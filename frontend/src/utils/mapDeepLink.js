/** Lê ?mmsi= & ?lat= & ?lon= da URL (links vindos do Telegram). */

export function readMapDeepLinkFromUrl() {
  if (typeof window === 'undefined') return { mmsi: null, lat: null, lon: null };
  const p = new URLSearchParams(window.location.search);
  const mmsiRaw = p.get('mmsi')?.trim() || '';
  const mmsi = /^\d{9}$/.test(mmsiRaw) ? mmsiRaw : null;
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  return {
    mmsi,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
}
