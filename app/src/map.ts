export interface MapPoint {
  lat: number;
  lng: number;
}

// OpenStreetMap embed (no API key): box covers both points, marker on the moving person.
export function osmEmbedUrl(marker: MapPoint, other?: MapPoint): string {
  const pts = other ? [marker, other] : [marker];
  const pad = 0.006;
  const minLat = Math.min(...pts.map((p) => p.lat)) - pad;
  const maxLat = Math.max(...pts.map((p) => p.lat)) + pad;
  const minLng = Math.min(...pts.map((p) => p.lng)) - pad;
  const maxLng = Math.max(...pts.map((p) => p.lng)) + pad;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${marker.lat},${marker.lng}`;
}
