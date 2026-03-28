/**
 * AppointmentCalendar
 * Week/day view calendar for appointments.
 *
 * Features:
 *   - Toggle between week view (7-day grid) and day view (single day slots)
 *   - Doctor filter dropdown (fetches /users?role=doctor)
 *   - Appointments fetched for the visible date range
 *   - Clicking an appointment opens an inline detail panel
 */
import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';

/**
 * startOfWeek
 * Returns the Monday (day 1) of the week containing `date`.
 * getDay() returns 0=Sun, 1=Mon … 6=Sat, so subtracting getDay()-1 rewinds to Monday.
 * Hours are zeroed so we get the very start of the day for range queries.
 */
function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

/** addDays — returns a new Date offset by n days (negative n goes backwards) */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08:00–18:00

export default function AppointmentCalendar() {
  const [view, setView] = useState('week'); // 'week' | 'day'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [selected, setSelected] = useState(null);

  // Fetch the list of doctors once on mount to populate the filter dropdown.
  // GET /users?role=doctor returns all User documents with role='doctor'.
  useEffect(() => {
    api.get('/users?role=doctor').then(({ data }) => setDoctors(data.data || data)).catch(() => {});
  }, []);

  // Re-fetch appointments whenever the view, date, or doctor filter changes.
  // The date range sent depends on the current view mode:
  //   week → 7-day range from Monday of currentDate's week
  //   day  → just currentDate (00:00–23:59)
  useEffect(() => {
    async function load() {
      // Determine start of range
      const from = view === 'week' ? startOfWeek(currentDate) : new Date(currentDate);
      from.setHours(0, 0, 0, 0);
      // Determine end of range — week adds 6 days, day stays the same date
      const to = view === 'week' ? addDays(from, 6) : new Date(from);
      to.setHours(23, 59, 59, 999);

      // Build query params; doctor filter is optional
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (doctorFilter) params.set('doctor', doctorFilter);

      try {
        // GET /appointments returns all appointments within the date range
        const { data } = await api.get(`/appointments?${params}`);
        setAppointments(data.data || data);
      } catch (_) {}
    }
    load();
  }, [currentDate, view, doctorFilter]); // any of these changing must trigger a re-fetch

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate), i));

  /** Find appointments for a specific day and hour */
  function apptAt(day, hour) {
    return appointments.filter((a) => {
      const d = new Date(a.scheduledAt);
      return d.toDateString() === day.toDateString() && d.getHours() === hour;
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Appointment Calendar</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
            {['week', 'day'].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize ${view === v ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <button onClick={() => setCurrentDate((d) => addDays(d, view === 'week' ? -7 : -1))}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">◀</button>
          <button onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Today</button>
          <button onClick={() => setCurrentDate((d) => addDays(d, view === 'week' ? 7 : 1))}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">▶</button>
          {/* Doctor filter */}
          <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="">All Doctors</option>
            {doctors.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-auto">
        <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `60px repeat(${view === 'week' ? 7 : 1}, 1fr)` }}>
          <div className="p-2" />
          {(view === 'week' ? weekDays : [currentDate]).map((day, i) => (
            <div key={i} className={`p-2 text-center border-l border-gray-200 ${day.toDateString() === new Date().toDateString() ? 'bg-teal-50' : ''}`}>
              <p className="text-xs text-gray-400 uppercase">{day.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
              <p className={`text-sm font-semibold ${day.toDateString() === new Date().toDateString() ? 'text-teal-700' : 'text-gray-700'}`}>
                {day.getDate()}
              </p>
            </div>
          ))}
        </div>

        {HOURS.map((hour) => (
          <div key={hour} className="grid border-b border-gray-100 min-h-[56px]"
            style={{ gridTemplateColumns: `60px repeat(${view === 'week' ? 7 : 1}, 1fr)` }}>
            <div className="p-2 text-xs text-gray-400 text-right">{hour}:00</div>
            {(view === 'week' ? weekDays : [currentDate]).map((day, i) => {
              const appts = apptAt(day, hour);
              return (
                <div key={i} className="border-l border-gray-100 p-1">
                  {appts.map((appt) => (
                    <button key={appt._id} onClick={() => setSelected(appt)}
                      className="w-full text-left bg-teal-100 text-teal-800 rounded px-2 py-1 text-xs font-medium hover:bg-teal-200 truncate mb-0.5">
                      {appt.patient?.fullName?.split(' ')[0]} — {appt.type}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Appointment detail panel */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{selected.patient?.fullName}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <dl className="space-y-2 text-sm">
              <InfoRow label="Doctor" value={selected.doctor?.name} />
              <InfoRow label="Time" value={new Date(selected.scheduledAt).toLocaleString()} />
              <InfoRow label="Type" value={selected.type} />
              <InfoRow label="Duration" value={`${selected.duration} min`} />
              <div className="flex gap-2 items-center">
                <dt className="text-gray-500 w-20">Status</dt>
                <dd><StatusBadge status={selected.status} /></dd>
              </div>
              {selected.notes && <InfoRow label="Notes" value={selected.notes} />}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-500 w-20 shrink-0">{label}:</dt>
      <dd className="text-gray-800 capitalize">{value || '—'}</dd>
    </div>
  );
}
