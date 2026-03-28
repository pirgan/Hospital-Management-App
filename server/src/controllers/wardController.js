/**
 * Ward controller
 * Manages hospital wards and bed assignment operations.
 *
 * Bed admission and discharge are special operations (not generic CRUD) because
 * they must:
 *   1. Find the specific bed by number within the ward's embedded beds array.
 *   2. Validate the bed's current status before allowing the transition.
 *   3. Update multiple bed fields atomically (status, patient ref, admittedAt).
 *   4. Save the entire ward document in one write.
 *
 * This pattern (find document → mutate embedded array item → save) is used
 * instead of a MongoDB array update operator like $set + $ positional to make
 * the validation logic clear and easy to extend.
 */
import Ward from '../models/Ward.js';

/**
 * POST /api/wards
 * Creates a new ward with its initial bed configuration. Admin only.
 */
export const createWard = async (req, res) => {
  try {
    const ward = await Ward.create(req.body);
    res.status(201).json(ward);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/wards
 * Returns all wards (or filtered by type) with patient names populated for occupied beds.
 * The ward map UI uses this to render the bed grid with patient names.
 */
export const getWards = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = type ? { type } : {};
    const wards = await Ward.find(filter).populate('beds.patient', 'fullName nhsNumber');
    res.json(wards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/wards/:id
 * Returns a single ward with all beds and patient details.
 */
export const getWard = async (req, res) => {
  try {
    const ward = await Ward.findById(req.params.id).populate('beds.patient', 'fullName nhsNumber');
    if (!ward) return res.status(404).json({ message: 'Ward not found' });
    res.json(ward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/wards/admit
 * Admits a patient to a specific bed.
 *
 * Steps:
 *   1. Find the ward by wardId.
 *   2. Find the target bed by bedNumber within the ward's beds array.
 *   3. Reject if the bed isn't available (prevents double-booking).
 *   4. Set bed status = 'occupied', assign the patient ref, and stamp admittedAt.
 *   5. Save the ward document (single atomic write).
 *
 * @body wardId    — MongoDB ObjectId of the ward
 * @body bedNumber — bed identifier string, e.g. "G-01"
 * @body patientId — MongoDB ObjectId of the patient being admitted
 */
export const admitPatient = async (req, res) => {
  try {
    const { wardId, bedNumber, patientId } = req.body;

    const ward = await Ward.findById(wardId);
    if (!ward) return res.status(404).json({ message: 'Ward not found' });

    // Find the bed within the embedded array by its number string.
    // String() normalises the value in case the client sends a JS number (parseInt result)
    // while the schema stores bed numbers as strings (e.g. "1", "G-01").
    const bed = ward.beds.find((b) => b.number === String(bedNumber));
    if (!bed) return res.status(404).json({ message: 'Bed not found' });

    // Guard against admitting to an already-occupied or reserved bed
    if (bed.status !== 'available') {
      return res.status(409).json({ message: 'Bed is not available' });
    }

    // Mutate the embedded subdocument and save the parent document
    bed.status = 'occupied';
    bed.patient = patientId;
    bed.admittedAt = new Date();
    await ward.save();

    res.json(ward);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/wards/discharge
 * Discharges a patient from a bed, resetting it to available.
 *
 * Clears the patient reference and admittedAt so the bed shows as empty
 * in the ward map. The patient's own record (MedicalRecord, etc.) is not
 * affected — this only updates the physical bed state.
 *
 * Lookup strategy:
 *   - If bedNumber is provided (preferred path), find by bed number.
 *   - If bedNumber is omitted, fall back to finding by patientId — this handles
 *     the case where the client couldn't resolve the bed number.
 *
 * @body wardId     — MongoDB ObjectId of the ward
 * @body bedNumber  — bed number (e.g. 5); optional if patientId is provided
 * @body patientId  — MongoDB ObjectId of the patient; used as fallback bed lookup
 */
export const dischargePatient = async (req, res) => {
  try {
    const { wardId, bedNumber, patientId } = req.body;

    const ward = await Ward.findById(wardId);
    if (!ward) return res.status(404).json({ message: 'Ward not found' });

    // Primary: find by bed number. Fallback: find by patientId on an occupied bed.
    // String() normalises the bed number in case the client sends it as a JS number —
    // the schema stores bed numbers as strings (e.g. "1", "G-01").
    const bed = bedNumber
      ? ward.beds.find((b) => b.number === String(bedNumber))
      : ward.beds.find((b) => b.patient?.toString() === patientId && b.status === 'occupied');

    if (!bed) return res.status(404).json({ message: 'Bed not found' });

    // Reset bed to its clean available state
    bed.status = 'available';
    bed.patient = null;
    bed.admittedAt = null;
    await ward.save();

    res.json(ward);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
