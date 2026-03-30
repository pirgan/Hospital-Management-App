/**
 * Invoice controller
 * Manages billing documents for patient encounters.
 *
 * The `markPaid` action is separate from the general `updateInvoice` because
 * it needs to atomically set both `status = 'paid'` and `paidAt = now()` —
 * keeping the payment timestamp consistent with the status change.
 *
 * The hourly cron job in seedCronJobs.js automatically transitions invoices
 * from 'sent' to 'overdue' when dueDate passes — no controller action needed
 * for that transition.
 */
import Invoice from '../models/Invoice.js';

/**
 * POST /api/invoices
 * Creates a draft invoice. Admin/receptionist only (enforced at route level).
 */
export const createInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/invoices
 * Returns invoices optionally filtered by patient and/or status.
 * The billing dashboard uses this to show overdue invoices at the top.
 */
export const getInvoices = async (req, res) => {
  try {
    const { patient, status } = req.query;
    const filter = {};
    if (patient) filter.patient = patient;
    if (status) filter.status = status;

    const invoices = await Invoice.find(filter)
      .populate('patient', 'fullName nhsNumber')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/invoices/:id
 * Returns a single invoice. Patients can access their own invoices (enforced in routes).
 */
export const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('patient', 'fullName');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/invoices/:id
 * Updates invoice details (e.g. adding line items, changing dueDate, filing insurance claim).
 */
export const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * PATCH /api/invoices/:id/pay
 * Records payment — atomically sets status to 'paid' and stamps paidAt with the
 * current timestamp. The atomic update ensures these two fields are always in sync.
 */
export const markPaid = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status: 'paid', paidAt: new Date() },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
