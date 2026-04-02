/**
 * AI controller
 * Implements all six AI-powered features using the Anthropic Claude API.
 *
 * Model selection strategy:
 *   - claude-sonnet-4-6  — complex reasoning tasks (differential diagnosis, discharge summaries)
 *   - claude-haiku-4-5   — fast, low-cost tasks (summarisation, interaction checks, intent parsing)
 *
 * Features overview:
 *   1. differentialDiagnosis     — Sonnet, streaming SSE, ranked diagnoses with confidence scores
 *   2. summarizeRecord           — Haiku, JSON mode, cached on Patient.aiSummary
 *   3. generateDischargeSummary  — Sonnet, streaming SSE, saved to Cloudinary as .txt
 *   4. checkInteractions         — Haiku, JSON mode, drug-drug interaction detection
 *   5. parseAppointmentIntent    — Haiku, JSON mode, natural language → structured booking data
 *   6. protocolChatbot           — Two-model RAG: Haiku extracts keywords → $text search → Sonnet answers
 *
 * All endpoints are rate-limited to 10 req/min per user by aiRateLimit middleware.
 */
import { anthropic } from '../config/anthropic.js';
import Patient from '../models/Patient.js';
import MedicalRecord from '../models/MedicalRecord.js';
import ProtocolChunk from '../models/ProtocolChunk.js';
import cloudinary from '../config/cloudinary.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Differential Diagnosis — Sonnet, streaming SSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/differential
 * Streams a ranked list of differential diagnoses via Server-Sent Events.
 *
 * SSE format: each chunk is sent as `data: {"text": "..."}\n\n`
 * The stream ends with `data: [DONE]\n\n` so the client knows when to close.
 *
 * The model is prompted to return each diagnosis as a JSON object with rank,
 * diagnosis name, confidence score (0–100), and clinical reasoning. The client
 * (AIAssistantPanel.jsx) parses these objects as they arrive to render a live
 * updating list without waiting for the full response.
 *
 * @body symptoms  — free-text description of presenting symptoms
 * @body vitals    — vitals object from the current medical record
 * @body patientId — optional; if provided, clears the old aiDifferentialDiagnosis cache
 */
