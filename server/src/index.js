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
import app from './app.js';
import connectDB from './config/db.js';
import { registerCronJobs } from './scripts/seedCronJobs.js';

const PORT = process.env.PORT ?? 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      registerCronJobs();
    });
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });

export default app;
