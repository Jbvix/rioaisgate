import { useState, useCallback } from 'react';
import { API_URL } from '../config';
import { useWebSocket } from './useWebSocket';

export function useVessels() {
  const [vessels, setVessels] = useState({});   // mmsi → vessel
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);

  const fetchInitial = useCallback(async () => {
    try {
      const [vRes, eRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/vessels`),
        fetch(`${API_URL}/api/events?limit=50`),
        fetch(`${API_URL}/api/stats/today`),
      ]);
      const [vs, es, ss] = await Promise.all([vRes.json(), eRes.json(), sRes.json()]);
      const map = {};
      vs.forEach(v => { map[v.mmsi] = v; });
      setVessels(map);
      setEvents(es);
      setStats(ss);
    } catch (err) {
      console.error('[API] fetchInitial:', err.message);
    }
  }, []);

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'POSITION') {
      setVessels(prev => ({ ...prev, [msg.vessel.mmsi]: msg.vessel }));
    }
    if (msg.type === 'EVENT') {
      setEvents(prev => [msg.event, ...prev].slice(0, 200));
      // refresh stats on every event
      fetch(`${API_URL}/api/stats/today`)
        .then(r => r.json())
        .then(setStats)
        .catch(() => {});
    }
  }, []);

  useWebSocket(handleWsMessage);

  return { vessels, events, stats, fetchInitial };
}
