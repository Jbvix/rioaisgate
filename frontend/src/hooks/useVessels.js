import { useState, useCallback, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { requestJson } from '../utils/request.mjs';
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
export function useVessels(onGeofenceEvent) {
  const [vessels, setVessels] = useState(() => ({ ...initialPersisted.vessels }));
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [feedStatus, setFeedStatus] = useState(null);
  const [dataStatus, setDataStatus] = useState({ loading: true, errors: [], updatedAt: null });
  const refreshSequence = useRef(0);
  const [bootstrap, setBootstrap] = useState({
    done: false,
    progress: 0,
    label: 'Iniciando RioAISGate…',
  });

  const lastTouchRef = useRef({ ...initialPersisted.lastTouch });
  const [realtimeConnected, setRealtimeConnected] = useState(false);
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

  const refreshData = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const paths = ['/vessels', '/events?limit=50', '/stats/today', '/aisstream/status'];
    const results = await Promise.allSettled(paths.map((path) => requestJson(`${API_URL}/api${path}`)));
    if (sequence !== refreshSequence.current) return;
    const errors = [];
    const labels = ['Embarcações', 'Eventos', 'Indicadores', 'Sinal AIS'];
    results.forEach((result, index) => {
      if (result.status === 'rejected') { errors.push(labels[index]); return; }
      const value = result.value;
      if ((index < 2 && !Array.isArray(value)) || (index >= 2 && (!value || typeof value !== 'object' || Array.isArray(value)))) {
        errors.push(labels[index]); return;
      }
      if (index === 0) setVessels((prev) => mergeFromApi(prev, value));
      if (index === 1) setEvents(value);
      if (index === 2) setStats(value);
      if (index === 3) setFeedStatus(value);
    });
    if (errors.includes('Sinal AIS')) setFeedStatus({ connected: false, api_unreachable: true });
    setDataStatus((prev) => ({ loading: false, errors, updatedAt: errors.length ? prev.updatedAt : Date.now() }));
  }, [mergeFromApi]);

  const runBootstrap = useCallback(async () => {
    step(20, 'Carregando dados…');
    await refreshData();
    setBootstrap({ done: true, progress: 100, label: 'Pronto' });
  }, [refreshData, step]);

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
      requestJson(`${API_URL}/api/stats/today`)
        .then(setStats)
        .catch(() => {});
    }
  }, []);

  useWebSocket(handleWsMessage, {
    onConnectionChange: (connected) => {
      setRealtimeConnected(connected);
    },
  });

  useEffect(() => {
    if (bootstrapOnceRef.current) return;
    bootstrapOnceRef.current = true;
    runBootstrap();
  }, [runBootstrap]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      await refreshData();
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };
    let timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      persistVesselsToStorage(vessels, lastTouchRef.current);
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [vessels]);

  return { vessels, events, stats, feedStatus, bootstrap, dataStatus, refreshData, realtimeConnected };
}
