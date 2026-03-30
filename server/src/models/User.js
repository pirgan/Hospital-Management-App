/**
 * User model
 * Represents all staff and patient accounts in the system.
 * The `role` field drives RBAC — the six roles are:
 *   secondaryRoles — optional extra hats (e.g. admin who is also a clinician)
 *
 * Primary role enum:
 *   admin        — full system access, user management, reports
 *   doctor       — EHR, prescriptions, lab orders, AI assistant
 *   nurse        — vitals entry, ward management, medication dispensing
 *   patient      — view own appointments, records, invoices
 *   receptionist — patient registration, appointment booking
 *   lab_tech     — process lab orders, upload results
 *
 * Passwords are hashed with bcrypt (salt rounds = 12) in a pre-save hook
 * so the plain-text password is never stored in MongoDB.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 8 },
    role: {
      type: String,
      enum: ['admin', 'doctor', 'nurse', 'patient', 'receptionist', 'lab_tech'],
      required: true,
    },
    /** Additional roles for users who need more than one hat (checked alongside `role` in RBAC) */
    secondaryRoles: {
      type: [String],
      default: [],
      validate: {
        validator(arr) {
          const allowed = ['admin', 'doctor', 'nurse', 'patient', 'receptionist', 'lab_tech'];
          return Array.isArray(arr) && arr.every((r) => allowed.includes(r));
        },
        message: 'Invalid secondary role value',
      },
    },
    department: { type: String, trim: true },       // e.g. "Cardiology", "Emergency"
    licenseNumber: { type: String, trim: true },    // medical licence for doctors/nurses
    isActive: { type: Boolean, default: true },     // soft-disable without deleting the account
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

/**
 * Pre-save hook — hash the password before writing to the database.
 * Only runs when the password field has been modified to avoid re-hashing
 * on unrelated updates (e.g. changing a user's department).
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

/**
 * Instance method — compares a candidate plain-text password against the stored hash.
 * Used by authController.login to validate credentials.
 *
 * @param {string} entered - The plain-text password from the login request body.
 * @returns {Promise<boolean>} true if the password matches, false otherwise.
 */
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

/**
 * toJSON override — removes the password field whenever the document is serialised
 * to JSON (e.g. when sent in an API response). This ensures the hash is never
 * accidentally leaked to the client.
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);
