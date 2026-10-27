import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Send,
  PackageCheck,
  Clock,
  MapPin,
  Scale,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Truck,
  AlertCircle,
  Sparkles,
  Leaf,
  Layers,
} from 'lucide-react';
import { createFoodListing, fetchAllListings, verifyPickup, fetchListingRecommendations } from '../services/api';
import { getSocket } from '../services/socket';
import LocationPickerMap from '../components/LocationPickerMap';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

export default function DonorPage({ session, initialSegment = 'broadcast' }) {
  const [activeSegment, setActiveSegment] = useState(initialSegment); // 'broadcast' or 'active'

  // Intake Form State
  const [foodType, setFoodType] = useState('Hot Vegetable Biryani & Gravy');
  const [category, setCategory] = useState('COOKED_MEAL');
  const [dietaryType, setDietaryType] = useState('VEG');
  const [safetyDeclared, setSafetyDeclared] = useState(true);
  const [quantityKg, setQuantityKg] = useState('25');
  const [expiryOption, setExpiryOption] = useState('7200'); // 2 hours default
  const [pickupAddress, setPickupAddress] = useState(
    session?.org?.name ? `${session.org.name}, Banquet Hall` : 'Grand Palace Hotel, Banquet Hall, MG Road'
  );
  const [lat, setLat] = useState(session?.org?.latitude?.toString() || '12.9716');
  const [lng, setLng] = useState(session?.org?.longitude?.toString() || '77.5946');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Active Donations State
  const [myListings, setMyListings] = useState([]);
  const [pickupOtpMap, setPickupOtpMap] = useState({});
  const [verifyingId, setVerifyingId] = useState(null);
  const [pickupMsg, setPickupMsg] = useState({});
  const [recsMap, setRecsMap] = useState({});
  const [loadingRecsId, setLoadingRecsId] = useState(null);

  const donorId = session?.user?.id || '11111111-1111-1111-1111-111111111111';

  useEffect(() => {
    if (initialSegment) {
      setActiveSegment(initialSegment);
    }
  }, [initialSegment]);

  const loadMyListings = async () => {
    try {
      const data = await fetchAllListings(session?.token);
      const filtered = (data.listings || []).filter(
        (l) => l.donor_id === donorId || l.donor_name === session?.user?.full_name || !l.donor_id
      );
      setMyListings(filtered);
    } catch (err) {
      console.error('[DonorPage] Error loading listings:', err);
    }
  };

  useEffect(() => {
    loadMyListings();

    const socket = getSocket();
    const onUpdate = () => loadMyListings();

    socket.on('food:new_alert', onUpdate);
    socket.on('food:claimed', onUpdate);
    socket.on('food:expired', onUpdate);
    socket.on('delivery:update', onUpdate);

    const syncInterval = setInterval(() => {
      loadMyListings();
    }, 4000);

    return () => {
      clearInterval(syncInterval);
      socket.off('food:new_alert', onUpdate);
      socket.off('food:claimed', onUpdate);
      socket.off('food:expired', onUpdate);
      socket.off('delivery:update', onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePostFood = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMsg(null);

    try {
      const data = await createFoodListing({
        donor_id: donorId,
        food_type: foodType,
        quantity_kg: parseFloat(quantityKg),
        expires_in_seconds: parseInt(expiryOption, 10),
        pickup_address: pickupAddress,
        pickup_lat: parseFloat(lat),
        pickup_lng: parseFloat(lng),
        category,
        dietary_type: dietaryType,
        safety_declared: safetyDeclared,
      }, session?.token);

      setStatusMsg({
        type: 'success',
        text: `Surplus batch broadcasted successfully! ${data.nearby_shelters_alerted} nearby verified shelters alerted in <50ms.`,
      });

      await loadMyListings();
      setActiveSegment('active');
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadRecs = async (listingId) => {
    if (recsMap[listingId]) {
      setRecsMap((prev) => {
        const next = { ...prev };
        delete next[listingId];
        return next;
      });
      return;
    }
    setLoadingRecsId(listingId);
    try {
      const data = await fetchListingRecommendations(listingId, session?.token);
      setRecsMap((prev) => ({ ...prev, [listingId]: data.recommendations || [] }));
    } catch (e) {
      console.error('Failed to load recommendations', e);
    } finally {
      setLoadingRecsId(null);
    }
  };

  const handleVerifyPickup = async (listingId) => {
    const code = pickupOtpMap[listingId];
    if (!code || code.length !== 6) {
      setPickupMsg({ [listingId]: { error: 'Please enter the 6-digit OTP from the driver.' } });
      return;
    }

    setVerifyingId(listingId);
    try {
      await verifyPickup(listingId, code, session?.token);
      setPickupMsg({
        [listingId]: {
          success: 'Pickup verified! Handover authorized. Delivery status transitioned to IN_TRANSIT.',
        },
      });
      loadMyListings();
    } catch (err) {
      setPickupMsg({ [listingId]: { error: err.message } });
    } finally {
      setVerifyingId(null);
    }
  };

  // ESG Metrics
  const totalKgDonated = myListings.reduce(
    (sum, item) => (item.status === 'DELIVERED' ? sum + parseFloat(item.quantity_kg || 0) : sum),
    0
  );
  const totalMeals = Math.round(totalKgDonated * 2.5);
  const co2Saved = (totalKgDonated * 1.9).toFixed(1);

  const activeBatchesCount = myListings.filter(
    (l) => l.status === 'AVAILABLE' || l.status === 'CLAIMED' || l.status === 'IN_TRANSIT'
  ).length;

  return (
    <div className="page-container" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Top Segmented Tabs Navigation */}
      <Tabs value={activeSegment} onValueChange={setActiveSegment}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <TabsList>
            <TabsTrigger value="broadcast">
              <Send size={14} />
              <span>Broadcast Surplus Food</span>
            </TabsTrigger>
            <TabsTrigger value="active">
              <PackageCheck size={14} />
              <span>Active Donations & Handover</span>
              {activeBatchesCount > 0 && (
                <Badge variant="info" style={{ marginLeft: '0.25rem', fontSize: '0.65rem' }}>
                  {activeBatchesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <Badge variant="secondary" style={{ gap: '0.35rem' }}>
            <Layers size={12} />
            <span>PostgreSQL & Redis Dual-Write</span>
          </Badge>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: BROADCAST SURPLUS FOOD                                            */}
        {/* ========================================================================= */}
        <TabsContent value="broadcast">
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Utensils size={18} />
                </div>
                <div>
                  <CardTitle>Broadcast Prepared Food Surplus</CardTitle>
                  <CardDescription>
                    Publish freshly prepared surplus meals. Nearby hunger shelters receive instant WebSocket push alerts.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {statusMsg && (
                <div
                  style={{
                    backgroundColor: statusMsg.type === 'success' ? 'var(--success-bg)' : 'var(--destructive-bg)',
                    border: `1px solid ${statusMsg.type === 'success' ? 'var(--success-border)' : '#fecaca'}`,
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius)',
                    color: statusMsg.type === 'success' ? '#065f46' : '#991b1b',
                    marginBottom: '1.25rem',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span style={{ fontWeight: 500 }}>{statusMsg.text}</span>
                </div>
              )}

              <form onSubmit={handlePostFood}>
                <div className="form-group">
                  <label className="form-label">
                    <span>Food Description & Dietary Details</span>
                    <span className="form-hint">Item name, portions, temperature</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Hot Vegetable Biryani & Dal Makhani (50 portions)"
                    value={foodType}
                    onChange={(e) => setFoodType(e.target.value)}
                    required
                  />
                </div>

                {/* Category & Dietary Selection */}
                <div className="workflow-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">
                      <span>Food Category</span>
                      <span className="form-hint">Surplus classification</span>
                    </label>
                    <select
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '0.875rem',
                      }}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="COOKED_MEAL">Cooked Prepared Meals</option>
                      <option value="BAKERY">Bakery & Pastries</option>
                      <option value="RAW_PRODUCE">Raw Fresh Produce</option>
                      <option value="PACKAGED">Packaged / Canned Goods</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span>Dietary Classification</span>
                      <span className="form-hint">Recipient safety preference</span>
                    </label>
                    <div className="chips-row" style={{ marginTop: '0.15rem' }}>
                      {[
                        { label: 'Vegetarian', value: 'VEG' },
                        { label: 'Non-Vegetarian', value: 'NON_VEG' },
                        { label: 'Vegan', value: 'VEGAN' },
                      ].map((chip) => (
                        <button
                          key={chip.value}
                          type="button"
                          className={`chip-btn ${dietaryType === chip.value ? 'active' : ''}`}
                          onClick={() => setDietaryType(chip.value)}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="workflow-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">
                      <span>Total Weight (kg)</span>
                      <span className="form-hint">Estimated net weight</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Input
                        type="number"
                        step="0.5"
                        min="1"
                        placeholder="25"
                        value={quantityKg}
                        onChange={(e) => setQuantityKg(e.target.value)}
                        required
                        style={{ paddingLeft: '2.25rem' }}
                      />
                      <Scale
                        size={15}
                        color="#94a3b8"
                        style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span>Perishability Shelf-Life (TTL)</span>
                      <span className="form-hint">Auto-evicted from Redis</span>
                    </label>
                    <div className="chips-row" style={{ marginTop: '0.15rem' }}>
                      {[
                        { label: '⚡ 15s (Demo)', value: '15' },
                        { label: '1 Hour', value: '3600' },
                        { label: '2 Hours', value: '7200' },
                        { label: '4 Hours', value: '14400' },
                      ].map((chip) => (
                        <button
                          key={chip.value}
                          type="button"
                          className={`chip-btn ${expiryOption === chip.value ? 'active' : ''}`}
                          onClick={() => setExpiryOption(chip.value)}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>Kitchen Pickup Address & Gate</span>
                    <span className="form-hint">Specific loading dock or entry point</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type="text"
                      placeholder="e.g. Grand Palace Hotel, Banquet Hall, Gate 4"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      required
                      style={{ paddingLeft: '2.25rem' }}
                    />
                    <MapPin
                      size={15}
                      color="#94a3b8"
                      style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </div>
                </div>

                {/* Interactive Location Pin Map */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <LocationPickerMap
                    initialLat={parseFloat(lat) || 12.9716}
                    initialLng={parseFloat(lng) || 77.5946}
                    label="Pin Commercial Kitchen / Pickup Gate"
                    onLocationSelect={(newLat, newLng, autoAddress) => {
                      setLat(newLat.toString());
                      setLng(newLng.toString());
                      if (
                        autoAddress &&
                        (!pickupAddress || pickupAddress === 'Grand Palace Hotel, Banquet Hall, MG Road')
                      ) {
                        setPickupAddress(autoAddress);
                      }
                    }}
                    height="200px"
                  />
                </div>

                {/* Food Safety Compliance Checkbox */}
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: 'var(--muted)',
                    borderRadius: 'var(--radius)',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    border: '1px solid var(--border)',
                  }}
                >
                  <input
                    type="checkbox"
                    id="safety-declaration"
                    checked={safetyDeclared}
                    onChange={(e) => setSafetyDeclared(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="safety-declaration"
                    style={{ fontSize: '0.8rem', cursor: 'pointer', color: 'var(--foreground)', lineHeight: 1.4 }}
                  >
                    <b>Food Safety Declaration:</b> I confirm that this surplus food was safely prepared and maintained at proper temperature, remains unserved, and is fit for charitable redistribution.
                  </label>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || !safetyDeclared}
                  style={{ width: '100%' }}
                >
                  <Send size={16} />
                  <span>{submitting ? 'Broadcasting Batch to Redis GEO...' : 'Broadcast Surplus Food Batch'}</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: ACTIVE DONATIONS & HANDOVER GATE                                   */}
        {/* ========================================================================= */}
        <TabsContent value="active">
          {/* ESG Impact Scorecards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <Card style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
                  Food Rescued
                </span>
                <Scale size={16} color="#2563eb" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', marginTop: '0.25rem' }}>
                {totalKgDonated} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>kg</span>
              </div>
            </Card>

            <Card style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
                  Meals Distributed
                </span>
                <Sparkles size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
                {totalMeals} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>meals</span>
              </div>
            </Card>

            <Card style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
                  CO₂ Averted
                </span>
                <Leaf size={16} color="#d97706" />
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>
                {co2Saved} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>kg</span>
              </div>
            </Card>
          </div>

          {/* Active Listings List */}
          {myListings.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--secondary)',
                color: 'var(--muted-foreground)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <Utensils size={24} />
              </div>
              <CardTitle style={{ marginBottom: '0.35rem' }}>No active food batches</CardTitle>
              <CardDescription style={{ maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                You have no active food batches right now. Click below to broadcast prepared surplus meals to nearby shelters.
              </CardDescription>
              <Button onClick={() => setActiveSegment('broadcast')}>
                <Send size={15} />
                <span>Broadcast New Batch</span>
              </Button>
            </Card>
          ) : (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--muted-foreground)'
                }}>
                  Active Surplus Batches ({myListings.length})
                </span>
              </div>

              {myListings.map((item) => {
                const isClaimed = item.status === 'CLAIMED';
                const isInTransit = item.status === 'IN_TRANSIT';
                const isDelivered = item.status === 'DELIVERED';
                const isExpired = item.status === 'EXPIRED';

                const badgeVariant = isDelivered
                  ? 'success'
                  : isInTransit
                  ? 'info'
                  : isClaimed
                  ? 'warning'
                  : isExpired
                  ? 'destructive'
                  : 'secondary';

                return (
                  <div key={item.id} className="batch-card">
                    <div className="batch-card-header">
                      <div>
                        <div className="batch-title">{item.food_type}</div>
                        <div className="batch-meta-row" style={{ marginTop: '0.35rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Scale size={13} />
                            <b>{item.quantity_kg} kg</b>
                          </span>
                          <span>&bull;</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <MapPin size={13} />
                            {item.pickup_address}
                          </span>
                        </div>
                      </div>

                      <Badge variant={badgeVariant}>
                        {isDelivered && <CheckCircle2 size={11} />}
                        {isInTransit && <Truck size={11} />}
                        {isClaimed && <KeyRound size={11} />}
                        {isExpired && <AlertCircle size={11} />}
                        <span>{item.status}</span>
                      </Badge>
                    </div>

                    {/* SMART RECOMMENDATIONS DRAWER (When status is AVAILABLE) */}
                    {item.status === 'AVAILABLE' && (
                      <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                            Algorithm: Proximity + Capacity + Deadline Slack Feasibility
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadRecs(item.id)}
                            disabled={loadingRecsId === item.id}
                            style={{ fontSize: '0.75rem', gap: '0.35rem', height: '28px' }}
                          >
                            <Sparkles size={12} color="#2563eb" />
                            <span>{recsMap[item.id] ? 'Hide Matches' : 'Smart Feasible Matches'}</span>
                          </Button>
                        </div>

                        {recsMap[item.id] && (
                          <div style={{ marginTop: '0.65rem' }}>
                            {recsMap[item.id].length === 0 ? (
                              <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                No shelters meet all operational constraints (deadline buffer, dietary, or capacity) at this moment.
                              </div>
                            ) : (
                              recsMap[item.id].map((rec, idx) => (
                                <div
                                  key={rec.recipient_id}
                                  style={{
                                    padding: '0.6rem 0.75rem',
                                    backgroundColor: idx === 0 ? 'rgba(37, 99, 235, 0.05)' : 'var(--muted)',
                                    borderRadius: 'var(--radius)',
                                    marginBottom: '0.45rem',
                                    border: idx === 0 ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid transparent',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.82rem', color: idx === 0 ? '#1d4ed8' : 'var(--foreground)' }}>
                                      #{idx + 1} {rec.recipient_name}
                                    </span>
                                    <Badge variant={idx === 0 ? 'info' : 'secondary'} style={{ fontSize: '0.68rem' }}>
                                      Match Score: {(rec.total_score * 100).toFixed(0)}%
                                    </Badge>
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                                    {rec.explanation.summary}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* PHYSICAL HANDOVER VERIFICATION GATE (When status is CLAIMED) */}
                    {isClaimed && (
                      <div className="otp-pass-card" style={{ marginTop: '0.5rem', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: 600, fontSize: '0.84rem' }}>
                          <ShieldCheck size={16} />
                          <span>Driver Physical Handover Gate</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', margin: '0.35rem 0 0.85rem 0' }}>
                          The driver arriving from <b>{item.claimed_by_name || 'Verified Shelter'}</b> must present their 6-digit OTP pass. Enter it below to authorize pickup:
                        </p>

                        {pickupMsg[item.id]?.error && (
                          <div style={{
                            backgroundColor: 'var(--destructive-bg)',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.78rem',
                            marginBottom: '0.65rem'
                          }}>
                            {pickupMsg[item.id].error}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <Input
                            type="text"
                            placeholder="6-Digit OTP"
                            maxLength="6"
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '1.1rem',
                              fontWeight: 700,
                              letterSpacing: '0.2rem',
                              width: '160px',
                              textAlign: 'center',
                            }}
                            value={pickupOtpMap[item.id] || ''}
                            onChange={(e) =>
                              setPickupOtpMap({ ...pickupOtpMap, [item.id]: e.target.value.trim() })
                            }
                          />

                          <Button
                            disabled={verifyingId === item.id}
                            onClick={() => handleVerifyPickup(item.id)}
                          >
                            <KeyRound size={14} />
                            <span>{verifyingId === item.id ? 'Verifying OTP...' : 'Authorize Handover'}</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {isInTransit && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.8125rem',
                        color: '#1d4ed8',
                        backgroundColor: '#eff6ff',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #bfdbfe'
                      }}>
                        <Truck size={14} />
                        <span>Courier verified! Food is currently in transit to recipient shelter.</span>
                      </div>
                    )}

                    {isDelivered && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.8125rem',
                        color: '#065f46',
                        backgroundColor: '#ecfdf5',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #a7f3d0'
                      }}>
                        <CheckCircle2 size={14} />
                        <span>Delivery complete and safely recorded in PostgreSQL compliance audit trail.</span>
                      </div>
                    )}

                    {isExpired && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.8125rem',
                        color: 'var(--warning-foreground)',
                        backgroundColor: 'var(--warning-bg)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--warning-border)'
                      }}>
                        <Clock size={14} />
                        <span>Shelf-life TTL expired. Automatically evicted from active radar.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
