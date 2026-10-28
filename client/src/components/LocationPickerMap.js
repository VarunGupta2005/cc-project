import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom Swiggy-style vibrant location pin
const pinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [28, 46],
  iconAnchor: [14, 46],
  popupAnchor: [1, -40],
  shadowSize: [41, 41],
});

// Helper component to handle click and drag events on the map
function MapEventsHandler({ position, onPositionChange }) {
  const map = useMap();

  useMapEvents({
    click(e) {
      const newPos = { lat: parseFloat(e.latlng.lat.toFixed(6)), lng: parseFloat(e.latlng.lng.toFixed(6)) };
      onPositionChange(newPos);
      map.panTo(e.latlng);
    },
  });

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={pinIcon}
      draggable={true}
      eventHandlers={{
        dragend(e) {
          const marker = e.target;
          const pos = marker.getLatLng();
          const newPos = { lat: parseFloat(pos.lat.toFixed(6)), lng: parseFloat(pos.lng.toFixed(6)) };
          onPositionChange(newPos);
        },
      }}
    />
  );
}

// Controller component to smoothly fly to a new coordinate
function MapPanController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.flyTo([center.lat, center.lng], map.getZoom() || 14, { duration: 1 });
    }
  }, [center, map]);
  return null;
}

export default function LocationPickerMap({
  initialLat = 12.9716,
  initialLng = 77.5946,
  onLocationSelect,
  height = '240px',
  label = 'Select Location on Map',
}) {
  const [position, setPosition] = useState({
    lat: parseFloat(initialLat) || 12.9716,
    lng: parseFloat(initialLng) || 77.5946,
  });
  const [flyCenter, setFlyCenter] = useState(null);
  const [locating, setLocating] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Sync internal position and fly map when initial coordinates change from props
  useEffect(() => {
    const pLat = parseFloat(initialLat);
    const pLng = parseFloat(initialLng);
    if (!isNaN(pLat) && !isNaN(pLng)) {
      setPosition({ lat: pLat, lng: pLng });
      setFlyCenter({ lat: pLat, lng: pLng });
    }
  }, [initialLat, initialLng]);

  // Reverse geocode whenever position changes (debounced)
  const timerRef = useRef(null);
  const handlePositionChange = (newPos) => {
    setPosition(newPos);
    if (onLocationSelect) {
      onLocationSelect(newPos.lat, newPos.lng, resolvedAddress);
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        setGeocoding(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPos.lat}&lon=${newPos.lng}&zoom=18&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            // Pick a clean concise portion of the address
            const parts = data.display_name.split(', ');
            const concise = parts.slice(0, 3).join(', ');
            setResolvedAddress(concise);
            if (onLocationSelect) {
              onLocationSelect(newPos.lat, newPos.lng, concise);
            }
          }
        }
      } catch (err) {
        // Fallback gracefully without breaking if network is offline
      } finally {
        setGeocoding(false);
      }
    }, 400);
  };

  // Swiggy-like GPS "Locate Me" button
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = {
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
        };
        setPosition(newPos);
        setFlyCenter(newPos);
        handlePositionChange(newPos);
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setLocating(false);
        // Default to Bangalore center if location permission denied
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Quick landmark shortcuts (Bangalore Hubs)
  const quickHubs = [
    { name: 'MG Road', lat: 12.9756, lng: 77.6066 },
    { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
    { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
    { name: 'Whitefield', lat: 12.9698, lng: 77.7499 },
    { name: 'Majestic', lat: 12.9767, lng: 77.5713 },
  ];

  const handleSelectHub = (hub) => {
    const newPos = { lat: hub.lat, lng: hub.lng };
    setPosition(newPos);
    setFlyCenter(newPos);
    handlePositionChange(newPos);
  };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* Header with Title and "Locate Me" button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>📍</span>
          <span>{label}</span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'normal' }}>
            (Tap map or drag pin)
          </span>
        </label>

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="btn btn-secondary"
          style={{
            fontSize: '0.75rem',
            padding: '0.3rem 0.65rem',
            gap: '0.35rem',
          }}
          title="Use browser GPS location"
        >
          <span>🎯</span>
          <span>{locating ? 'Detecting GPS...' : 'Use My GPS Location'}</span>
        </button>
      </div>

      {/* Map Box */}
      <div style={{
        height,
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
      }}>
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEventsHandler position={position} onPositionChange={handlePositionChange} />
          {flyCenter && <MapPanController center={flyCenter} />}
        </MapContainer>
      </div>

      {/* Quick Landmark Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Quick Hubs:</span>
        {quickHubs.map((hub) => (
          <button
            key={hub.name}
            type="button"
            onClick={() => handleSelectHub(hub)}
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {hub.name}
          </button>
        ))}
      </div>

      {/* Pinned Coordinates & Resolved Address Bar */}
      <div style={{
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.45rem 0.75rem',
        marginTop: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: 'var(--text-main)',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ color: 'var(--accent)', fontWeight: '700' }}>📍 Pin:</span>
          <span style={{ fontWeight: '600' }}>
            {resolvedAddress ? resolvedAddress : `${position.lat}, ${position.lng}`}
          </span>
          {geocoding && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(resolving...)</span>}
        </div>

        <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
          Lat: {position.lat} &bull; Lng: {position.lng}
        </div>
      </div>
    </div>
  );
}
