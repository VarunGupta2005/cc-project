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

// Professional Color Palette for Inbound Deliveries
const ROUTE_PALETTE = [
  '#0284c7', // Sky Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#db2777', // Pink
];

// Professional Shelter Central Hub Pin (Sleek Royal Blue with SVG Building)
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
        box-shadow: 0 0 16px rgba(37, 99, 235, 0.65), 0 4px 10px rgba(0, 0, 0, 0.35);
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
          <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
        </svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });

// Professional Food Surplus Pin (Emerald Glow with SVG Plate & Utensils)
const createFoodIcon = () =>
  L.divIcon({
    className: 'custom-food-pin',
    html: `
      <div style="
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 0 14px rgba(16, 185, 129, 0.55), 0 3px 8px rgba(0, 0, 0, 0.3);
        cursor: pointer;
      ">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/>
          <path d="M15 2v19"/>
          <path d="M5 2v7a3 3 0 0 0 3 3h2"/>
          <path d="M7 2v20"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });

// Professional Active Delivery Courier Pin (Vibrant Sky-Blue with SVG Delivery Truck)
const createDeliveryCourierIcon = (color = '#0284c7') =>
  L.divIcon({
    className: 'custom-delivery-pin',
    html: `
      <div style="
        background: ${color};
        color: #ffffff;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 14px ${color}, 0 4px 10px rgba(0, 0, 0, 0.35);
        cursor: pointer;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18.5" r="2.5"/>
          <circle cx="7" cy="18.5" r="2.5"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -21],
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
          backgroundColor: 'var(--card)',
        }}
      >
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', background: 'var(--card)' }}
        >
          {/* Standard Free OpenStreetMap Basemap (Zero API Key Dependencies) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)' }}>
                  {shelterName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                  🏢 Central Shelter Hub
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.35rem' }}>
                  Radar Scan Perimeter: {radiusKm} km
                </div>
                {activeClaimed.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, marginTop: '0.2rem' }}>
                    🚚 {activeClaimed.length} Inbound Deliveries Active
                  </div>
                )}
              </div>
            </Popup>
          </Marker>

          {/* 3. Inbound Active Delivery Courier Pins (Clean Point Markers - No Cluttered Straight Lines) */}
          {activeClaimed.map((item, idx) => {
            const donorPos = [parseFloat(item.pickup_lat), parseFloat(item.pickup_lng)];
            const routeColor = ROUTE_PALETTE[idx % ROUTE_PALETTE.length];

            return (
              <Marker key={`delivery-courier-${item.id}`} position={donorPos} icon={createDeliveryCourierIcon(routeColor)}>
                <Popup>
                  <div style={{ padding: '0.25rem', minWidth: '220px', fontFamily: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: routeColor, textTransform: 'uppercase' }}>
                        Inbound Delivery #{idx + 1}
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                        {item.status}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)' }}>
                      {item.food_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                      📍 <b>From:</b> {item.pickup_address}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.1rem' }}>
                      🏢 <b>To:</b> {shelterName}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.45rem',
                        padding: '0.35rem 0.5rem',
                        backgroundColor: 'var(--secondary)',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: 'var(--foreground)' }}>⚖️ {item.quantity_kg} kg</span>
                      <span style={{ color: '#10b981' }}>Handover Code Verified</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
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
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)' }}>
                      {item.food_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                      📍 {item.pickup_address || 'Donor Kitchen'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        backgroundColor: 'var(--secondary)',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: 'var(--foreground)' }}>⚖️ {item.quantity_kg} kg</span>
                      <span style={{ color: '#10b981' }}>
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
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
              </svg>
            </span>
            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{shelterName} (Hub)</span>
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
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 2v19"/><path d="M5 2v7a3 3 0 0 0 3 3h2"/><path d="M7 2v20"/>
              </svg>
            </span>
            <span>{listings.length} Available Batches</span>
          </div>
          {activeClaimed.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0284c7', fontWeight: 600 }}>
              <span style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/>
                </svg>
              </span>
              <span>{activeClaimed.length} Inbound Deliveries Active</span>
            </div>
          )}
        </div>

        <span style={{ fontSize: '0.7rem' }}>Tap any pin for facility details & digital handover code</span>
      </div>
    </div>
  );
}
