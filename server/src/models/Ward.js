/**
 * Ward model
 * Represents a hospital ward and all of its physical beds.
 * The beds array is embedded inside the Ward document (rather than a separate
 * collection) because beds are always read together with their ward, and the
 * total number of beds per ward is small enough that an embedded array is efficient.
 *
 * Bed status values:
 *   available — empty and ready for admission
 *   occupied  — patient is currently admitted (patient ref + admittedAt are set)
 *   reserved  — held for a scheduled admission (patient ref may or may not be set)
 *
 * The admit/discharge operations (wardController.admitPatient / dischargePatient)
 * find the target bed by number within the ward document and mutate its status inline,
 * then save the whole ward document in one atomic MongoDB write.
 */
import mongoose from 'mongoose';

const wardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "General Ward A"
    type: {
      type: String,
      enum: ['general', 'ICU', 'pediatric', 'maternity', 'surgical'],
      required: true,
    },
    floor: { type: Number }, // building floor number
    capacity: { type: Number, required: true }, // total number of beds

    // Each element represents one physical bed in the ward
    beds: [
      {
        number: { type: String, required: true }, // e.g. "G-01"
        status: {
          type: String,
          enum: ['available', 'occupied', 'reserved'],
          default: 'available',
        },
        patient: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Patient',
          default: null, // null when the bed is not occupied
        },
        admittedAt: { type: Date, default: null }, // when the current patient was admitted
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Ward', wardSchema);
