import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../config';

const RECONNECT_DELAY = 4000;

export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}/ws`);
    wsRef.current = ws;

    ws.onopen = () => console.log('[WS] Connected');

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        onMessageRef.current(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
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
