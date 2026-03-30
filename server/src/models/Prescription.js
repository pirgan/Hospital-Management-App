/**
 * Prescription model
 * Records medications prescribed during a clinical encounter.
 *
 * Status lifecycle:
 *   active → dispensed  (nurse marks as dispensed after giving medication to patient)
 *          → cancelled  (doctor cancels before dispensing)
 *
 * The aiInteractionCheck sub-document stores the result of the medication
 * interaction check performed by aiController.checkInteractions before the
 * prescription is saved. If `safe` is false, the UI shows a warning modal
 * (InteractionWarning.jsx) requiring the doctor to confirm before proceeding.
 *
 * dispensedBy and dispensedAt track which nurse dispensed the medication
 * and when, for medication administration record (MAR) compliance.
 */
import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medicalRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },

    // A prescription can contain multiple medications in one document
    medications: [
      {
        name: { type: String, required: true },
        dosage: String,       // e.g. "10 mg"
        frequency: String,    // e.g. "twice daily"
        duration: String,     // e.g. "7 days"
        instructions: String, // e.g. "take with food"
      },
    ],

    status: {
      type: String,
      enum: ['active', 'dispensed', 'cancelled'],
      default: 'active',
    },

    // Filled in when a nurse dispenses the medication via the dispense endpoint
    dispensedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dispensedAt: { type: Date },

    // Result of the AI interaction check — stored here so it's auditable
    aiInteractionCheck: {
      checkedAt: Date,
      interactions: [
        {
          drug1: String,
          drug2: String,
          severity: String,     // "mild" | "moderate" | "severe"
          description: String,
        },
      ],
      safe: Boolean, // false if any severe/moderate interaction was detected
    },
  },
  { timestamps: true }
);

export default mongoose.model('Prescription', prescriptionSchema);
