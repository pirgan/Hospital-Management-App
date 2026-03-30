/**
 * Dashboard — enhanced role-specific landing page.
 *
 * admin       — KPI cards, appointments bar chart, bed occupancy pie chart,
 *               overdue invoices table, flagged lab alerts, high-risk follow-ups
 * doctor      — stat cards, today's schedule, flagged labs, overdue follow-ups, quick actions
 * nurse       — bed stat cards, ward occupancy, active Rx queue, STAT lab orders
 * receptionist— stat cards, check-in list, upcoming 7-day grouped list, recent patients
 * lab_tech    — stat cards, priority-coded pending queue, completed-today flagged results
 * patient     — next appointment card, recent prescriptions, recent lab orders, quick links
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import { userHasRole, formatUserRoles } from '../utils/roles';

// ── Shared tiny components ────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  const border = accent === 'red'    ? 'border-red-200'
               : accent === 'teal'   ? 'border-teal-200'
               : accent === 'amber'  ? 'border-amber-200'
               : 'border-gray-200';
  return (
    <div className={`bg-white border ${border} rounded-xl p-5`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
      {children}
    </h2>
  );
}

function Panel({ children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

const TYPE_COLOURS = {
  consultation: 'bg-blue-100 text-blue-700',
  'follow-up':  'bg-teal-100 text-teal-700',
  procedure:    'bg-purple-100 text-purple-700',
  emergency:    'bg-red-100 text-red-700',
};

const PRIORITY_BORDER = {
  stat:    'border-l-4 border-red-500',
  urgent:  'border-l-4 border-orange-400',
  routine: 'border-l-4 border-gray-300',
};

const PRIORITY_BADGE = {
  stat:    'bg-red-100 text-red-700',
  urgent:  'bg-orange-100 text-orange-700',
  routine: 'bg-gray-100 text-gray-600',
};

const BED_COLOURS = { available: '#5eead4', occupied: '#f87171', reserved: '#fbbf24' };

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// ── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today    = new Date().toISOString().split('T')[0];
        const in7Days  = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];
        const merged   = {};

        if (userHasRole(user, 'admin')) {
          const { data: stats } = await api.get('/dashboard/stats');
          merged.stats = stats;
        }

        if (userHasRole(user, 'doctor')) {
          const [{ data: stats }, { data: appts }] = await Promise.all([
            api.get('/dashboard/stats'),
            api.get(`/appointments?doctor=${user._id}&from=${today}&to=${today}`),
          ]);
          merged.stats              = stats;
          const raw = appts?.data ?? appts;
          merged.doctorAppointments = Array.isArray(raw) ? raw : [];
        }

        if (userHasRole(user, 'nurse')) {
          const [wardsRes, rxRes, statLabRes] = await Promise.all([
            api.get('/wards'),
            api.get('/prescriptions?status=active'),
            api.get('/lab-orders?status=ordered&priority=stat'),
          ]);
          merged.wards              = wardsRes.data?.data ?? wardsRes.data ?? [];
          const rxRaw = rxRes.data?.data ?? rxRes.data;
          merged.activePrescriptions = Array.isArray(rxRaw) ? rxRaw : [];
          const labRaw = statLabRes.data?.data ?? statLabRes.data;
          merged.statOrders          = Array.isArray(labRaw) ? labRaw : [];
        }

        if (userHasRole(user, 'receptionist')) {
          const [todayRes, upcomingRes, patientsRes] = await Promise.all([
            api.get(`/appointments?from=${today}&to=${today}`),
            api.get(`/appointments?from=${today}&to=${in7Days}`),
            api.get('/patients?limit=5'),
          ]);
          const toRaw = todayRes.data?.data ?? todayRes.data;
          const upRaw = upcomingRes.data?.data ?? upcomingRes.data;
          merged.receptionistAppointments = Array.isArray(toRaw) ? toRaw : [];
          merged.upcomingAppointments     = Array.isArray(upRaw) ? upRaw : [];
          merged.recentPatients           = patientsRes.data?.patients ?? patientsRes.data?.data ?? [];
        }

        if (userHasRole(user, 'lab_tech')) {
          const [pendRes, inProgRes, compRes] = await Promise.all([
            api.get('/lab-orders?status=ordered'),
            api.get('/lab-orders?status=in-progress'),
            api.get('/lab-orders?status=completed'),
          ]);
          const pendRaw  = pendRes.data?.data  ?? pendRes.data;
          const progRaw  = inProgRes.data?.data ?? inProgRes.data;
          const compRaw  = compRes.data?.data  ?? compRes.data;
          merged.pendingOrders   = Array.isArray(pendRaw)  ? pendRaw  : [];
          merged.inProgressOrders= Array.isArray(progRaw)  ? progRaw  : [];
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          merged.completedToday  = Array.isArray(compRaw)
            ? compRaw.filter((o) => new Date(o.updatedAt) >= todayStart)
            : [];
        }

        if (userHasRole(user, 'patient')) {
          const [apptRes, rxRes, labRes] = await Promise.all([
            api.get(`/appointments?patient=${user._id}&from=${today}`),
            api.get(`/prescriptions?patient=${user._id}&status=active`),
            api.get(`/lab-orders?patient=${user._id}`),
          ]);
          const apptRaw = apptRes.data?.data ?? apptRes.data;
          const rxRaw   = rxRes.data?.data   ?? rxRes.data;
          const labRaw  = labRes.data?.data   ?? labRes.data;
          merged.patientAppointments  = Array.isArray(apptRaw) ? apptRaw : [];
          merged.patientPrescriptions = Array.isArray(rxRaw)   ? rxRaw.slice(0, 3) : [];
          merged.patientLabOrders     = Array.isArray(labRaw)  ? labRaw.slice(0, 3) : [];
        }

        setData(merged);
      } catch (_) {
        // Dashboard degrades gracefully
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-400 text-sm">
        <span className="animate-spin rounded-full h-4 w-4 border-2 border-teal-500 border-t-transparent" />
        Loading dashboard…
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {user.name.split(' ').slice(-1)[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">
          {formatUserRoles(user)} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── ADMIN ─────────────────────────────────────────────────────────── */}
      {userHasRole(user, 'admin') && <AdminView stats={data.stats} />}

      {/* ── DOCTOR ────────────────────────────────────────────────────────── */}
      {userHasRole(user, 'doctor') && !userHasRole(user, 'admin') && (
        <DoctorView stats={data.stats} appointments={data.doctorAppointments ?? []} />
      )}

      {/* ── NURSE ─────────────────────────────────────────────────────────── */}
      {userHasRole(user, 'nurse') && (
        <NurseView
          wards={data.wards ?? []}
          activePrescriptions={data.activePrescriptions ?? []}
          statOrders={data.statOrders ?? []}
        />
      )}

      {/* ── RECEPTIONIST ──────────────────────────────────────────────────── */}
      {userHasRole(user, 'receptionist') && (
        <ReceptionistView
          todayAppointments={data.receptionistAppointments ?? []}
          upcomingAppointments={data.upcomingAppointments ?? []}
          recentPatients={data.recentPatients ?? []}
        />
      )}

      {/* ── LAB TECH ──────────────────────────────────────────────────────── */}
      {userHasRole(user, 'lab_tech') && (
        <LabTechView
          pendingOrders={data.pendingOrders ?? []}
          inProgressOrders={data.inProgressOrders ?? []}
          completedToday={data.completedToday ?? []}
        />
      )}

      {/* ── PATIENT ───────────────────────────────────────────────────────── */}
      {userHasRole(user, 'patient') && (
        <PatientView
          appointments={data.patientAppointments ?? []}
          prescriptions={data.patientPrescriptions ?? []}
          labOrders={data.patientLabOrders ?? []}
        />
      )}
    </div>
  );
}

