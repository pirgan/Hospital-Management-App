/**
 * AdminPanel
 * User management for admins.
 *
 * Features:
 *   - Table of all staff accounts with name, email, role, department, status
 *   - Deactivate/Reactivate toggle (PUT /users/:id with { isActive })
 *   - Create new user form (inline modal)
 *   - Role filter dropdown
 */
import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import { toast } from 'react-toastify';

const ROLES = ['all', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'patient'];

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  /**
   * load — fetches users from GET /users, optionally scoped to a specific role.
   * Re-runs whenever the role filter tab changes.
   */
  async function load() {
    setLoading(true);
    try {
      // Omit the role param entirely when 'all' is selected (returns every user)
      const params = roleFilter !== 'all' ? `?role=${roleFilter}` : '';
      const { data } = await api.get(`/users${params}`);
      setUsers(data.data || data);
    } catch (_) {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * toggleActive — flips the isActive flag on a user account via PUT /users/:id.
   * Deactivating prevents the user from logging in without deleting their history.
   * The toast message adapts to clarify whether we're deactivating or reactivating.
   */
  async function toggleActive(user) {
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? 'Account deactivated' : 'Account reactivated');
      load(); // refresh the table so the status badge updates
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  }

  const ROLE_COLOURS = {
    admin: 'bg-purple-100 text-purple-700',
    doctor: 'bg-blue-100 text-blue-700',
    nurse: 'bg-teal-100 text-teal-700',
    patient: 'bg-green-100 text-green-700',
    receptionist: 'bg-yellow-100 text-yellow-700',
    lab_tech: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Admin — User Management</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
          + New User
        </button>
      </div>

      {/* Role filter */}
      <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 whitespace-nowrap transition-colors
              ${roleFilter === r ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading users...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Role', 'Department', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize
                      ${ROLE_COLOURS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{user.department || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                      ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(user)}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors
                        ${user.isActive
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                    >
                      {user.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-6">No users found.</p>
          )}
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

/** Create user modal — re-uses the same auth register endpoint */
function CreateUserModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'nurse', department: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('User created');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  const ROLE_OPTIONS = ['admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'patient'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="font-bold text-gray-900 mb-4">Create New User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Full Name', field: 'name', type: 'text' },
            { label: 'Email', field: 'email', type: 'email' },
            { label: 'Temporary Password', field: 'password', type: 'password' },
            { label: 'Department (optional)', field: 'department', type: 'text' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} required={field !== 'department'} value={form[field]}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none">
              {ROLE_OPTIONS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
