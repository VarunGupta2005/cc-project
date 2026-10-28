import React, { useState } from 'react';
import {
  Zap,
  Utensils,
  Building2,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { loginUser, registerUser, saveSession } from '../services/api';
import LocationPickerMap from '../components/LocationPickerMap';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function AuthPage({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState('DONOR');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [capacityKg, setCapacityKg] = useState('100');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await loginUser(email, password);
      saveSession(data.token, data.user, data.organization);
      onLoginSuccess(data.user, data.organization);
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await loginUser(demoEmail, 'password123');
      saveSession(data.token, data.user, data.organization);
      onLoginSuccess(data.user, data.organization);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to authenticate demo account.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = {
        email,
        password,
        role,
        full_name: fullName,
        phone,
        organization: {
          name: orgName,
          org_type: role === 'DONOR' ? 'HOTEL' : 'SHELTER',
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          capacity_kg: parseFloat(capacityKg),
        },
      };

      const data = await registerUser(payload);
      saveSession(data.token, data.user, data.organization);
      onLoginSuccess(data.user, data.organization);
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: '2.5rem auto', padding: '0 1rem' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius)',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
          marginBottom: '0.75rem',
        }}>
          <Zap size={24} strokeWidth={2.5} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
          RescueGrid Cloud
        </h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem', marginTop: '0.2rem' }}>
          Real-Time Food Surplus Redistribution &bull; Redis 7 GEO + Postgres
        </p>
      </div>

      <Card>
        <CardContent style={{ padding: '1.75rem' }}>
          {/* Toggle between Login and Register */}
          <div className="ui-tabs-list" style={{ width: '100%', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => { setIsRegister(false); setErrorMsg(null); }}
              className={`ui-tabs-trigger ${!isRegister ? 'ui-tabs-trigger--active' : ''}`}
              style={{ flex: 1 }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setErrorMsg(null); }}
              className={`ui-tabs-trigger ${isRegister ? 'ui-tabs-trigger--active' : ''}`}
              style={{ flex: 1 }}
            >
              Register Facility
            </button>
          </div>

          {errorMsg && (
            <div className="alert-box alert-box--error" style={{ marginBottom: '1rem', fontSize: '0.8125rem' }}>
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {!isRegister ? (
            /* ================= SIGN IN FORM ================= */
            <div>
              {/* Step 1: Select Facility Category */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                  1. Select Facility Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div
                    onClick={() => {
                      setRole('DONOR');
                      setEmail('donor@grandhotel.com');
                      setPassword('password123');
                    }}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      border: `2px solid ${role === 'DONOR' ? 'var(--primary)' : 'var(--border)'}`,
                      backgroundColor: role === 'DONOR' ? 'var(--secondary)' : 'var(--card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Utensils size={18} color={role === 'DONOR' ? 'var(--primary)' : 'var(--muted-foreground)'} />
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: role === 'DONOR' ? 'var(--primary)' : 'var(--foreground)', marginTop: '0.35rem' }}>
                      Food Producer
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '0.1rem', lineHeight: '1.3' }}>
                      Commercial Kitchen / Caterer
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setRole('SHELTER');
                      setEmail('director@hopehaven.org');
                      setPassword('password123');
                    }}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      border: `2px solid ${role === 'SHELTER' ? 'var(--primary)' : 'var(--border)'}`,
                      backgroundColor: role === 'SHELTER' ? 'var(--secondary)' : 'var(--card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Building2 size={18} color={role === 'SHELTER' ? 'var(--primary)' : 'var(--muted-foreground)'} />
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: role === 'SHELTER' ? 'var(--primary)' : 'var(--foreground)', marginTop: '0.35rem' }}>
                      Food Consumer
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '0.1rem', lineHeight: '1.3' }}>
                      Hunger Shelter / NGO / Bank
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Credentials */}
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type="email"
                      placeholder="contact@organization.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{ paddingLeft: '2.25rem' }}
                    />
                    <Mail size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ paddingLeft: '2.25rem' }}
                    />
                    <Lock size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  variant={role === 'DONOR' ? 'default' : 'success'}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  <span>{loading ? 'Authenticating...' : `Enter ${role === 'DONOR' ? 'Producer' : 'Shelter'} Portal`}</span>
                  <ArrowRight size={15} />
                </Button>
              </form>

              {/* Quick 1-Click Demo Accounts */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                  ⚡ Quick Demo Evaluator Logins:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickLogin('donor@grandhotel.com')}
                    style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}
                  >
                    <Utensils size={13} />
                    <span>Grand Palace (Donor)</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickLogin('director@hopehaven.org')}
                    style={{ fontSize: '0.75rem', justifyContent: 'flex-start' }}
                  >
                    <Building2 size={13} />
                    <span>Hope Haven (Shelter)</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* ================= REGISTER FACILITY FORM ================= */
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Facility Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <Button
                    type="button"
                    variant={role === 'DONOR' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRole('DONOR')}
                  >
                    <Utensils size={13} />
                    <span>Food Producer</span>
                  </Button>
                  <Button
                    type="button"
                    variant={role === 'SHELTER' ? 'success' : 'outline'}
                    size="sm"
                    onClick={() => setRole('SHELTER')}
                  >
                    <Building2 size={13} />
                    <span>Hunger Shelter</span>
                  </Button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Facility / Organization Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Royal Bengal Caterers"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Representative Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <div style={{ position: 'relative' }}>
                  <Input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{role === 'DONOR' ? 'Daily Surplus Cap (kg)' : 'Cold Storage Capacity (kg)'}</span>
                </label>
                <Input
                  type="number"
                  placeholder="100"
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Official Email</label>
                <Input
                  type="email"
                  placeholder="admin@facility.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <LocationPickerMap
                  initialLat={parseFloat(lat) || 12.9716}
                  initialLng={parseFloat(lng) || 77.5946}
                  label="Pin Facility Entrance"
                  onLocationSelect={(newLat, newLng) => {
                    setLat(newLat.toString());
                    setLng(newLng.toString());
                  }}
                  height="160px"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                style={{ width: '100%' }}
              >
                <span>{loading ? 'Registering Facility...' : 'Create Verified Facility'}</span>
                <ArrowRight size={15} />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
