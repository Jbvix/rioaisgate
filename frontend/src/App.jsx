import React, { useEffect, useState } from 'react';
import Map from './components/Map';
import Dashboard from './components/Dashboard';
import EventLog from './components/EventLog';
import VesselList from './components/VesselList';
import VesselDetail from './components/VesselDetail';
import Charts from './components/Charts';
import GeofenceEditor from './components/GeofenceEditor';
import { useVessels } from './hooks/useVessels';
import { GUANABARA_BAY_POLYGON } from './constants/geofence';

const TABS = ['Mapa', 'Eventos', 'Embarcações', 'Gráficos'];
const GEOFENCE_STORAGE_KEY = 'rioaisgate.geofence.polygon.v1';

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

export default function App() {
  const { vessels, events, stats, feedStatus, setFeedEnabled, fetchInitial } = useVessels();
  const [selectedMmsi, setSelectedMmsi] = useState(null);
  const [sideTab, setSideTab] = useState('Eventos');
  const [editingGeofence, setEditingGeofence] = useState(false);
  const [geofencePolygon, setGeofencePolygon] = useState(loadSavedPolygon);
  const [togglingFeed, setTogglingFeed] = useState(false);
  const [baseLayer, setBaseLayer] = useState('osm');
  const [showSeaMarks, setShowSeaMarks] = useState(true);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  const saveGeofence = (points) => {
    if (!isValidPolygon(points)) return false;
    localStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(points));
    return true;
  };

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 flex flex-col bg-navy-800 border-r border-navy-700 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚓</span>
            <div>
              <div className="text-white font-bold text-sm leading-tight">RioAISGate</div>
              <div className="text-white/40 text-xs">Barra da Guanabara</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${feedStatus?.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className="text-xs text-white/40">Live</span>
              <button
                className={`ml-2 rounded px-2 py-0.5 text-[10px] font-semibold ${
                  feedStatus?.enabled
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                } disabled:opacity-50`}
                disabled={togglingFeed}
                onClick={async () => {
                  try {
                    setTogglingFeed(true);
                    await setFeedEnabled(!feedStatus?.enabled);
                  } catch (err) {
                    console.error('[AIS] toggle failed:', err.message);
                  } finally {
                    setTogglingFeed(false);
                  }
                }}
              >
                {feedStatus?.enabled ? 'Desligar' : 'Ligar'}
              </button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <Dashboard stats={stats} vessels={vessels} />

        {/* Vessel detail */}
        {selectedMmsi && (
          <div className="px-3 pb-3">
            <VesselDetail
              mmsi={selectedMmsi}
              vessels={vessels}
              onClose={() => setSelectedMmsi(null)}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-navy-700 px-3">
          {TABS.filter(t => t !== 'Mapa').map(t => (
            <button
              key={t}
              onClick={() => setSideTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                sideTab === t
                  ? 'text-ocean-400 border-b-2 border-ocean-400'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {sideTab === 'Eventos' && (
            <EventLog events={events} onSelectVessel={setSelectedMmsi} />
          )}
          {sideTab === 'Embarcações' && (
            <VesselList vessels={vessels} onSelect={setSelectedMmsi} selectedMmsi={selectedMmsi} />
          )}
          {sideTab === 'Gráficos' && <Charts />}
        </div>
      </aside>

      {/* ── Map ─────────────────────────────────────────── */}
      <main className="flex-1 relative">
        <Map
          vessels={vessels}
          selectedMmsi={selectedMmsi}
          onSelectVessel={setSelectedMmsi}
          geofencePolygon={geofencePolygon}
          isEditingGeofence={editingGeofence}
          onGeofenceChange={setGeofencePolygon}
          baseLayer={baseLayer}
          showSeaMarks={showSeaMarks}
        />

        <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
          <button
            className="rounded-lg border border-navy-600 bg-navy-800/90 px-3 py-2 text-sm text-white shadow-lg backdrop-blur hover:bg-navy-700"
            onClick={() => setMapMenuOpen((v) => !v)}
            title="Menu do mapa"
          >
            ☰
          </button>

          {mapMenuOpen && (
            <div className="w-64 rounded-lg border border-navy-600 bg-navy-800/95 p-3 text-xs text-white shadow-lg backdrop-blur">
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

              <button
                className="mt-3 w-full rounded border border-navy-600 bg-navy-700 px-3 py-2 text-xs text-white hover:bg-navy-600"
                onClick={() => setEditingGeofence((v) => !v)}
              >
                {editingGeofence ? 'Fechar editor geofence' : 'Editar geofence'}
              </button>
            </div>
          )}
        </div>

        {editingGeofence && (
          <div className="absolute top-0 right-0 z-[1001] h-full w-[380px] border-l border-navy-600 bg-navy-800/95 shadow-2xl backdrop-blur">
            <GeofenceEditor
              polygon={geofencePolygon}
              defaultPolygon={GUANABARA_BAY_POLYGON}
              onChange={setGeofencePolygon}
              onSave={saveGeofence}
              onClose={() => setEditingGeofence(false)}
            />
          </div>
        )}

        {/* Floating vessel count badge */}
        <div className="absolute bottom-4 right-4 bg-navy-800/90 backdrop-blur rounded-xl px-4 py-2 shadow-xl border border-navy-600 pointer-events-none">
          <div className="text-xs text-white/50 uppercase tracking-widest">Embarcações visíveis</div>
          <div className="text-2xl font-bold text-white text-center">{Object.keys(vessels).length}</div>
        </div>
      </main>
    </div>
  );
}
