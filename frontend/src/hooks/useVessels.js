import { useState, useCallback, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { useWebSocket } from './useWebSocket';

/** Tempo que um alvo permanece visível após sumir do REST (backend usa ~30 min ativos). */
const CLIENT_VESSEL_GRACE_MS = 120 * 60 * 1000; // 2 h após última atualização recebida

const POLL_MS = 45_000;
const VESSELS_PERSIST_KEY = 'rioaisgate.vessels.persist.v1';
const PERSIST_DEBOUNCE_MS = 200;

function vesselsArrayToMap(vs) {
  const map = {};
  if (!Array.isArray(vs)) return map;
  vs.forEach((v) => {
    if (v && v.mmsi != null) map[String(v.mmsi)] = v;
  });
  return map;
}

function pruneExpiredFromCache(vessels, lastTouch) {
  const now = Date.now();
  const v = { ...vessels };
  const t = { ...lastTouch };
  for (const id of Object.keys(v)) {
    const ts = t[id];
    if (ts != null && now - ts > CLIENT_VESSEL_GRACE_MS) {
      delete v[id];
      delete t[id];
    }
  }
  return { vessels: v, lastTouch: t };
}

function loadPersistedVessels() {
  try {
    const raw = localStorage.getItem(VESSELS_PERSIST_KEY);
    if (!raw) return { vessels: {}, lastTouch: {} };
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return { vessels: {}, lastTouch: {} };
    const vessels =
      o.vessels && typeof o.vessels === 'object' && !Array.isArray(o.vessels) ? o.vessels : {};
    const lastTouch =
      o.lastTouch && typeof o.lastTouch === 'object' && !Array.isArray(o.lastTouch)
        ? o.lastTouch
        : {};
    return pruneExpiredFromCache(vessels, lastTouch);
  } catch {
    return { vessels: {}, lastTouch: {} };
  }
}

function persistVesselsToStorage(vessels, lastTouch) {
  try {
    localStorage.setItem(
      VESSELS_PERSIST_KEY,
      JSON.stringify({ vessels, lastTouch, savedAt: Date.now() }),
    );
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      try {
        const ids = Object.keys(vessels);
        if (ids.length > 80) {
          const lastTouchCopy = { ...lastTouch };
          const vesselsCopy = { ...vessels };
          ids
            .sort((a, b) => (lastTouchCopy[b] ?? 0) - (lastTouchCopy[a] ?? 0))
            .slice(80)
            .forEach((id) => {
              delete vesselsCopy[id];
              delete lastTouchCopy[id];
            });
          localStorage.setItem(
            VESSELS_PERSIST_KEY,
            JSON.stringify({ vessels: vesselsCopy, lastTouch: lastTouchCopy, savedAt: Date.now() }),
          );
        }
      } catch {
        /* ignore */
      }
    }
  }
}

