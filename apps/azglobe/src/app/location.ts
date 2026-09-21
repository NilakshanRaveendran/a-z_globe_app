import * as Location from 'expo-location';
import { geohashForLocation } from 'geofire-common';
import type { GeoPoint } from '@modules/food/types';

/**
 * One location reading, or null if none arrives in time.
 *
 * Shared by the supplier's restaurant pin and the customer's delivery-address
 * pin, which have the same problem: `getCurrentPositionAsync` with no options
 * waits for a high-accuracy fix and never gives up, so indoors the button spins
 * forever. In order:
 *
 *   1. a cached fix up to 10 minutes old — the person has usually just had maps
 *      or the camera open, and neither a restaurant nor a home moves;
 *   2. balanced accuracy, which Android serves from Wi-Fi and cell towers and so
 *      works indoors, for up to 8 seconds;
 *   3. high accuracy (GPS) for up to 12 seconds — balanced never consults GPS,
 *      so without this a device holding a good GPS fix but no network location
 *      would report failure.
 */
export async function locateOnce(): Promise<Location.LocationObject | null> {
  const cached = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(
    () => null
  );
  if (cached) return cached;
  return (
    (await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      8_000
    )) ??
    (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 12_000))
  );
}

export type PinResult =
  | { ok: true; geo: GeoPoint }
  | { ok: false; reason: 'permission' | 'no-fix' };

/**
 * Ask for permission, take one reading and turn it into a pin with a geohash —
 * the geohash is what the "near you" range queries sort on.
 */
export async function dropPin(): Promise<PinResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { ok: false, reason: 'permission' };
  const pos = await locateOnce().catch(() => null);
  if (!pos) return { ok: false, reason: 'no-fix' };
  const { latitude: lat, longitude: lng } = pos.coords;
  return { ok: true, geo: { lat, lng, geohash: geohashForLocation([lat, lng]) } };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
