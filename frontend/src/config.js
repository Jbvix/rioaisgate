// Build-time env var takes priority.
// Fallback: detect production at runtime so even an old Netlify bundle
// without VITE_API_URL set still connects to the correct Railway backend.
function resolveApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return 'https://rioaisgate-production.up.railway.app';
    }
  }
  return 'http://localhost:3001';
}

export const API_URL = resolveApiUrl();
export const WS_URL = (import.meta.env.VITE_WS_URL || API_URL)
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws');
