/**
 * Auth routes
 * Public endpoints for authentication — no JWT required on register and login.
 * /me is protected so users can fetch their own profile after logging in.
 *
 * In production, /register would typically be restricted to admin users
 * to prevent self-service account creation with arbitrary roles.
 */
import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);       // create a new account (returns JWT)
router.post('/login', login);             // authenticate and return JWT
router.get('/me', protect, getMe);        // get current user profile (JWT required)

export default router;
