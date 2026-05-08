import { useState, useCallback, useEffect } from 'react';
import { API_URL } from '../config';
import { useWebSocket } from './useWebSocket';

function vesselsArrayToMap(vs) {
  const map = {};
  if (!Array.isArray(vs)) return map;
  vs.forEach((v) => {
    if (v && v.mmsi != null) map[String(v.mmsi)] = v;
  });
  return map;
}

const POLL_MS = 45_000;

export function useVessels() {
  const [vessels, setVessels] = useState({}); // mmsi → vessel
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [feedStatus, setFeedStatus] = useState(null);

  const fetchInitial = useCallback(async () => {
    // Embarcações: isolado — falha em /events ou /stats não pode esvaziar o mapa
    try {
      const vRes = await fetch(`${API_URL}/api/vessels`);
      const vs = await vRes.json();
      setVessels(vesselsArrayToMap(vs));
    } catch (err) {
      console.error('[API] fetchInitial vessels:', err.message);
    }

    try {
      const [eRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/events?limit=50`),
        fetch(`${API_URL}/api/stats/today`),
      ]);
      const es = await eRes.json();
      const ss = await sRes.json();
      if (Array.isArray(es)) setEvents(es);
      if (ss && typeof ss === 'object' && !Array.isArray(ss)) setStats(ss);
    } catch (err) {
      console.error('[API] fetchInitial events/stats:', err.message);
    }

    fetch(`${API_URL}/api/aisstream/status`)
      .then((r) => r.json())
      .then(setFeedStatus)
      .catch(() => setFeedStatus(null));
  }, []);

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'POSITION' && msg.vessel?.mmsi != null) {
      const id = String(msg.vessel.mmsi);
      setVessels((prev) => ({ ...prev, [id]: msg.vessel }));
    }
    if (msg.type === 'EVENT') {
      setEvents((prev) => [msg.event, ...prev].slice(0, 200));
      fetch(`${API_URL}/api/stats/today`)
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    }
  }, []);

  useWebSocket(handleWsMessage);

  // Status do feed + sincronização REST das embarcações (funciona mesmo se o WS for bloqueado, ex. preview Netlify)
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch(`${API_URL}/api/aisstream/status`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data && typeof data === 'object') setFeedStatus(data);
        })
        .catch(() => {
          if (!cancelled) setFeedStatus(null);
        });

      fetch(`${API_URL}/api/vessels`)
        .then((r) => r.json())
        .then((vs) => {
          if (!cancelled && Array.isArray(vs)) setVessels(vesselsArrayToMap(vs));
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { vessels, events, stats, feedStatus, fetchInitial };
}
