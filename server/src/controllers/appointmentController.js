/**
 * Appointment controller
 * CRUD operations for appointment scheduling.
 *
 * getAppointments supports multiple simultaneous filters so the calendar view
 * can fetch appointments for a specific doctor in a date range, or a receptionist
 * can query by patient and status in one request.
 *
 * All date filters use $gte/$lte to match any appointment within the given window,
 * making it easy to populate a week view by passing from=Monday&to=Sunday.
 */
import Appointment from '../models/Appointment.js';

/**
 * POST /api/appointments
 * Creates a new appointment. Stamps createdBy with the authenticated user's ID.
 */
export const createAppointment = async (req, res) => {
  try {
    const appt = await Appointment.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(appt);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/appointments
 * Returns appointments filtered by any combination of:
 *   doctor  — ObjectId of the doctor
 *   patient — ObjectId of the patient
 *   status  — e.g. "confirmed"
 *   from    — ISO date string (start of range, inclusive)
 *   to      — ISO date string (end of range, inclusive)
 * Results are sorted by scheduledAt ascending (chronological order for calendar display).
 */
export const getAppointments = async (req, res) => {
  try {
    const { doctor, patient, status, from, to } = req.query;
    const filter = {};

    if (doctor) filter.doctor = doctor;
    if (patient) filter.patient = patient;
    if (status) filter.status = status;

    // Build a date range filter only when at least one bound is provided
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to) filter.scheduledAt.$lte = new Date(to);
    }

    const appts = await Appointment.find(filter)
      .populate('patient', 'fullName nhsNumber')
      .populate('doctor', 'name')
      .sort({ scheduledAt: 1 });

    res.json(appts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/appointments/:id
 * Returns a single appointment with fuller patient and doctor data for the detail panel.
 */
export const getAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .populate('patient', 'fullName nhsNumber dateOfBirth')
      .populate('doctor', 'name department');
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/appointments/:id
 * Updates an appointment (e.g. rescheduling, changing status to confirmed/cancelled).
 */
export const updateAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    res.json(appt);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * DELETE /api/appointments/:id
 * Hard-deletes an appointment. Admin/receptionist only (enforced at route level).
 */
export const deleteAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    res.json({ message: 'Appointment removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
