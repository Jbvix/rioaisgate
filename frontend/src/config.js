export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Derive WebSocket URL from API_URL if VITE_WS_URL is not explicitly set.
// https://... → wss://..., http://... → ws://...
export const WS_URL = import.meta.env.VITE_WS_URL
  || API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');
