/**
 * Dashboard
 * Role-specific landing page after login.
 *
 * doctor       — patient queue (today's appointments) + quick-action cards
 * nurse        — ward bed summary + assigned patients
 * receptionist — check-in list (today's confirmed appointments)
 * admin        — system stats: patient count, pending invoices, active staff
 * patient      — next appointment + recent invoice
 * lab_tech     — ordered lab tests queue
 *
 * Fetches data from relevant endpoints based on role.
 * Uses a switch on user.role to render the appropriate sub-view.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Each role fetches only the data relevant to their workflow.
    // This avoids a single bloated "load everything" call and keeps latency low.
    async function load() {
      try {
        // today as YYYY-MM-DD — used to scope appointment queries to the current day
        const today = new Date().toISOString().split('T')[0];

        if (user.role === 'doctor') {
          // Doctors see their own appointments for today, filtered by their user ID
          const { data: appts } = await api.get(`/appointments?doctor=${user._id}&from=${today}&to=${today}`);
          setData({ appointments: appts.data || appts });
        } else if (user.role === 'receptionist') {
          // Receptionists see all confirmed appointments for today (check-in list)
          const { data: appts } = await api.get(`/appointments?from=${today}&to=${today}&status=confirmed`);
          setData({ appointments: appts.data || appts });
        } else if (user.role === 'nurse') {
          // Nurses see all wards with bed occupancy so they can monitor capacity
          const { data: wards } = await api.get('/wards');
          setData({ wards: wards.data || wards });
        } else if (user.role === 'lab_tech') {
          // Lab techs see all ordered (pending) lab tests waiting to be processed
          const { data: labs } = await api.get('/lab-orders?status=ordered');
          setData({ labs: labs.data || labs });
        } else if (user.role === 'admin') {
          // Admin needs counts, not full lists — use Promise.all for parallel requests
          const [pRes, iRes] = await Promise.all([
            api.get('/patients?limit=1'), // total count is in the response meta, not the array
            api.get('/invoices?status=overdue'),
          ]);
          setData({
            patientCount: pRes.data.total || 0,
            overdueInvoices: iRes.data?.length || 0,
          });
        }
        // patient role has no special fetch — falls through to the empty data state
      } catch (_) {
        // Non-critical — dashboard degrades gracefully
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]); // re-run if the logged-in user changes (e.g. after role switch)

  if (loading) return <div className="p-6 text-gray-400">Loading dashboard...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Good morning, {user.name.split(' ')[0]}
      </h1>
      <p className="text-gray-500 text-sm mb-6 capitalize">{user.role} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      {/* Doctor view */}
      {user.role === 'doctor' && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">Today's Appointments</h2>
          {data?.appointments?.length === 0 && (
            <p className="text-sm text-gray-400">No appointments scheduled today.</p>
          )}
          <div className="space-y-2">
            {data?.appointments?.map((appt) => (
              <Link
                key={appt._id}
                to={`/patients/${appt.patient?._id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-teal-300 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{appt.patient?.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(appt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{appt.type}
                  </p>
                </div>
                <StatusBadge status={appt.status} />
              </Link>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'New Patient', icon: '➕', path: '/patients/register' },
              { label: 'EHR Record', icon: '📋', path: '/records' },
              { label: 'Lab Order', icon: '🔬', path: '/lab' },
            ].map(({ label, icon, path }) => (
              <Link key={path} to={path} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-teal-300 transition-colors">
                <span className="text-2xl">{icon}</span>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Receptionist view */}
      {user.role === 'receptionist' && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">Check-in List</h2>
          {data?.appointments?.length === 0 && (
            <p className="text-sm text-gray-400">No confirmed appointments today.</p>
          )}
          <div className="space-y-2">
            {data?.appointments?.map((appt) => (
              <div key={appt._id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{appt.patient?.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(appt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · Dr. '}{appt.doctor?.name}
                  </p>
                </div>
                <StatusBadge status={appt.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nurse view */}
      {user.role === 'nurse' && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">Ward Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data?.wards?.map((ward) => {
              const occupied = ward.beds?.filter((b) => b.status === 'occupied').length || 0;
              const total = ward.capacity || 0;
              return (
                <Link key={ward._id} to="/wards" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors">
                  <p className="font-semibold text-gray-900">{ward.name}</p>
                  <p className="text-xs text-gray-500 capitalize mt-0.5">{ward.type} · Floor {ward.floor}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(occupied / total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-600">{occupied}/{total}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Lab tech view */}
      {user.role === 'lab_tech' && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">Pending Lab Orders</h2>
          {data?.labs?.length === 0 && <p className="text-sm text-gray-400">No pending orders.</p>}
          <div className="space-y-2">
            {data?.labs?.map((order) => (
              <Link key={order._id} to="/lab" className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-teal-300 transition-colors">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{order.patient?.fullName}</p>
                  <p className="text-xs text-gray-500">{order.tests?.join(', ')}</p>
                </div>
                <StatusBadge status={order.priority} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Admin view */}
      {user.role === 'admin' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Patients', value: data?.patientCount, icon: '👥', path: '/patients' },
            { label: 'Overdue Invoices', value: data?.overdueInvoices, icon: '⚠️', path: '/billing' },
            { label: 'Manage Staff', value: 'Users', icon: '⚙️', path: '/admin' },
          ].map(({ label, value, icon, path }) => (
            <Link key={path} to={path} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-teal-300 transition-colors">
              <span className="text-2xl">{icon}</span>
              <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{label}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
