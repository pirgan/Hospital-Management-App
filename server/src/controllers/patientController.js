/**
 * Patient controller
 * CRUD operations for patient records.
 *
 * getPatients supports:
 *   - Fuzzy search on fullName via a case-insensitive regex query
 *   - Pagination via `page` and `limit` query params (defaults: page=1, limit=20)
 *   - Returns total count alongside the page so the frontend can render pagination controls
 *
 * All write operations are logged by auditMiddleware before reaching these handlers.
 */
import Patient from '../models/Patient.js';

/**
 * POST /api/patients
 * Creates a new patient record.
 * Automatically stamps `registeredBy` with the authenticated user's ID.
 */
export const createPatient = async (req, res) => {
  try {
    const patient = await Patient.create({ ...req.body, registeredBy: req.user._id });
    res.status(201).json(patient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/patients
 * Returns a paginated list of patients.
 * Optional query params:
 *   search — case-insensitive regex match on fullName
 *   page   — page number (1-based)
 *   limit  — results per page
 */
export const getPatients = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    // Build the filter object — only add search condition when a term is provided
    const filter = search
      ? { fullName: { $regex: search, $options: 'i' } }
      : {};

    const patients = await Patient.find(filter)
      .skip((page - 1) * limit)  // skip records from previous pages
      .limit(Number(limit))
      .sort({ createdAt: -1 });  // newest registrations first

    // Run count query in the same round-trip result set for pagination metadata
    const total = await Patient.countDocuments(filter);

    res.json({ patients, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/patients/:id
 * Returns a single patient with the registering staff member's name and role populated.
 */
export const getPatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate('registeredBy', 'name role');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/patients/:id
 * Updates a patient record. runValidators ensures schema constraints are re-checked.
 */
export const updatePatient = async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {
      new: true,         // return the updated document, not the original
      runValidators: true,
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * DELETE /api/patients/:id
 * Hard-deletes the patient record. Admin only (enforced at the route level).
 * Consider a soft-delete approach for production to preserve audit history.
 */
export const deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
