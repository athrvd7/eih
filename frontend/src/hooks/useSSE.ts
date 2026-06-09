import { useEffect, useRef, useCallback } from 'react';
import type { SSEEvent } from '../types';

interface UseSSEOptions {
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

export function useSSE(jobId: string | null, { onEvent, onError, enabled = true }: UseSSEOptions) {
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!jobId || !enabled) return;
    if (esRef.current) {
      esRef.current.close();
    }
    const es = new EventSource(`/api/jobs/${jobId}/events`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data: SSEEvent = JSON.parse(e.data);
        onEvent(data);
        if (data.status === 'done' || (data.status === 'complete' && data.stage === 'pipeline') || data.status === 'failed') {
          es.close();
          esRef.current = null;
        }
      } catch {}
    };

    es.onerror = (e) => {
      onError?.(e);
      es.close();
      esRef.current = null;
    };
  }, [jobId, enabled, onEvent, onError]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
