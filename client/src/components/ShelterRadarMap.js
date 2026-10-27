import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default leaflet marker icon asset paths if broken in CRA
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Shelter Facility Pin (Blue Glow)
const createShelterIcon = () =>
  L.divIcon({
    className: 'custom-shelter-pin',
    html: `
      <div style="
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2.5px solid white;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.45);
        font-size: 16px;
      ">
        🏢
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });

// Custom Food Surplus Batch Pin (Emerald Glow)
const createFoodIcon = () =>
  L.divIcon({
    className: 'custom-food-pin',
    html: `
      <div style="
        background: linear-gradient(135deg, #16a34a, #15803d);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 3px 8px rgba(22, 163, 74, 0.4);
        font-size: 15px;
        cursor: pointer;
      ">
        🍲
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });

// Automatically fits map viewport when radius or center pin changes
function FitRadarBounds({ center, radiusKm }) {
  const map = useMap();

  const centerLat = center?.[0];
  const centerLng = center?.[1];

  useEffect(() => {
    if (centerLat && centerLng && radiusKm) {
      try {
        map.invalidateSize();
        // 25% margin buffer so the scan circle fits comfortably with breathing room
        const effectiveRadiusKm = parseFloat(radiusKm) * 1.25;

        // 1 deg latitude is ~111 km; 1 deg longitude at latitude lat is ~111 * cos(lat) km
        const latRad = (centerLat * Math.PI) / 180;
        const deltaLat = effectiveRadiusKm / 111.0;
        const deltaLng = effectiveRadiusKm / Math.max(0.001, 111.0 * Math.cos(latRad));

        const southWest = [centerLat - deltaLat, centerLng - deltaLng];
        const northEast = [centerLat + deltaLat, centerLng + deltaLng];

        map.fitBounds([southWest, northEast], {
          padding: [25, 25],
          maxZoom: 15,
          animate: true,
        });
      } catch (err) {
        console.error('FitRadarBounds error:', err);
      }
    }
  }, [centerLat, centerLng, radiusKm, map]);

  return null;
}

export default function ShelterRadarMap({
  shelterLat = 12.98,
  shelterLng = 77.605,
  shelterName = 'My Shelter',
  radiusKm = 15,
  listings = [],
  onClaim,
  height = '440px',
}) {
  const center = [parseFloat(shelterLat) || 12.98, parseFloat(shelterLng) || 77.605];
  const radiusMeters = Math.max(1000, (parseFloat(radiusKm) || 15) * 1000);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div
        style={{
          height,
          width: '100%',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitRadarBounds center={center} radiusKm={radiusKm} />

          {/* 1. Dynamic Blue Radar Scan Circle */}
          <Circle
            center={center}
            radius={radiusMeters}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.12,
              weight: 2,
              dashArray: '5, 8',
            }}
          />

          {/* 2. Registered Shelter Center Marker */}
          <Marker position={center} icon={createShelterIcon()}>
            <Popup>
              <div style={{ padding: '0.2rem', minWidth: '160px', fontFamily: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                  {shelterName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  🏢 Registered Shelter Facility
                </div>
                <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600, marginTop: '0.35rem' }}>
                  Radar Scan Radius: {radiusKm} km
                </div>
              </div>
            </Popup>
          </Marker>

          {/* 3. Available Food Surplus Donation Pins */}
          {listings.map((item) => {
            const lat = parseFloat(item.pickup_lat);
            const lng = parseFloat(item.pickup_lng);
            if (isNaN(lat) || isNaN(lng)) return null;

            return (
              <Marker key={item.id} position={[lat, lng]} icon={createFoodIcon()}>
                <Popup>
                  <div style={{ padding: '0.25rem', minWidth: '200px', fontFamily: 'inherit' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                      {item.food_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      📍 {item.pickup_address || 'Donor Kitchen'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: '#0f172a' }}>⚖️ {item.quantity_kg} kg</span>
                      <span style={{ color: '#059669' }}>
                        {item.distance_km ? `${item.distance_km} km away` : 'In Range'}
                      </span>
                    </div>

                    {onClaim && (
                      <button
                        type="button"
                        onClick={() => onClaim(item.id)}
                        style={{
                          marginTop: '0.6rem',
                          width: '100%',
                          padding: '0.45rem 0.75rem',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)',
                        }}
                      >
                        <span>Claim Surplus Batch</span>
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Map Legend Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'var(--muted)',
          borderBottomLeftRadius: 'var(--radius)',
          borderBottomRightRadius: 'var(--radius)',
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          border: '1px solid var(--border)',
          borderTop: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>🏢</span>
            <span>{shelterName} (Center)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.3)',
                border: '1.5px solid #2563eb',
                display: 'inline-block',
              }}
            />
            <span>{radiusKm} km Scan Perimeter</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>🍲</span>
            <span>{listings.length} Available Surplus Batches</span>
          </div>
        </div>

        <span style={{ fontSize: '0.7rem' }}>Tap any pin to view batch details & claim</span>
      </div>
    </div>
  );
}
