import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Loaded lazily by LocationPicker so Leaflet only downloads when a map is shown.

export interface LatLng {
  lat: number;
  lng: number;
}

interface MapPinPickerProps {
  value: LatLng | null;
  center: LatLng;
  zoom: number;
  onChange: (point: LatLng) => void;
  label: string;
}

// A CSS pin instead of Leaflet's default PNG icon (whose image paths break
// under bundlers) — also lets the pin follow the site's accent colour.
const pinIcon = L.divIcon({
  className: '',
  html: '<span class="map-pin" aria-hidden="true"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28]
});

function ClickToPlace({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

function Recenter({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom, map]);
  return null;
}

export default function MapPinPicker({ value, center, zoom, onChange, label }: MapPinPickerProps) {
  const eventHandlers = useMemo(() => ({
    dragend(e: L.LeafletEvent) {
      const p = (e.target as L.Marker).getLatLng();
      onChange({ lat: p.lat, lng: p.lng });
    }
  }), [onChange]);

  return (
    <div className="location-map" role="application" aria-label={label}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Recenter center={center} zoom={zoom} />
        <ClickToPlace onChange={onChange} />
        {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} draggable eventHandlers={eventHandlers} keyboard />}
      </MapContainer>
    </div>
  );
}
