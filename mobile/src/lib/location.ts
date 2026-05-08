import * as Location from 'expo-location';

export interface CapturedLocation {
  lat: number;
  lng: number;
  accuracy_m: number | null;
}

/**
 * Ensure foreground location permission. Returns true if granted.
 * Safe to call repeatedly; the OS shows the prompt only the first time.
 */
export async function ensureLocationPermission(): Promise<boolean> {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

/**
 * Get the current GPS position. Returns null if permission was denied or
 * the lookup failed (e.g. GPS off, indoor, no fix in time).
 */
export async function getCurrentLocation(): Promise<CapturedLocation | null> {
  try {
    const ok = await ensureLocationPermission();
    if (!ok) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy_m: pos.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}
