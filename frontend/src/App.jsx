import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { playPortalSound } from './utils/portalSound.mjs';
import { readMapDeepLinkFromUrl } from './utils/mapDeepLink';
import Map from './components/Map';
import Dashboard from './components/Dashboard';
import AisControl from './components/AisControl';
import EventLog from './components/EventLog';
import VesselList from './components/VesselList';
import VesselDetail from './components/VesselDetail';
const Charts = lazy(() => import('./components/Charts'));
import SplashScreen from './components/SplashScreen';
import UserManual from './components/UserManual';
import { useVessels } from './hooks/useVessels';
import { GUANABARA_BAY_POLYGON } from './constants/geofence';
import { playGeofenceAlert, unlockGeofenceAudio } from './utils/playGeofenceAlert';

const TABS = ['Mapa', 'Eventos', 'Embarcações', 'Gráficos'];
const GEOFENCE_STORAGE_KEY = 'rioaisgate.geofence.polygon.v1';
const GEOFENCE_WATCH_STORAGE_KEY = 'rioaisgate.geofence.watch.v1';
const BAR_SOUND_STORAGE_KEY = 'rioaisgate.bar.sound.v1';

function loadBarSoundEnabled() {
  try {
    const raw = localStorage.getItem(BAR_SOUND_STORAGE_KEY);
    if (raw === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

function saveBarSoundEnabled(enabled) {
  try {
    localStorage.setItem(BAR_SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

function loadGeofenceWatch() {
  try {
    const raw = sessionStorage.getItem(GEOFENCE_WATCH_STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') return o;
  } catch {
    /* ignore */
  }
  return {};
}

function saveGeofenceWatch(map) {
  try {
    sessionStorage.setItem(GEOFENCE_WATCH_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function isValidPolygon(points) {
  return (
    Array.isArray(points) &&
    points.length >= 3 &&
    points.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
  );
}

function loadSavedPolygon() {
  try {
    const raw = localStorage.getItem(GEOFENCE_STORAGE_KEY);
    if (!raw) return GUANABARA_BAY_POLYGON;
    const parsed = JSON.parse(raw);
    return isValidPolygon(parsed) ? parsed.map((p) => [Number(p[0]), Number(p[1])]) : GUANABARA_BAY_POLYGON;
  } catch {
    return GUANABARA_BAY_POLYGON;
  }
}

function MainApp({
  vessels,
  events,
  stats,
  feedStatus,
  dataStatus,
  refreshData,
  realtimeConnected,
  geofenceWatch,
  updateGeofenceWatch,
  toggleGeofenceWatch,
  barSoundEnabled,
  onToggleBarSound,
}) {
  const [deepLink] = useState(() => readMapDeepLinkFromUrl());
  const [selectedMmsi, setSelectedMmsi] = useState(deepLink.mmsi);
  const [sideTab, setSideTab] = useState('Eventos');
  const [geofencePolygon] = useState(loadSavedPolygon);
  const [baseLayer, setBaseLayer] = useState('osm');
  const [showSeaMarks, setShowSeaMarks] = useState(true);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const panelRef = useRef(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!panelOpen || !isMobile) return;
    const previous = document.activeElement;
    const focusable = () => [...panelRef.current.querySelectorAll('button, input, select, summary, a[href], [tabindex="0"]')].filter((el) => !el.disabled && el.getClientRects().length);
    focusable()[0]?.focus();
    const trapFocus = (event) => {
      if (event.key !== 'Tab') return;
      const controls = focusable();
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => { document.removeEventListener('keydown', trapFocus); if (previous?.isConnected) previous.focus(); };
  }, [panelOpen, isMobile]);


  useEffect(() => {
    const escape = (event) => { if (event.key === 'Escape') { setPanelOpen(false); setMapMenuOpen(false); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const handleSelectVessel = useCallback((mmsi) => {
    setSelectedMmsi(mmsi);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setPanelOpen(true);
    }
  }, []);

  useEffect(() => {
    if (deepLink.mmsi && typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setPanelOpen(true);
    }
  }, [deepLink.mmsi]);

  return (
    <div className="app-shell flex bg-navy-900 overflow-hidden animate-[fadeIn_0.4s_ease-out] lg:flex-row">
      {/* Overlay mobile */}
      {panelOpen && (
        <button
          type="button"
          aria-label="Fechar painel"
          className="fixed inset-0 z-[1990] bg-black/55 lg:hidden"
          onClick={closePanel}
        />
      )}

      {/* ── Sidebar (drawer no mobile) ─────────────────── */}
      <aside
        id="operations-panel"
        ref={panelRef}
        inert={isMobile && !panelOpen ? '' : undefined}
        aria-hidden={isMobile && !panelOpen ? true : undefined}
        role={isMobile && panelOpen ? 'dialog' : undefined}
        aria-modal={isMobile && panelOpen ? true : undefined}
        aria-label="Painel de monitoramento"
        className={[
          'operations-panel fixed inset-y-0 left-0 z-[2000] flex max-w-full flex-col',
          'bg-navy-900 border-r border-navy-700 shadow-2xl',
          'transition-transform duration-300 ease-out lg:transition-none',
          'lg:static lg:z-auto lg:flex-shrink-0 lg:shadow-none',
          panelOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Header */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-navy-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl">⚓</span>
            <div className="min-w-0 flex-1">
              <div className="text-white font-bold text-sm leading-tight">RioAISGate</div>
              <div className="text-white/40 text-xs">Barra da Guanabara</div>
              <div className="text-white/30 text-[10px] mt-0.5 hidden sm:block truncate">
                Jossian Brito · TugLife Systems
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 shrink-0"
              title={
                feedStatus == null
                  ? 'Verificando feed AIS…'
                  : feedStatus.api_unreachable
                    ? 'Backend indisponível — verifique deploy Railway'
                    : feedStatus.connected
                      ? 'Feed AIS conectado — operação contínua 24h'
                      : feedStatus.manual_enabled === false
                        ? 'Feed pausado manualmente pelo controle com PIN'
                        : feedStatus.api_key_set === false
                          ? 'AISSTREAM_API_KEY não configurada no servidor'
                          : 'Sem conexão AIS — reconexão automática ativa 24h'
              }
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  feedStatus == null
                    ? 'bg-white/30'
                    : feedStatus.api_unreachable
                      ? 'bg-rose-500'
                      : feedStatus.connected
                        ? 'bg-emerald-400 animate-pulse'
                        : feedStatus.manual_enabled === false ? 'bg-sky-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-[10px] sm:text-xs text-white/60 hidden min-[380px]:inline">
                {feedStatus == null
                  ? 'Verificando…'
                  : feedStatus.api_unreachable
                    ? 'API offline'
                    : feedStatus.connected
                      ? 'Live · 24h'
                      : feedStatus.manual_enabled === false ? 'Pausado' : feedStatus.api_key_set === false ? 'Sem sinal' : 'Reconectando'}
              </span>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="lg:hidden shrink-0 rounded-lg min-h-11 min-w-11 p-1.5 text-white/50 hover:text-white hover:bg-navy-700"
              aria-label="Fechar painel"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-2 sm:px-3 py-2 border-b border-navy-700/80 shrink-0">
          <button
            type="button"
            onClick={onToggleBarSound}
            className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-medium transition-colors ${
              barSoundEnabled
                ? 'bg-ocean-500/15 text-ocean-300 border border-ocean-500/35 hover:bg-ocean-500/25'
                : 'bg-navy-700/60 text-white/45 border border-navy-600 hover:bg-navy-700'
            }`}
            title={
              barSoundEnabled
                ? 'Som ativo: toca em toda entrada e saída na barra'
                : 'Som desligado — clique para ativar alertas da barra'
            }
          >
            <span className="text-left leading-snug">
              <span className="sm:hidden">{barSoundEnabled ? '🔔 Som na barra' : '🔕 Som off'}</span>
              <span className="hidden sm:inline">
                {barSoundEnabled ? '🔔 Som na barra (entrada e saída)' : '🔕 Som na barra desligado'}
              </span>
            </span>
            <span className={`text-[10px] uppercase tracking-wide shrink-0 ${barSoundEnabled ? 'text-emerald-400/90' : 'text-white/30'}`}>
              {barSoundEnabled ? 'On' : 'Off'}
            </span>
          </button>
        </div>

        <div className="operations-body flex flex-1 flex-col min-h-0">
          <div className="operations-summary shrink-0">
            <AisControl feedStatus={feedStatus} onChanged={refreshData} />
            <div className="px-3 pt-2 text-xs text-white/70" role="status" aria-live="polite">
              {dataStatus.errors.length > 0 ? (
                <><p className="text-amber-300">Falha ao atualizar: {dataStatus.errors.join(', ')}. Os dados podem estar desatualizados.</p>
                <button type="button" className="underline py-2" onClick={refreshData}>Tentar novamente</button></>
              ) : dataStatus.updatedAt ? <p>Última consulta: {new Date(dataStatus.updatedAt).toLocaleTimeString('pt-BR')}</p> : <p>Carregando dados…</p>}
              <p className="mt-1 text-white/65">{realtimeConnected ? 'Atualização em tempo real conectada' : 'Tempo real desconectado · consultas a cada 45 s'}</p>
              <details className="mt-2"><summary className="cursor-pointer text-white/65">Sobre a atualização das posições</summary><p className="mt-1 leading-relaxed">Posições podem permanecer em cache por até 2 horas. Consulte o sinal AIS antes de usá-las. A última consulta não indica a hora da transmissão AIS.</p></details>
            </div>
            <Dashboard stats={stats} vessels={vessels} />

            {selectedMmsi && (
              <div className="px-2 sm:px-3 pb-2 sm:pb-3">
                <VesselDetail
                  mmsi={selectedMmsi}
                  vessels={vessels}
                  onClose={() => setSelectedMmsi(null)}
                  geofenceWatchRule={geofenceWatch[String(selectedMmsi)]}
                  onToggleGeofenceWatch={(enabled) => toggleGeofenceWatch(selectedMmsi, enabled)}
                />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="operations-tabs flex border-b border-navy-700 px-2 sm:px-3 shrink-0">
            {TABS.filter((t) => t !== 'Mapa').map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSideTab(t)}
                aria-pressed={sideTab === t}
                className={`flex-1 py-2 text-[10px] sm:text-xs font-medium transition-colors ${
                  sideTab === t
                    ? 'text-ocean-400 border-b-2 border-ocean-400'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {t === 'Embarcações' ? (
                  <>
                    <span className="sm:hidden">Navios</span>
                    <span className="hidden sm:inline">Embarcações</span>
                  </>
                ) : (
                  t
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="operations-content flex-1 min-h-0">
            {sideTab === 'Eventos' && (
              <EventLog events={events} onSelectVessel={handleSelectVessel} />
            )}
            {sideTab === 'Embarcações' && (
              <VesselList vessels={vessels} onSelect={handleSelectVessel} selectedMmsi={selectedMmsi} />
            )}
            {sideTab === 'Gráficos' && <Suspense fallback={<p role="status" className="p-4 text-sm text-white/70">Carregando gráficos…</p>}><Charts /></Suspense>}
          </div>
        </div>
      </aside>

      {/* ── Map ─────────────────────────────────────────── */}
      <main inert={isMobile && panelOpen ? '' : undefined} aria-label="Mapa de embarcações" className="relative flex-1 min-w-0 min-h-0">
        <Map
          vessels={vessels}
          selectedMmsi={selectedMmsi}
          onSelectVessel={handleSelectVessel}
          geofencePolygon={geofencePolygon}
          baseLayer={baseLayer}
          showSeaMarks={showSeaMarks}
          deepLinkLat={deepLink.lat}
          deepLinkLon={deepLink.lon}
        />

        <div className="map-layers absolute z-[1000] flex flex-col items-end gap-2">
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-lg border border-navy-600 bg-navy-800/90 px-2.5 py-2 sm:px-3 text-sm text-white shadow-lg backdrop-blur hover:bg-navy-700"
            onClick={() => setMapMenuOpen((v) => !v)}
            title="Menu do mapa"
            aria-label="Camadas do mapa"
            aria-expanded={mapMenuOpen}
          >
            ☰
          </button>

          {mapMenuOpen && (
            <div className="w-[min(calc(100vw-1.5rem),16rem)] rounded-lg border border-navy-600 bg-navy-800/95 p-3 text-xs text-white shadow-lg backdrop-blur">
              <div className="mb-2 font-semibold text-white/90">Camadas do mapa</div>
              <label className="mb-1 block text-white/70">Base</label>
              <select
                className="w-full rounded border border-navy-600 bg-navy-900 px-2 py-1 text-xs"
                value={baseLayer}
                onChange={(e) => setBaseLayer(e.target.value)}
              >
                <option value="osm">OpenStreetMap</option>
                <option value="satellite">Satélite</option>
                <option value="relief">Relevo</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>

              <label className="mt-2 flex items-center gap-2 text-white/80">
                <input
                  type="checkbox"
                  checked={showSeaMarks}
                  onChange={(e) => setShowSeaMarks(e.target.checked)}
                />
                OpenSeaMap
              </label>
            </div>
          )}
        </div>

        <div className="map-summary absolute z-[1000] flex items-end gap-2">
          <button
            type="button"
            onClick={openPanel}
            className="min-h-11 flex items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-800/95 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-navy-700 lg:hidden"
            aria-label="Abrir painel"
            aria-controls="operations-panel"
            aria-expanded={panelOpen}
          >
            <span aria-hidden>☰</span>
            <span>Painel</span>
          </button>
          <div className="bg-navy-800/90 backdrop-blur rounded-lg sm:rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 shadow-xl border border-navy-600 pointer-events-none max-w-[9rem] sm:max-w-none">
            <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wide sm:tracking-widest leading-tight">
              <span className="sm:hidden">Navios</span>
              <span className="hidden sm:inline">Embarcações visíveis</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums">{Object.keys(vessels).length}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [manualOpen, setManualOpen] = useState(false);
  const [portalEntered, setPortalEntered] = useState(false);
  const [geofenceWatch, setGeofenceWatch] = useState(loadGeofenceWatch);
  const [barSoundEnabled, setBarSoundEnabled] = useState(loadBarSoundEnabled);
  const watchRef = useRef(geofenceWatch);
  const barSoundRef = useRef(barSoundEnabled);
  watchRef.current = geofenceWatch;
  barSoundRef.current = barSoundEnabled;

  const onGeofenceEvent = useCallback((event) => {
    const t = event?.event_type;
    if (t !== 'ENTRY' && t !== 'EXIT') return;

    const id = String(event?.mmsi ?? '');
    const rule = watchRef.current[id];
    const fromWatch = rule && (rule === 'BOTH' || rule === t);
    const fromBar = barSoundRef.current;

    if (fromBar || fromWatch) {
      playGeofenceAlert(t === 'ENTRY' ? 'entry' : 'exit');
    }
  }, []);

  const onToggleBarSound = useCallback(() => {
    setBarSoundEnabled((prev) => {
      const next = !prev;
      saveBarSoundEnabled(next);
      if (next) {
        void unlockGeofenceAudio().then(() => playGeofenceAlert('entry'));
      }
      return next;
    });
  }, []);

  const { vessels, events, stats, feedStatus, bootstrap, dataStatus, refreshData, realtimeConnected } = useVessels(onGeofenceEvent);

  useEffect(() => {
    if (!bootstrap.done || !portalEntered || !barSoundEnabled) return;
    const unlock = () => {
      void unlockGeofenceAudio();
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [bootstrap.done, portalEntered, barSoundEnabled]);

  const updateGeofenceWatch = useCallback((updater) => {
    setGeofenceWatch((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveGeofenceWatch(next);
      return next;
    });
  }, []);

  const toggleGeofenceWatch = useCallback(
    (mmsi, enabled) => {
      const id = String(mmsi);
      if (!enabled) {
        updateGeofenceWatch((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      void unlockGeofenceAudio();
      const v = vessels[id];
      let rule = 'BOTH';
      if (v?.insideBay === true) rule = 'EXIT';
      else if (v?.insideBay === false) rule = 'ENTRY';
      updateGeofenceWatch((prev) => ({ ...prev, [id]: rule }));
    },
    [vessels, updateGeofenceWatch],
  );

  if (manualOpen) {
    return <UserManual onClose={() => setManualOpen(false)} />;
  }

  if (!bootstrap.done || !portalEntered) {
    return (
      <SplashScreen
        ready={bootstrap.done}
        onEnter={(withSound) => {
          if (withSound) void playPortalSound();
          setPortalEntered(true);
        }}
        progress={bootstrap.progress}
        label={bootstrap.label}
        onOpenManual={() => setManualOpen(true)}
      />
    );
  }

  return (
    <MainApp
      vessels={vessels}
      events={events}
      stats={stats}
      feedStatus={feedStatus}
      dataStatus={dataStatus}
      refreshData={refreshData}
      realtimeConnected={realtimeConnected}
      geofenceWatch={geofenceWatch}
      updateGeofenceWatch={updateGeofenceWatch}
      toggleGeofenceWatch={toggleGeofenceWatch}
      barSoundEnabled={barSoundEnabled}
      onToggleBarSound={onToggleBarSound}
    />
  );
}
