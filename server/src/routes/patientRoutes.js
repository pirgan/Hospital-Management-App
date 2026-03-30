/**
 * Patient routes
 * All routes require JWT authentication and audit logging.
 *
 * Role matrix:
 *   GET    /           — any authenticated user (all roles need to look up patients)
 *   POST   /           — admin, receptionist, doctor (those who register patients)
 *   GET    /:id        — any authenticated user
 *   PUT    /:id        — admin, doctor, receptionist (those who update records)
 *   DELETE /:id        — admin only (hard delete; consider soft-delete for production)
 *
 * The audit middleware logs all write operations (POST, PUT, DELETE) to the console.
 * It is applied at the router level so it covers every route automatically.
 */
import { Router } from 'express';
import {
  createPatient,
  getPatients,
  getPatient,
  updatePatient,
  deletePatient,
} from '../controllers/patientController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { audit } from '../middleware/auditMiddleware.js';

const router = Router();

// Apply JWT verification and audit logging to all patient routes
router.use(protect, audit);

router.route('/')
  .get(getPatients)
  .post(requireRole('admin', 'receptionist', 'doctor'), createPatient);

router.route('/:id')
  .get(getPatient)
  .put(requireRole('admin', 'doctor', 'receptionist'), updatePatient)
  .delete(requireRole('admin'), deletePatient);

export default router;
