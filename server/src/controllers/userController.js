/**
 * User controller
 * Handles non-auth user management operations.
 *
 * These endpoints exist separately from /auth because:
 *   - Auth endpoints deal with credentials (login, register, token refresh).
 *   - User management endpoints deal with profile data and status (role, isActive, department).
 *
 * Password is always excluded from query results via .select('-password') so it is
 * never sent over the wire, even accidentally.
 */
import User from '../models/User.js';

/**
 * getUsers
 * GET /api/users
 * Returns all users sorted by name. Optionally filter by role via ?role=doctor.
 *
 * Use-cases:
 *   - AppointmentCalendar: fetches /users?role=doctor to populate the doctor filter dropdown
 *   - AppointmentBook: fetches /users?role=doctor to populate the booking form
 *   - AdminPanel: fetches /users (no filter) for the full staff table
 *
 * @query {string} [role] — if provided, only users with this role are returned
 * @returns {User[]} array of user documents without the password field
 */
export const getUsers = async (req, res) => {
  try {
    // Match primary role or secondaryRoles (e.g. admin who is also a doctor appears in ?role=doctor)
    const filter = req.query.role
      ? { $or: [{ role: req.query.role }, { secondaryRoles: req.query.role }] }
      : {};

    // .select('-password') removes the hashed password from the result projection.
    // .sort({ name: 1 }) alphabetical order makes dropdown lists easier to scan.
    const users = await User.find(filter).select('-password').sort({ name: 1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * updateUser
 * PUT /api/users/:id
 * Partial update of a user's profile fields. Admin-only.
 *
 * Allowed fields: name, isActive, department, role.
 * The body is passed directly to findByIdAndUpdate; runValidators ensures
 * Mongoose schema constraints (e.g. enum on role) are enforced on updates.
 *
 * @param {string} req.params.id — MongoDB ObjectId of the user to update
 * @body {string}  [name]        — updated display name
 * @body {boolean} [isActive]    — true = active account, false = deactivated
 * @body {string}  [department]  — clinical department (e.g. "Cardiology")
 * @body {string}  [role]        — one of the allowed role enum values
 * @returns {User} the updated user document without the password field
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // { new: true } returns the updated document rather than the original.
    // { runValidators: true } ensures the role enum and other validators fire on update.
    const user = await User.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).select('-password'); // never expose the password hash

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
