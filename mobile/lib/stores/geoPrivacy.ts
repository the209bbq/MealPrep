/** Round coordinates before RPC, cache keys, or profile persistence (never store raw GPS). */
export function roundCoordsForPrivacy(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  };
}
