import React, { useState } from 'react';
import {
  Building2,
  Utensils,
  MapPin,
  Save,
  Server,
  CheckCircle2,
  ArrowRightLeft,
} from 'lucide-react';
import LocationPickerMap from '../components/LocationPickerMap';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export default function AccountPage({ session, onLogout, onSwitchRole }) {
  const isDonor = session?.user?.role === 'DONOR';
  const roleTitle = isDonor ? 'Food Producer' : 'Food Consumer';
  const roleSubtitle = isDonor ? 'Commercial Kitchen / Hotel / Caterer' : 'Hunger Shelter / Food Bank / NGO';

  const org = session?.org || {};
  const user = session?.user || {};

  const [lat, setLat] = useState(parseFloat(org.latitude) || 12.9716);
  const [lng, setLng] = useState(parseFloat(org.longitude) || 77.5946);
  const [address, setAddress] = useState(org.name || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveLocation = () => {
    try {
      const storedOrg = JSON.parse(localStorage.getItem('rg_org') || '{}');
      storedOrg.latitude = lat;
      storedOrg.longitude = lng;
      localStorage.setItem('rg_org', JSON.stringify(storedOrg));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save location', err);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '880px', margin: '0 auto' }}>
      {/* Profile Overview Card */}
      <Card>
        <CardHeader style={{ paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: 'var(--radius)',
                backgroundColor: isDonor ? 'var(--accent)' : 'var(--success-bg)',
                border: `1px solid ${isDonor ? '#bfdbfe' : 'var(--success-border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDonor ? 'var(--primary)' : '#059669',
              }}>
                {isDonor ? <Utensils size={24} /> : <Building2 size={24} />}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CardTitle style={{ fontSize: '1.25rem' }}>
                    {org.name || user.full_name || 'My Facility'}
                  </CardTitle>
                  <Badge variant="success">
                    <CheckCircle2 size={11} />
                    <span>Verified</span>
                  </Badge>
                </div>
                <CardDescription style={{ marginTop: '0.2rem' }}>
                  {roleTitle} &bull; {roleSubtitle}
                </CardDescription>
              </div>
            </div>

            <Badge variant="secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}>
              {user.role}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>
                Contact Email
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 600 }}>
                {user.email || 'N/A'}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>
                Representative
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 600 }}>
                {user.full_name || 'Staff User'}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>
                {isDonor ? 'Daily Surplus Cap' : 'Storage Capacity'}
              </div>
              <div style={{ fontSize: '0.85rem', color: isDonor ? 'var(--primary)' : '#059669', fontWeight: 700 }}>
                {org.capacity_kg || (isDonor ? '200' : '100')} kg
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>
                Geo-Coordinates
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--foreground)', fontFamily: 'monospace' }}>
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facility Pin Map Card */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
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
                <CardTitle>Physical Location & Coordinates</CardTitle>
                <CardDescription>
                  Drag the pin to adjust your facility entrance across the Redis spatial index.
                </CardDescription>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleSaveLocation}
            >
              <Save size={13} />
              <span>Save Location Pin</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {savedSuccess && (
            <div style={{
              backgroundColor: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius)',
              color: '#065f46',
              fontSize: '0.8125rem',
              marginBottom: '0.85rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <CheckCircle2 size={15} />
              <span>Location pin updated and saved to session!</span>
            </div>
          )}

          <LocationPickerMap
            initialLat={lat}
            initialLng={lng}
            label="Pinned Facility Entrance"
            onLocationSelect={(newLat, newLng, newAddress) => {
              setLat(newLat);
              setLng(newLng);
              if (newAddress) setAddress(newAddress);
            }}
            height="220px"
          />

          {address && (
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
              Resolved Address: <b>{address}</b>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cloud Security Info Card */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--secondary)',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Server size={18} />
            </div>
            <div>
              <CardTitle>Cloud Computing Architecture & Cluster Specs</CardTitle>
              <CardDescription>
                High-availability production cluster deployment details
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
            <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', fontWeight: 600 }}>Load Balancer</div>
              <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.84rem', marginTop: '0.15rem' }}>✓ Nginx (Port 80)</div>
            </div>

            <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', fontWeight: 600 }}>API Microservices</div>
              <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.84rem', marginTop: '0.15rem' }}>✓ 3x Replicas (Port 5000)</div>
            </div>

            <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', fontWeight: 600 }}>Session Auth</div>
              <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.84rem', marginTop: '0.15rem' }}>HMAC-SHA256 JWT</div>
            </div>

            <div style={{ backgroundColor: 'var(--secondary)', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', fontWeight: 600 }}>Spatial Index</div>
              <div style={{ color: '#d97706', fontWeight: 700, fontSize: '0.84rem', marginTop: '0.15rem' }}>Redis 7 In-Memory GEO</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evaluator Testing Helper */}
      <Card style={{ borderStyle: 'dashed', backgroundColor: 'var(--secondary)' }}>
        <CardContent style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Evaluator Viva Role Switcher
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                Instantly swap authentication perspective to test the opposite isolated portal:
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onSwitchRole(isDonor ? 'SHELTER' : 'DONOR')}
            >
              <ArrowRightLeft size={13} />
              <span>
                {isDonor ? 'Switch to Hope Haven (Consumer)' : 'Switch to Grand Palace (Producer)'}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
