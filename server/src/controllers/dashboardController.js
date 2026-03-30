import Appointment   from '../models/Appointment.js';
import Invoice        from '../models/Invoice.js';
import LabOrder       from '../models/LabOrder.js';
import MedicalRecord  from '../models/MedicalRecord.js';
import Patient        from '../models/Patient.js';
import Prescription   from '../models/Prescription.js';
import Ward           from '../models/Ward.js';

// Helper: does the user have this role (primary or secondary)?
const hasRole = (user, role) =>
  user.role === role || (user.secondaryRoles ?? []).includes(role);

export const getDashboardStats = async (req, res) => {
  try {
    const user = req.user;
    const now  = new Date();

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(now - 7 * 86_400_000);

    // ── Admin ──────────────────────────────────────────────────────────────────
    if (hasRole(user, 'admin')) {
      const [
        totalPatients,
        todayAppointments,
        revenueAgg,
        overdueAgg,
        apptStatusAgg,
        bedAgg,
        recentOverdueInvoices,
        flaggedLabResults,
        highRiskFollowUps,
      ] = await Promise.all([
        Patient.countDocuments({}),

        Appointment.countDocuments({
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
        }),

        Invoice.aggregate([
          { $match: { status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),

        Invoice.aggregate([
          { $match: { status: 'overdue' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),

        // Group by (date string, status) over the last 7 days
        Appointment.aggregate([
          { $match: { scheduledAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' },
                },
                status: '$status',
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': 1 } },
        ]),

        Ward.aggregate([
          { $unwind: '$beds' },
          { $group: { _id: '$beds.status', count: { $sum: 1 } } },
        ]),

        Invoice.find({ status: 'overdue' })
          .populate('patient', 'fullName')
          .sort({ dueDate: 1 })
          .limit(8)
          .lean(),

        LabOrder.find({ 'results.flagged': true, status: 'completed' })
          .populate('patient', 'fullName')
          .sort({ updatedAt: -1 })
          .limit(10)
          .lean(),

        MedicalRecord.find({
          aiRiskScore: { $gt: 75 },
          followUpDate: { $lt: now },
        })
          .populate('patient', 'fullName')
          .sort({ aiRiskScore: -1 })
          .limit(8)
          .lean(),
      ]);

      // Pivot appointment aggregation into chart-friendly rows
      const dateMap = {};
      for (const entry of apptStatusAgg) {
        const { date, status } = entry._id;
        if (!dateMap[date]) {
          dateMap[date] = { date: formatShortDate(date), scheduled: 0, confirmed: 0, completed: 0, cancelled: 0, 'no-show': 0 };
        }
        dateMap[date][status] = (dateMap[date][status] ?? 0) + entry.count;
      }
      const appointmentsByStatus = Object.values(dateMap);

      // Bed occupancy — normalise to { name, value }
      const bedOccupancy = bedAgg.map((b) => ({ name: b._id, value: b.count }));

      // Append daysOverdue
      const overdueWithDays = recentOverdueInvoices.map((inv) => ({
        ...inv,
        daysOverdue: Math.max(0, Math.floor((now - new Date(inv.dueDate)) / 86_400_000)),
      }));

      // Flatten flagged lab results to only include flagged test rows
      const flaggedFlat = flaggedLabResults.map((order) => ({
        _id: order._id,
        patient: order.patient,
        tests: order.tests,
        flaggedResults: (order.results ?? []).filter((r) => r.flagged),
        updatedAt: order.updatedAt,
      }));

      return res.json({
        totalPatients,
        todayAppointments,
        revenueCollected: revenueAgg[0]?.total ?? 0,
        overdueAmount:    overdueAgg[0]?.total ?? 0,
        appointmentsByStatus,
        bedOccupancy,
        recentOverdueInvoices: overdueWithDays,
        flaggedLabResults: flaggedFlat,
        highRiskFollowUps,
      });
    }

    // ── Doctor ─────────────────────────────────────────────────────────────────
    if (hasRole(user, 'doctor')) {
      const userId = user._id;

      const [todayCount, pendingLabCount, activeRxCount, flaggedLabs, overdueFollowUps] =
        await Promise.all([
          Appointment.countDocuments({
            doctor: userId,
            scheduledAt: { $gte: todayStart, $lte: todayEnd },
          }),

          LabOrder.countDocuments({
            doctor: userId,
            status: { $in: ['ordered', 'in-progress'] },
          }),

          Prescription.countDocuments({ doctor: userId, status: 'active' }),

          LabOrder.find({ doctor: userId, 'results.flagged': true, status: 'completed' })
            .populate('patient', 'fullName')
            .sort({ updatedAt: -1 })
            .limit(5)
            .lean(),

          MedicalRecord.find({ doctor: userId, followUpDate: { $lt: todayStart } })
            .populate('patient', 'fullName')
            .sort({ followUpDate: 1 })
            .limit(5)
            .lean(),
        ]);

      const flaggedLabsFlat = flaggedLabs.map((order) => ({
        _id: order._id,
        patient: order.patient,
        tests: order.tests,
        flaggedResults: (order.results ?? []).filter((r) => r.flagged),
        updatedAt: order.updatedAt,
      }));

      return res.json({
        todayCount,
        pendingLabCount,
        activeRxCount,
        flaggedLabs: flaggedLabsFlat,
        overdueFollowUps,
      });
    }

    // All other roles — client uses existing CRUD endpoints
    return res.json({});
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ message: 'Failed to load dashboard stats' });
  }
};

// "2025-03-23" → "Mar 23"
function formatShortDate(isoDate) {
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
