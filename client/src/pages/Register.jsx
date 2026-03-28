/**
 * Register page
 * Staff account registration form. Submits to AuthContext.register().
 * Role field is shown so new accounts can self-select their role
 * (admin approval is separate in the AdminPanel).
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const ROLES = ['doctor', 'nurse', 'receptionist', 'lab_tech', 'patient'];

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'patient', department: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  /** update — generic setter for any single form field to avoid repeating onChange handlers */
  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * handleSubmit — calls AuthContext.register() which POSTs to /auth/register.
   * The server creates the User document and returns a JWT so the user is
   * immediately logged in — no separate login step required.
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form); // stores token + user in localStorage via AuthContext
      toast.success('Account created successfully');
      navigate('/dashboard'); // go straight to the app after registration
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-teal-700">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">MediCore — Staff Registration</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Full Name', field: 'name', type: 'text', placeholder: 'Dr. Jane Smith' },
            { label: 'Email', field: 'email', type: 'email', placeholder: 'jane@medicore.nhs' },
            { label: 'Password', field: 'password', type: 'password', placeholder: 'Min 8 characters' },
            { label: 'Department (optional)', field: 'department', type: 'text', placeholder: 'Cardiology' },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                required={field !== 'department'}
                value={form[field]}
                onChange={(e) => update(field, e.target.value)}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">{r}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold
              hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-teal-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
