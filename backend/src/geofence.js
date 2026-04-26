/**
 * Geofence — Barra da Guanabara
 *
 * Canal de acesso à Baía de Guanabara entre o Forte São João (RJ)
 * e o Forte Santa Cruz (Niterói).
 *
 * Polígono simplificado da BAÍa de Guanabara:
 * Uma embarcação está INSIDE quando encontra-se dentro deste polígono.
 * Cruzamento barra → ENTRY (outside→inside) ou EXIT (inside→outside).
 */

// Bounding box para assinatura AISSTREAM (cobre abordagem oceânica + baía)
const AISSTREAM_BBOX = [
  [-23.10, -43.40],  // SW [lat, lon]
  [-22.70, -42.80],  // NE [lat, lon]
];

// Polígono simplificado da Baía de Guanabara (sentido horário)
// Pontos-chave: entrada da barra, costa de Niterói, fundo da baía, costa do Rio
const GUANABARA_BAY_POLYGON = [
  [-22.9160, -43.1590],  // Forte São João / Urca (boca da barra - RJ)
  [-22.9460, -43.1370],  // Forte Santa Cruz (boca da barra - Niterói)
  [-22.9600, -43.1100],  // Ponta da Armação (Niterói)
  [-22.9300, -43.0800],  // Jurujuba
  [-22.8900, -43.0700],  // São Francisco / Charitas
  [-22.8400, -43.1000],  // Fundo da baía - Guapimirim lado Niterói
  [-22.7700, -43.1000],  // APA Guapimirim
  [-22.7500, -43.1200],  // Rio Guapimirim
  [-22.7600, -43.2000],  // Rio Magé
  [-22.8000, -43.2500],  // Magé
  [-22.8300, -43.2800],  // Caju / Guanabara - lado Rio
  [-22.8600, -43.2600],  // Caju / Porto do Rio
  [-22.8900, -43.2000],  // Centro / Aeroporto Santos Dumont
  [-22.9000, -43.1750],  // Flamengo / Botafogo
  [-22.9160, -43.1590],  // Fechamento — Forte São João
];

// Zona de aproximação oceânica (buffer antes da barra)
const APPROACH_ZONE_BBOX = {
  minLat: -23.05,
  maxLat: -22.93,
  minLon: -43.30,
  maxLon: -43.14,
};

/**
 * Ray-casting algorithm — ponto dentro de polígono
 */
function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInsideBay(lat, lon) {
  return pointInPolygon(lat, lon, GUANABARA_BAY_POLYGON);
}

function isInApproachZone(lat, lon) {
  return (
    lat >= APPROACH_ZONE_BBOX.minLat &&
    lat <= APPROACH_ZONE_BBOX.maxLat &&
    lon >= APPROACH_ZONE_BBOX.minLon &&
    lon <= APPROACH_ZONE_BBOX.maxLon
  );
}

function isInMonitoringZone(lat, lon) {
  return isInsideBay(lat, lon) || isInApproachZone(lat, lon);
}

module.exports = {
  AISSTREAM_BBOX,
  GUANABARA_BAY_POLYGON,
  isInsideBay,
  isInApproachZone,
  isInMonitoringZone,
};
