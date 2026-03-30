/**
 * Invoice model
 * Represents a billing document issued to a patient after a medical encounter.
 *
 * Status lifecycle:
 *   draft → sent → paid
 *               → overdue  (set automatically by hourly cron job in seedCronJobs.js
 *                           when dueDate has passed and status is still 'sent')
 *
 * lineItems is an array of individual charges (consultation fee, procedure, medications, etc.)
 * totalAmount is stored denormalised for fast querying — must be recalculated whenever
 * lineItems change.
 *
 * insuranceClaim tracks whether the hospital has filed a claim with the patient's
 * insurer and what the outcome was.
 */
import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

    // Individual line items that make up the invoice
    lineItems: [
      {
        description: { type: String, required: true }, // e.g. "Consultation Fee"
        qty: { type: Number, default: 1 },
        unitPrice: { type: Number, required: true },   // in the local currency (pence/cents)
      },
    ],

    totalAmount: { type: Number, required: true }, // sum of qty × unitPrice for all line items

    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue'],
      default: 'draft',
    },

    insuranceClaim: {
      provider: String,     // insurance company name
      policyNumber: String,
      claimStatus: {
        type: String,
        enum: ['pending', 'approved', 'denied', 'not_filed'],
      },
    },

    dueDate: { type: Date },  // when payment is expected — cron checks this hourly
    paidAt: { type: Date },   // set by the markPaid endpoint
  },
  { timestamps: true }
);

export default mongoose.model('Invoice', invoiceSchema);
