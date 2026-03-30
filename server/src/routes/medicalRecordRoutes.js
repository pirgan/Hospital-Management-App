/**
 * Medical record routes
 * Protects EHR data — only clinical staff can access medical records.
 * Patients cannot directly read raw medical records through this API
 * (they see a summarised view via the AI summarisation endpoint instead).
 *
 * Role matrix:
 *   GET    /     — admin, doctor, nurse (clinical viewing rights)
 *   POST   /     — doctor only (only doctors author EHR records)
 *   GET    /:id  — admin, doctor, nurse
 *   PUT    /:id  — doctor only (only the clinician can amend their own records)
 */
import { Router } from 'express';
import {
  createRecord,
  getRecords,
  getRecord,
  updateRecord,
} from '../controllers/medicalRecordController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { audit } from '../middleware/auditMiddleware.js';

const router = Router();

router.use(protect, audit);

router.route('/')
  .get(requireRole('admin', 'doctor', 'nurse'), getRecords)
  .post(requireRole('doctor'), createRecord);

router.route('/:id')
  .get(requireRole('admin', 'doctor', 'nurse'), getRecord)
  .put(requireRole('doctor'), updateRecord);

export default router;
