/**
 * Lab order routes
 * Mirrors the real-world lab workflow:
 *   doctors order tests → lab techs process them → lab techs enter results.
 *
 * The /results endpoint uses PATCH (partial update) rather than PUT (full replace)
 * because entering results only modifies the results, status, and processedBy fields —
 * the rest of the order document stays unchanged.
 *
 * Role matrix:
 *   GET    /                 — any authenticated user
 *   POST   /                 — doctor only (ordering authority)
 *   GET    /:id              — any authenticated user
 *   PUT    /:id              — doctor, lab_tech, admin (general updates, cancellation)
 *   PATCH  /:id/results      — lab_tech, admin (result entry)
 */
import { Router } from 'express';
import {
  createLabOrder,
  getLabOrders,
  getLabOrder,
  updateLabOrder,
  enterResults,
} from '../controllers/labOrderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { audit } from '../middleware/auditMiddleware.js';

const router = Router();

router.use(protect, audit);

router.route('/')
  .get(getLabOrders)
  .post(requireRole('doctor'), createLabOrder);

router.route('/:id')
  .get(getLabOrder)
  .put(requireRole('doctor', 'lab_tech', 'admin'), updateLabOrder);

// Dedicated results endpoint — lab_tech is the primary role for this action
router.patch('/:id/results', requireRole('lab_tech', 'admin'), enterResults);

export default router;
