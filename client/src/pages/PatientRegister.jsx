/**
 * PatientRegister
 * 3-step registration wizard:
 *   Step 1 — Demographics: name, DOB, gender, blood type, NHS number
 *   Step 2 — Contact: phone, email, address, emergency contact
 *   Step 3 — Insurance: provider, policy number, allergies, chronic conditions
 *
 * Navigation: Next/Back between steps; Submit only shown on step 3.
 * Form state is accumulated in a single object across steps.
 * On success, navigates to the new patient's detail page.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['male', 'female', 'other'];

export default function PatientRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullName: '', dateOfBirth: '', gender: 'male', bloodType: '', nhsNumber: '',
    contactInfo: { phone: '', email: '', address: '' },
    emergencyContact: { name: '', relation: '', phone: '' },
    insuranceDetails: { provider: '', policyNumber: '' },
    allergies: '',
    chronicConditions: '',
  });
  const [loading, setLoading] = useState(false);

  /**
   * set — generic nested field setter supporting one or two key depths.
   * Uses dot notation: set('contactInfo.phone', '07700...')
   * One level: set('fullName', 'Jane Doe') → { ...form, fullName: 'Jane Doe' }
   * Two levels: set('contactInfo.phone', ...) → { ...form, contactInfo: { ...contactInfo, phone: ... } }
   */
  function set(path, value) {
    setForm((prev) => {
      const keys = path.split('.');
      if (keys.length === 1) return { ...prev, [keys[0]]: value };
      return { ...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: value } };
    });
  }

  /**
   * handleSubmit — transforms the wizard form state into a Patient document payload.
   * Allergies and chronicConditions are entered as comma-separated strings in the UI
   * and converted to string arrays here before sending to POST /patients.
   * On success, navigates to the new patient's detail page.
   */
  async function handleSubmit() {
    setLoading(true);
    try {
      const payload = {
        ...form,
        // Convert "Penicillin, Aspirin" → ["Penicillin", "Aspirin"]; filter removes empty strings
        allergies: form.allergies.split(',').map((s) => s.trim()).filter(Boolean),
        chronicConditions: form.chronicConditions.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const { data } = await api.post('/patients', payload);
      toast.success('Patient registered successfully');
      navigate(`/patients/${data._id}`); // go straight to the new patient's profile
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const steps = ['Demographics', 'Contact', 'Insurance'];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Register New Patient</h1>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {steps.map((label, i) => {
          const n = i + 1;
          return (
            <div key={n} className="flex-1 flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${step >= n ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {n}
              </div>
              <span className={`text-sm font-medium ${step >= n ? 'text-teal-700' : 'text-gray-400'}`}>{label}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-teal-400' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        {/* Step 1 — Demographics */}
        {step === 1 && (
          <>
            <Field label="Full Name" value={form.fullName} onChange={(v) => set('fullName', v)} />
            <Field label="Date of Birth" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} type="date" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select value={form.gender} onChange={(e) => set('gender', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {GENDERS.map((g) => <option key={g} value={g} className="capitalize">{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
              <select value={form.bloodType} onChange={(e) => set('bloodType', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="">Unknown</option>
                {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
            <Field label="NHS Number" value={form.nhsNumber} onChange={(v) => set('nhsNumber', v)} placeholder="000-000-0000" />
          </>
        )}

        {/* Step 2 — Contact */}
        {step === 2 && (
          <>
            <Field label="Phone" value={form.contactInfo.phone} onChange={(v) => set('contactInfo.phone', v)} />
            <Field label="Email" value={form.contactInfo.email} onChange={(v) => set('contactInfo.email', v)} type="email" />
            <Field label="Address" value={form.contactInfo.address} onChange={(v) => set('contactInfo.address', v)} />
            <hr className="my-2 border-gray-100" />
            <p className="text-sm font-semibold text-gray-700">Emergency Contact</p>
            <Field label="Name" value={form.emergencyContact.name} onChange={(v) => set('emergencyContact.name', v)} />
            <Field label="Relation" value={form.emergencyContact.relation} onChange={(v) => set('emergencyContact.relation', v)} />
            <Field label="Phone" value={form.emergencyContact.phone} onChange={(v) => set('emergencyContact.phone', v)} />
          </>
        )}

        {/* Step 3 — Insurance */}
        {step === 3 && (
          <>
            <Field label="Insurance Provider" value={form.insuranceDetails.provider} onChange={(v) => set('insuranceDetails.provider', v)} />
            <Field label="Policy Number" value={form.insuranceDetails.policyNumber} onChange={(v) => set('insuranceDetails.policyNumber', v)} />
            <Field label="Allergies (comma-separated)" value={form.allergies} onChange={(v) => set('allergies', v)} placeholder="Penicillin, Aspirin" />
            <Field label="Chronic Conditions (comma-separated)" value={form.chronicConditions} onChange={(v) => set('chronicConditions', v)} placeholder="Type 2 Diabetes, Hypertension" />
          </>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register Patient'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
      />
    </div>
  );
}
