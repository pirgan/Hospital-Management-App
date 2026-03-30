/**
 * BillingPage
 * Invoice management for admin and receptionist.
 *
 * Features:
 *   - Status filter tabs (all / draft / sent / paid / overdue)
 *   - Invoice list with totals and status badges
 *   - Mark as paid button → PATCH /invoices/:id/pay
 *   - Create invoice form (patient, line items, due date)
 */
import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import InvoiceTable from '../components/InvoiceTable';
import { toast } from 'react-toastify';

const STATUS_FILTERS = ['all', 'draft', 'sent', 'paid', 'overdue'];

export default function BillingPage() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  /**
   * load — fetches invoices from GET /invoices, optionally filtered by status.
   * Called on mount and whenever the status tab filter changes.
   */
  async function load() {
    setLoading(true);
    try {
      // Omit the query param entirely when 'all' is selected (no server-side filter)
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const { data } = await api.get(`/invoices${params}`);
      setInvoices(data.data || data);
    } catch (_) {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * markPaid — sends PATCH /invoices/:id/pay which transitions invoice status to 'paid'
   * and stamps paidAt on the server. Reloads the list so the updated status badge shows.
   */
  async function markPaid(id) {
    try {
      await api.patch(`/invoices/${id}/pay`);
      toast.success('Invoice marked as paid');
      load(); // refresh so paid invoice now shows green badge or moves to paid tab
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Billing</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
          + New Invoice
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
        {STATUS_FILTERS.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 whitespace-nowrap transition-colors
              ${filter === s ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading invoices...</p>
      ) : invoices.length === 0 ? (
        <p className="text-gray-400 text-sm">No invoices found.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === inv._id ? null : inv._id)}
              >
                <div>
                  <p className="font-semibold text-gray-900">{inv.patient?.fullName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                    {inv.paidAt && ` · Paid: ${new Date(inv.paidAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">£{inv.totalAmount?.toFixed(2)}</span>
                  <StatusBadge status={inv.status} size="md" />
                  {(inv.status === 'sent' || inv.status === 'overdue') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markPaid(inv._id); }}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg font-medium hover:bg-green-700"
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded line items */}
              {expanded === inv._id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <InvoiceTable lineItems={inv.lineItems || []} />
                  {inv.insuranceClaim?.provider && (
                    <p className="text-xs text-gray-500 mt-3">
                      Insurance: {inv.insuranceClaim.provider} — {inv.insuranceClaim.policyNumber}
                      {' · '}<StatusBadge status={inv.insuranceClaim.claimStatus} />
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateInvoiceModal onClose={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

/** Inline modal for creating a new invoice */
function CreateInvoiceModal({ onClose }) {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({ patient: '', dueDate: '', lineItems: [{ description: '', qty: 1, unitPrice: 0 }] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/patients?limit=100')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.patients ?? data.data;
        setPatients(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  /**
   * updateLine — updates a field in a specific line item.
   * qty and unitPrice are parsed to floats (falling back to 0) so the total
   * calculation in handleSubmit works with numbers rather than strings.
   */
  function updateLine(i, key, value) {
    setForm((prev) => {
      const lineItems = [...prev.lineItems];
      lineItems[i] = { ...lineItems[i], [key]: key === 'qty' || key === 'unitPrice' ? parseFloat(value) || 0 : value };
      return { ...prev, lineItems };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Compute the total client-side so the server doesn't need to recalculate
      const totalAmount = form.lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      await api.post('/invoices', { ...form, totalAmount });
      toast.success('Invoice created');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <h2 className="font-bold text-gray-900 mb-4">New Invoice</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select required value={form.patient} onChange={(e) => setForm((p) => ({ ...p, patient: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none">
            <option value="">Select patient...</option>
            {patients.map((p) => <option key={p._id} value={p._id}>{p.fullName}</option>)}
          </select>

          {form.lineItems.map((l, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input placeholder="Description" value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                className="col-span-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
              <input type="number" placeholder="Qty" value={l.qty} onChange={(e) => updateLine(i, 'qty', e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
              <input type="number" placeholder="Price (£)" value={l.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
            </div>
          ))}

          <button type="button" onClick={() => setForm((p) => ({ ...p, lineItems: [...p.lineItems, { description: '', qty: 1, unitPrice: 0 }] }))}
            className="text-sm text-teal-600 hover:underline">+ Add line item</button>

          <input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
