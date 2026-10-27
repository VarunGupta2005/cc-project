import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Building2, Utensils, RefreshCw } from 'lucide-react';
import { fetchNearbyListings, fetchShelters } from '../services/api';
import { getSocket } from '../services/socket';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

// Custom Leaflet Icons using SVG Data URIs
const donorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const shelterIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function LiveMap() {
  const [donations, setDonations] = useState([]);
  const [shelters, setShelters] = useState([]);
  const center = [12.9716, 77.5946];

  const loadData = async () => {
    try {
      const [donationsData, sheltersData] = await Promise.all([
        fetchNearbyListings(12.9716, 77.5946, 25),
        fetchShelters(),
      ]);
      setDonations(donationsData.listings || []);
      setShelters(sheltersData.shelters || []);
    } catch (err) {
      console.error('[Error loading map markers]', err);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    socket.on('food:new_alert', () => loadData());
    socket.on('food:claimed', () => loadData());
    socket.on('food:expired', () => loadData());
    socket.on('delivery:update', () => loadData());

    return () => {
      socket.off('food:new_alert');
      socket.off('food:claimed');
      socket.off('food:expired');
      socket.off('delivery:update');
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--accent)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MapPin size={18} />
            </div>
            <div>
              <CardTitle>City-Wide Real-Time Dispatch Grid</CardTitle>
              <CardDescription>
                Live geospatial overlay. Red markers: Active surplus food &bull; Blue markers: Hunger shelters.
              </CardDescription>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Badge variant="destructive" style={{ gap: '0.35rem' }}>
              <Utensils size={11} />
              <span>Surplus ({donations.length})</span>
            </Badge>

            <Badge variant="info" style={{ gap: '0.35rem' }}>
              <Building2 size={11} />
              <span>Shelters ({shelters.length})</span>
            </Badge>

            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw size={12} />
              <span>Sync</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent style={{ paddingBottom: '1.25rem' }}>
        <div className="map-card-container">
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {/* Render Shelters */}
            {shelters.map((s) => (
              <Marker key={s.id} position={[parseFloat(s.latitude), parseFloat(s.longitude)]} icon={shelterIcon}>
                <Popup>
                  <div style={{ color: '#0f172a', padding: '0.2rem' }}>
                    <b style={{ fontSize: '0.875rem' }}>{s.name}</b>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Type: {s.org_type} &bull; Capacity: {s.capacity_kg} kg
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Render Active Food Donations */}
            {donations.map((d) => (
              <Marker key={d.id} position={[parseFloat(d.pickup_lat), parseFloat(d.pickup_lng)]} icon={donorIcon}>
                <Popup>
                  <div style={{ color: '#0f172a', padding: '0.2rem' }}>
                    <b style={{ fontSize: '0.875rem' }}>{d.food_type}</b>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Quantity: <b>{d.quantity_kg} kg</b> &bull; Status: {d.status}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
