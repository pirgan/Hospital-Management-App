/**
 * PharmacyDashboard
 * Active prescription queue for pharmacy/nursing staff.
 *
 * Lists all active prescriptions with patient name, medications, and
 * a Dispense button that calls PATCH /prescriptions/:id/dispense.
 * Also shows the AI interaction check result if available.
 */
import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import { toast } from 'react-toastify';

export default function PharmacyDashboard() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * load — fetches all active prescriptions from GET /prescriptions?status=active.
   * Called on mount and after each dispense so the list stays current.
   */
  async function load() {
    setLoading(true);
    try {
      // Only active prescriptions are shown — dispensed ones are no longer actionable
      const { data } = await api.get('/prescriptions?status=active');
      setPrescriptions(data.data || data);
    } catch (_) {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // load once on mount

  /**
   * dispense — sends PATCH /prescriptions/:id/dispense to mark the prescription as dispensed.
   * The server transitions status from 'active' → 'dispensed' and returns the updated document.
   * We reload the list afterward to remove the dispensed item from view.
   */
  async function dispense(id) {
    try {
      await api.patch(`/prescriptions/${id}/dispense`);
      toast.success('Prescription dispensed');
      load(); // refresh list to drop this prescription from the active queue
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispense failed');
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Pharmacy — Active Prescriptions</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading prescriptions...</p>
      ) : prescriptions.length === 0 ? (
        <p className="text-gray-400 text-sm">No active prescriptions.</p>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx._id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{rx.patient?.fullName}</p>
                  <p className="text-xs text-gray-500">Prescribed by Dr. {rx.doctor?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={rx.status} />
                  <button
                    onClick={() => dispense(rx._id)}
                    className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700"
                  >
                    Dispense
                  </button>
                </div>
              </div>

              <ul className="space-y-1">
                {rx.medications?.map((med, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    <span className="font-medium">{med.name}</span>
                    {' '}{med.dosage} — {med.frequency} for {med.duration}
                    {med.instructions && <span className="text-gray-400"> ({med.instructions})</span>}
                  </li>
                ))}
              </ul>

              {/* AI interaction check result */}
              {rx.aiInteractionCheck && !rx.aiInteractionCheck.safe && (
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-orange-700">
                    ⚠ Interaction warning overridden at prescribing
                  </p>
                  <p className="text-xs text-orange-600 mt-0.5">{rx.aiInteractionCheck.recommendation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
