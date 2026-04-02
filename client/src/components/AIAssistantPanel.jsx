/**
 * AIAssistantPanel
 * Streaming differential diagnosis panel for doctor-only use in the EHR form.
 *
 * Uses fetch + ReadableStream (not EventSource) because the endpoint is POST —
 * EventSource only supports GET so the useSSE hook cannot be used here.
 *
 * Rendering strategy while streaming:
 *   - Complete lines that match the differential format are rendered as cards.
 *   - Non-matching complete lines (headers, blank lines, disclaimer) are rendered as text.
 *   - The currently-streaming incomplete line is shown as raw text with a blinking cursor.
 *
 * @prop {object} recordData  — { chiefComplaint, vitals, allergies, chronicConditions, _id }
 * @prop {function} onSave    — called with the full generated text when "Accept to EHR" is clicked
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Matches: "1. Diagnosis Name — Confidence: 75% — Next Steps: Step one, step two"
const DIFF_LINE_RE = /^(\d+)\.\s+(.+?)\s+—\s+Confidence:\s*(\d+)%\s+—\s+Next Steps:\s*(.+)$/i;

function parseLine(line) {
  const m = line.match(DIFF_LINE_RE);
  if (!m) return { type: 'text', content: line };
  return {
    type: 'differential',
    rank: Number(m[1]),
    diagnosis: m[2].trim(),
    confidence: Number(m[3]),
    nextSteps: m[4].split(/[,;]/).map((s) => s.trim()).filter(Boolean),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }) {
  const color = value >= 70 ? '#0d9488' : value >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-500 w-9 text-right shrink-0">{value}%</span>
    </div>
  );
}

function DifferentialCard({ item, expanded, onToggle }) {
  return (
    <li className="border border-gray-200 rounded-xl p-4 bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
              {item.rank}
            </span>
            <span className="font-bold text-gray-900 text-sm">{item.diagnosis}</span>
          </div>
          <ConfidenceBar value={item.confidence} />
        </div>
        {item.nextSteps.length > 0 && (
          <button
            onClick={onToggle}
            className="text-xs text-teal-600 hover:underline shrink-0 mt-1"
          >
            {expanded ? 'Hide' : 'Next Steps'}
          </button>
        )}
      </div>

      {expanded && item.nextSteps.length > 0 && (
        <ul className="mt-3 border-t border-gray-200 pt-3 space-y-1">
          {item.nextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-teal-500 mt-0.5 shrink-0">•</span>
              {step}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIAssistantPanel({ recordData, onSave }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [cursorVisible, setCursorVisible] = useState(true);
  const abortRef = useRef(null);

  // Blink cursor at 500 ms while streaming
  useEffect(() => {
    if (!streaming) {
      setCursorVisible(true);
      return;
    }
    const id = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, [streaming]);

  // Doctor-only guard — render nothing for other roles
  if (user?.role !== 'doctor') return null;

  // ── Streaming handler ───────────────────────────────────────────────────────

  const handleStream = useCallback(async () => {
    setText('');
    setDone(false);
    setError(null);
    setExpanded({});
    setStreaming(true);

    const token = localStorage.getItem('token');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/ai/differential-diagnosis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chiefComplaint: recordData?.chiefComplaint ?? '',
          vitals: recordData?.vitals ?? {},
          allergies: recordData?.allergies ?? [],
          chronicConditions: recordData?.chronicConditions ?? [],
          recordId: recordData?._id,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by \n\n; split on each newline to process lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last chunk in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();

          if (raw === '[DONE]') {
            setDone(true);
            setStreaming(false);
            return;
          }

          try {
            const payload = JSON.parse(raw);
            if (payload.error) throw new Error(payload.error);
            if (payload.chunk) setText((prev) => prev + payload.chunk);
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected token') {
              throw parseErr; // propagate real stream errors
            }
            // malformed JSON chunk — skip silently
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setStreaming(false);
    }
  }, [recordData]);

  // ── Text → line model ───────────────────────────────────────────────────────

  const rawLines = text.split('\n');
  // Lines before the last are "complete" (terminated by \n)
  const completeLines = (text.endsWith('\n') ? rawLines : rawLines.slice(0, -1)).filter(Boolean);
  const currentChunk = text.endsWith('\n') ? '' : rawLines[rawLines.length - 1];

  const parsedLines = completeLines.map(parseLine);
  const differentials = parsedLines.filter((l) => l.type === 'differential');
  const textLines = parsedLines.filter((l) => l.type === 'text');

  // Detect disclaimer: last text line that looks like a disclaimer
  const disclaimerLine = [...textLines].reverse().find((l) =>
    /disclaimer|this is ai|not a final|always apply/i.test(l.content)
  );
  const bodyTextLines = textLines.filter((l) => l !== disclaimerLine);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="border-l-4 border-teal-500 bg-white rounded-r-xl shadow-sm p-5 space-y-4">
      {/* Header + trigger */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">AI Differential Diagnosis</h3>
        <button
          onClick={handleStream}
          disabled={streaming}
          className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {streaming ? 'Analysing...' : 'Get AI Differential'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Non-disclaimer text lines (intro prose, headers, etc.) */}
      {bodyTextLines.length > 0 && (
        <div className="space-y-1">
          {bodyTextLines.map((l, i) => (
            <p key={i} className="text-sm text-gray-700">{l.content}</p>
          ))}
        </div>
      )}

      {/* Differential cards — rendered progressively as lines complete */}
      {differentials.length > 0 && (
        <ul className="space-y-3">
          {differentials.map((item) => (
            <DifferentialCard
              key={item.rank}
              item={item}
              expanded={!!expanded[item.rank]}
              onToggle={() => setExpanded((p) => ({ ...p, [item.rank]: !p[item.rank] }))}
            />
          ))}
        </ul>
      )}

      {/* Currently-streaming line with blinking cursor */}
      {(streaming || currentChunk) && (
        <p className="text-sm text-gray-700 leading-relaxed">
          {currentChunk}
          {streaming && (
            <span
              className="font-bold text-teal-600 ml-0.5"
              style={{ opacity: cursorVisible ? 1 : 0, transition: 'opacity 0.1s' }}
            >
              |
            </span>
          )}
        </p>
      )}

      {/* Disclaimer */}
      {(disclaimerLine || done) && (
        <p className="text-xs text-gray-400 italic">
          {disclaimerLine?.content ??
            'This is AI-generated clinical decision support, not a final diagnosis. Always apply clinical judgement.'}
        </p>
      )}

      {/* Accept to EHR — only after stream completes */}
      {done && text && (
        <button
          onClick={() => onSave(text)}
          className="w-full py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors"
        >
          Accept to EHR
        </button>
      )}
    </div>
  );
}
