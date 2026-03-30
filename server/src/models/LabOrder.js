/**
 * LabOrder model
 * Represents a doctor's request for laboratory tests on a patient sample.
 *
 * Status lifecycle:
 *   ordered → in-progress → completed
 *           → cancelled
 *
 * Priority levels affect how the order appears in the lab tech's queue:
 *   routine — standard processing
 *   urgent  — process within 4 hours
 *   stat    — process immediately (shown in red in the Lab Results UI)
 *
 * When a lab tech enters results via the enterResults endpoint, each result
 * in the results array can be flagged (flagged: true) to indicate an
 * abnormal value. Flagged results trigger a visual alert in the EHR view.
 *
 * reportFile stores the Cloudinary URL for the uploaded PDF/image report,
 * set when the lab tech uploads the document along with the results.
 */
import mongoose from 'mongoose';

const labOrderSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medicalRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },

    tests: [{ type: String }], // e.g. ["CBC", "Metabolic Panel", "HbA1c"]

    priority: {
      type: String,
      enum: ['routine', 'urgent', 'stat'],
      default: 'routine',
    },
    status: {
      type: String,
      enum: ['ordered', 'in-progress', 'completed', 'cancelled'],
      default: 'ordered',
    },

    // Populated by the lab tech when results are ready
    results: [
      {
        testName: String,
        value: String,         // stored as string to handle ranges like ">100"
        unit: String,          // e.g. "g/dL", "mmol/L"
        referenceRange: String, // e.g. "4.0-11.0"
        flagged: { type: Boolean, default: false }, // true = outside reference range
      },
    ],

    reportFile: { type: String }, // Cloudinary secure URL for the uploaded report document
    notes: { type: String },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // lab tech who completed it
  },
  { timestamps: true }
);

export default mongoose.model('LabOrder', labOrderSchema);
