/**
 * MedicalRecord model
 * Represents a single clinical encounter — the core EHR document.
 * Created by a doctor after each patient visit and linked to an appointment.
 *
 * The $text index on chiefComplaint and treatmentPlan enables the RAG chatbot
 * in aiController.protocolChatbot to perform full-text keyword searches across
 * all medical records when finding relevant clinical protocol chunks.
 *
 * AI fields:
 *   aiDifferentialDiagnosis — populated by aiController.differentialDiagnosis (Sonnet SSE)
 *   aiRiskScore             — overall patient risk score from 0–100
 */
import mongoose from 'mongoose';

const medicalRecordSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    visitDate: { type: Date, required: true },
    chiefComplaint: { type: String, required: true }, // patient's primary reason for visit

    // Vital signs recorded at the visit
    vitals: {
      height: Number,       // cm
      weight: Number,       // kg
      bloodPressure: String, // e.g. "140/90"
      pulse: Number,        // bpm
      temperature: Number,  // °C
      o2Saturation: Number, // percentage (SpO2)
    },

    // Array of diagnoses — a visit can have multiple (primary + secondary)
    diagnoses: [
      {
        icd10Code: String,    // e.g. "I10" for Essential Hypertension
        description: String,
        type: { type: String, enum: ['primary', 'secondary', 'differential'] },
      },
    ],

    treatmentPlan: { type: String },
    followUpDate: { type: Date },

    // AI-generated ranked differential diagnoses from the Sonnet SSE endpoint
    aiDifferentialDiagnosis: [
      {
        diagnosis: String,
        confidence: Number, // 0–100 confidence score
        reasoning: String,
      },
    ],
    aiRiskScore: { type: Number }, // composite risk score calculated by AI
  },
  { timestamps: true }
);

// Full-text index so MongoDB can search across the most clinically relevant free-text fields.
// Used by the RAG chatbot keyword search step.
medicalRecordSchema.index({ chiefComplaint: 'text', treatmentPlan: 'text' });

export default mongoose.model('MedicalRecord', medicalRecordSchema);
