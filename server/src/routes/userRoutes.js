/**
 * User routes
 * Non-auth user management endpoints (profile data, status, role).
 *
 * Route matrix:
 *   GET  /        — any authenticated user (needed by appointment booking to list doctors)
 *   PUT  /:id     — admin only (changing roles, deactivating accounts)
 *
 * Both routes require a valid JWT (protect) and all write operations are
 * logged via the audit middleware.
 */
import { Router } from 'express';
import { getUsers, updateUser } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { audit } from '../middleware/auditMiddleware.js';

const router = Router();

// Apply JWT verification and audit logging at router level so both routes are covered
router.use(protect, audit);

// GET / — returns all users, optionally filtered by ?role=doctor
// Any authenticated user may list users (e.g. to populate a doctor dropdown)
router.get('/', getUsers);

// PUT /:id — update a user's profile/status; restricted to admin only
router.put('/:id', requireRole('admin'), updateUser);

export default router;
