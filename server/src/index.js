/**
 * Server entry point
 * Bootstraps the Express application, registers all route groups,
 * connects to MongoDB, and starts the HTTP server.
 *
 * Startup sequence:
 *   1. Load environment variables via dotenv.
 *   2. Create Express app and register global middleware (CORS, JSON body parser).
 *   3. Mount all nine API route groups under their /api/* prefixes.
 *   4. Add a /health endpoint for uptime checks and load balancer probes.
 *   5. Register a global error handler as the last middleware.
 *   6. Connect to MongoDB — only start listening after a successful connection
 *      so the server never accepts requests without a database.
 *   7. Register cron jobs after the DB is ready (models must be initialised first).
 *
 * Route map:
 *   POST/GET  /api/auth/*              — register, login, get current user
 *   CRUD      /api/patients/*          — patient demographics
 *   CRUD      /api/appointments/*      — appointment scheduling
 *   CRUD      /api/medical-records/*   — EHR visit records
 *   CRUD      /api/prescriptions/*     — medication prescriptions
 *   CRUD      /api/lab-orders/*        — lab test orders and results
 *   CRUD      /api/invoices/*          — billing documents
 *   CRUD      /api/wards/*             — ward and bed management
 *   POST      /api/ai/*               — six AI features (rate-limited 10 req/min)
 *   GET/PUT   /api/users/*            — user management (list staff, update role/status)
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import { registerCronJobs } from './scripts/seedCronJobs.js';

import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import medicalRecordRoutes from './routes/medicalRecordRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import labOrderRoutes from './routes/labOrderRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import wardRoutes from './routes/wardRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

// ── Global middleware ──────────────────────────────────────────────────────
// Allow requests from the React dev server (5173) or configured CLIENT_URL
app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }));

// Parse incoming JSON request bodies (makes req.body available in controllers)
app.use(express.json());

// ── API route groups ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/lab-orders', labOrderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/ai', aiRoutes);
// User management (non-auth): list staff, deactivate accounts, change roles
app.use('/api/users', userRoutes);

// ── Utility endpoints ──────────────────────────────────────────────────────
// Health check — returns 200 { status: 'ok' } for uptime monitoring
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ───────────────────────────────────────────────────
// Catches any unhandled errors thrown inside route handlers.
// Must be the LAST middleware registered (Express identifies error handlers
// by the four-argument signature: err, req, res, next).
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT ?? 5000;

// Connect to MongoDB first, then start listening — ensures no requests are
// accepted before the database connection is ready
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // Register cron jobs after the DB is connected so Mongoose models are ready
      registerCronJobs();
    });
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1); // crash fast so the process manager can restart the server
  });

// Export app for use in integration tests (supertest imports this)
export default app;
