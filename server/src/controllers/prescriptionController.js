/**
 * Prescription controller
 * Manages creating, retrieving, updating, and dispensing prescriptions.
 *
 * The `dispensePrescription` action is separated from the general `updatePrescription`
 * because it requires a different RBAC role (nurse, not doctor) and needs to
 * set both `dispensedBy` and `dispensedAt` in a single atomic operation.
 *
 * Before createPrescription is called, the frontend should call
 * POST /api/ai/interactions to check for drug interactions and display
 * any warnings. The result can be attached to `aiInteractionCheck` in the body.
 */
import Prescription from '../models/Prescription.js';

/**
 * POST /api/prescriptions
 * Creates a prescription. The authenticated doctor is stamped as the prescriber.
 */
export const createPrescription = async (req, res) => {
  try {
    const rx = await Prescription.create({ ...req.body, doctor: req.user._id });
    res.status(201).json(rx);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/prescriptions
 * Returns prescriptions optionally filtered by patient and/or status.
 * Used by the doctor's prescriptions list and the nurse's dispensing queue.
 */
export const getPrescriptions = async (req, res) => {
  try {
    const { patient, status } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (status) filter.status = status;

    const rxList = await Prescription.find(filter)
      .populate('patient', 'fullName')
      .populate('doctor', 'name')
      .sort({ createdAt: -1 });

    res.json(rxList);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/prescriptions/:id
 * Returns a single prescription with patient allergies populated —
 * useful for the nurse dispensing UI to surface allergy warnings.
 */
export const getPrescription = async (req, res) => {
  try {
    const rx = await Prescription.findById(req.params.id)
      .populate('patient', 'fullName nhsNumber allergies')
      .populate('doctor', 'name');
    if (!rx) return res.status(404).json({ message: 'Prescription not found' });
    res.json(rx);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/prescriptions/:id
 * General update — used by doctors to modify medications or cancel a prescription.
 */
export const updatePrescription = async (req, res) => {
  try {
    const rx = await Prescription.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!rx) return res.status(404).json({ message: 'Prescription not found' });
    res.json(rx);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * PATCH /api/prescriptions/:id/dispense
 * Marks a prescription as dispensed by the authenticated nurse.
 * Records who dispensed the medication (dispensedBy) and exactly when (dispensedAt)
 * in a single atomic update for medication administration record compliance.
 */
export const dispensePrescription = async (req, res) => {
  try {
    const rx = await Prescription.findByIdAndUpdate(
      req.params.id,
      {
        status: 'dispensed',
        dispensedBy: req.user._id,
        dispensedAt: new Date(),
      },
      { new: true }
    );
    if (!rx) return res.status(404).json({ message: 'Prescription not found' });
    res.json(rx);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
