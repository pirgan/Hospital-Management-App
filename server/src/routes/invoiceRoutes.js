/**
 * Invoice routes
 * Billing is restricted to admin and receptionist for most operations.
 * Patients can view their own invoices (GET /:id) to see what they owe.
 *
 * The /pay endpoint uses PATCH because it only updates status + paidAt —
 * the rest of the invoice document (line items, total, etc.) is not changed
 * when recording a payment.
 *
 * Role matrix:
 *   GET    /          — admin, receptionist (billing queue view)
 *   POST   /          — admin, receptionist (create new invoice)
 *   GET    /:id       — admin, receptionist, patient (patients view their own)
 *   PUT    /:id       — admin, receptionist (edit line items, dates, insurance)
 *   PATCH  /:id/pay   — admin, receptionist (record payment)
 */
import { Router } from 'express';
import {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  markPaid,
} from '../controllers/invoiceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { audit } from '../middleware/auditMiddleware.js';

const router = Router();

router.use(protect, audit);

router.route('/')
  .get(requireRole('admin', 'receptionist'), getInvoices)
  .post(requireRole('admin', 'receptionist'), createInvoice);

router.route('/:id')
  .get(requireRole('admin', 'receptionist', 'patient'), getInvoice)
  .put(requireRole('admin', 'receptionist'), updateInvoice);

router.patch('/:id/pay', requireRole('admin', 'receptionist'), markPaid);

export default router;
