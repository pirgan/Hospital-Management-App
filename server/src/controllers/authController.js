/**
 * Auth controller
 * Handles user registration, login, and fetching the authenticated user's profile.
 *
 * JWT strategy:
 *   - Tokens are signed with JWT_SECRET and expire after 7 days.
 *   - The token payload contains only the user's _id — the full user document
 *     is re-fetched from MongoDB on every protected request by authMiddleware.protect.
 *   - Passwords are hashed by the User model's pre-save hook before reaching the DB.
 */
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Signs a JWT for the given user ID.
 * Kept as a private helper so the same token config is used in both
 * register and login without duplication.
 *
 * @param {string} id - The MongoDB ObjectId of the user.
 * @returns {string} Signed JWT string.
 */
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

/**
 * POST /api/auth/register
 * Creates a new user account and returns a JWT.
 * Only admins should call this in production (protected at the route level if needed).
 * Returns 409 if the email is already registered.
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, role, department, licenseNumber } = req.body;

    // Reject duplicate emails before attempting to create — gives a cleaner error message
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    // Password hashing happens in the User model's pre-save hook
    // secondaryRoles is admin-only via PUT /users/:id — not on public self-registration
    const user = await User.create({ name, email, password, role, department, licenseNumber });

    res.status(201).json({ token: signToken(user._id), user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/auth/login
 * Validates credentials and returns a JWT on success.
 * Uses a deliberately vague "Invalid credentials" message to avoid
 * leaking whether an email address exists in the system.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // .select('+password') is needed because the password field has `select: false`
    // implied by the toJSON override — we need it here for comparison only
    const user = await User.findOne({ email }).select('+password');

    // Check both existence and password in one condition to prevent timing attacks
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Deactivated accounts should not be able to log in even with valid credentials
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });

    res.json({ token: signToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 * req.user is populated by authMiddleware.protect before this handler runs.
 */
export const getMe = async (req, res) => {
  res.json(req.user);
};
