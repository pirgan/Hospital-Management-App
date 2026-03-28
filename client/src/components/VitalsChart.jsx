/**
 * VitalsChart
 * Recharts LineChart showing patient vital signs over time.
 * Plots: systolic BP (red), diastolic BP (orange), pulse (blue), O2 sat (teal).
 * Expects an array of MedicalRecord objects with vitals and visitDate fields.
 *
 * @param {object[]} records — array of { visitDate, vitals: { bp, pulse, o2sat } }
 *   bp is expected as "120/80" string — split into systolic/diastolic for plotting
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * Transforms MedicalRecord array into Recharts-friendly data points.
 * Parses "systolic/diastolic" BP string into two separate numeric fields.
 */
function transformRecords(records) {
  return records
    .slice() // shallow copy so we don't sort the caller's original array (side-effect free)
    .sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate)) // chronological order
    .map((r) => {
      // BP is stored as "systolic/diastolic" string (e.g. "120/80").
      // Split and cast to Number; Recharts needs numeric values for the Y axis.
      const [systolic, diastolic] = (r.vitals?.bp || '').split('/').map(Number);
      return {
        date: new Date(r.visitDate).toLocaleDateString(), // X-axis label
        systolic: systolic || null,   // null tells Recharts to leave a gap rather than plot 0
        diastolic: diastolic || null,
        pulse: r.vitals?.pulse || null,
        o2sat: r.vitals?.o2sat || null,
      };
    });
}

export default function VitalsChart({ records = [] }) {
  if (!records.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">No vitals recorded yet.</p>;
  }

  const data = transformRecords(records);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="systolic" stroke="#ef4444" dot={false} name="Systolic BP" />
        <Line type="monotone" dataKey="diastolic" stroke="#f97316" dot={false} name="Diastolic BP" />
        <Line type="monotone" dataKey="pulse" stroke="#3b82f6" dot={false} name="Pulse" />
        <Line type="monotone" dataKey="o2sat" stroke="#14b8a6" dot={false} name="O₂ Sat %" />
      </LineChart>
    </ResponsiveContainer>
  );
}
