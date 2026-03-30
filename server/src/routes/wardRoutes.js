/**
 * Ward routes
 * Manages physical ward and bed state.
 *
 * /admit and /discharge are POST routes (not PUT /:id) because they operate
 * on a specific bed within a ward, identified by the wardId + bedNumber in
 * the request body — they don't map cleanly to a single resource ID in the URL.
 *
 * Ward creation is restricted to admin because ward structure (number of beds,
 * type, floor) reflects physical hospital layout — it rarely changes and
 * requires administrative approval.
 *
 * Bed operations (admit/discharge) are allowed for nurses and doctors because
 * they are the staff who physically manage patient placement.
 *
 * Role matrix:
 *   GET    /          — any authenticated user (ward map is visible to all clinical staff)
 *   POST   /          — admin only (create a new ward)
 *   GET    /:id       — any authenticated user
 *   POST   /admit     — admin, nurse, doctor
 *   POST   /discharge — admin, nurse, doctor
 *
 * Note: /admit and /discharge are registered before /:id to prevent Express
 * from treating "admit" and "discharge" as :id parameter values.
 */
import { Router } from 'express';
import {
  createWard,
  getWards,
  getWard,
  admitPatient,
  dischargePatient,
} from '../controllers/wardController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { audit } from '../middleware/auditMiddleware.js';

const router = Router();

router.use(protect, audit);

router.route('/')
  .get(getWards)
  .post(requireRole('admin'), createWard);

// Specific action routes registered before the /:id wildcard route
router.post('/admit', requireRole('admin', 'nurse', 'doctor'), admitPatient);
router.post('/discharge', requireRole('admin', 'nurse', 'doctor'), dischargePatient);

// Wildcard — matches any :id that isn't "admit" or "discharge"
router.get('/:id', getWard);

export default router;
