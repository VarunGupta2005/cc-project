import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default leaflet marker icon asset paths if broken in CRA
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Vibrant Cyberpunk Palette for Multiple Concurrent Inbound Deliveries
const ROUTE_PALETTE = [
  '#38bdf8', // Electric Sky Blue
  '#34d399', // Radiant Emerald
  '#fbbf24', // Luminous Amber
  '#c084fc', // Cyber Purple
  '#f472b6', // Neon Pink
  '#67e8f9', // Cyan
];

// Custom Shelter Facility Pin (Electric Blue Hub Glow)
const createShelterIcon = () =>
  L.divIcon({
    className: 'custom-shelter-pin',
    html: `
      <div style="
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: white;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.65), 0 4px 10px rgba(0, 0, 0, 0.5);
        font-size: 18px;
      ">
        🏢
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });

// Custom Food Surplus Batch Pin (Emerald Glow for Unclaimed Batches)
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
        border: 2px solid #ffffff;
        box-shadow: 0 0 12px rgba(34, 197, 94, 0.5), 0 3px 8px rgba(0, 0, 0, 0.4);
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

// Custom Active Delivery Courier Pin (Glowing Truck with Route-specific color)
const createDeliveryCourierIcon = (color) =>
  L.divIcon({
    className: 'custom-delivery-pin',
    html: `
      <div style="
        background: ${color};
        color: #090d16;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 14px ${color}, 0 4px 10px rgba(0, 0, 0, 0.6);
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
      ">
        🚚
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
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
  claimedListings = [],
  onClaim,
  height = '440px',
}) {
  const center = [parseFloat(shelterLat) || 12.98, parseFloat(shelterLng) || 77.605];
  const radiusMeters = Math.max(1000, (parseFloat(radiusKm) || 15) * 1000);

  // Filter active claimed batches in-transit or pending pickup
  const activeClaimed = (claimedListings || []).filter(
    (item) =>
      (item.status === 'CLAIMED' || item.status === 'IN_TRANSIT') &&
      !isNaN(parseFloat(item.pickup_lat)) &&
      !isNaN(parseFloat(item.pickup_lng))
  );

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
          backgroundColor: '#090d16',
        }}
      >
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', background: '#090d16' }}
        >
          {/* CartoDB Dark Matter High-Contrast Night Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <FitRadarBounds center={center} radiusKm={radiusKm} />

          {/* 1. Dynamic Blue Radar Scan Perimeter */}
          <Circle
            center={center}
            radius={radiusMeters}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#1d4ed8',
              fillOpacity: 0.12,
              weight: 2,
              dashArray: '5, 8',
            }}
          />

          {/* 2. Registered Shelter Center Marker (Central Hub) */}
          <Marker position={center} icon={createShelterIcon()}>
            <Popup>
              <div style={{ padding: '0.2rem', minWidth: '170px', fontFamily: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f8fafc' }}>
                  {shelterName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  🏢 Central Shelter Hub
                </div>
                <div style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 600, marginTop: '0.35rem' }}>
                  Radar Scan Perimeter: {radiusKm} km
                </div>
                {activeClaimed.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600, marginTop: '0.2rem' }}>
                    🚚 {activeClaimed.length} Inbound Deliveries Active
                  </div>
                )}
              </div>
            </Popup>
          </Marker>

          {/* 3. Inbound Active Delivery Route Lines (Hub-and-Spoke Topology) */}
          {activeClaimed.map((item, idx) => {
            const donorPos = [parseFloat(item.pickup_lat), parseFloat(item.pickup_lng)];
            const routeColor = ROUTE_PALETTE[idx % ROUTE_PALETTE.length];

            return (
              <React.Fragment key={`delivery-route-${item.id}`}>
                {/* Visual Route Path Line */}
                <Polyline
                  positions={[donorPos, center]}
                  pathOptions={{
                    color: routeColor,
                    weight: 3.5,
                    dashArray: '8, 10',
                    opacity: 0.95,
                  }}
                >
                  <Popup>
                    <div style={{ padding: '0.25rem', minWidth: '220px', fontFamily: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: routeColor }}>
                          ● ACTIVE DELIVERY ROUTE #{idx + 1}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc', marginTop: '0.25rem' }}>
                        {item.food_type}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        From: <b>{item.pickup_address}</b> ➔ <b>{shelterName}</b>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '0.45rem',
                          padding: '0.35rem 0.5rem',
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ color: '#f8fafc' }}>⚖️ {item.quantity_kg} kg</span>
                        <span style={{ color: routeColor }}>Status: {item.status}</span>
                      </div>
                    </div>
                  </Popup>
                </Polyline>

                {/* Pickup Origin Marker (Donor Commercial Kitchen) */}
                <Marker position={donorPos} icon={createDeliveryCourierIcon(routeColor)}>
                  <Popup>
                    <div style={{ padding: '0.25rem', minWidth: '220px', fontFamily: 'inherit' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: routeColor, textTransform: 'uppercase' }}>
                        Pickup Kitchen Gate
                      </span>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f8fafc', marginTop: '0.2rem' }}>
                        {item.food_type}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        📍 {item.pickup_address}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '0.35rem', fontWeight: 600 }}>
                        Handover Code Verified at Kitchen Gate
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}

          {/* 4. Available Unclaimed Food Surplus Donation Pins */}
          {listings.map((item) => {
            const lat = parseFloat(item.pickup_lat);
            const lng = parseFloat(item.pickup_lng);
            if (isNaN(lat) || isNaN(lng)) return null;

            return (
              <Marker key={item.id} position={[lat, lng]} icon={createFoodIcon()}>
                <Popup>
                  <div style={{ padding: '0.25rem', minWidth: '210px', fontFamily: 'inherit' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f8fafc' }}>
                      {item.food_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      📍 {item.pickup_address || 'Donor Kitchen'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: '#f8fafc' }}>⚖️ {item.quantity_kg} kg</span>
                      <span style={{ color: '#34d399' }}>
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
                          boxShadow: '0 2px 6px rgba(22, 163, 74, 0.4)',
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
            <span>{shelterName} (Hub)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.3)',
                border: '1.5px solid #3b82f6',
                display: 'inline-block',
              }}
            />
            <span>{radiusKm} km Scan Perimeter</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>🍲</span>
            <span>{listings.length} Available Batches</span>
          </div>
          {activeClaimed.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#38bdf8', fontWeight: 600 }}>
              <span>🚚</span>
              <span>{activeClaimed.length} Active Inbound Routes</span>
            </div>
          )}
        </div>

        <span style={{ fontSize: '0.7rem' }}>Tap any pin or route for batch details & handover</span>
      </div>
    </div>
  );
}
