/**
 * EHRRecord
 * Create or view a medical record (visit note).
 *
 * In create mode (no real record id — path is /records/new or :id is the literal "new"):
 *   shows a full form with vitals entry,
 *   diagnosis fields (ICD-10 code + description), treatment plan, and
 *   the AI Differential Diagnosis panel for the current patient.
 *
 * In view mode (:id present): displays the saved record with vitals,
 *   diagnoses, treatment plan, and AI risk score.
 *
 * The AIAssistantPanel is only shown in create mode since it needs to
 * fire against an unsaved record context (we pass patientId instead).
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import AIAssistantPanel from '../components/AIAssistantPanel';
import { toast } from 'react-toastify';

export default function EHRRecord() {
  const { id } = useParams(); // present in view mode
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient'); // for create mode
  const navigate = useNavigate();

  const [record, setRecord] = useState(null); // view mode
  const [form, setForm] = useState({
    patient: patientId || '',
    visitDate: new Date().toISOString().split('T')[0],
    chiefComplaint: '',
    vitals: { height: '', weight: '', bp: '', pulse: '', temp: '', o2sat: '' },
    diagnoses: [{ icd10Code: '', description: '', type: 'primary' }],
    treatmentPlan: '',
    followUpDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);

  // If /records/:id matches the literal segment "new", id is the string "new" — still create mode.
  // (!id alone would be false for that string, wrongly entering view mode and fetching /medical-records/new.)
  const isCreateMode = !id || id === 'new';

  useEffect(() => {
    if (!isCreateMode) {
      // View mode: fetch the specific record by id for display
      api.get(`/medical-records/${id}`).then(({ data }) => setRecord(data)).catch(() => {});
    } else {
      setRecord(null);
      // Create mode: load patient list so the doctor can select who the record is for
      api
        .get('/patients?limit=100')
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : data.patients ?? data.data;
          setPatients(Array.isArray(list) ? list : []);
        })
        .catch(() => {});
    }
  }, [id, isCreateMode]);

  /**
   * setVital — updates a single key inside the nested vitals object.
   * Uses a spread to avoid mutating the existing vitals object.
   */
  function setVital(key, value) {
    setForm((prev) => ({ ...prev, vitals: { ...prev.vitals, [key]: value } }));
  }

  /**
   * setDiagnosis — updates a single field in the diagnoses array at position index.
   * Spreads the array to avoid direct mutation (React state must be immutable).
   */
  function setDiagnosis(index, key, value) {
    setForm((prev) => {
      const diagnoses = [...prev.diagnoses]; // shallow copy of the array
      diagnoses[index] = { ...diagnoses[index], [key]: value }; // replace the target element
      return { ...prev, diagnoses };
    });
  }

  /**
   * addDiagnosis — appends a blank secondary diagnosis row to the diagnoses array.
   * New rows default to 'secondary' type since primary is already set on row 0.
   */
  function addDiagnosis() {
    setForm((prev) => ({
      ...prev,
      diagnoses: [...prev.diagnoses, { icd10Code: '', description: '', type: 'secondary' }],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/medical-records', form);
      toast.success('Medical record saved');
      navigate(`/patients/${form.patient}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  if (!isCreateMode && !record) return <div className="p-6 text-gray-400">Loading record...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">
        {isCreateMode ? 'New Visit Note' : `Visit — ${new Date(record.visitDate).toLocaleDateString()}`}
      </h1>

      {isCreateMode ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main form — 2/3 width */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
            {!patientId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                <select required value={form.patient} onChange={(e) => setForm((p) => ({ ...p, patient: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none">
                  <option value="">Select patient...</option>
                  {patients.map((p) => <option key={p._id} value={p._id}>{p.fullName}</option>)}
                </select>
              </div>
            )}

            <Card title="Chief Complaint">
              <textarea required value={form.chiefComplaint}
                onChange={(e) => setForm((p) => ({ ...p, chiefComplaint: e.target.value }))}
                placeholder="Reason for visit..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none resize-none" />
            </Card>

            <Card title="Vitals">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Height (cm)', key: 'height' },
                  { label: 'Weight (kg)', key: 'weight' },
                  { label: 'BP (e.g. 120/80)', key: 'bp' },
                  { label: 'Pulse (bpm)', key: 'pulse' },
                  { label: 'Temp (°C)', key: 'temp' },
                  { label: 'O₂ Sat (%)', key: 'o2sat' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input type="text" value={form.vitals[key]} onChange={(e) => setVital(key, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Diagnoses (ICD-10)">
              {form.diagnoses.map((d, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                  <input type="text" placeholder="ICD-10 code" value={d.icd10Code}
                    onChange={(e) => setDiagnosis(i, 'icd10Code', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
                  <input type="text" placeholder="Description" value={d.description}
                    onChange={(e) => setDiagnosis(i, 'description', e.target.value)}
                    className="col-span-2 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
                  <select value={d.type} onChange={(e) => setDiagnosis(i, 'type', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none">
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="differential">Differential</option>
                  </select>
                </div>
              ))}
              <button type="button" onClick={addDiagnosis}
                className="text-sm text-teal-600 hover:underline mt-1">+ Add diagnosis</button>
            </Card>

            <Card title="Treatment Plan">
              <textarea required value={form.treatmentPlan}
                onChange={(e) => setForm((p) => ({ ...p, treatmentPlan: e.target.value }))}
                placeholder="Treatment plan, medications, referrals..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none resize-none" />
            </Card>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
              <input type="date" value={form.followUpDate}
                onChange={(e) => setForm((p) => ({ ...p, followUpDate: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Record'}
            </button>
          </form>

          {/* AI panel — 1/3 width, only shown when patient is selected */}
          <div className="lg:col-span-1">
            {form.patient && <AIAssistantPanel recordId={form.patient} />}
          </div>
        </div>
      ) : (
        /* View mode */
        <div className="space-y-5">
          <Card title="Chief Complaint">
            <p className="text-sm text-gray-800">{record.chiefComplaint}</p>
          </Card>
          <Card title="Vitals">
            <div className="grid grid-cols-3 gap-3 text-sm">
              {Object.entries(record.vitals || {}).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><span className="text-gray-500 capitalize">{k}: </span><span className="text-gray-800 font-medium">{v}</span></div>
              ))}
            </div>
          </Card>
          <Card title="Diagnoses">
            {record.diagnoses?.map((d, i) => (
              <p key={i} className="text-sm text-gray-800">
                <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2">{d.icd10Code}</span>
                {d.description}
                <span className="ml-2 text-xs text-gray-400 capitalize">({d.type})</span>
              </p>
            ))}
          </Card>
          <Card title="Treatment Plan">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{record.treatmentPlan}</p>
          </Card>
          {record.aiRiskScore && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-700">AI Risk Score: {record.aiRiskScore}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">{title}</p>
      {children}
    </div>
  );
}
