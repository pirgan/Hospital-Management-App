/**
 * Role-based access control (RBAC) middleware
 * Used after the `protect` middleware to restrict routes to specific user roles.
 *
 * The six roles are: admin, doctor, nurse, patient, receptionist, lab_tech
 *
 * Usage in a route file:
 *   router.post('/patients', protect, requireRole('admin', 'receptionist'), createPatient)
 *
 * requireRole is a factory function — it takes the allowed roles as arguments and
 * returns an Express middleware function that checks req.user.role at request time.
 * Using a factory keeps route definitions readable and avoids repeating the check logic.
 */

/**
 * userHasAnyRole — true if primary `role` or any `secondaryRoles` is in the allowed list.
 */
export const userHasAnyRole = (user, roles) => {
  if (!user) return false;
  if (roles.includes(user.role)) return true;
  const extra = user.secondaryRoles;
  if (!Array.isArray(extra) || extra.length === 0) return false;
  return extra.some((r) => roles.includes(r));
};

/**
 * requireRole(...roles) — RBAC guard factory.
 *
 * @param {...string} roles - One or more role strings that are allowed to access the route.
 * @returns Express middleware that returns 403 if the authenticated user's role
 *          is not in the allowed list, or calls next() if it is.
 */
export const requireRole = (...roles) =>
  (req, res, next) => {
    if (!userHasAnyRole(req.user, roles)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    next();
  };
