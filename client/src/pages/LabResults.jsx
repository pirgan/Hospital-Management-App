/**
 * LabResults
 * Lab technician view for processing ordered tests.
 *
 * Features:
 *   - List of ordered/in-progress lab orders
 *   - Inline result entry form (test name, value, unit, reference range, flagged)
 *   - File upload zone for PDF reports (uploads to Cloudinary via server)
 *   - Submit calls PATCH /lab-orders/:id/results
 */
import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import FileUploadZone from '../components/FileUploadZone';
import { toast } from 'react-toastify';

export default function LabResults() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(null); // orderId being edited
  const [results, setResults] = useState([{ testName: '', value: '', unit: '', referenceRange: '', flagged: false }]);
  const [reportUrl, setReportUrl] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/lab-orders?status=ordered');
      setOrders(data.data || data);
    } catch (_) {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  /**
   * startEntering — opens the inline result entry form for the selected order.
   * Resets results to a single blank row and clears any previously uploaded report URL.
   */
  function startEntering(orderId) {
    setEntering(orderId); // track which order is being edited
    // Start with one empty result row; the tech can add more with "+ Add test result"
    setResults([{ testName: '', value: '', unit: '', referenceRange: '', flagged: false }]);
    setReportUrl(''); // clear previous upload in case the tech switches orders
  }

  /**
   * updateResult — updates a single field in the results array at position i.
   * Uses an immutable copy pattern so React detects the change and re-renders.
   */
  function updateResult(i, key, value) {
    setResults((prev) => {
      const r = [...prev]; // shallow copy so we don't mutate state directly
      r[i] = { ...r[i], [key]: value };
      return r;
    });
  }

  /**
   * submitResults — sends the entered results to PATCH /lab-orders/:id/results.
   * reportFile is optional — only included if the tech uploaded a PDF.
   * On success, closes the form and refreshes the order list.
   */
  async function submitResults() {
    try {
      await api.patch(`/lab-orders/${entering}/results`, {
        results,
        reportFile: reportUrl || undefined, // omit key if no file was uploaded
      });
      toast.success('Results submitted');
      setEntering(null); // close the inline form
      load(); // reload orders to reflect updated status
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit failed');
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Lab Orders</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-400 text-sm">No pending lab orders.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order._id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{order.patient?.fullName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ordered by Dr. {order.doctor?.name}</p>
                  <p className="text-sm text-gray-700 mt-1">{order.tests?.join(', ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={order.priority} />
                  <StatusBadge status={order.status} />
                  {entering !== order._id && (
                    <button onClick={() => startEntering(order._id)}
                      className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">
                      Enter Results
                    </button>
                  )}
                </div>
              </div>

              {entering === order._id && (
                <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
                  {results.map((r, i) => (
                    <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <input placeholder="Test name" value={r.testName} onChange={(e) => updateResult(i, 'testName', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm col-span-2 sm:col-span-1 focus:ring-2 focus:ring-teal-400 focus:outline-none" />
                      <input placeholder="Value" value={r.value} onChange={(e) => updateResult(i, 'value', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
                      <input placeholder="Unit" value={r.unit} onChange={(e) => updateResult(i, 'unit', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
                      <input placeholder="Ref range" value={r.referenceRange} onChange={(e) => updateResult(i, 'referenceRange', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
                      <label className="flex items-center gap-1 text-sm text-red-600 cursor-pointer">
                        <input type="checkbox" checked={r.flagged} onChange={(e) => updateResult(i, 'flagged', e.target.checked)} />
                        Abnormal
                      </label>
                    </div>
                  ))}
                  <button type="button" onClick={() => setResults((p) => [...p, { testName: '', value: '', unit: '', referenceRange: '', flagged: false }])}
                    className="text-sm text-teal-600 hover:underline">+ Add test result</button>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Upload Report (optional)</p>
                    <FileUploadZone
                      endpoint={`/lab-orders/${entering}/upload`}
                      onUploaded={({ url }) => setReportUrl(url)}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEntering(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={submitResults}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700">Submit Results</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
