/**
 * PatientDetail
 * Full patient view with tabbed sections.
 *
 * Tabs:
 *   Overview     — demographics, allergies, chronic conditions, emergency contact
 *   EHR History  — list of medical records / visit notes
 *   Prescriptions — active and dispensed prescriptions
 *   Lab Orders   — ordered tests and results
 *   Invoices     — billing history
 *   AI Summary   — cached Claude summary (or generate on demand)
 *
 * Data fetching: loads patient on mount; each tab fetches its own data lazily.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import VitalsChart from '../components/VitalsChart';

const TABS = ['Overview', 'EHR History', 'Prescriptions', 'Lab Orders', 'Invoices', 'AI Summary'];

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [tabData, setTabData] = useState({});
  const [aiLoading, setAiLoading] = useState(false);

  // Load patient demographics
  useEffect(() => {
    api.get(`/patients/${id}`).then(({ data }) => setPatient(data)).catch(() => {});
  }, [id]);

  // Lazy-load tab data on first visit to each tab.
  // This avoids loading all five data sets up-front — most users only open 1-2 tabs.
  // The tabData cache (keyed by tab label) ensures we don't re-fetch when switching back.
  useEffect(() => {
    if (tabData[activeTab]) return; // already loaded — skip the fetch

    async function load() {
      try {
        let result;
        // Each tab fetches its own endpoint, always scoped to this patient by id
        if (activeTab === 'EHR History') {
          const { data } = await api.get(`/medical-records?patient=${id}`);
          result = data.data || data;
        } else if (activeTab === 'Prescriptions') {
          const { data } = await api.get(`/prescriptions?patient=${id}`);
          result = data.data || data;
        } else if (activeTab === 'Lab Orders') {
          const { data } = await api.get(`/lab-orders?patient=${id}`);
          result = data.data || data;
        } else if (activeTab === 'Invoices') {
          const { data } = await api.get(`/invoices?patient=${id}`);
          result = data.data || data;
        }
        // Store under the tab label key so subsequent visits to this tab are instant
        if (result) setTabData((prev) => ({ ...prev, [activeTab]: result }));
      } catch (_) {}
    }
    load();
  }, [activeTab, id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * generateAiSummary
   * Calls POST /ai/summarize-record which uses Claude Haiku to produce a concise
   * patient summary from all their medical records. The response is cached on the
   * Patient document (patient.aiSummary) so future visits don't re-call the AI.
   * We update both the local patient state and the tabData cache to reflect this.
   */
  async function generateAiSummary() {
    setAiLoading(true);
    try {
      const { data } = await api.post(`/ai/summarize-record`, { patientId: id });
      // Optimistically update the cached patient so the summary persists if user
      // navigates away and comes back (stored in tabData, not just UI state)
      setPatient((prev) => ({ ...prev, aiSummary: data.summary }));
      setTabData((prev) => ({ ...prev, 'AI Summary': data.summary }));
    } catch (_) {} finally {
      setAiLoading(false);
    }
  }

  if (!patient) return <div className="p-6 text-gray-400">Loading patient...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Patient header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{patient.fullName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">NHS: {patient.nhsNumber}</p>
          <div className="flex gap-3 mt-2 text-sm text-gray-600">
            <span>{new Date(patient.dateOfBirth).toLocaleDateString()}</span>
            <span className="capitalize">{patient.gender}</span>
            {patient.bloodType && (
              <span className="font-bold text-red-600">{patient.bloodType}</span>
            )}
          </div>
        </div>
        {patient.allergies?.length > 0 && (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {patient.allergies.map((a) => (
              <span key={a} className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">⚠ {a}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${activeTab === tab
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && (
        <div className="grid sm:grid-cols-2 gap-5">
          <InfoBlock title="Contact" data={{
            Phone: patient.contactInfo?.phone,
            Email: patient.contactInfo?.email,
            Address: patient.contactInfo?.address,
          }} />
          <InfoBlock title="Emergency Contact" data={{
            Name: patient.emergencyContact?.name,
            Relation: patient.emergencyContact?.relation,
            Phone: patient.emergencyContact?.phone,
          }} />
          {patient.chronicConditions?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Chronic Conditions</p>
              <div className="flex flex-wrap gap-2">
                {patient.chronicConditions.map((c) => (
                  <span key={c} className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full border border-blue-200">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'EHR History' && (
        <div>
          {tabData['EHR History']?.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-600 mb-3">Vitals Over Time</p>
              <VitalsChart records={tabData['EHR History']} />
            </div>
          )}
          <div className="space-y-3">
            {(tabData['EHR History'] || []).map((rec) => (
              <div key={rec._id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-gray-900 text-sm">{rec.chiefComplaint}</p>
                  <span className="text-xs text-gray-400">{new Date(rec.visitDate).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-gray-500">Dr. {rec.doctor?.name}</p>
                {rec.diagnoses?.map((d, i) => (
                  <span key={i} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded mt-2 mr-1">
                    {d.icd10Code} — {d.description}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Prescriptions' && (
        <div className="space-y-3">
          {(tabData['Prescriptions'] || []).map((rx) => (
            <div key={rx._id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">{new Date(rx.createdAt).toLocaleDateString()}</p>
                <StatusBadge status={rx.status} />
              </div>
              {rx.medications?.map((med, i) => (
                <p key={i} className="text-sm text-gray-800">
                  <span className="font-medium">{med.name}</span> — {med.dosage} {med.frequency} for {med.duration}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Lab Orders' && (
        <div className="space-y-3">
          {(tabData['Lab Orders'] || []).map((order) => (
            <div key={order._id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                  <StatusBadge status={order.status} />
                  <StatusBadge status={order.priority} />
                </div>
                <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-700">{order.tests?.join(', ')}</p>
              {order.results?.map((r, i) => (
                <p key={i} className={`text-xs mt-1 ${r.flagged ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                  {r.testName}: {r.value} {r.unit} (ref: {r.referenceRange}) {r.flagged ? '⚑' : ''}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Invoices' && (
        <div className="space-y-3">
          {(tabData['Invoices'] || []).map((inv) => (
            <div key={inv._id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">£{inv.totalAmount?.toFixed(2)}</p>
                <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={inv.status} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'AI Summary' && (
        <div>
          {patient.aiSummary ? (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.aiSummary}</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">No AI summary generated yet.</p>
              <button
                onClick={generateAiSummary}
                disabled={aiLoading}
                className="bg-teal-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
              >
                {aiLoading ? 'Generating...' : 'Generate AI Summary'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Small key-value info block used in Overview tab */
function InfoBlock({ title, data }) {
  const entries = Object.entries(data).filter(([, v]) => v);
  if (!entries.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">{title}</p>
      <dl className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-sm">
            <dt className="text-gray-500 w-20 shrink-0">{k}:</dt>
            <dd className="text-gray-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
