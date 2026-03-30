/**
 * Prescription routes
 * Separates prescription authoring (doctor) from dispensing (nurse).
 * This matches the real-world clinical workflow where prescribing and
 * dispensing are distinct, audited steps performed by different roles.
 *
 * Role matrix:
 *   GET    /                  — any authenticated user (doctors, nurses, patients)
 *   POST   /                  — doctor only (prescribing authority)
 *   GET    /:id               — any authenticated user
 *   PUT    /:id               — doctor only (amend medications, cancel)
 *   PATCH  /:id/dispense      — nurse, admin (medication administration record)
 */
import { Router } from 'express';
import {
  createPrescription,
  getPrescriptions,
  getPrescription,
  updatePrescription,
  dispensePrescription,
} from '../controllers/prescriptionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { audit } from '../middleware/auditMiddleware.js';

const router = Router();

router.use(protect, audit);

router.route('/')
  .get(getPrescriptions)
  .post(requireRole('doctor'), createPrescription);

router.route('/:id')
  .get(getPrescription)
  .put(requireRole('doctor'), updatePrescription);

// Separate PATCH endpoint for dispensing — different role requirement from update
router.patch('/:id/dispense', requireRole('nurse', 'admin'), dispensePrescription);

export default router;
