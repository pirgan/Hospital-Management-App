/**
 * Appointment routes
 * Manages scheduling, rescheduling, and cancellation of appointments.
 *
 * Role matrix:
 *   GET    /     — any authenticated user (doctors see their schedule, patients see their own)
 *   POST   /     — admin, receptionist, doctor (those who create bookings)
 *   GET    /:id  — any authenticated user
 *   PUT    /:id  — admin, receptionist, doctor (status changes, rescheduling)
 *   DELETE /:id  — admin, receptionist (hard-cancel; audit log captures who deleted it)
 *
 * Note: access control for patients viewing only their own appointments should be
 * enforced in the controller if a patient role is added to the GET handlers.
 */
import { Router } from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointment,
  updateAppointment,
  deleteAppointment,
} from '../controllers/appointmentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { audit } from '../middleware/auditMiddleware.js';

const router = Router();

router.use(protect, audit);

router.route('/')
  .get(getAppointments)
  .post(requireRole('admin', 'receptionist', 'doctor'), createAppointment);

router.route('/:id')
  .get(getAppointment)
  .put(requireRole('admin', 'receptionist', 'doctor'), updateAppointment)
  .delete(requireRole('admin', 'receptionist'), deleteAppointment);

export default router;
