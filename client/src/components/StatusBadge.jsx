/**
 * StatusBadge
 * Colour-coded pill badge for status values across different domains.
 * Maps status strings to Tailwind background/text colour pairs so the
 * same component works for appointments, prescriptions, lab orders, invoices, etc.
 *
 * @param {string} status — e.g. "scheduled", "completed", "overdue", "stat"
 * @param {string} [size="sm"] — "sm" | "md"
 */
const STATUS_COLOURS = {
  // Appointment statuses
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  'no-show': 'bg-gray-100 text-gray-600',
  // Prescription statuses
  active: 'bg-green-100 text-green-800',
  dispensed: 'bg-purple-100 text-purple-800',
  // Lab order statuses
  ordered: 'bg-yellow-100 text-yellow-800',
  'in-progress': 'bg-orange-100 text-orange-800',
  // Priority
  routine: 'bg-gray-100 text-gray-700',
  urgent: 'bg-orange-100 text-orange-800',
  stat: 'bg-red-100 text-red-800',
  // Invoice statuses
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function StatusBadge({ status, size = 'sm' }) {
  const colour = STATUS_COLOURS[status] || 'bg-gray-100 text-gray-600';
  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-block rounded-full font-medium capitalize ${padding} ${colour}`}>
      {status}
    </span>
  );
}