const initialPersisted = loadPersistedVessels();
const MIN_SPLASH_MS = 2200;
const WS_WAIT_MS = 3500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useVessels(onGeofenceEvent) {
  const [vessels, setVessels] = useState(() => ({ ...initialPersisted.vessels }));
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [feedStatus, setFeedStatus] = useState(null);
  const [bootstrap, setBootstrap] = useState({
    done: false,
    progress: 0,
    label: 'Iniciando RioAISGate…',
  });

  const lastTouchRef = useRef({ ...initialPersisted.lastTouch });
  const wsConnectedRef = useRef(false);
  const bootstrapOnceRef = useRef(false);

  const onGeofenceEventRef = useRef(onGeofenceEvent);
  onGeofenceEventRef.current = onGeofenceEvent;

  const mergeFromApi = useCallback((prev, apiList) => {
    if (!Array.isArray(apiList)) return prev;
    const apiMap = vesselsArrayToMap(apiList);
    const now = Date.now();
    const merged = {};

    for (const id of Object.keys(apiMap)) {
      merged[id] = apiMap[id];
      lastTouchRef.current[id] = now;
    }

    for (const id of Object.keys(prev)) {
      if (merged[id]) continue;
      const t = lastTouchRef.current[id];
      if (t != null && now - t < CLIENT_VESSEL_GRACE_MS) {
        merged[id] = prev[id];
      } else {
        delete lastTouchRef.current[id];
      }
    }

    return merged;
  }, []);

  const step = useCallback((progress, label) => {
    setBootstrap({ done: false, progress, label });
  }, []);

  const runBootstrap = useCallback(async () => {
    const started = Date.now();
    step(5, 'Iniciando RioAISGate…');
    await delay(180);

    step(15, 'Conectando ao servidor…');
    try {
      await fetch(`${API_URL}/api/health/live`);
    } catch (err) {
      console.warn('[API] health/live:', err.message);
    }

    step(35, 'Carregando embarcações…');
    try {
      const vRes = await fetch(`${API_URL}/api/vessels`);
      const vs = await vRes.json();
      setVessels((prev) => mergeFromApi(prev, vs));
    } catch (err) {
      console.error('[API] bootstrap vessels:', err.message);
    }

    step(58, 'Carregando eventos e estatísticas…');
    try {
      const [eRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/events?limit=50`),
        fetch(`${API_URL}/api/stats/today`),
      ]);
      if (eRes.ok) {
        const es = await eRes.json();
        if (Array.isArray(es)) setEvents(es);
      }
      if (sRes.ok) {
        const ss = await sRes.json();
        if (ss && typeof ss === 'object' && !Array.isArray(ss)) setStats(ss);
      }
    } catch (err) {
      console.error('[API] bootstrap events/stats:', err.message);
    }

    step(72, 'Verificando feed AIS…');
    try {
      const r = await fetch(`${API_URL}/api/aisstream/status`);
      setFeedStatus(await r.json());
    } catch {
      setFeedStatus({ connected: false, api_unreachable: true });
    }

    step(85, 'Conectando tempo real…');
    const wsDeadline = Date.now() + WS_WAIT_MS;
    while (!wsConnectedRef.current && Date.now() < wsDeadline) {
      await delay(120);
    }

    step(96, 'Preparando mapa…');
    const elapsed = Date.now() - started;
    if (elapsed < MIN_SPLASH_MS) await delay(MIN_SPLASH_MS - elapsed);

    step(100, 'Abrindo painel…');
    await delay(280);
    setBootstrap({ done: true, progress: 100, label: 'Pronto' });
  }, [mergeFromApi, step]);

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'POSITION' && msg.vessel?.mmsi != null) {
      const id = String(msg.vessel.mmsi);
      lastTouchRef.current[id] = Date.now();
      setVessels((prev) => ({ ...prev, [id]: msg.vessel }));
    }
    if (msg.type === 'EVENT') {
      try {
        onGeofenceEventRef.current?.(msg.event);
      } catch {
        /* noop */
      }
      setEvents((prev) => [msg.event, ...prev].slice(0, 200));
      fetch(`${API_URL}/api/stats/today`)
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    }
  }, []);

  useWebSocket(handleWsMessage, {
    onConnectionChange: (connected) => {
      wsConnectedRef.current = connected;
    },
  });

  useEffect(() => {
    if (bootstrapOnceRef.current) return;
    bootstrapOnceRef.current = true;
    runBootstrap();
  }, [runBootstrap]);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch(`${API_URL}/api/aisstream/status`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data && typeof data === 'object') setFeedStatus(data);
        })
        .catch(() => {
          if (!cancelled) {
            setFeedStatus({ connected: false, api_unreachable: true });
          }
        });

      fetch(`${API_URL}/api/vessels`)
        .then((r) => r.json())
        .then((vs) => {
          if (!cancelled && Array.isArray(vs)) {
            setVessels((prev) => mergeFromApi(prev, vs));
          }
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mergeFromApi]);

  useEffect(() => {
    const timer = setTimeout(() => {
      persistVesselsToStorage(vessels, lastTouchRef.current);
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [vessels]);

  return { vessels, events, stats, feedStatus, bootstrap };
}
