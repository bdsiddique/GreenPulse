import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface WeatherCoordinateMapProps {
  lat: number;
  lon: number;
  onSelectCoordinate: (lat: number, lon: number) => void;
}

const PIN_ICON = L.divIcon({
  className: 'gridpulse-leaflet-pin',
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#0F172A;border:3px solid #F59E0B;box-shadow:0 2px 6px rgba(15,23,42,0.45);transform:translate(-50%,-50%);"></div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

export const WeatherCoordinateMap: React.FC<WeatherCoordinateMapProps> = ({
  lat,
  lon,
  onSelectCoordinate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelectCoordinate);

  useEffect(() => {
    onSelectRef.current = onSelectCoordinate;
  }, [onSelectCoordinate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [lat, lon],
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const marker = L.marker([lat, lon], {
      icon: PIN_ICON,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onSelectRef.current(
        Number(pos.lat.toFixed(4)),
        Number(pos.lng.toFixed(4))
      );
    });

    map.on('click', (ev: L.LeafletMouseEvent) => {
      const nextLat = Number(ev.latlng.lat.toFixed(4));
      const nextLon = Number(ev.latlng.lng.toFixed(4));
      marker.setLatLng([nextLat, nextLon]);
      onSelectRef.current(nextLat, nextLon);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Ensure proper tile rendering inside dynamically mounted popover
    const t1 = window.setTimeout(() => map.invalidateSize(), 60);
    const t2 = window.setTimeout(() => map.invalidateSize(), 240);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync map & marker when coordinates change externally (e.g. preset city or manual input)
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - lat) > 0.0005 || Math.abs(cur.lng - lon) > 0.0005) {
      marker.setLatLng([lat, lon]);
      map.setView([lat, lon], Math.max(map.getZoom(), 6), { animate: true });
    }
  }, [lat, lon]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
      <div
        ref={containerRef}
        className="w-full h-[165px] z-0"
        aria-label="Interactive coordinate map"
      />
      <div className="pointer-events-none absolute bottom-1 left-1.5 z-[400] rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
        Click map or drag pin to pick coordinates
      </div>
    </div>
  );
};
