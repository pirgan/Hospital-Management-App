/**
 * MedicalRecordList
 * Full list of all EHR visit records across the system (no patient filter).
 *
 * Features:
 *   - Fetches GET /medical-records on mount and shows every record in a table
 *   - Table columns: patient name, doctor, visit date, chief complaint, diagnoses (badges)
 *   - "+ New Record" button navigates to /records/new (the EHRRecord create form)
 *   - Clicking a table row navigates to /records/:id (the EHRRecord view form)
 *   - Shows a friendly empty state when no records exist yet
 *
 * This page is accessible to admin, doctor, and nurse roles (enforced in App.jsx via RoleRoute).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function MedicalRecordList() {
  // records — the array of MedicalRecord documents returned by the server
  const [records, setRecords] = useState([]);

  // loading — true while the initial fetch is in flight so we can show a loading message
  const [loading, setLoading] = useState(true);

  // navigate — React Router hook used to push to detail or create routes on user action
  const navigate = useNavigate();

  /**
   * fetchRecords
   * Calls GET /medical-records with no query params to retrieve all records.
   * The server returns an array directly (no pagination wrapper for this endpoint).
   * Falls back to an empty array on error so the empty-state message renders gracefully.
   */
  async function fetchRecords() {
    setLoading(true);
    try {
      const { data } = await api.get('/medical-records');
      // The endpoint returns an array directly; guard against accidental wrapper shape
      setRecords(Array.isArray(data) ? data : data.data || data);
    } catch (_) {
      // Non-critical — show empty state instead of crashing
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  // Run once on mount to populate the table
  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header with action button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">EHR Records</h1>
        {/* Navigate to create form — /records/new renders EHRRecord in create mode */}
        <button
          onClick={() => navigate('/records/new')}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
        >
          + New Record
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading records...</p>
      ) : records.length === 0 ? (
        /* Empty state — shown when the list has loaded but contains no documents */
        <p className="text-gray-400 text-sm">No records found.</p>
      ) : (
        /* Records table */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Patient', 'Doctor', 'Visit Date', 'Chief Complaint', 'Diagnoses'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((rec) => (
                // Clicking any row opens the record in view mode at /records/:id
                <tr
                  key={rec._id}
                  onClick={() => navigate(`/records/${rec._id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  {/* Patient name — populated ref from the server; show '—' if not populated */}
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {rec.patient?.fullName || '—'}
                  </td>

                  {/* Doctor name — populated ref from the server */}
                  <td className="px-4 py-3 text-gray-600">
                    {rec.doctor?.name ? `Dr. ${rec.doctor.name}` : '—'}
                  </td>

                  {/* Visit date — ISO string formatted to locale date */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {rec.visitDate
                      ? new Date(rec.visitDate).toLocaleDateString()
                      : '—'}
                  </td>

                  {/* Chief complaint — truncated to keep rows compact */}
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                    {rec.chiefComplaint || '—'}
                  </td>

                  {/* Diagnoses — rendered as small grey badges (ICD-10 code + description) */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {rec.diagnoses?.length > 0 ? (
                        rec.diagnoses.map((d, i) => (
                          <span
                            key={i}
                            // Each badge shows the ICD-10 code so clinical staff can
                            // identify diagnoses at a glance without opening the record
                            className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded"
                          >
                            {d.icd10Code ? `${d.icd10Code} — ` : ''}{d.description}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">None</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
