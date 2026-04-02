/**
 * AI routes
 * All endpoints are protected by JWT auth AND the AI rate limiter (10 req/min per user).
 * The rate limiter is applied at the router level so it covers every AI route.
 *
 * Role restrictions:
 *   /differential     — doctors only (clinical decision support)
 *   /summarize        — doctors, nurses, admins (read access to patient history)
 *   /discharge-summary— doctors and admins (formal clinical document generation)
 *   /interactions     — doctors, nurses, admins (medication safety check)
 *   /schedule-intent  — receptionists, doctors, admins (booking assistant)
 *   /chatbot          — all authenticated users (clinical protocol reference)
 */
import { Router } from 'express';
import {
  differentialDiagnosis,
  streamDifferentialDiagnosis,
  summarizeRecord,
  generateDischargeSummary,
  checkInteractions,
  parseAppointmentIntent,
  protocolChatbot,
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { aiRateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Apply JWT verification and rate limiting to every route in this file
router.use(protect, aiRateLimit);

router.post('/differential', requireRole('doctor'), differentialDiagnosis);
router.post('/differential-diagnosis', requireRole('doctor'), streamDifferentialDiagnosis);
router.get('/summarize/:patientId', requireRole('doctor', 'nurse', 'admin'), summarizeRecord);
router.post('/discharge-summary', requireRole('doctor', 'admin'), generateDischargeSummary);
router.post('/interactions', requireRole('doctor', 'nurse', 'admin'), checkInteractions);
router.post('/schedule-intent', requireRole('receptionist', 'doctor', 'admin'), parseAppointmentIntent);
router.post('/chatbot', protocolChatbot); // all authenticated users can use the chatbot

export default router;
