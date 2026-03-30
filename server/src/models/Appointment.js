/**
 * Appointment model
 * Represents a scheduled meeting between a patient and a doctor.
 *
 * Status lifecycle:
 *   scheduled → confirmed → completed
 *                         → cancelled
 *                         → no-show
 *
 * The `reminderSent` flag is set to true by the daily cron job (seedCronJobs.js)
 * after it emails the patient, preventing duplicate reminders on the next run.
 *
 * The `type` field drives how the appointment appears in the calendar UI
 * and determines which AI features are offered (e.g. emergency appointments
 * get priority routing in the differential diagnosis feature).
 */
import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledAt: { type: Date, required: true },
    duration: { type: Number, default: 30 }, // duration in minutes
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'],
      default: 'scheduled',
    },
    type: {
      type: String,
      enum: ['consultation', 'follow-up', 'procedure', 'emergency'],
      required: true,
    },
    notes: { type: String },

    // Tracks whether the 24-hour reminder email has been sent by the cron job
    reminderSent: { type: Boolean, default: false },

    // Who booked the appointment (could be receptionist, doctor, or the patient themselves)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Appointment', appointmentSchema);
