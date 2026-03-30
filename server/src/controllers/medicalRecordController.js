/**
 * Medical Record controller
 * CRUD for EHR (Electronic Health Record) documents.
 *
 * Records are created by doctors and linked to a specific patient and visit.
 * The `doctor` field is always set from the authenticated user (req.user._id)
 * rather than the request body, preventing one doctor from creating records
 * attributed to another.
 *
 * getRecords accepts a `patient` query param so the EHR page can load all
 * records for a specific patient sorted newest-first.
 */
import MedicalRecord from '../models/MedicalRecord.js';

/**
 * POST /api/medical-records
 * Creates a new medical record for a patient visit.
 * The authenticated doctor is automatically stamped as the author.
 */
export const createRecord = async (req, res) => {
  try {
    // Override any doctor field in the body with the authenticated user's ID
    const record = await MedicalRecord.create({ ...req.body, doctor: req.user._id });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/medical-records
 * Returns records filtered by patient (if provided), sorted newest visit first.
 * Used by the EHR page to display the patient's visit history.
 */
export const getRecords = async (req, res) => {
  try {
    const { patient } = req.query;
    const filter = patient ? { patient } : {};

    const records = await MedicalRecord.find(filter)
      .populate('doctor', 'name')
      .sort({ visitDate: -1 }); // most recent visit at top

    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/medical-records/:id
 * Returns a single record with full patient and doctor details for the EHR detail view.
 */
export const getRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate('patient', 'fullName nhsNumber')
      .populate('doctor', 'name department');
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/medical-records/:id
 * Updates a record. Doctors use this to add diagnoses, update the treatment plan,
 * or attach AI differential diagnosis results after running the AI assistant.
 */
export const updateRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
