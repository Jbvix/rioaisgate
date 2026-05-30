import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../config';

const RECONNECT_DELAY = 4000;

export function useWebSocket(onMessage, { onConnectionChange } = {}) {
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  onMessageRef.current = onMessage;
  onConnectionChangeRef.current = onConnectionChange;

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      onConnectionChangeRef.current?.(true);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        onMessageRef.current(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      onConnectionChangeRef.current?.(false);
      console.warn('[WS] Disconnected, reconnecting…');
      timerRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
