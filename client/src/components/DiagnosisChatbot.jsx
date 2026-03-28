/**
 * DiagnosisChatbot
 * Floating RAG chatbot for querying clinical protocols.
 *
 * UI:
 *   - Teal chat bubble button fixed at bottom-right corner
 *   - Click to slide open a panel (350px wide)
 *   - Type a clinical question → hits /api/ai/protocol-chatbot via SSE
 *   - Streamed answer is shown with typing indicator while pending
 *   - Source citations appear as pills below each AI message once streaming ends
 *
 * Architecture:
 *   - Each conversation turn is added to local `messages` state
 *   - SSE hook streams the answer; on complete, sources from [DONE] payload are stored
 */
import { useState, useRef, useEffect } from 'react';
import useSSE from '../hooks/useSSE';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function DiagnosisChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role, text, sources? }
  const [input, setInput] = useState('');
  const [queryUrl, setQueryUrl] = useState(null);
  const bottomRef = useRef(null);
  const { content, sources, streaming, start } = useSSE(queryUrl || '');

  // Auto-scroll to bottom as stream arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [content, messages]);

  // When the SSE stream finishes (streaming flips from true → false with content present),
  // replace the in-progress placeholder message with the completed assistant message.
  // sources comes from the [DONE] JSON payload — protocol document names for citation.
  useEffect(() => {
    if (!streaming && content) {
      setMessages((prev) => {
        // Replace the in-progress placeholder if it exists as the last message
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last?.streaming) {
          return [
            ...prev.slice(0, -1),                           // drop the placeholder
            { role: 'assistant', text: content, sources },  // add the completed message
          ];
        }
        return prev;
      });
    }
  }, [streaming]); // eslint-disable-line react-hooks/exhaustive-deps
  // We intentionally omit content/sources from deps to avoid re-running mid-stream

  /**
   * sendMessage — adds the user turn to the message list, sets up the SSE URL,
   * and fires the stream. The assistant placeholder ({ streaming: true }) is added
   * first so the typing indicator renders immediately.
   */
  function sendMessage() {
    const q = input.trim();
    if (!q || streaming) return; // guard: don't send empty input or while streaming
    setInput(''); // clear the input field immediately for a responsive feel

    // Add user message + streaming placeholder for the upcoming assistant reply
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: q },
      { role: 'assistant', text: '', streaming: true }, // replaced when stream completes
    ]);

    // Build SSE URL and trigger stream
    const url = `${API_BASE}/ai/protocol-chatbot?question=${encodeURIComponent(q)}`;
    setQueryUrl(url);
    // setTimeout(0) defers start() to the next event loop tick, ensuring queryUrl state
    // has updated before useSSE's start() reads it via its closure.
    setTimeout(start, 0);
  }

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-teal-600 text-white shadow-lg
          flex items-center justify-center text-2xl hover:bg-teal-700 transition-colors"
        title="Clinical Protocol Assistant"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Slide-in panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl
          border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: 460 }}
        >
          {/* Header */}
          <div className="bg-teal-600 text-white px-4 py-3 flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <p className="font-semibold text-sm">Clinical Protocol Assistant</p>
              <p className="text-teal-200 text-xs">Powered by Claude + RAG</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-4">
                Ask about clinical protocols, drug dosing, or treatment guidelines.
              </p>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm
                    ${msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                >
                  {msg.streaming && !content ? (
                    <span className="flex gap-1 items-center text-gray-400">
                      <span className="animate-bounce">●</span>
                      <span className="animate-bounce" style={{ animationDelay: '0.15s' }}>●</span>
                      <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>●</span>
                    </span>
                  ) : msg.streaming ? (
                    content
                  ) : (
                    msg.text
                  )}

                  {/* Citation pills */}
                  {msg.sources?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.sources.map((src, si) => (
                        <span
                          key={si}
                          className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded-full"
                        >
                          📄 {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask a clinical question..."
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium
                hover:bg-teal-700 disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
