/**
 * useSSE — Server-Sent Events hook for AI streaming endpoints.
 *
 * Opens an EventSource to the given URL (with Bearer token in query string
 * because EventSource doesn't support custom headers).
 * Appends incoming text chunks to `content` state.
 * When the server sends [DONE] it closes the connection and parses the
 * optional JSON payload for citation sources.
 *
 * Usage:
 *   const { content, sources, streaming, error, start, stop } = useSSE(url);
 *   start() — opens EventSource
 *   stop()  — closes it early (e.g. user navigates away)
 */
import { useState, useRef, useCallback } from 'react';

export default function useSSE(url) {
  const [content, setContent] = useState('');
  const [sources, setSources] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const esRef = useRef(null); // holds EventSource instance for cleanup

  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStreaming(false);
  }, []);

  const start = useCallback(() => {
    // Reset state for a fresh stream
    setContent('');
    setSources([]);
    setError(null);
    setStreaming(true);

    const token = localStorage.getItem('token');
    // EventSource doesn't support headers — pass token as query param
    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}token=${token}`;
    const es = new EventSource(fullUrl);
    esRef.current = es;

    es.onmessage = (event) => {
      const raw = event.data;

      // Server signals end of stream; may include JSON payload with sources
      if (raw.startsWith('[DONE]')) {
        const payload = raw.slice(6).trim(); // strip "[DONE]" prefix
        if (payload) {
          try {
            const { sources: citedSources } = JSON.parse(payload);
            if (citedSources) setSources(citedSources);
          } catch (_) {
            // No JSON payload — that's fine
          }
        }
        stop();
        return;
      }

      // Append the text delta to accumulated content
      setContent((prev) => prev + raw);
    };

    es.onerror = () => {
      setError('Stream connection lost. Please try again.');
      stop();
    };
  }, [url, stop]);

  return { content, sources, streaming, error, start, stop };
}
