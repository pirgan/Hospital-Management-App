/**
 * Sidebar
 * Collapsible left navigation sidebar.
 * Menu items are filtered by the user's role so each role sees only
 * the sections relevant to them.
 *
 * Collapsed state: shows only icons (w-16).
 * Expanded state: shows icons + labels (w-56).
 *
 * @param {boolean}  open       — whether sidebar is expanded (controlled by parent)
 * @param {function} onToggle   — called to toggle collapsed/expanded
 */
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userHasRole } from '../utils/roles';

// Each item has a roles array; shown only if user.role is included
const NAV_ITEMS = [
  { label: 'Dashboard',     path: '/dashboard',     icon: '🏠', roles: ['admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'patient'] },
  { label: 'Patients',      path: '/patients',      icon: '👥', roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
  { label: 'Appointments',  path: '/appointments',  icon: '📅', roles: ['admin', 'doctor', 'nurse', 'receptionist', 'patient'] },
  { label: 'EHR Records',   path: '/records',       icon: '📋', roles: ['admin', 'doctor', 'nurse'] },
  { label: 'Pharmacy',      path: '/pharmacy',      icon: '💊', roles: ['admin', 'doctor', 'nurse'] },
  { label: 'Lab Results',   path: '/lab',           icon: '🔬', roles: ['admin', 'doctor', 'lab_tech'] },
  { label: 'Billing',       path: '/billing',       icon: '💳', roles: ['admin', 'receptionist'] },
  { label: 'Ward Map',      path: '/wards',         icon: '🏥', roles: ['admin', 'doctor', 'nurse'] },
  { label: 'Admin',         path: '/admin',         icon: '⚙️',  roles: ['admin'] },
];

export default function Sidebar({ open, onToggle }) {
  const { user } = useAuth();
  // Filter nav items by the current user's role — each item declares which roles can see it.
  // Optional chaining on user?.role handles the brief moment before auth state is loaded.
  const filtered = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => userHasRole(user, r))
  );

  return (
    <aside
      className={`flex flex-col bg-gray-900 text-gray-300 transition-all duration-200 h-full
        ${open ? 'w-56' : 'w-16'}`}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="h-14 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        title={open ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {open ? '◀' : '▶'}
      </button>

      <nav className="flex-1 py-2">
        {/* NavLink: className receives isActive from React Router for the current route */}
        {filtered.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
              ${isActive
                ? 'bg-teal-700 text-white'
                : 'hover:bg-gray-800 hover:text-white'}`
            }
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {open && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
