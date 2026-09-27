import { useCallback, useState } from 'react';

export interface Coords {
  lat: number;
  lng: number;
}

type GeoStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

const CACHE_KEY = 'relay:lastCoords';

function readCache(): Coords | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Coords) : null;
  } catch {
    return null;
  }
}

/**
 * Wraps navigator.geolocation. The caller decides what to fall back to
 * (e.g. the user's saved city/area coordinates) when permission is denied.
 */
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(readCache);
  const [status, setStatus] = useState<GeoStatus>(coords ? 'granted' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(
    () =>
      new Promise<Coords | null>((resolve) => {
        if (!('geolocation' in navigator)) {
          setStatus('unavailable');
          setError('Location is not supported on this device.');
          return resolve(null);
        }
        setStatus('locating');
        setError(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
            setCoords(c);
            setStatus('granted');
            try {
              sessionStorage.setItem(CACHE_KEY, JSON.stringify(c));
            } catch {
              /* ignore */
            }
            resolve(c);
          },
          (err) => {
            setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
            setError(err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not get your location.');
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
        );
      }),
    [],
  );

  return { coords, status, error, locate };
}
