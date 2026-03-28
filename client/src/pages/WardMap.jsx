/**
 * WardMap
 * Visual ward management page.
 *
 * Features:
 *   - Ward selector tabs (one tab per ward from GET /wards)
 *   - BedGrid component for the selected ward
 *   - Admit form: patient selector + bed number → POST /wards/admit
 *   - Discharge form: patient selector → POST /wards/discharge
 */
import { useEffect, useState } from 'react';
import api from '../api/axios';
import BedGrid from '../components/BedGrid';
import { toast } from 'react-toastify';

export default function WardMap() {
  const [wards, setWards] = useState([]);
  const [activeWard, setActiveWard] = useState(null);
  const [patients, setPatients] = useState([]);
  const [action, setAction] = useState(null); // 'admit' | 'discharge' | null
  const [form, setForm] = useState({ patientId: '', bedNumber: '' });
  const [loading, setLoading] = useState(false);

  async function loadWards() {
    // Set loading true before fetching so the empty-state check knows we're in-flight
    setLoading(true);
    try {
      const { data } = await api.get('/wards');
      // GET /wards returns an array directly (no wrapper), fall back in case of wrapper
      const wardList = data.data || data;
      setWards(wardList);
      // Pre-select the first ward so the tab UI renders immediately
      if (wardList.length > 0) setActiveWard(wardList[0]);
    } catch (_) {
      // On error, leave wards empty so the empty-state message renders
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWards();
    // Load all patients for the admit/discharge dropdowns (limit=200 is safe for most hospitals)
    api.get('/patients?limit=200').then(({ data }) => setPatients(data.patients || data)).catch(() => {});
  }, []);

  async function handleAdmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/wards/admit', {
        wardId: activeWard._id,
        patientId: form.patientId,
        bedNumber: parseInt(form.bedNumber),
      });
      toast.success('Patient admitted');
      setAction(null);
      loadWards();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Admit failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDischarge(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Find the bed number for this patient — the controller looks up beds by bedNumber,
      // so we must include it. When the ward is populated, bed.patient is an object;
      // when it is not populated, bed.patient is just an ObjectId string.
      const occupiedBed = activeWard.beds?.find(
        (b) => b.patient?._id?.toString() === form.patientId || b.patient?.toString() === form.patientId
      );
      await api.post('/wards/discharge', {
        wardId: activeWard._id,
        patientId: form.patientId,
        bedNumber: occupiedBed?.number, // let controller find by patientId if undefined
      });
      toast.success('Patient discharged');
      setAction(null);
      loadWards();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Discharge failed');
    } finally {
      setLoading(false);
    }
  }

  // Show a proper empty state when wards have loaded but none exist yet.
  // The old check (!activeWard) was true both while loading AND when wards were empty,
  // causing "Loading wards..." to show forever on a fresh system with no wards.
  if (wards.length === 0 && !loading) {
    return (
      <div className="p-6 text-gray-400">
        No wards configured yet. Ask an admin to create wards via the API.
      </div>
    );
  }
  // Still waiting for the initial fetch to complete
  if (!activeWard) return <div className="p-6 text-gray-400">Loading wards...</div>;

  const occupiedCount = activeWard.beds?.filter((b) => b.status === 'occupied').length || 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Ward Map</h1>
        <div className="flex gap-2">
          <button onClick={() => { setAction('admit'); setForm({ patientId: '', bedNumber: '' }); }}
            className="px-3 py-2 bg-teal-600 text-white text-sm rounded-lg font-medium hover:bg-teal-700">
            + Admit Patient
          </button>
          <button onClick={() => { setAction('discharge'); setForm({ patientId: '', bedNumber: '' }); }}
            className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 text-sm rounded-lg font-medium hover:bg-red-100">
            Discharge Patient
          </button>
        </div>
      </div>

      {/* Ward tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {wards.map((ward) => (
          <button key={ward._id} onClick={() => setActiveWard(ward)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${activeWard._id === ward._id ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {ward.name}
          </button>
        ))}
      </div>

      {/* Ward info */}
      <div className="flex items-center gap-4 mb-5 text-sm text-gray-600">
        <span className="capitalize font-medium text-gray-800">{activeWard.type}</span>
        <span>Floor {activeWard.floor}</span>
        <span>{occupiedCount}/{activeWard.capacity} occupied</span>
      </div>

      {/* Bed grid */}
      <BedGrid beds={activeWard.beds || []} />

      {/* Admit / Discharge forms */}
      {action === 'admit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Admit Patient to {activeWard.name}</h2>
            <form onSubmit={handleAdmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                <select required value={form.patientId} onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none">
                  <option value="">Select patient...</option>
                  {patients.map((p) => <option key={p._id} value={p._id}>{p.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bed Number</label>
                <input required type="number" value={form.bedNumber} onChange={(e) => setForm((p) => ({ ...p, bedNumber: e.target.value }))}
                  placeholder="e.g. 5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setAction(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                  {loading ? 'Admitting...' : 'Admit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {action === 'discharge' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Discharge Patient from {activeWard.name}</h2>
            <form onSubmit={handleDischarge} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                <select required value={form.patientId} onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none">
                  <option value="">Select patient...</option>
                  {patients
                    // When beds are populated, b.patient is an object { _id, fullName }.
                    // When not populated, b.patient is a raw ObjectId string.
                    // We must check both to correctly filter only currently-admitted patients.
                    .filter((p) => activeWard.beds?.some(
                      (b) => (b.patient?._id?.toString() === p._id || b.patient?.toString() === p._id) && b.status === 'occupied'
                    ))
                    .map((p) => <option key={p._id} value={p._id}>{p.fullName}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setAction(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                  {loading ? 'Discharging...' : 'Discharge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
