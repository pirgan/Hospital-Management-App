/**
 * Authentication middleware
 * Verifies the JWT Bearer token sent in the Authorization header on every protected route.
 * On success, attaches the full User document to req.user so downstream middleware
 * and controllers can read the authenticated user's id, role, etc. without re-querying.
 */
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * protect — Express middleware that guards routes behind JWT authentication.
 *
 * Flow:
 *  1. Extract the Bearer token from the Authorization header.
 *  2. Verify the token signature and expiry with JWT_SECRET.
 *  3. Load the matching User from MongoDB (excluding the password field).
 *  4. Reject deactivated accounts so suspended users can't access the API.
 *  5. Attach the user to req.user and call next() to continue the request chain.
 *
 * Returns 401 for missing/invalid/expired tokens or inactive users.
 */
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Expect format: "Bearer <token>"
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorised, no token' });
  }

  try {
    const token = authHeader.split(' ')[1];

    // jwt.verify throws if the token is expired or the signature doesn't match JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data — ensures revoked/deactivated accounts are caught
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ message: 'Not authorised, user inactive' });
    }

    next();
  } catch {
    res.status(401).json({ message: 'Not authorised, token invalid' });
  }
};
