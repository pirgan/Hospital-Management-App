/**
 * Patient model
 * Stores the demographic and medical background for every registered patient.
 * This is the central record that all other models (appointments, records,
 * prescriptions, lab orders, invoices, ward beds) reference via ObjectId.
 *
 * Key design decisions:
 *   - nhsNumber is unique — used as the human-readable patient identifier
 *   - allergies and chronicConditions are simple string arrays for fast read/display
 *   - aiSummary caches the latest AI-generated patient summary to avoid
 *     re-calling Claude on every page load (invalidated when new records are added)
 */
import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    nhsNumber: { type: String, unique: true, required: true, trim: true },

    // Nested objects for contact details — stored inline rather than as
    // separate collections since they're always fetched together with the patient
    contactInfo: {
      phone: String,
      email: String,
      address: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },

    allergies: [{ type: String }],              // e.g. ["Penicillin", "Sulfa drugs"]
    chronicConditions: [{ type: String }],      // e.g. ["Type 2 Diabetes", "Hypertension"]

    insuranceDetails: {
      provider: String,
      policyNumber: String,
      groupNumber: String,
    },

    // Tracks who registered this patient for audit purposes
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Cached AI summary from aiController.summarizeRecord — null until first AI call
    aiSummary: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Patient', patientSchema);
