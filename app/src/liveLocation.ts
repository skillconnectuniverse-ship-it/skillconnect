import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { api } from './api';

// While a job is active the hired person's app sends its position so the client can follow along (foreground only).
export function useShareLocation(bookingId: string, enabled: boolean) {
  const last = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted' || cancelled) return;
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 20 }, (pos) => {
          const now = Date.now();
          if (now - last.current < 8000) return;
          last.current = now;
          api.post(`/bookings/${bookingId}/location`, { lat: pos.coords.latitude, lng: pos.coords.longitude }).catch(() => {});
        });
        if (cancelled) sub.remove();
      } catch {
        /* location is optional */
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [bookingId, enabled]);
}