export const differentialDiagnosis = async (req, res) => {
  const { symptoms, vitals, patientId } = req.body;

  // Set SSE headers — this keeps the HTTP connection open for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // anthropic.messages.stream returns an async iterable of streaming events
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        'You are a clinical decision support assistant. Return ranked differential diagnoses with confidence scores (0-100) and brief reasoning. Format each as JSON: {"rank":1,"diagnosis":"...","confidence":85,"reasoning":"..."}',
      messages: [
        {
          role: 'user',
          content: `Patient symptoms: ${symptoms}\nVitals: ${JSON.stringify(vitals)}\nGenerate top 5 differential diagnoses.`,
        },
      ],
    });

    // Forward each text delta to the client as an SSE event
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    // Optionally clear the cached diagnoses on the most recent record for this patient
    if (patientId) {
      await MedicalRecord.findOneAndUpdate(
        { patient: patientId },
        { $set: { aiDifferentialDiagnosis: [] } },
        { sort: { createdAt: -1 } }
      );
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    // Send the error as an SSE event so the client can display it gracefully
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1b. Differential Diagnosis (v2) — Sonnet, streaming SSE, full clinical context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/differential-diagnosis
 * Streams a ranked differential diagnosis list via Server-Sent Events.
 *
 * Accepts a richer clinical context than the legacy /differential endpoint:
 *   chiefComplaint (required), vitals, allergies[], chronicConditions[]
 *
 * SSE format: each delta is `data: {"chunk":"..."}\n\n`
 * Stream ends with `data: [DONE]\n\n`
 *
 * If recordId is provided, the complete generated text is persisted to
 * MedicalRecord.aiDifferentialDiagnosis once streaming finishes.
 *
 * @body chiefComplaint     — required; free-text presenting complaint
 * @body vitals             — optional vitals object (HR, BP, temp, SpO2, etc.)
 * @body allergies          — optional array of known allergy strings
 * @body chronicConditions  — optional array of pre-existing condition strings
 * @body recordId           — optional MedicalRecord _id; if given, saves result
 */
export const streamDifferentialDiagnosis = async (req, res) => {
  const { chiefComplaint, vitals, allergies = [], chronicConditions = [], recordId } = req.body;

  if (!chiefComplaint) {
    return res.status(400).json({ message: 'chiefComplaint is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const userPrompt = [
      `Chief Complaint: ${chiefComplaint}`,
      `Vitals: ${JSON.stringify(vitals ?? {})}`,
      `Allergies: ${allergies.length ? allergies.join(', ') : 'None reported'}`,
      `Chronic Conditions: ${chronicConditions.length ? chronicConditions.join(', ') : 'None reported'}`,
      '',
      'Generate a ranked differential diagnosis list.',
    ].join('\n');

    const stream = anthropic.messages.stream({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system:
        'You are a clinical decision support tool. Generate a ranked differential diagnosis. ' +
        "Format each item as: '1. [Diagnosis] — Confidence: X% — Next Steps: ...' " +
        'Always include a disclaimer that this is AI assistance, not a final diagnosis. ' +
        'Never recommend specific drug doses. 3-5 differentials maximum.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
        res.write(`data: ${JSON.stringify({ chunk: chunk.delta.text })}\n\n`);
      }
    }

    if (recordId) {
      await MedicalRecord.findByIdAndUpdate(recordId, {
        $set: { aiDifferentialDiagnosis: fullText },
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Medical Record Summarisation — Haiku, JSON mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ai/summarize/:patientId
 * Generates a concise AI summary of a patient's recent medical history.
 *
 * Uses Haiku (faster, cheaper) because summarisation is a straightforward
 * extraction task that doesn't need Sonnet's deeper reasoning.
 *
 * The system prompt instructs the model to return only valid JSON so the
 * response can be safely parsed without needing to strip markdown fences.
 *
 * The summary is cached to Patient.aiSummary to avoid re-calling Claude every
 * time the patient profile is opened. It should be invalidated (set to null)
 * when new medical records are created.
 */
export const summarizeRecord = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // Fetch the 5 most recent visits to keep the context window manageable
    const records = await MedicalRecord.find({ patient: patient._id })
      .sort({ visitDate: -1 })
      .limit(5);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:
        'You are a medical summarisation assistant. Return ONLY valid JSON: {"summary":"...","keyConditions":[],"recentMedications":[],"riskFlags":[]}',
      messages: [
        {
          role: 'user',
          content: `Summarise this patient's recent medical history:\n${JSON.stringify(records, null, 2)}`,
        },
      ],
    });

    const summary = JSON.parse(response.content[0].text);

    // Persist the plain-text summary to the patient document for future page loads
    await Patient.findByIdAndUpdate(patient._id, { aiSummary: summary.summary });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Discharge Summary Generator — Sonnet, streaming SSE + Cloudinary upload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/discharge-summary
 * Streams a formal discharge summary document and uploads the completed text to Cloudinary.
 *
 * Two-phase response:
 *   Phase 1 — SSE stream of text deltas while Claude is generating
 *   Phase 2 — Final SSE event with the Cloudinary URL once upload is complete
 *
 * The text is collected in `fullText` during streaming, then uploaded to Cloudinary
 * as a plain-text file in the 'discharge-summaries' folder.
 *
 * The upload uses the upload_stream API with a Promise wrapper because Cloudinary's
 * Node SDK doesn't natively support async/await for stream uploads.
 *
 * @body patientId        — patient to generate the summary for
 * @body admissionDate    — ISO date string
 * @body dischargeDate    — ISO date string
 * @body additionalNotes  — optional free-text notes from the discharging doctor
 */
export const generateDischargeSummary = async (req, res) => {
  const { patientId, admissionDate, dischargeDate, additionalNotes } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const patient = await Patient.findById(patientId);
    const records = await MedicalRecord.find({ patient: patientId })
      .populate('doctor', 'name')
      .sort({ visitDate: -1 })
      .limit(3);

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: 'You are a clinical documentation assistant generating formal hospital discharge summaries.',
      messages: [
        {
          role: 'user',
          content: `Generate a discharge summary for:
Patient: ${patient.fullName}, DOB: ${patient.dateOfBirth}
Admission: ${admissionDate}, Discharge: ${dischargeDate}
Records: ${JSON.stringify(records, null, 2)}
Notes: ${additionalNotes ?? 'None'}`,
        },
      ],
    });

    // Accumulate the full text while streaming deltas to the client
    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    // Upload the complete summary text to Cloudinary as a .txt file
    // upload_stream doesn't support promises natively, so we wrap it in one
    const buffer = Buffer.from(fullText, 'utf8');
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: 'discharge-summaries', format: 'txt' },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      uploadStream.end(buffer);
    });

    // Send the Cloudinary URL as a final SSE event so the client can link to the document
    res.write(`data: ${JSON.stringify({ fileUrl: uploadResult.secure_url })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Medication Interaction Checker — Haiku, JSON mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/interactions
 * Checks a list of medication names for drug-drug interactions.
 *
 * Returns a structured JSON result that the frontend InteractionWarning.jsx modal
 * uses to display any detected interactions before the doctor saves the prescription.
 *
 * Uses Haiku because interaction checking is a lookup/classification task —
 * it doesn't require the complex reasoning that Sonnet provides.
 *
 * @body medications — array of medication name strings, e.g. ["Warfarin", "Aspirin", "Metoprolol"]
 */
export const checkInteractions = async (req, res) => {
  try {
    const { medications } = req.body;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:
        'You are a clinical pharmacist. Return ONLY valid JSON: {"safe":true/false,"interactions":[{"drug1":"...","drug2":"...","severity":"mild|moderate|severe","description":"..."}],"recommendation":"..."}',
      messages: [
        {
          role: 'user',
          content: `Check interactions for these medications: ${medications.join(', ')}`,
        },
      ],
    });

    // The system prompt instructs JSON-only output, so we can parse directly
    const result = JSON.parse(response.content[0].text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Natural Language Appointment Scheduling — Haiku, intent parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/schedule-intent
 * Parses a natural language scheduling request into structured booking data.
 *
 * Example input:  "I need to see Dr. Chen urgently tomorrow afternoon about my blood pressure"
 * Example output: { preferredDate: "2026-03-29", preferredTime: "14:00", type: "consultation",
 *                   urgency: "urgent", doctor: "Dr. Chen", notes: "blood pressure concern" }
 *
 * The extracted data pre-fills the appointment booking form in the UI,
 * saving the receptionist from manually entering each field.
 *
 * @body text       — the natural language request string
 * @body doctorList — optional array of known doctor names to help the model resolve the doctor field
 */
export const parseAppointmentIntent = async (req, res) => {
  try {
    const { text, doctorList } = req.body;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system:
        'Extract appointment intent from natural language. Return ONLY valid JSON: {"preferredDate":"ISO8601 or null","preferredTime":"HH:MM or null","type":"consultation|follow-up|procedure|emergency","urgency":"routine|urgent|emergency","doctor":"name or null","notes":"..."}',
      messages: [
        {
          role: 'user',
          content: `Available doctors: ${(doctorList ?? []).join(', ')}\nRequest: "${text}"`,
        },
      ],
    });

    const intent = JSON.parse(response.content[0].text);
    res.json(intent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Clinical Protocol RAG Chatbot — Two-model pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/chatbot
 * Answers clinical questions using a RAG (Retrieval-Augmented Generation) pipeline
 * backed by the ProtocolChunk collection — no external vector database required.
 *
 * Pipeline:
 *   Step 1 — Haiku extracts 3–5 clinical keywords from the question.
 *             Haiku is used here because keyword extraction is simple and fast.
 *   Step 2 — MongoDB $text search finds the most relevant protocol chunks,
 *             scored and ranked by keyword frequency using the textScore metadata.
 *   Step 3 — Sonnet synthesises a cited answer from the top 5 chunks.
 *             Sonnet is used here because answer synthesis requires clinical reasoning.
 *
 * The system prompt constrains Sonnet to answer ONLY from the provided context
 * and always cite the source protocol and section — preventing hallucination
 * and making the answers auditable by clinical staff.
 *
 * Returns both the answer text and a sources array listing which protocol
 * sections were used, so the chatbot UI (DiagnosisChatbot.jsx) can display citations.
 *
 * @body question — the clinical question to answer
 */
export const protocolChatbot = async (req, res) => {
  try {
    const { question } = req.body;

    // ── Step 1: Keyword extraction with Haiku ─────────────────────────────
    const kwResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system: 'Extract 3-5 clinical search keywords from the question. Return only a comma-separated list.',
      messages: [{ role: 'user', content: question }],
    });

    const keywords = kwResponse.content[0].text.split(',').map((k) => k.trim());

    // ── Step 2: MongoDB full-text search ─────────────────────────────────
    // $text search uses the index on ProtocolChunk.content.
    // { $meta: 'textScore' } projects the relevance score so we can sort by it.
    const chunks = await ProtocolChunk.find(
      { $text: { $search: keywords.join(' ') } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } }) // highest relevance first
      .limit(5);                                // top 5 is enough context for most questions

    if (!chunks.length) {
      return res.json({
        answer: 'No relevant clinical protocols found for this query.',
        sources: [],
      });
    }

    // Format the chunks as labelled context blocks with source attribution
    const context = chunks
      .map((c) => `[${c.source} — ${c.section}]\n${c.content}`)
      .join('\n\n');

    // ── Step 3: Answer synthesis with Sonnet ─────────────────────────────
    const answerResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        'You are a clinical protocol assistant. Answer the question using ONLY the provided protocol excerpts. Always cite your sources by protocol name and section.',
      messages: [
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    });

    // Return sources alongside the answer for the citation UI
    const sources = chunks.map((c) => ({ source: c.source, section: c.section }));
    res.json({ answer: answerResponse.content[0].text, sources });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
