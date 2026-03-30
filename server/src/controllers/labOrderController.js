/**
 * Lab Order controller
 * Manages the lifecycle of laboratory test requests from ordering to result entry.
 *
 * Workflow:
 *   1. Doctor calls createLabOrder → status = "ordered"
 *   2. Lab tech calls updateLabOrder → status = "in-progress"
 *   3. Lab tech calls enterResults   → status = "completed", results array populated
 *
 * The enterResults action is a dedicated endpoint (PATCH /:id/results) rather than
 * using general update because it needs separate RBAC (lab_tech role) and it
 * atomically sets the status, results, and processedBy fields together.
 */
import LabOrder from '../models/LabOrder.js';

/**
 * POST /api/lab-orders
 * Creates a lab order. The authenticated doctor is stamped as the ordering physician.
 */
export const createLabOrder = async (req, res) => {
  try {
    const order = await LabOrder.create({ ...req.body, doctor: req.user._id });
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/lab-orders
 * Returns lab orders optionally filtered by patient, status, and/or priority.
 * The lab tech's queue view uses status=ordered and sorts by priority to surface STAT orders.
 */
export const getLabOrders = async (req, res) => {
  try {
    const { patient, status, priority } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const orders = await LabOrder.find(filter)
      .populate('patient', 'fullName nhsNumber')
      .populate('doctor', 'name')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/lab-orders/:id
 * Returns a single order with full patient details for the lab result entry panel.
 */
export const getLabOrder = async (req, res) => {
  try {
    const order = await LabOrder.findById(req.params.id)
      .populate('patient', 'fullName nhsNumber dateOfBirth')
      .populate('doctor', 'name');
    if (!order) return res.status(404).json({ message: 'Lab order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/lab-orders/:id
 * General update — e.g. cancelling an order or changing its status to "in-progress".
 */
export const updateLabOrder = async (req, res) => {
  try {
    const order = await LabOrder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!order) return res.status(404).json({ message: 'Lab order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * PATCH /api/lab-orders/:id/results
 * Submits test results for a lab order. Lab tech only.
 * Atomically sets:
 *   - results array (with per-test values, units, ranges, and flagged status)
 *   - status = "completed"
 *   - processedBy = authenticated lab tech's user ID
 *
 * Flagged results (value outside reference range) are highlighted in the EHR view.
 */
export const enterResults = async (req, res) => {
  try {
    const { results } = req.body;
    const order = await LabOrder.findByIdAndUpdate(
      req.params.id,
      {
        results,
        status: 'completed',
        processedBy: req.user._id,
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Lab order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
