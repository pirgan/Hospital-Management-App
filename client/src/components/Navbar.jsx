/**
 * Navbar
 * Top navigation bar. Shows app title and right-side controls.
 * Displays the logged-in user's name, role badge, and logout button.
 * On mobile, shows a hamburger button to toggle the Sidebar.
 *
 * @param {function} onMenuToggle — called when hamburger is clicked (mobile)
 */
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { formatUserRoles } from '../utils/roles';

const ROLE_COLOURS = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-blue-100 text-blue-700',
  nurse: 'bg-teal-100 text-teal-700',
  patient: 'bg-green-100 text-green-700',
  receptionist: 'bg-yellow-100 text-yellow-700',
  lab_tech: 'bg-orange-100 text-orange-700',
};

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Hamburger for mobile */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
      >
        ☰
      </button>

      <Link to="/dashboard" className="text-lg font-bold text-teal-700 tracking-tight hover:opacity-90">
        MediCore
      </Link>
      <Link
        to="/dashboard"
        className="hidden sm:inline text-sm font-medium text-gray-600 hover:text-teal-700 ml-2"
      >
        Dashboard
      </Link>

      <div className="ml-auto flex items-center gap-3">
        {user && (
          <>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize max-w-[200px] truncate
                ${ROLE_COLOURS[user.role] || 'bg-gray-100 text-gray-600'}`}
              title={formatUserRoles(user)}
            >
              {formatUserRoles(user)}
            </span>
            <span className="text-sm text-gray-700 hidden sm:block">{user.name}</span>
          </>
        )}
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
