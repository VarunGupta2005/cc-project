import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Truck,
  MapPin,
  Clock,
  Sparkles,
  Maximize2,
  RefreshCw,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Zap,
  PlusCircle,
  Trash2,
  Utensils,
  XCircle,
} from 'lucide-react';
import {
  fetchNearbyListings,
  claimFoodListing,
  cancelClaimFoodListing,
  confirmDelivery,
  fetchAllListings,
  fetchRecipientRequests,
  createRecipientRequest,
  cancelRecipientRequest,
} from '../services/api';
import { getSocket } from '../services/socket';
import ShelterRadarMap from '../components/ShelterRadarMap';
import ClaimQuantityModal from '../components/ClaimQuantityModal';
import CancelClaimModal from '../components/CancelClaimModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function ShelterPage({ session, onOpenTokenModal, initialSegment = 'radar' }) {
  const [activeSegment, setActiveSegment] = useState(initialSegment);
  const [availableListings, setAvailableListings] = useState([]);
  const [allAvailableListings, setAllAvailableListings] = useState([]);
  const [claimedDeliveries, setClaimedDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimError, setClaimError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  // Partial / Full Claiming Modal State
  const [claimingListing, setClaimingListing] = useState(null);
  const [claimingLoading, setClaimingLoading] = useState(false);

  // Claim Cancellation Modal State
  const [cancellingDelivery, setCancellingDelivery] = useState(null);
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Active Food Demands / Requirements State
  const [myRequests, setMyRequests] = useState([]);
  const [reqQuantity, setReqQuantity] = useState('30');
  const [reqCategories, setReqCategories] = useState(['COOKED_MEAL', 'PACKAGED']);
  const [reqDietary, setReqDietary] = useState('ANY');
  const [reqHours, setReqHours] = useState('6');
  const [postingReq, setPostingReq] = useState(false);
  const [reqMsg, setReqMsg] = useState(null);

  const DEMAND_CATEGORIES = [
    { id: 'COOKED_MEAL', label: 'Cooked Prepared Meals', desc: 'Hot trays, rice, curries, meals' },
    { id: 'PACKAGED', label: 'Packaged / Canned Food', desc: 'Sealed snacks, dry rations, tins' },
    { id: 'BAKERY', label: 'Bakery & Bread', desc: 'Loaves, buns, rolls, pastries' },
    { id: 'RAW_PRODUCE', label: 'Raw Fresh Produce', desc: 'Vegetables, fruits, ingredients' },
  ];

  const toggleReqCategory = (catId) => {
    setReqCategories((prev) => {
      if (prev.includes(catId)) {
        if (prev.length === 1) return prev; // At least one must be selected
        return prev.filter((c) => c !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  // Dynamic Radar Location
  const initialLat = parseFloat(session?.org?.latitude) || 12.9800;
  const initialLng = parseFloat(session?.org?.longitude) || 77.6050;
  const [radarLat, setRadarLat] = useState(initialLat);
  const [radarLng, setRadarLng] = useState(initialLng);
  const [radarAddress, setRadarAddress] = useState(session?.org?.name || 'My Location');
  const [radiusKm, setRadiusKm] = useState(50);
  const [showMap, setShowMap] = useState(true);

  const activeShelterId = session?.org?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const radarLatRef = useRef(radarLat);
  const radarLngRef = useRef(radarLng);
  const radiusKmRef = useRef(radiusKm);

  useEffect(() => {
    radarLatRef.current = radarLat;
    radarLngRef.current = radarLng;
    radiusKmRef.current = radiusKm;
  }, [radarLat, radarLng, radiusKm]);

  useEffect(() => {
    if (initialSegment) {
      setActiveSegment(initialSegment);
    }
  }, [initialSegment]);

  const loadData = async (lat = radarLatRef.current, lng = radarLngRef.current, radius = radiusKmRef.current) => {
    try {
      setLoading(true);
      const [nearbyData, allData, reqData] = await Promise.all([
        fetchNearbyListings(lat, lng, radius),
        fetchAllListings(session?.token),
        fetchRecipientRequests(activeShelterId).catch(() => ({ requests: [] })),
      ]);

      setAvailableListings(nearbyData.listings || []);

      const activeAll = (allData.listings || []).filter(
        (l) => l.status === 'AVAILABLE'
      );
      setAllAvailableListings(activeAll);

      const myClaimed = (allData.listings || []).filter(
        (l) => l.claimed_by === activeShelterId && l.status !== 'EXPIRED'
      );
      setClaimedDeliveries(myClaimed);
      setMyRequests(reqData.requests || []);
    } catch (err) {
      console.error('[ShelterPage Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostRequest = async (e) => {
    e.preventDefault();
    setPostingReq(true);
    setReqMsg(null);
    try {
      const catString = reqCategories.length > 0 ? reqCategories.join(',') : 'COOKED_MEAL';
      await createRecipientRequest({
        org_id: activeShelterId,
        quantity_kg: parseFloat(reqQuantity),
        category: catString,
        dietary_type: reqDietary,
        hours_valid: parseFloat(reqHours),
      }, session?.token);
      setReqMsg({ type: 'success', text: `Broadcasted active demand for ${reqCategories.length} category(ies) to donors & matching engine!` });
      loadData();
    } catch (err) {
      setReqMsg({ type: 'error', text: err.message });
    } finally {
      setPostingReq(false);
    }
  };

  const handleCancelReq = async (id) => {
    try {
      await cancelRecipientRequest(id, session?.token);
      loadData();
    } catch (err) {
      console.error('Failed to cancel request', err);
    }
  };

  useEffect(() => {
    loadData(radarLat, radarLng, radiusKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radarLat, radarLng, radiusKm]);

  // Real-time WebSockets & Background Sync
  useEffect(() => {
    const socket = getSocket();

    const refreshData = () => {
      loadData(radarLatRef.current, radarLngRef.current, radiusKmRef.current);
    };

    socket.on('food:new_alert', refreshData);
    socket.on('food:claimed', refreshData);
    socket.on('food:partially_claimed', refreshData);
    socket.on('food:reopened', refreshData);
    socket.on('food:expired', refreshData);
    socket.on('delivery:update', refreshData);

    const syncTimer = setInterval(refreshData, 4000);

    return () => {
      clearInterval(syncTimer);
      socket.off('food:new_alert', refreshData);
      socket.off('food:claimed', refreshData);
      socket.off('food:partially_claimed', refreshData);
      socket.off('food:reopened', refreshData);
      socket.off('food:expired', refreshData);
      socket.off('delivery:update', refreshData);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocationUpdate = (newLat, newLng, newAddress) => {
    setRadarLat(newLat);
    setRadarLng(newLng);
    if (newAddress) setRadarAddress(newAddress);
    loadData(newLat, newLng, radiusKm);
  };

  const openClaimModal = (item) => {
    setClaimError(null);
    setClaimingListing(item);
  };

  const handleConfirmClaim = async (claimKg) => {
    if (!claimingListing) return;
    setClaimingLoading(true);
    setClaimError(null);
    try {
      const data = await claimFoodListing(claimingListing.id, activeShelterId, session?.token, claimKg);
      const token = data.handover?.verification_code || data.verification_token;
      if (token) {
        onOpenTokenModal(token, claimingListing.id);
      }
      setClaimingListing(null);
      await loadData();
      setActiveSegment('deliveries');
    } catch (err) {
      setClaimError(err.message);
    } finally {
      setClaimingLoading(false);
    }
  };

  const handleOpenCancelModal = (delivery) => {
    setCancelError(null);
    setCancellingDelivery(delivery);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingDelivery) return;
    setCancellingLoading(true);
    setCancelError(null);
    try {
      await cancelClaimFoodListing(cancellingDelivery.id, activeShelterId, session?.token);
      setCancellingDelivery(null);
      await loadData();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancellingLoading(false);
    }
  };

  const handleConfirmDelivery = async (listingId) => {
    setConfirmingId(listingId);
    try {
      await confirmDelivery(listingId, 'Verified handover at shelter', session?.token);
      await loadData();
    } catch (err) {
      alert('Confirmation failed: ' + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const formatTtl = (seconds) => {
    if (!seconds || seconds <= 0) return 'Expired';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s left`;
    return `${m}m ${s}s left`;
  };

  return (
    <div className="page-container" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Segmented Control Header */}
      <Tabs value={activeSegment} onValueChange={setActiveSegment}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <TabsList>
            <TabsTrigger value="radar">
              <Radio size={14} />
              <span>Inbound Food Radar</span>
              {availableListings.length > 0 && (
                <Badge variant="info" style={{ marginLeft: '0.25rem', fontSize: '0.65rem' }}>
                  {availableListings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="demand">
              <Utensils size={14} />
              <span>Active Food Demand</span>
              {myRequests.length > 0 && (
                <Badge variant="warning" style={{ marginLeft: '0.25rem', fontSize: '0.65rem' }}>
                  {myRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deliveries">
              <Truck size={14} />
              <span>Claimed Deliveries & OTP</span>
              {claimedDeliveries.length > 0 && (
                <Badge variant="success" style={{ marginLeft: '0.25rem', fontSize: '0.65rem' }}>
                  {claimedDeliveries.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <Badge variant="secondary" style={{ gap: '0.35rem' }}>
            <Zap size={12} color="#2563eb" />
            <span>Redis GEO Proximity &bull; &lt;5ms</span>
          </Badge>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: INBOUND FOOD SURPLUS RADAR                                         */}
        {/* ========================================================================= */}
        <TabsContent value="radar">
          {/* Radar Configuration Card */}
          <Card style={{ marginBottom: '1.25rem' }}>
            <CardHeader style={{ paddingBottom: '0.75rem' }}>
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
                    <Radio size={18} />
                  </div>
                  <div>
                    <CardTitle>Shelter Geo-Radar</CardTitle>
                    <CardDescription>
                      Centered at <b>{radarAddress}</b> ({radarLat.toFixed(3)}, {radarLng.toFixed(3)})
                    </CardDescription>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select
                    className="ui-input"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
                    style={{ width: 'auto', height: '1.875rem', fontSize: '0.78rem', padding: '0 0.5rem' }}
                  >
                    <option value="5">5 km (Neighborhood)</option>
                    <option value="15">15 km (City Center)</option>
                    <option value="30">30 km (Suburban)</option>
                    <option value="50">50 km (Metro Area)</option>
                    <option value="150">150 km (Regional)</option>
                    <option value="3000">🌐 All India (Wide Test)</option>
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMap(!showMap)}
                  >
                    <MapPin size={13} />
                    <span>{showMap ? 'Hide Radar Map' : 'Show Radar Map'}</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadData()}
                  >
                    <RefreshCw size={13} />
                    <span>Sync</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Visual Radar Map with Dynamic Blue Scan Perimeter */}
            {showMap && (
              <CardContent style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <ShelterRadarMap
                  shelterLat={radarLat}
                  shelterLng={radarLng}
                  shelterName={session?.org?.name || session?.user?.full_name || 'My Shelter'}
                  radiusKm={radiusKm}
                  listings={availableListings}
                  claimedListings={claimedDeliveries}
                  currentShelterId={activeShelterId}
                  onClaim={openClaimModal}
                  height="440px"
                />
              </CardContent>
            )}
          </Card>

          {claimError && (
            <div style={{
              backgroundColor: 'var(--destructive-bg)',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius)',
              marginBottom: '1rem',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <AlertCircle size={16} />
              <span><b>Claim Conflict:</b> {claimError}</span>
            </div>
          )}

          {/* Diagnostic Banner if batches exist outside radius */}
          {availableListings.length === 0 && allAvailableListings.length > 0 && (
            <Card style={{
              backgroundColor: 'var(--accent)',
              borderColor: '#bfdbfe',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#1d4ed8', fontWeight: 600, fontSize: '0.875rem' }}>
                <Sparkles size={16} />
                <span>{allAvailableListings.length} Surplus Food Batch(es) Active in Cluster</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', margin: '0.35rem 0 0.75rem 0' }}>
                Batch <b>"{allAvailableListings[0].food_type}"</b> was posted at <b>{allAvailableListings[0].pickup_address}</b> (~{getDistanceKm(radarLat, radarLng, parseFloat(allAvailableListings[0].pickup_lat), parseFloat(allAvailableListings[0].pickup_lng))} km away from your pin).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  onClick={() => {
                    const target = allAvailableListings[0];
                    handleLocationUpdate(
                      parseFloat(target.pickup_lat),
                      parseFloat(target.pickup_lng),
                      target.pickup_address
                    );
                  }}
                >
                  <Navigation size={13} />
                  <span>Snap Radar to Food Location</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRadiusKm(3000)}
                >
                  <span>Expand Radius to All India</span>
                </Button>
              </div>
            </Card>
          )}

          {/* Food Feed */}
          {loading ? (
            <Card style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--muted-foreground)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <RefreshCw size={16} className="spin" />
                <span>Scanning Redis geospatial index for fresh surplus batches...</span>
              </div>
            </Card>
          ) : availableListings.length === 0 ? (
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
                <Radio size={24} />
              </div>
              <CardTitle style={{ marginBottom: '0.35rem' }}>
                No active food batches in your immediate radius ({radiusKm} km)
              </CardTitle>
              <CardDescription style={{ maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
                Your shelter radar is scanning around <b>{radarAddress}</b>. Switch to the Food Producer portal to broadcast food, or broaden your search radius.
              </CardDescription>
              <Button variant="outline" onClick={() => setRadiusKm(3000)}>
                <span>Search All India (3000 km)</span>
              </Button>
            </Card>
          ) : (
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--muted-foreground)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
              }}>
                Available Surplus Batches ({availableListings.length})
              </div>

              {availableListings.map((item) => {
                const remKg = item.quantity_remaining !== undefined ? parseFloat(item.quantity_remaining) : parseFloat(item.quantity_kg || 0);
                const totalKg = parseFloat(item.quantity_kg || remKg);
                const isPartial = remKg < totalKg;

                const isMyPriority1 = activeShelterId && item.priority_tier_1_recipient && item.priority_tier_1_recipient === activeShelterId;
                const tier2List = item.priority_tier_2_recipients ? item.priority_tier_2_recipients.split(',') : [];
                const isMyPriority2 = activeShelterId && tier2List.includes(activeShelterId);

                const isTier1Locked = item.current_tier === 1 && item.priority_tier_1_recipient && !isMyPriority1;
                const isTier2Locked = item.current_tier === 2 && item.priority_tier_1_recipient && !isMyPriority1 && !isMyPriority2;
                const isLocked = isTier1Locked || isTier2Locked;
                const lockMinsLeft = Math.max(1, Math.ceil((item.tier_seconds_remaining || 0) / 60));

                return (
                  <div key={item.id} className="batch-card">
                    <div className="batch-card-header">
                      <div>
                        <div className="batch-title">{item.food_type}</div>
                        <div className="batch-meta-row" style={{ marginTop: '0.25rem' }}>
                          <MapPin size={13} />
                          <span>{item.pickup_address}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Cascading Priority Tier Badges */}
                        {isMyPriority1 && item.current_tier === 1 && (
                          <Badge variant="success" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#047857', border: '1px solid #10b981', fontSize: '0.72rem' }}>
                            ⭐ Priority Match for You ({lockMinsLeft}m window)
                          </Badge>
                        )}
                        {isLocked && (
                          <Badge variant="destructive" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#991b1b', border: '1px solid #f87171', fontSize: '0.72rem' }}>
                            🔒 Priority Reserved ({lockMinsLeft}m left)
                          </Badge>
                        )}
                        {item.current_tier === 2 && (isMyPriority1 || isMyPriority2) && (
                          <Badge variant="info" style={{ fontSize: '0.72rem' }}>
                            ⚡ Top-5 Priority Match
                          </Badge>
                        )}

                        {item.dietary_type && (
                          <Badge variant="outline" style={{ fontSize: '0.7rem' }}>
                            {item.dietary_type}
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {item.distance_km ? `${item.distance_km} km away` : 'Near you'}
                        </Badge>
                        <Badge variant="warning">
                          <Clock size={11} />
                          <span>{formatTtl(item.ttl_remaining_seconds)}</span>
                        </Badge>
                      </div>
                    </div>

                    {/* Feasibility & Transit Slack Indicator */}
                    {(() => {
                      const dist = parseFloat(item.distance_km) || 2.0;
                      const oneWayMins = Math.ceil((dist / 25.0) * 60);
                      const roundTripMins = oneWayMins * 2;
                      const totalOpMins = roundTripMins + 30; // 15m pickup + 15m delivery handling
                      const ttlMins = Math.floor((item.ttl_remaining_seconds || 7200) / 60);
                      const slackMins = ttlMins - totalOpMins;
                      const isFeasible = slackMins >= 0;

                      return (
                        <div style={{
                          marginTop: '0.4rem',
                          padding: '0.45rem 0.65rem',
                          backgroundColor: isFeasible ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          borderRadius: 'var(--radius)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.74rem'
                        }}>
                          <span style={{ color: isFeasible ? '#065f46' : '#991b1b', fontWeight: 600 }}>
                            {isFeasible ? '✓ Feasible Self-Pickup' : '⚠ Tight Deadline Buffer'}
                          </span>
                          <span style={{ color: 'var(--muted-foreground)' }}>
                            Round-trip ETA: <b>~{roundTripMins}m</b> &bull; Slack Buffer: <b>{slackMins > 0 ? `+${slackMins}m` : `${slackMins}m`}</b>
                          </span>
                        </div>
                      );
                    })()}

                    <div className="batch-card-footer">
                      <div>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>
                          {remKg} kg
                        </span>
                        {isPartial ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginLeft: '0.35rem' }}>
                            left of {totalKg} kg
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginLeft: '0.35rem' }}>
                            prepared food available
                          </span>
                        )}
                        {isPartial && (
                          <Badge variant="outline" style={{ marginLeft: '0.45rem', color: '#16a34a', borderColor: '#16a34a', fontSize: '0.68rem' }}>
                            PARTIALLY CLAIMED
                          </Badge>
                        )}
                      </div>

                      <Button
                        variant="success"
                        disabled={isLocked}
                        onClick={() => openClaimModal(item)}
                      >
                        <Zap size={14} />
                        <span>{isLocked ? `Priority Reserved (${lockMinsLeft}m)` : isPartial ? 'Claim Remaining / Partial' : 'Claim Surplus Batch'}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: ACTIVE FOOD DEMAND & REQUIREMENTS                                  */}
        {/* ========================================================================= */}
        <TabsContent value="demand">
          <Card style={{ marginBottom: '1.25rem' }}>
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
                  <CardTitle>Broadcast Active Food Demand</CardTitle>
                  <CardDescription>
                    Publish your shelter's current headcount food requirements. The matching engine aligns donations with genuine needs.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {reqMsg && (
                <div
                  style={{
                    backgroundColor: reqMsg.type === 'success' ? 'var(--success-bg)' : 'var(--destructive-bg)',
                    border: `1px solid ${reqMsg.type === 'success' ? 'var(--success-border)' : '#fecaca'}`,
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius)',
                    color: reqMsg.type === 'success' ? '#065f46' : '#991b1b',
                    marginBottom: '1rem',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {reqMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{reqMsg.text}</span>
                </div>
              )}

              <form onSubmit={handlePostRequest}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="form-group" style={{ maxWidth: '320px', marginBottom: '1.25rem' }}>
                    <label className="form-label">
                      <span>Total Quantity Needed (kg)</span>
                      <span className="form-hint">Kilograms required</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      placeholder="30"
                      value={reqQuantity}
                      onChange={(e) => setReqQuantity(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  {/* Multi-Select Checkboxes for Accepted Categories */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label">
                      <span>Accepted Food Categories (Tick all that apply)</span>
                      <span className="form-hint" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {reqCategories.length} category(ies) selected
                      </span>
                    </label>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                      gap: '0.6rem',
                      marginTop: '0.35rem'
                    }}>
                      {DEMAND_CATEGORIES.map((cat) => {
                        const isSelected = reqCategories.includes(cat.id);
                        return (
                          <div
                            key={cat.id}
                            onClick={() => toggleReqCategory(cat.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.65rem',
                              padding: '0.65rem 0.85rem',
                              borderRadius: 'var(--radius)',
                              border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                              backgroundColor: isSelected ? 'var(--accent)' : 'var(--card)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              userSelect: 'none',
                              boxShadow: isSelected ? 'var(--shadow-xs)' : 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by container onClick
                              style={{
                                cursor: 'pointer',
                                accentColor: 'var(--primary)',
                                width: '16px',
                                height: '16px',
                                marginTop: '2px',
                                flexShrink: 0
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.84rem', fontWeight: isSelected ? 700 : 600, color: 'var(--foreground)' }}>
                                {cat.label}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.1rem' }}>
                                {cat.desc}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="workflow-grid" style={{ marginBottom: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">
                      <span>Dietary Compatibility</span>
                      <span className="form-hint">Beneficiary requirement</span>
                    </label>
                    <select
                      value={reqDietary}
                      onChange={(e) => setReqDietary(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="ANY">Any Dietary Type</option>
                      <option value="VEG">Strictly Vegetarian</option>
                      <option value="NON_VEG">Includes Non-Vegetarian</option>
                      <option value="VEGAN">Strictly Vegan</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span>Needed Within</span>
                      <span className="form-hint">Operational delivery window</span>
                    </label>
                    <select
                      value={reqHours}
                      onChange={(e) => setReqHours(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="2">Next 2 Hours (Urgent Meal)</option>
                      <option value="4">Next 4 Hours</option>
                      <option value="6">Next 6 Hours</option>
                      <option value="12">Next 12 Hours (Today)</option>
                      <option value="24">Next 24 Hours</option>
                    </select>
                  </div>
                </div>

                <Button type="submit" disabled={postingReq} style={{ width: '100%' }}>
                  <PlusCircle size={15} />
                  <span>{postingReq ? 'Broadcasting Need...' : `Broadcast Food Requirement (${reqCategories.length} Categories)`}</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Needs List */}
          <div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--muted-foreground)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem',
            }}>
              Current Active Requirements ({myRequests.length})
            </div>

            {myRequests.length === 0 ? (
              <Card style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                <CardDescription>
                  No active requirements posted. Post a requirement above so commercial donors and the matching algorithm prioritize your shelter.
                </CardDescription>
              </Card>
            ) : (
              myRequests.map((req) => (
                <div key={req.id} className="batch-card" style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {req.quantity_kg} kg &bull; {(req.category || 'COOKED_MEAL').split(',').map((c) => c.replace('_', ' ')).join(' + ')} ({req.dietary_type})
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                        Needed by: {new Date(req.needed_by).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(req.needed_by).toLocaleDateString()})
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant={req.status === 'ACTIVE' ? 'warning' : 'secondary'}>
                        {req.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelReq(req.id)}
                        style={{ height: '28px', padding: '0 0.5rem', color: '#b91c1c' }}
                      >
                        <Trash2 size={13} />
                        <span>Cancel</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: CLAIMED DELIVERIES & HANDOVER OTP                                  */}
        {/* ========================================================================= */}
        <TabsContent value="deliveries">
          {claimedDeliveries.length === 0 ? (
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
                <Truck size={24} />
              </div>
              <CardTitle style={{ marginBottom: '0.35rem' }}>No active deliveries claimed</CardTitle>
              <CardDescription style={{ maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                Claim an active surplus batch from the Inbound Radar to track your courier arrival and view your digital handover OTP pass.
              </CardDescription>
              <Button onClick={() => setActiveSegment('radar')}>
                <Radio size={14} />
                <span>Go to Inbound Radar</span>
              </Button>
            </Card>
          ) : (
            <div>
              {/* Live Inbound Route Map for Active Claimed Deliveries */}
              <div style={{ marginBottom: '1.25rem' }}>
                <ShelterRadarMap
                  shelterLat={radarLat}
                  shelterLng={radarLng}
                  shelterName={session?.org?.name || session?.user?.full_name || 'My Shelter'}
                  radiusKm={radiusKm}
                  listings={[]}
                  claimedListings={claimedDeliveries}
                  height="320px"
                />
              </div>

              <div style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--muted-foreground)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
              }}>
                Active Claimed Deliveries ({claimedDeliveries.length})
              </div>

              {claimedDeliveries.map((delivery) => {
                const isDelivered = delivery.status === 'DELIVERED';
                const isInTransit = delivery.status === 'IN_TRANSIT';
                const isClaimed = delivery.status === 'CLAIMED';

                return (
                  <div key={delivery.id} className="batch-card" style={{ padding: '1.25rem' }}>
                    <div className="batch-card-header">
                      <div>
                        <div className="batch-title">{delivery.food_type}</div>
                        <div className="batch-meta-row" style={{ marginTop: '0.25rem' }}>
                          <MapPin size={13} />
                          <span>Pickup: <b>{delivery.pickup_address}</b></span>
                        </div>
                      </div>

                      <Badge
                        variant={isDelivered ? 'success' : isInTransit ? 'info' : 'warning'}
                      >
                        {isDelivered && <CheckCircle2 size={11} />}
                        {isInTransit && <Truck size={11} />}
                        {isClaimed && <Clock size={11} />}
                        <span>
                          {isInTransit ? 'In Transit' : isDelivered ? 'Delivered' : 'Awaiting Pickup'}
                        </span>
                      </Badge>
                    </div>

                    {/* Apple Wallet / Shadcn Digital OTP Security Ticket */}
                    <div className="otp-pass-card" style={{ margin: '0.75rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'var(--muted-foreground)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Courier Physical Handover Verification Code
                          </div>
                          <div className="otp-digit-display">
                            {delivery.verification_code || '------'}
                          </div>
                        </div>

                        {delivery.verification_code && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenTokenModal(delivery.verification_code, delivery.id)}
                          >
                            <Maximize2 size={13} />
                            <span>Enlarge Pass</span>
                          </Button>
                        )}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                        Show this 6-digit cryptographic HMAC code to the kitchen staff at pickup to authorize batch release.
                      </div>
                    </div>

                    {/* Status Messages & Actions */}
                    {isClaimed && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        marginTop: '0.5rem',
                        backgroundColor: 'var(--warning-bg)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--warning-border)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8125rem', color: 'var(--warning-foreground)' }}>
                          <Clock size={14} />
                          <span>Awaiting courier dispatch / physical pickup verification.</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCancelModal(delivery)}
                          style={{
                            color: '#dc2626',
                            borderColor: '#fca5a5',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <XCircle size={13} />
                          <span>Cancel Claim</span>
                        </Button>
                      </div>
                    )}

                    {isInTransit && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border-subtle)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          fontSize: '0.8125rem',
                          color: '#60a5fa',
                          fontWeight: 600
                        }}>
                          <Truck size={15} />
                          <span>Courier verified! Food is on the way to your shelter.</span>
                        </div>

                        <Button
                          variant="success"
                          disabled={confirmingId === delivery.id}
                          onClick={() => handleConfirmDelivery(delivery.id)}
                        >
                          <CheckCircle2 size={14} />
                          <span>{confirmingId === delivery.id ? 'Confirming Receipt...' : 'Confirm Delivery Received'}</span>
                        </Button>
                      </div>
                    )}

                    {isDelivered && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.8125rem',
                        color: '#34d399',
                        backgroundColor: 'var(--success-bg)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--success-border)'
                      }}>
                        <CheckCircle2 size={14} />
                        <span>Delivery complete and verified in PostgreSQL audit ledger.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Claim Quantity Selection Modal (Full or Partial Split) */}
      <ClaimQuantityModal
        listing={claimingListing}
        isOpen={Boolean(claimingListing)}
        onClose={() => {
          setClaimingListing(null);
          setClaimError(null);
        }}
        onConfirmClaim={handleConfirmClaim}
        claiming={claimingLoading}
        claimError={claimError}
      />

      {/* Claim Cancellation Modal with Preserved Shelf-Life */}
      <CancelClaimModal
        delivery={cancellingDelivery}
        isOpen={Boolean(cancellingDelivery)}
        onClose={() => {
          setCancellingDelivery(null);
          setCancelError(null);
        }}
        onConfirmCancel={handleConfirmCancel}
        cancelling={cancellingLoading}
        error={cancelError}
      />
    </div>
  );
}
