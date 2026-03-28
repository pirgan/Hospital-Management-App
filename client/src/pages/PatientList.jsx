/**
 * PatientList
 * Searchable, paginated patient registry.
 * Search fires a debounced GET /patients?search=<query> request.
 * Clicking a card navigates to PatientDetail.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import PatientCard from '../components/PatientCard';

/**
 * useDebounce
 * Delays updating the returned value until `delay` ms after the last change.
 * This prevents an API request on every keypress — instead we wait for the
 * user to pause typing before hitting the server (reduces back-end load).
 */
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    // Schedule an update; if value changes again before the timer fires, cancel and restart
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t); // cleanup: cancel pending timer on each re-render
  }, [value, delay]);
  return debounced;
}

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search);
  const navigate = useNavigate();
  const LIMIT = 12;

  // useCallback memoises fetchPatients so it only changes when its deps change.
  // Without this, the useEffect below would re-run on every render.
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      // Build query string — page and limit are always present; search is optional
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (debouncedSearch) params.set('search', debouncedSearch);
      // GET /patients returns { patients, total, page, pages }
      const { data } = await api.get(`/patients?${params}`);
      // Server returns { patients, total, page, pages } — use data.patients, not data.data
      setPatients(data.patients || data);
      // total is used to calculate totalPages for the pagination controls
      setTotal(data.total || 0);
    } catch (_) {
      setPatients([]); // show empty state rather than stale data on error
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]); // re-create when search or page changes

  useEffect(() => { fetchPatients(); }, [fetchPatients]);
  // Reset to page 1 when search changes so stale page numbers don't cause empty results
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Patient Registry</h1>
        <button
          onClick={() => navigate('/patients/register')}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
        >
          + Register Patient
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name or NHS number..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-teal-400"
      />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading patients...</p>
      ) : patients.length === 0 ? (
        <p className="text-gray-400 text-sm">No patients found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((p) => (
            <PatientCard key={p._id} patient={p} onClick={() => navigate(`/patients/${p._id}`)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
