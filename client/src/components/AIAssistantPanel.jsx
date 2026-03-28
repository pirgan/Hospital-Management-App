/**
 * AIAssistantPanel
 * Streaming differential diagnosis panel embedded in the EHR record view.
 *
 * Calls /api/ai/differential-diagnosis with the medical record ID.
 * SSE chunks stream in and are rendered as a growing text block.
 * Once streaming ends, attempts to parse the content as JSON (the AI returns
 * a structured list) to render individual diagnosis cards with confidence bars.
 *
 * If JSON parsing fails, falls back to rendering raw text — graceful degradation.
 *
 * @param {string} recordId — MedicalRecord _id to request diagnosis for
 */
import { useState } from 'react';
import useSSE from '../hooks/useSSE';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function AIAssistantPanel({ recordId }) {
  const url = `${API_BASE}/ai/differential-diagnosis?recordId=${recordId}`;
  const { content, streaming, error, start } = useSSE(url);
  const [expanded, setExpanded] = useState({}); // tracks which diagnosis is expanded

  // Attempt to parse AI response as structured JSON array
  let diagnoses = null;
  if (content && !streaming) {
    try {
      diagnoses = JSON.parse(content);
    } catch (_) {
      // Not JSON — render as plain text
    }
  }

  return (
    <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-2xl border border-teal-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <h3 className="font-semibold text-gray-900">AI Differential Diagnosis</h3>
        </div>
        <button
          onClick={start}
          disabled={streaming}
          className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {streaming ? 'Analysing...' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {streaming && !content && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="animate-pulse">●</span> Claude is analysing the record...
        </div>
      )}

      {/* Structured view: confidence bars per diagnosis */}
      {diagnoses && Array.isArray(diagnoses) ? (
        <ul className="space-y-3">
          {diagnoses.map((d, i) => (
            <li key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{d.diagnosis}</span>
                    {d.icd10 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {d.icd10}
                      </span>
                    )}
                  </div>
                  {/* Confidence bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${(d.confidence || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">
                      {Math.round((d.confidence || 0) * 100)}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
                  className="text-xs text-teal-600 hover:underline ml-2 mt-1"
                >
                  {expanded[i] ? 'Hide' : 'Reasoning'}
                </button>
              </div>
              {expanded[i] && d.reasoning && (
                <p className="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-2">
                  {d.reasoning}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : content ? (
        // Fallback: raw streamed text
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{content}</pre>
      ) : null}
    </div>
  );
}
