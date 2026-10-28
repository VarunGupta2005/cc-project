import React, { useState } from 'react';
import {
  Building2,
  Utensils,
  MapPin,
  Save,
  CheckCircle2,
  Bike,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import LocationPickerMap from '../components/LocationPickerMap';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { updateOrganizationProfile } from '../services/api';

export default function AccountPage({ session, onLogout }) {
  const role = session?.user?.role || 'DONOR';
  const org = session?.org || {};
  const user = session?.user || {};

  const getRoleMeta = () => {
    switch (role) {
      case 'DONOR':
        return {
          title: 'Food Producer Facility',
          subtitle: 'Commercial Kitchen / Hotel / Caterer',
          icon: Utensils,
          color: '#f59e0b',
        };
      case 'SHELTER':
        return {
          title: 'Hunger Shelter Facility',
          subtitle: 'Shelter / Food Bank / Community Kitchen',
          icon: Building2,
          color: '#10b981',
        };
      case 'RIDER':
        return {
          title: 'Fleet Courier Node',
          subtitle: 'Authorized Redistribution Rider',
          icon: Bike,
          color: '#38bdf8',
        };
      case 'ADMIN':
        return {
          title: 'Platform Operations Tower',
          subtitle: 'RescueGrid System Operator',
          icon: ShieldCheck,
          color: '#a855f7',
        };
      default:
        return {
          title: 'Authorized Facility Node',
          subtitle: 'RescueGrid Network Member',
          icon: Building2,
          color: '#6366f1',
        };
    }
  };

  const roleMeta = getRoleMeta();
  const RoleIcon = roleMeta.icon;

  const [lat, setLat] = useState(parseFloat(org.latitude) || 12.9716);
  const [lng, setLng] = useState(parseFloat(org.longitude) || 77.5946);
  const [address, setAddress] = useState(org.name || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleSaveLocation = async () => {
    if (!org.id) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateOrganizationProfile(org.id, {
        latitude: lat,
        longitude: lng,
        name: address || org.name,
      });

      // Update localStorage session org coordinates
      const storedOrg = JSON.parse(localStorage.getItem('rg_org') || '{}');
      storedOrg.latitude = lat;
      storedOrg.longitude = lng;
      if (address) storedOrg.name = address;
      localStorage.setItem('rg_org', JSON.stringify(storedOrg));

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || 'Failed to update organization location in PostgreSQL');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '880px', margin: '0 auto' }}>
      {/* Profile Overview Card */}
      <Card>
        <CardHeader style={{ paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: `${roleMeta.color}18`,
                  border: `1px solid ${roleMeta.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: roleMeta.color,
                }}
              >
                <RoleIcon size={26} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CardTitle style={{ fontSize: '1.25rem' }}>
                    {org.name || user.full_name || 'My Facility'}
                  </CardTitle>
                  <Badge variant="success">
                    <CheckCircle2 size={11} />
                    <span>{org.verification_status || 'VERIFIED'}</span>
                  </Badge>
                </div>
                <CardDescription style={{ marginTop: '0.2rem' }}>
                  {roleMeta.title} &bull; {roleMeta.subtitle}
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
                Operational Scope
              </div>
              <div style={{ fontSize: '0.85rem', color: roleMeta.color, fontWeight: 700 }}>
                {role === 'DONOR'
                  ? (org.capacity_kg ? `${org.capacity_kg} kg / day` : 'Commercial Kitchen')
                  : role === 'SHELTER'
                  ? 'Community Food Intake'
                  : role === 'RIDER'
                  ? 'City-Wide Courier'
                  : 'Platform Operations'}
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

      {/* Facility Pin Map Card (For Donors and Shelters) */}
      {(role === 'DONOR' || role === 'SHELTER') && (
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
                  <CardTitle>Physical Location & Entrance Coordinates</CardTitle>
                  <CardDescription>
                    Drag the pin to adjust your facility entrance for dispatch and pickups.
                  </CardDescription>
                </div>
              </div>

              <Button
                size="sm"
                disabled={saving}
                onClick={handleSaveLocation}
              >
                <Save size={13} />
                <span>{saving ? 'Saving...' : 'Save Location Pin'}</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {savedSuccess && (
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius)',
                color: '#34d399',
                fontSize: '0.8125rem',
                marginBottom: '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}>
                <CheckCircle2 size={15} />
                <span>Location pin updated successfully!</span>
              </div>
            )}

            {saveError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius)',
                color: '#f87171',
                fontSize: '0.8125rem',
                marginBottom: '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}>
                <AlertCircle size={15} />
                <span>{saveError}</span>
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
      )}
    </div>
  );
}
