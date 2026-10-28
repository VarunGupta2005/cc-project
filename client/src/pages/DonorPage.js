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
  FileText,
} from 'lucide-react';
import { createFoodListing, fetchAllListings, verifyPickup, fetchListingRecommendations } from '../services/api';
import { getSocket } from '../services/socket';
import LocationPickerMap from '../components/LocationPickerMap';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

export default function DonorPage({ session, initialSegment = 'broadcast', onSegmentChange }) {
  const [activeSegment, setActiveSegment] = useState(initialSegment); // 'broadcast', 'active', or 'history'

  const handleSegmentChange = (seg) => {
    setActiveSegment(seg);
    if (onSegmentChange) onSegmentChange(seg);
  };

  // Intake Form State
  const [foodType, setFoodType] = useState('Hot Vegetable Biryani & Gravy');
  const [category, setCategory] = useState('COOKED_MEAL');
  const [dietaryType, setDietaryType] = useState('VEG');
  const [safetyDeclared, setSafetyDeclared] = useState(true);
  const [quantityKg, setQuantityKg] = useState('25');
  const [expiryOption, setExpiryOption] = useState('7200'); // 2 hours default
  const [customHours, setCustomHours] = useState('2');
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
    }, 15000);

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

  const handleVerifyPickup = async (listingId, allocationId) => {
    const key = allocationId || listingId;
    const code = pickupOtpMap[key] || pickupOtpMap[listingId];
    if (!code || code.length !== 6) {
      setPickupMsg((prev) => ({ ...prev, [key]: { error: 'Please enter the 6-digit OTP from the driver.' } }));
      return;
    }

    setVerifyingId(key);
    try {
      await verifyPickup(listingId, code, session?.token, allocationId);
      setPickupMsg((prev) => ({
        ...prev,
        [key]: {
          success: 'Pickup verified! Handover authorized. Delivery status transitioned to IN_TRANSIT.',
        },
      }));
      loadMyListings();
    } catch (err) {
      setPickupMsg((prev) => ({ ...prev, [key]: { error: err.message } }));
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

  const activeBatches = myListings.filter(
    (l) => l.status === 'AVAILABLE' || l.status === 'CLAIMED' || l.status === 'IN_TRANSIT' || l.status === 'PARTIALLY_CLAIMED'
  );
  const historyBatches = myListings.filter(
    (l) => l.status === 'DELIVERED' || l.status === 'EXPIRED'
  );
  const activeBatchesCount = activeBatches.length;

  return (
    <div className="page-container" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Top Segmented Tabs Navigation */}
      <Tabs value={activeSegment} onValueChange={handleSegmentChange}>
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
            <TabsTrigger value="history">
              <FileText size={14} />
              <span>History & ESG Impact</span>
              {historyBatches.length > 0 && (
                <Badge variant="secondary" style={{ marginLeft: '0.25rem', fontSize: '0.65rem' }}>
                  {historyBatches.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
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
                  className={`alert-box ${statusMsg.type === 'success' ? 'alert-box--success' : 'alert-box--error'}`}
                  style={{ marginBottom: '1.25rem' }}
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
                        step="any"
                        min="0.1"
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
                      <span>Perishability Shelf-Life</span>
                      <span className="form-hint">Hours until food spoils</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Input
                        type="number"
                        step="any"
                        min="0.25"
                        max="72"
                        placeholder="2"
                        value={customHours}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomHours(val);
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed) && parsed > 0) {
                            setExpiryOption(Math.round(parsed * 3600).toString());
                          }
                        }}
                        required
                        style={{ paddingLeft: '2.25rem', paddingRight: '2.8rem' }}
                      />
                      <Clock
                        size={15}
                        color="#94a3b8"
                        style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                      />
                      <span style={{
                        position: 'absolute',
                        right: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.8rem',
                        color: 'var(--muted-foreground)',
                        fontWeight: 600,
                        pointerEvents: 'none',
                      }}>
                        hours
                      </span>
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
                  <span>{submitting ? 'Broadcasting Batch...' : 'Broadcast Surplus Food Batch'}</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: ACTIVE DONATIONS & HANDOVER GATE                                   */}
        {/* ========================================================================= */}
        <TabsContent value="active">
          {/* Active Listings Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--muted-foreground)',
              }}>
                Active Surplus Batches ({activeBatches.length})
              </span>
            </div>

            {activeBatches.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--secondary)',
                  color: 'var(--muted-foreground)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem',
                }}>
                  <Utensils size={20} />
                </div>
                <CardTitle style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>No active surplus batches</CardTitle>
                <CardDescription style={{ maxWidth: '360px', margin: '0 auto 1rem auto' }}>
                  You currently have no active listings awaiting claim or pickup.
                </CardDescription>
                <Button size="sm" onClick={() => setActiveSegment('broadcast')}>
                  <Send size={13} />
                  <span>Broadcast New Batch</span>
                </Button>
              </Card>
            ) : (
              <div>
                {activeBatches.map((item) => {
                  const isClaimed = item.status === 'CLAIMED';
                  const isInTransit = item.status === 'IN_TRANSIT';
                  const isPartiallyClaimed = item.status === 'PARTIALLY_CLAIMED';
                  const isAwaitingPickup = isClaimed || isPartiallyClaimed;

                  const allocations = Array.isArray(item.all_allocations) ? item.all_allocations : [];
                  const pendingAllocations = allocations.filter((a) => a.status === 'RESERVED');
                  const inTransitAllocations = allocations.filter((a) => a.status === 'IN_TRANSIT');

                  // Determine display weight & portion breakdown
                  const totalKg = parseFloat(item.quantity_kg || 0);
                  const remainingKg = parseFloat(item.quantity_remaining !== undefined ? item.quantity_remaining : totalKg);

                  // If an allocation is pending pickup, find its portion weight
                  let activePortionKg = null;
                  let activeRecipientName = item.claimed_by_name || 'Verified Shelter';

                  if (pendingAllocations.length === 1) {
                    activePortionKg = parseFloat(pendingAllocations[0].allocated_kg || 0);
                    activeRecipientName = pendingAllocations[0].shelter_name || activeRecipientName;
                  } else if (item.claimed_portion_kg) {
                    activePortionKg = parseFloat(item.claimed_portion_kg);
                  } else if (isPartiallyClaimed && remainingKg < totalKg) {
                    activePortionKg = totalKg - remainingKg;
                  }

                  const hasSplitPortion = activePortionKg !== null && activePortionKg < totalKg;
                  const isRemainingPortion = hasSplitPortion && remainingKg === 0;

                  const badgeVariant = isInTransit
                    ? 'info'
                    : isAwaitingPickup
                    ? 'outline'
                    : 'secondary';

                  return (
                    <div key={item.id} className="batch-card">
                      <div className="batch-card-header">
                        <div>
                          <div className="batch-title">{item.food_type}</div>
                          <div className="batch-meta-row" style={{ marginTop: '0.35rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Scale size={13} />
                              {hasSplitPortion ? (
                                <>
                                  <b>{activePortionKg.toFixed(1)} kg</b>
                                  <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, fontSize: '0.78rem' }}>
                                    ({isRemainingPortion ? 'Remaining portion' : 'Claimed portion'} of {totalKg.toFixed(1)} kg batch)
                                  </span>
                                </>
                              ) : (
                                <b>{totalKg.toFixed(1)} kg</b>
                              )}
                            </span>
                            {isPartiallyClaimed && remainingKg > 0 && !hasSplitPortion && (
                              <>
                                <span>&bull;</span>
                                <span style={{ color: 'var(--muted-foreground)' }}>
                                  Reserved: <b>{(totalKg - remainingKg).toFixed(1)} kg</b> ({remainingKg.toFixed(1)} kg left)
                                </span>
                              </>
                            )}
                            <span>&bull;</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MapPin size={13} />
                              {item.pickup_address}
                            </span>
                          </div>
                        </div>

                        <Badge
                          variant={badgeVariant}
                          style={
                            isAwaitingPickup
                              ? { color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }
                              : undefined
                          }
                        >
                          {isInTransit && <Truck size={11} />}
                          {isAwaitingPickup && <KeyRound size={11} />}
                          <span>
                            {isInTransit
                              ? 'In Transit'
                              : isPartiallyClaimed
                              ? 'Partially Claimed • Awaiting Pickup'
                              : isClaimed
                              ? 'Claimed • Awaiting Pickup'
                              : item.status}
                          </span>
                        </Badge>
                      </div>

                      {/* SMART RECOMMENDATIONS DRAWER (When status is AVAILABLE) */}
                      {(item.status === 'AVAILABLE' || isPartiallyClaimed) && (
                        <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                              Recommended Recipient Shelters
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleLoadRecs(item.id)}
                              disabled={loadingRecsId === item.id}
                              style={{ fontSize: '0.75rem', gap: '0.35rem', height: '28px' }}
                            >
                              <Sparkles size={12} color="var(--primary)" />
                              <span>{recsMap[item.id] ? 'Hide Matches' : 'Smart Feasible Matches'}</span>
                            </Button>
                          </div>

                          {recsMap[item.id] && (
                            <div style={{ marginTop: '0.65rem' }}>
                              {recsMap[item.id].length === 0 ? (
                                <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                  No shelters meet all operational constraints (deadline buffer or dietary compatibility) at this moment.
                                </div>
                              ) : (
                                recsMap[item.id].map((rec, idx) => (
                                  <div
                                    key={rec.recipient_id}
                                    style={{
                                      padding: '0.6rem 0.75rem',
                                      backgroundColor: idx === 0 ? 'rgba(56, 189, 248, 0.05)' : 'var(--muted)',
                                      borderRadius: 'var(--radius)',
                                      marginBottom: '0.45rem',
                                      border: idx === 0 ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid transparent',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 600, fontSize: '0.82rem', color: idx === 0 ? '#38bdf8' : 'var(--foreground)' }}>
                                        #{idx + 1} {rec.recipient_name}
                                      </span>
                                      <Badge variant={idx === 0 ? 'info' : 'secondary'} style={{ fontSize: '0.68rem' }}>
                                        Match: {(rec.total_score * 100).toFixed(0)}%
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

                      {/* PHYSICAL HANDOVER VERIFICATION GATE (When status is CLAIMED or PARTIALLY_CLAIMED) */}
                      {isAwaitingPickup && (
                        <div>
                          {pendingAllocations.length > 1 ? (
                            // Multiple pending allocations: Render separate handover gate for EACH courier
                            <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--foreground)', fontWeight: 600, fontSize: '0.84rem' }}>
                                <ShieldCheck size={16} />
                                <span>Driver Handover Verification ({pendingAllocations.length} Pickups Pending)</span>
                              </div>
                              {pendingAllocations.map((alloc) => {
                                const allocKey = alloc.id;
                                const portionWeight = parseFloat(alloc.allocated_kg || 0).toFixed(1);
                                return (
                                  <div key={alloc.id} className="otp-pass-card" style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                      <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#38bdf8' }}>
                                        Pickup for {alloc.shelter_name || 'Verified Shelter'}
                                      </span>
                                      <Badge variant="outline" style={{ fontSize: '0.72rem', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}>
                                        Portion: {portionWeight} kg
                                      </Badge>
                                    </div>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', margin: '0.2rem 0 0.65rem 0' }}>
                                      {alloc.rider_name ? (
                                        <>Assigned courier <b>{alloc.rider_name}</b> ({alloc.rider_phone}) must present their 6-digit OTP pass to collect <b>{portionWeight} kg</b>:</>
                                      ) : (
                                        <>The courier arriving from <b>{alloc.shelter_name}</b> must present their 6-digit OTP pass to collect <b>{portionWeight} kg</b>:</>
                                      )}
                                    </p>
                                    {pickupMsg[allocKey]?.error && (
                                      <div className="alert-box alert-box--error" style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                                        {pickupMsg[allocKey].error}
                                      </div>
                                    )}
                                    {pickupMsg[allocKey]?.success && (
                                      <div className="alert-box alert-box--info" style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                                        {pickupMsg[allocKey].success}
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
                                        value={pickupOtpMap[allocKey] || ''}
                                        onChange={(e) =>
                                          setPickupOtpMap((prev) => ({ ...prev, [allocKey]: e.target.value.trim() }))
                                        }
                                      />
                                      <Button
                                        disabled={verifyingId === allocKey}
                                        onClick={() => handleVerifyPickup(item.id, alloc.id)}
                                      >
                                        <KeyRound size={14} />
                                        <span>{verifyingId === allocKey ? 'Verifying OTP...' : 'Authorize Handover'}</span>
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : pendingAllocations.length === 1 ? (
                            // Single pending allocation
                            <div className="otp-pass-card" style={{ marginTop: '0.5rem', textAlign: 'left' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--foreground)', fontWeight: 600, fontSize: '0.84rem' }}>
                                <ShieldCheck size={16} />
                                <span>Driver Handover Verification</span>
                              </div>
                              <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', margin: '0.35rem 0 0.85rem 0' }}>
                                The courier arriving from <b>{activeRecipientName}</b> must present their 6-digit OTP pass{hasSplitPortion ? <> to pick up <b>{activePortionKg.toFixed(1)} kg</b></> : null}. Enter it below to authorize handover:
                              </p>

                              {pickupMsg[item.id]?.error && (
                                <div className="alert-box alert-box--error" style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                                  {pickupMsg[item.id].error}
                                </div>
                              )}
                              {pickupMsg[item.id]?.success && (
                                <div className="alert-box alert-box--info" style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                                  {pickupMsg[item.id].success}
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
                                    setPickupOtpMap((prev) => ({ ...prev, [item.id]: e.target.value.trim() }))
                                  }
                                />

                                <Button
                                  disabled={verifyingId === item.id}
                                  onClick={() => handleVerifyPickup(item.id, pendingAllocations[0]?.id)}
                                >
                                  <KeyRound size={14} />
                                  <span>{verifyingId === item.id ? 'Verifying OTP...' : 'Authorize Handover'}</span>
                                </Button>
                              </div>
                            </div>
                          ) : (allocations.length === 0 && isClaimed) ? (
                            // Legacy single-claim batch with no separate allocations record
                            <div className="otp-pass-card" style={{ marginTop: '0.5rem', textAlign: 'left' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--foreground)', fontWeight: 600, fontSize: '0.84rem' }}>
                                <ShieldCheck size={16} />
                                <span>Driver Handover Verification</span>
                              </div>
                              <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', margin: '0.35rem 0 0.85rem 0' }}>
                                The courier arriving from <b>{activeRecipientName}</b> must present their 6-digit OTP pass. Enter it below to authorize handover:
                              </p>

                              {pickupMsg[item.id]?.error && (
                                <div className="alert-box alert-box--error" style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                                  {pickupMsg[item.id].error}
                                </div>
                              )}
                              {pickupMsg[item.id]?.success && (
                                <div className="alert-box alert-box--info" style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                                  {pickupMsg[item.id].success}
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
                                    setPickupOtpMap((prev) => ({ ...prev, [item.id]: e.target.value.trim() }))
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
                          ) : (
                            // All pending portions already picked up / dispatched
                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--muted-foreground)', padding: '0.5rem 0.75rem', backgroundColor: 'var(--secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                              <CheckCircle2 size={14} color="#38bdf8" />
                              <span>All claimed portions have been authorized and picked up by couriers.{remainingKg > 0 ? ` ${remainingKg.toFixed(1)} kg surplus remaining on radar.` : ''}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Portions in transit notification */}
                      {inTransitAllocations.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          {inTransitAllocations.map((ita) => (
                            <div key={ita.id} className="alert-box alert-box--info" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                              <Truck size={14} />
                              <span>
                                Portion <b>{parseFloat(ita.allocated_kg || 0).toFixed(1)} kg</b> for <b>{ita.shelter_name || 'Verified Shelter'}</b> verified! Currently in transit{ita.rider_name ? ` with ${ita.rider_name}` : ''}.
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {isInTransit && inTransitAllocations.length === 0 && (
                        <div className="alert-box alert-box--info" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', marginBottom: 0 }}>
                          <Truck size={14} />
                          <span>Courier verified! Food is currently in transit to recipient shelter.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: HISTORY & ESG IMPACT SCORECARD                                     */}
        {/* ========================================================================= */}
        <TabsContent value="history">
          {/* ESG Impact Scorecards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <Card style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
                  Food Rescued
                </span>
                <Scale size={16} color="var(--primary)" />
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

          {/* Past History / Completed Log Section */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--muted-foreground)',
              }}>
                Donation History & Log ({historyBatches.length})
              </span>
            </div>

            {historyBatches.length === 0 ? (
              <Card style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                <CardDescription>
                  No past completed donations or expired batches yet.
                </CardDescription>
              </Card>
            ) : (
              <div>
                {historyBatches.map((item) => {
                  const isDelivered = item.status === 'DELIVERED';
                  const isExpired = item.status === 'EXPIRED';

                  return (
                    <div key={item.id} className="batch-card" style={{ opacity: isExpired ? 0.75 : 1 }}>
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
                            {item.claimed_by_name && (
                              <>
                                <span>&bull;</span>
                                <span>Shelter: <b>{item.claimed_by_name}</b></span>
                              </>
                            )}
                          </div>
                        </div>

                        <Badge
                          variant={isDelivered ? 'success' : 'outline'}
                          style={
                            isExpired
                              ? { color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
                              : undefined
                          }
                        >
                          {isDelivered && <CheckCircle2 size={11} />}
                          {isExpired && <Clock size={11} />}
                          <span>{isDelivered ? 'Delivered' : 'Expired'}</span>
                        </Badge>
                      </div>

                      {isDelivered && (
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            fontSize: '0.8rem',
                            color: '#10b981',
                            paddingTop: '0.35rem',
                          }}>
                            <CheckCircle2 size={14} />
                            <span>Delivery complete and safely received by recipient shelter.</span>
                          </div>
                          {Array.isArray(item.all_allocations) && item.all_allocations.length > 1 && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                              Distributed across {item.all_allocations.length} shelters: {item.all_allocations.map(a => `${parseFloat(a.allocated_kg || 0).toFixed(1)} kg (${a.shelter_name || 'Shelter'})`).join(', ')}
                            </div>
                          )}
                        </div>
                      )}

                      {isExpired && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          fontSize: '0.8rem',
                          color: 'var(--muted-foreground)',
                          paddingTop: '0.35rem',
                        }}>
                          <Clock size={14} />
                          <span>Shelf-life expired. Automatically archived from active listings.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
