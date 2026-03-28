/**
 * AppointmentBook
 * Book an appointment using either natural language input or the slot picker.
 *
 * Flow:
 *   1. User types a natural language request (e.g. "book a cardiology follow-up next Monday morning")
 *   2. Hits /api/ai/parse-appointment-intent → Claude extracts date/time/type/doctor
 *   3. Parsed intent is pre-filled into the form fields
 *   4. AppointmentSlotPicker shows available slots for the selected date/doctor
 *   5. User confirms and submits to POST /appointments
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppointmentSlotPicker from '../components/AppointmentSlotPicker';
import { toast } from 'react-toastify';

const TYPES = ['consultation', 'follow-up', 'procedure', 'emergency'];

export default function AppointmentBook() {
  const navigate = useNavigate();
  const [nlInput, setNlInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [form, setForm] = useState({
    patient: '', doctor: '', date: '', selectedSlot: '', type: 'consultation', notes: '',
  });
  const [loading, setLoading] = useState(false);

  // Load doctors and patients in parallel on mount — both are needed before the form is usable.
  // Promise.all fires both requests concurrently to halve the wait time.
  useEffect(() => {
    Promise.all([
      api.get('/users?role=doctor'),   // for the doctor dropdown
      api.get('/patients?limit=100'),  // for the patient dropdown
    ]).then(([d, p]) => {
      setDoctors(d.data.data || d.data);
      setPatients(p.data.data || p.data);
    }).catch(() => {});
  }, []);

  // Re-fetch booked slots whenever the selected doctor or date changes.
  // This keeps the slot picker in sync — greying out times already taken.
  useEffect(() => {
    // Can't look up slots without both a doctor and a date — reset to empty
    if (!form.doctor || !form.date) { setBookedSlots([]); return; }
    const from = `${form.date}T00:00:00`;
    const to = `${form.date}T23:59:59`;
    // GET /appointments scoped to this doctor on this specific day
    api.get(`/appointments?doctor=${form.doctor}&from=${from}&to=${to}`)
      .then(({ data }) => {
        const appts = data.data || data;
        // Slice to 'YYYY-MM-DDTHH:mm' so the format matches the slot strings in buildSlots()
        setBookedSlots(appts.map((a) => a.scheduledAt?.slice(0, 16)));
      }).catch(() => {});
  }, [form.doctor, form.date]);

  /**
   * parseNL
   * Sends the natural language input to Claude Haiku via POST /ai/parse-appointment-intent.
   * The AI extracts structured fields (date, type, notes) and pre-fills the form.
   * The user still must confirm — the AI output is a suggestion, not a final booking.
   */
  async function parseNL() {
    if (!nlInput.trim()) return;
    setParsing(true);
    try {
      // POST with the raw natural language text; Claude returns { intent: { preferredDate, type, notes } }
      const { data } = await api.post('/ai/parse-appointment-intent', { text: nlInput });
      const intent = data.intent || data;
      // Only overwrite fields that Claude was able to extract — keep existing values otherwise
      setForm((prev) => ({
        ...prev,
        date: intent.preferredDate || prev.date,
        type: intent.type || prev.type,
        notes: intent.notes || prev.notes,
      }));
      toast.success('Intent parsed — please confirm the details below');
    } catch (_) {
      toast.error('Could not parse request. Please fill manually.');
    } finally {
      setParsing(false);
    }
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.selectedSlot) { toast.error('Please select a time slot'); return; }
    setLoading(true);
    try {
      await api.post('/appointments', {
        patient: form.patient,
        doctor: form.doctor,
        scheduledAt: form.selectedSlot,
        type: form.type,
        notes: form.notes,
        duration: 30,
      });
      toast.success('Appointment booked');
      navigate('/appointments');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Book Appointment</h1>

      {/* Natural language input */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-teal-700 uppercase mb-2">AI-Assisted Booking</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            placeholder="e.g. Book a cardiology follow-up next Monday morning"
            className="flex-1 border border-teal-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
          />
          <button
            type="button"
            onClick={parseNL}
            disabled={parsing || !nlInput.trim()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {parsing ? '...' : 'Parse'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        {/* Patient */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select required value={form.patient} onChange={(e) => set('patient', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="">Select patient...</option>
            {patients.map((p) => <option key={p._id} value={p._id}>{p.fullName} — {p.nhsNumber}</option>)}
          </select>
        </div>

        {/* Doctor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
          <select required value={form.doctor} onChange={(e) => set('doctor', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="">Select doctor...</option>
            {doctors.map((d) => <option key={d._id} value={d._id}>{d.name}{d.department ? ` — ${d.department}` : ''}</option>)}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        {/* Slot picker */}
        {form.date && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Slot</label>
            <AppointmentSlotPicker
              date={form.date}
              bookedSlots={bookedSlots}
              selectedSlot={form.selectedSlot}
              onSelect={(slot) => set('selectedSlot', slot)}
            />
          </div>
        )}

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
          {loading ? 'Booking...' : 'Confirm Booking'}
        </button>
      </form>
    </div>
  );
}