// ── Admin View ────────────────────────────────────────────────────────────────

function AdminView({ stats = {} }) {
  const {
    totalPatients = 0,
    todayAppointments = 0,
    revenueCollected = 0,
    overdueAmount = 0,
    appointmentsByStatus = [],
    bedOccupancy = [],
    recentOverdueInvoices = [],
    flaggedLabResults = [],
    highRiskFollowUps = [],
  } = stats;

  return (
    <section className="space-y-6">
      {/* Row 1 — KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/patients">
          <StatCard label="Total Patients" value={totalPatients.toLocaleString()} sub="All registered" />
        </Link>
        <Link to="/appointments">
          <StatCard label="Today's Appointments" value={todayAppointments} sub="Across all doctors" accent="teal" />
        </Link>
        <Link to="/billing">
          <StatCard label="Revenue Collected" value={fmt(revenueCollected)} sub="All paid invoices" accent="teal" />
        </Link>
        <Link to="/billing">
          <StatCard label="Overdue Amount" value={fmt(overdueAmount)} sub="Requires follow-up" accent="red" />
        </Link>
      </div>

      {/* Row 2 — Appointments bar chart */}
      <Panel>
        <SectionHeading>Appointments — Last 7 Days</SectionHeading>
        {appointmentsByStatus.length === 0 ? (
          <p className="text-sm text-gray-400">No appointment data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={appointmentsByStatus} barSize={10} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="scheduled"  name="Scheduled"  fill="#93c5fd" radius={[4,4,0,0]} />
              <Bar dataKey="confirmed"  name="Confirmed"  fill="#5eead4" radius={[4,4,0,0]} />
              <Bar dataKey="completed"  name="Completed"  fill="#86efac" radius={[4,4,0,0]} />
              <Bar dataKey="cancelled"  name="Cancelled"  fill="#fca5a5" radius={[4,4,0,0]} />
              <Bar dataKey="no-show"    name="No-show"    fill="#d1d5db" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Row 3 — Bed occupancy pie + Overdue invoices table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <SectionHeading>Bed Occupancy</SectionHeading>
          {bedOccupancy.length === 0 ? (
            <p className="text-sm text-gray-400">No ward data available.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={bedOccupancy} dataKey="value" nameKey="name"
                       cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {bedOccupancy.map((entry) => (
                      <Cell key={entry.name} fill={BED_COLOURS[entry.name] ?? '#e5e7eb'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v + ' beds', n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {bedOccupancy.map((b) => (
                  <div key={b.name} className="text-center">
                    <p className="text-lg font-bold text-gray-900">{b.value}</p>
                    <p className="text-xs text-gray-500 capitalize">{b.name}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel>
          <SectionHeading>Overdue Invoices</SectionHeading>
          {recentOverdueInvoices.length === 0 ? (
            <p className="text-sm text-gray-400">No overdue invoices.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="pb-2 font-medium">Patient</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Due</th>
                    <th className="pb-2 font-medium">Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentOverdueInvoices.map((inv) => (
                    <tr key={inv._id}>
                      <td className="py-2 font-medium text-gray-900 text-xs">{inv.patient?.fullName}</td>
                      <td className="py-2 text-gray-700 text-xs">{fmt(inv.totalAmount)}</td>
                      <td className="py-2 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(inv.dueDate).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                      </td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.daysOverdue > 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {inv.daysOverdue}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Row 4 — Flagged labs + High-risk follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <SectionHeading>Flagged Lab Results</SectionHeading>
          {flaggedLabResults.length === 0 ? (
            <p className="text-sm text-gray-400">No flagged results.</p>
          ) : (
            <div className="space-y-2">
              {flaggedLabResults.map((order) => (
                <div key={order._id} className="bg-white border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{order.patient?.fullName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(order.flaggedResults ?? []).slice(0, 3).map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {r.testName}: {r.value} {r.unit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <SectionHeading>High-Risk Overdue Follow-ups</SectionHeading>
          {highRiskFollowUps.length === 0 ? (
            <p className="text-sm text-gray-400">No overdue high-risk follow-ups.</p>
          ) : (
            <div className="space-y-2">
              {highRiskFollowUps.map((rec) => (
                <div key={rec._id} className="bg-white border border-orange-100 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{rec.patient?.fullName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Follow-up was {fmtDate(rec.followUpDate)}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex-shrink-0">
                    Risk {rec.aiRiskScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Patients',     path: '/patients',     icon: '👥' },
          { label: 'Appointments', path: '/appointments', icon: '📅' },
          { label: 'Billing',      path: '/billing',      icon: '💳' },
          { label: 'Manage Staff', path: '/admin',        icon: '⚙️' },
        ].map(({ label, path, icon }) => (
          <Link key={path} to={path} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-teal-300 transition-colors">
            <span className="text-xl">{icon}</span>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Doctor View ───────────────────────────────────────────────────────────────

function DoctorView({ stats = {}, appointments = [] }) {
  const { todayCount = 0, pendingLabCount = 0, activeRxCount = 0, flaggedLabs = [], overdueFollowUps = [] } = stats;

  const sortedAppts = [...appointments].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  return (
    <section className="space-y-6">
      {/* Row 1 — Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Today's Appointments" value={todayCount} sub="Scheduled for today" accent="teal" />
        <StatCard label="Pending Lab Orders"   value={pendingLabCount} sub="Ordered or in-progress" accent="amber" />
        <StatCard label="Active Prescriptions" value={activeRxCount}  sub="Written by you" />
      </div>

      {/* Row 2 — Today's schedule */}
      <div>
        <SectionHeading>Today's Schedule</SectionHeading>
        {sortedAppts.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No appointments scheduled for today.</p></Panel>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {sortedAppts.map((appt) => (
              <Link
                key={appt._id}
                to={`/patients/${appt.patient?._id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-bold text-gray-700 w-14 flex-shrink-0 tabular-nums">
                  {fmtTime(appt.scheduledAt)}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 capitalize ${TYPE_COLOURS[appt.type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {appt.type}
                </span>
                <p className="text-sm font-medium text-gray-900 flex-1 truncate">{appt.patient?.fullName}</p>
                <p className="text-xs text-gray-400 flex-shrink-0">{appt.duration} min</p>
                <StatusBadge status={appt.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Row 3 — Flagged labs + Overdue follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <SectionHeading>Flagged Lab Results</SectionHeading>
          {flaggedLabs.length === 0 ? (
            <p className="text-sm text-gray-400">No flagged results for your patients.</p>
          ) : (
            <div className="space-y-2">
              {flaggedLabs.map((order) => (
                <div key={order._id} className="bg-white border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{order.patient?.fullName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(order.flaggedResults ?? []).slice(0, 3).map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {r.testName}: {r.value} {r.unit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <SectionHeading>Overdue Follow-ups</SectionHeading>
          {overdueFollowUps.length === 0 ? (
            <p className="text-sm text-gray-400">No overdue follow-ups.</p>
          ) : (
            <div className="space-y-2">
              {overdueFollowUps.map((rec) => (
                <Link
                  key={rec._id}
                  to={`/patients/${rec.patient?._id}`}
                  className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-3 py-2 hover:border-amber-300 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{rec.patient?.fullName}</p>
                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {fmtDate(rec.followUpDate)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4 — Quick actions */}
      <div>
        <SectionHeading>Quick Actions</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Register Patient', icon: '➕', path: '/patients/register' },
            { label: 'EHR Record',       icon: '📋', path: '/records' },
            { label: 'Lab Order',        icon: '🔬', path: '/lab' },
          ].map(({ label, icon, path }) => (
            <Link key={path} to={path} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-teal-300 transition-colors">
              <span className="text-2xl">{icon}</span>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Nurse View ────────────────────────────────────────────────────────────────

function NurseView({ wards = [], activePrescriptions = [], statOrders = [] }) {
  const allBeds      = wards.flatMap((w) => w.beds ?? []);
  const totalBeds    = allBeds.length;
  const occupiedBeds = allBeds.filter((b) => b.status === 'occupied').length;
  const availBeds    = allBeds.filter((b) => b.status === 'available').length;

  return (
    <section className="space-y-6">
      {/* Row 1 — Bed stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Beds"    value={totalBeds}    sub="Across all wards" />
        <StatCard label="Occupied"      value={occupiedBeds} sub="Currently admitted" accent="red" />
        <StatCard label="Available"     value={availBeds}    sub="Ready for admission" accent="teal" />
      </div>

      {/* Row 2 — Ward cards */}
      <div>
        <SectionHeading>Ward Occupancy</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wards.map((ward) => {
            const occ  = ward.beds?.filter((b) => b.status === 'occupied').length  ?? 0;
            const avail= ward.beds?.filter((b) => b.status === 'available').length ?? 0;
            const res  = ward.beds?.filter((b) => b.status === 'reserved').length  ?? 0;
            const total= ward.capacity ?? 0;
            const pct  = total > 0 ? (occ / total) * 100 : 0;
            return (
              <Link key={ward._id} to="/wards" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-gray-900 text-sm">{ward.name}</p>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{ward.type}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Floor {ward.floor}</p>
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-600">{occ}/{total}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span><span className="font-medium text-teal-600">{avail}</span> avail</span>
                    <span><span className="font-medium text-red-500">{occ}</span> occ</span>
                    <span><span className="font-medium text-amber-500">{res}</span> res</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Row 3 — Active Rx awaiting dispensing */}
      <div>
        <SectionHeading>Active Prescriptions Awaiting Dispensing</SectionHeading>
        {activePrescriptions.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No active prescriptions pending.</p></Panel>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {activePrescriptions.slice(0, 8).map((rx) => (
              <div key={rx._id} className="flex items-start justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{rx.patient?.fullName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {rx.medications?.map((m) => `${m.name} ${m.dosage}`).join(', ')}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2 mt-0.5">
                  {fmtDate(rx.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 4 — STAT lab orders */}
      <div>
        <SectionHeading>STAT Lab Orders</SectionHeading>
        {statOrders.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No STAT lab orders pending.</p></Panel>
        ) : (
          <div className="space-y-2">
            {statOrders.map((order) => (
              <div key={order._id} className="bg-white border-l-4 border-red-500 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.patient?.fullName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{order.tests?.join(', ')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">STAT</span>
                  <span className="text-xs text-gray-400">{fmtTime(order.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Receptionist View ─────────────────────────────────────────────────────────

function ReceptionistView({ todayAppointments = [], upcomingAppointments = [], recentPatients = [] }) {
  const confirmed = todayAppointments.filter((a) => a.status === 'confirmed').length;
  const noShows   = todayAppointments.filter((a) => a.status === 'no-show').length;

  // Group upcoming by date string
  const grouped = upcomingAppointments.reduce((acc, appt) => {
    const key = new Date(appt.scheduledAt).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(appt);
    return acc;
  }, {});
  const groupedDays = Object.entries(grouped)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .slice(0, 5);

  return (
    <section className="space-y-6">
      {/* Row 1 — Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Today's Appointments" value={todayAppointments.length} sub="All statuses" />
        <StatCard label="Confirmed"            value={confirmed}                sub="Ready to check in" accent="teal" />
        <StatCard label="No-Shows"             value={noShows}                  sub="Did not attend"   accent="red" />
      </div>

      {/* Row 2 — Today's check-in list */}
      <div>
        <SectionHeading>Today's Check-in List</SectionHeading>
        {todayAppointments.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No appointments scheduled today.</p></Panel>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {[...todayAppointments]
              .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
              .map((appt) => (
                <div key={appt._id} className="flex items-center gap-4 px-4 py-3">
                  <p className="text-sm font-bold text-gray-700 w-14 flex-shrink-0 tabular-nums">{fmtTime(appt.scheduledAt)}</p>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{appt.patient?.fullName}</p>
                    <p className="text-xs text-gray-500 truncate">Dr. {appt.doctor?.name} · {appt.duration} min</p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Row 3 — Upcoming 7 days grouped by day */}
      <div>
        <SectionHeading>Upcoming — Next 7 Days</SectionHeading>
        {groupedDays.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No upcoming appointments.</p></Panel>
        ) : (
          <div className="space-y-4">
            {groupedDays.map(([dayStr, appts]) => (
              <div key={dayStr}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {new Date(dayStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {appts
                    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                    .map((appt) => (
                      <div key={appt._id} className="flex items-center gap-4 px-4 py-2.5">
                        <p className="text-xs font-bold text-gray-600 w-12 flex-shrink-0 tabular-nums">{fmtTime(appt.scheduledAt)}</p>
                        <p className="text-sm text-gray-900 flex-1 truncate">{appt.patient?.fullName}</p>
                        <p className="text-xs text-gray-400 flex-shrink-0 truncate hidden sm:block">Dr. {appt.doctor?.name}</p>
                        <StatusBadge status={appt.status} />
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 4 — Recently registered patients */}
      <div>
        <SectionHeading>Recently Registered Patients</SectionHeading>
        {recentPatients.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No recent registrations.</p></Panel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentPatients.map((p) => (
              <Link key={p._id} to={`/patients/${p._id}`} className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-teal-300 transition-colors">
                <p className="text-sm font-medium text-gray-900">{p.fullName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.nhsNumber}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Registered {fmtDate(p.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Lab Tech View ─────────────────────────────────────────────────────────────

function LabTechView({ pendingOrders = [], inProgressOrders = [], completedToday = [] }) {
  const statCount = pendingOrders.filter((o) => o.priority === 'stat').length;

  const priorityRank = { stat: 0, urgent: 1, routine: 2 };
  const sortedPending = [...pendingOrders].sort(
    (a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2)
  );

  const flaggedToday = completedToday.filter((o) => o.results?.some((r) => r.flagged));

  return (
    <section className="space-y-6">
      {/* Row 1 — Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending Orders"  value={pendingOrders.length}   sub="Awaiting processing" accent="amber" />
        <StatCard label="In-Progress"     value={inProgressOrders.length} sub="Currently processing" accent="teal" />
        <StatCard label="STAT Priority"   value={statCount}              sub="Immediate attention"  accent="red" />
      </div>

      {/* Row 2 — Priority-coded pending queue */}
      <div>
        <SectionHeading>Pending Order Queue</SectionHeading>
        {sortedPending.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No pending orders.</p></Panel>
        ) : (
          <div className="space-y-2">
            {sortedPending.map((order) => (
              <Link
                key={order._id}
                to="/lab"
                className={`flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-teal-300 transition-colors ${PRIORITY_BORDER[order.priority] ?? ''}`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.patient?.fullName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{order.tests?.join(', ')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_BADGE[order.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                    {order.priority}
                  </span>
                  <span className="text-xs text-gray-400 hidden sm:block">{fmtTime(order.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Row 3 — Completed today with flagged results */}
      <div>
        <SectionHeading>Completed Today — Flagged Results</SectionHeading>
        {flaggedToday.length === 0 ? (
          <Panel>
            <p className="text-sm text-gray-400">
              {completedToday.length > 0
                ? `${completedToday.length} order(s) completed today — no flagged results.`
                : 'No orders completed today yet.'}
            </p>
          </Panel>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            {flaggedToday.map((order) => (
              <div key={order._id} className="bg-white border border-red-100 rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-gray-900">{order.patient?.fullName}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(order.results ?? []).filter((r) => r.flagged).slice(0, 4).map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      {r.testName}: {r.value} {r.unit}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Patient View ──────────────────────────────────────────────────────────────

function PatientView({ appointments = [], prescriptions = [], labOrders = [] }) {
  const sortedAppts = [...appointments].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const nextAppt    = sortedAppts[0];

  return (
    <section className="space-y-6">
      {/* Row 1 — Next appointment */}
      <div>
        <SectionHeading>Next Appointment</SectionHeading>
        {!nextAppt ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-400">No upcoming appointments.</p>
            <Link to="/appointments" className="inline-block mt-3 text-sm text-teal-600 font-medium hover:underline">
              Book an appointment →
            </Link>
          </div>
        ) : (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {new Date(nextAppt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                {new Date(nextAppt.scheduledAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                Dr. {nextAppt.doctor?.name}
                {' · '}
                <span className="capitalize">{nextAppt.type}</span>
                {' · '}
                {nextAppt.duration} min
              </p>
            </div>
            <StatusBadge status={nextAppt.status} />
          </div>
        )}
      </div>

      {/* Row 2 — Recent prescriptions */}
      <div>
        <SectionHeading>Current Prescriptions</SectionHeading>
        {prescriptions.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No active prescriptions on file.</p></Panel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {prescriptions.map((rx) => (
              <div key={rx._id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="space-y-1">
                  {rx.medications?.slice(0, 3).map((m, i) => (
                    <div key={i}>
                      <p className="text-sm font-medium text-gray-900">{m.name} {m.dosage}</p>
                      <p className="text-xs text-gray-500">{m.frequency}</p>
                    </div>
                  ))}
                  {rx.medications?.length > 3 && (
                    <p className="text-xs text-gray-400">+{rx.medications.length - 3} more</p>
                  )}
                </div>
                <div className="mt-3">
                  <StatusBadge status={rx.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 3 — Recent lab orders */}
      <div>
        <SectionHeading>Recent Lab Results</SectionHeading>
        {labOrders.length === 0 ? (
          <Panel><p className="text-sm text-gray-400">No lab orders on file.</p></Panel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {labOrders.map((order) => {
              const hasFlagged = order.results?.some((r) => r.flagged);
              return (
                <div key={order._id} className={`border rounded-xl p-4 ${hasFlagged ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                  <p className="text-xs text-gray-500">{order.tests?.join(', ')}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusBadge status={order.status} />
                    {hasFlagged && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Flagged
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{fmtDate(order.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 4 — Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link to="/appointments" className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-teal-300 transition-colors">
          View All Appointments
        </Link>
        <Link to="/records" className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-teal-300 transition-colors">
          My Health Records
        </Link>
      </div>
    </section>
  );
}
