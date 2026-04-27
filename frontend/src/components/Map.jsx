import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { GUANABARA_BAY_POLYGON } from '../constants/geofence';

// Barra da Guanabara center
const CENTER = [-22.930, -43.148];
const ZOOM = 12;

function vesselIcon(vessel) {
  const heading = vessel.heading ?? vessel.course ?? 0;
  const isInside = vessel.insideBay;
  const color = isInside ? '#22c55e' : '#0ea5e9';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <g transform="rotate(${heading}, 14, 14)">
        <polygon points="14,2 20,24 14,20 8,24" fill="${color}" stroke="#000" stroke-width="1.5" opacity="0.92"/>
      </g>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: 'vessel-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function VesselMarkers({ vessels, onSelect }) {
  return Object.values(vessels).map(v => {
    if (v.lat == null || v.lon == null) return null;
    return (
      <Marker
        key={v.mmsi}
        position={[v.lat, v.lon]}
        icon={vesselIcon(v)}
        eventHandlers={{ click: () => onSelect(v.mmsi) }}
      >
        <Popup>
          <div style={{ minWidth: 160 }}>
            <strong>{v.name || 'Embarcação desconhecida'}</strong>
            <br />
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>MMSI: {v.mmsi}</span>
            <br />
            {v.ship_type_label && <span>{v.ship_type_label}</span>}
            {v.speed != null && <><br />{v.speed} nós · {v.heading ?? '—'}°</>}
            <br />
            <span style={{ color: v.insideBay ? '#22c55e' : '#0ea5e9' }}>
              {v.insideBay ? 'Dentro da baía' : 'Fora da baía'}
            </span>
          </div>
        </Popup>
      </Marker>
    );
  });
}

function FlyToVessel({ selectedMmsi, vessels }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedMmsi) return;
    const v = vessels[selectedMmsi];
    if (v?.lat != null) map.flyTo([v.lat, v.lon], 14, { duration: 1 });
  }, [selectedMmsi, vessels, map]);
  return null;
}

const geofencePointIcon = L.divIcon({
  html: '<div style="width:10px;height:10px;border-radius:9999px;background:#f43f5e;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>',
  className: '',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

function GeofenceEditLayer({ enabled, polygon, onChange }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onChange([...polygon, [e.latlng.lat, e.latlng.lng]]);
    },
  });

  if (!enabled) return null;

  return polygon.map((point, index) => (
    <Marker
      key={`gf-${index}`}
      position={point}
      draggable
      icon={geofencePointIcon}
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          const next = [...polygon];
          next[index] = [lat, lng];
          onChange(next);
        },
        dblclick: () => {
          if (polygon.length <= 3) return;
          onChange(polygon.filter((_, i) => i !== index));
        },
      }}
    />
  ));
}

export default function Map({
  vessels,
  selectedMmsi,
  onSelectVessel,
  geofencePolygon = GUANABARA_BAY_POLYGON,
  isEditingGeofence = false,
  onGeofenceChange = () => {},
}) {
  return (
    <MapContainer
      center={CENTER}
      zoom={ZOOM}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      {/* OpenStreetMap base */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* OpenSeaMap nautical overlay */}
      <TileLayer
        attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
        url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        opacity={0.8}
      />

      {/* Geofence polygon — Baía de Guanabara */}
      <Polygon
        positions={geofencePolygon}
        pathOptions={{
          color: '#0ea5e9',
          fillColor: '#0ea5e9',
          fillOpacity: 0.07,
          weight: 2,
          dashArray: '6 4',
        }}
      />
      <GeofenceEditLayer
        enabled={isEditingGeofence}
        polygon={geofencePolygon}
        onChange={onGeofenceChange}
      />

      <VesselMarkers vessels={vessels} onSelect={onSelectVessel} />
      <FlyToVessel selectedMmsi={selectedMmsi} vessels={vessels} />
    </MapContainer>
  );
}
