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

export default function App() {
  const { vessels, events, stats, fetchInitial } = useVessels();
  const [selectedMmsi, setSelectedMmsi] = useState(null);
  const [sideTab, setSideTab] = useState('Eventos');
  const [editingGeofence, setEditingGeofence] = useState(false);
  const [geofencePolygon, setGeofencePolygon] = useState(GUANABARA_BAY_POLYGON);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

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
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-white/40">Live</span>
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
        />

        <button
          className="absolute top-4 right-4 z-[1000] rounded-lg border border-navy-600 bg-navy-800/90 px-3 py-2 text-xs text-white hover:bg-navy-700"
          onClick={() => setEditingGeofence((v) => !v)}
        >
          {editingGeofence ? 'Fechar editor' : 'Editar geofence'}
        </button>

        {editingGeofence && (
          <GeofenceEditor
            polygon={geofencePolygon}
            defaultPolygon={GUANABARA_BAY_POLYGON}
            onChange={setGeofencePolygon}
            onClose={() => setEditingGeofence(false)}
          />
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
