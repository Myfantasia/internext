import { useEffect, useState } from 'react';

// Difference between the server's clock and this device's clock, learned from
// API responses that include `serverTime`. Countdowns add it so they match the
// server, which is what actually decides when a deal ends.
let offsetMs = 0;

export function syncServerClock(serverTimeIso?: string | null) {
  if (!serverTimeIso) return;
  const server = new Date(serverTimeIso).getTime();
  if (Number.isFinite(server)) offsetMs = server - Date.now();
}

export function serverNow() {
  return Date.now() + offsetMs;
}

// Re-renders every second with the server-corrected time.
export function useServerClock() {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const t = window.setInterval(() => setNow(serverNow()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}
