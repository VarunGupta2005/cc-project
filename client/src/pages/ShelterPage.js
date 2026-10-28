import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Truck,
  MapPin,
  Clock,
  Sparkles,
  RefreshCw,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Zap,
  PlusCircle,
  Trash2,
  Utensils,
  XCircle,
  Bike,
  Users,
  UserPlus,
  ShieldCheck,
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
  fetchShelterRiders,
  registerShelterRider,
  cancelRiderAssignment,
} from '../services/api';
import { getSocket } from '../services/socket';
import ShelterRadarMap from '../components/ShelterRadarMap';
import ClaimQuantityModal from '../components/ClaimQuantityModal';
import CancelClaimModal from '../components/CancelClaimModal';
import AssignRiderModal from '../components/AssignRiderModal';
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
  // eslint-disable-next-line no-unused-vars
  const reqCategory = reqCategories[0] || 'COOKED_MEAL';
  // eslint-disable-next-line no-unused-vars
  const setReqCategory = (cat) => setReqCategories([cat]);
  const [reqDietary, setReqDietary] = useState('ANY');
  const [reqHours, setReqHours] = useState('6');
  const [postingReq, setPostingReq] = useState(false);
  const [reqMsg, setReqMsg] = useState(null);

  // Fleet Riders State
  const [shelterRiders, setShelterRiders] = useState([]);
  const [assigningDelivery, setAssigningDelivery] = useState(null);
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderEmail, setNewRiderEmail] = useState('');
  const [newRiderPhone, setNewRiderPhone] = useState('');
  const [newRiderPassword, setNewRiderPassword] = useState('password123');
  const [registeringRider, setRegisteringRider] = useState(false);
  const [riderError, setRiderError] = useState(null);
  const [riderSuccess, setRiderSuccess] = useState(null);
  const [cancellingAssignId, setCancellingAssignId] = useState(null);

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
      const [nearbyData, allData, reqData, ridersData] = await Promise.all([
        fetchNearbyListings(lat, lng, radius),
        fetchAllListings(session?.token),
        fetchRecipientRequests(activeShelterId).catch(() => ({ requests: [] })),
        fetchShelterRiders().catch(() => ({ riders: [] })),
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
      setShelterRiders(ridersData.riders || []);
    } catch (err) {
      console.error('[ShelterPage Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterRider = async (e) => {
    e.preventDefault();
    if (!newRiderName || !newRiderEmail) return;
    setRegisteringRider(true);
    setRiderError(null);
    setRiderSuccess(null);
    try {
      await registerShelterRider({
        full_name: newRiderName,
        email: newRiderEmail,
        phone: newRiderPhone,
        password: newRiderPassword || 'password123',
      });
      setRiderSuccess(`Rider ${newRiderName} registered to your fleet!`);
      setNewRiderName('');
      setNewRiderEmail('');
      setNewRiderPhone('');
      const ridersRes = await fetchShelterRiders();
      setShelterRiders(ridersRes.riders || []);
    } catch (err) {
      setRiderError(err.message || 'Failed to register rider');
    } finally {
      setRegisteringRider(false);
    }
  };

  const handleCancelAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to cancel this rider assignment? The food will remain reserved for your shelter.')) return;
    setCancellingAssignId(assignmentId);
    try {
      await cancelRiderAssignment(assignmentId, 'Shelter reassigned rider');
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to cancel assignment');
    } finally {
      setCancellingAssignId(null);
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
              <span>Claimed Deliveries</span>
              {claimedDeliveries.length > 0 && (
                <Badge variant="success" style={{ marginLeft: '0.25rem', fontSize: '0.65rem' }}>
                  {claimedDeliveries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="riders">
              <Bike size={14} />
              <span>Rider Fleet</span>
              {shelterRiders.length > 0 && (
                <Badge variant="outline" style={{ marginLeft: '0.25rem', fontSize: '0.65rem' }}>
                  {shelterRiders.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <Badge variant="secondary" style={{ gap: '0.35rem' }}>
            <Zap size={12} color="var(--primary)" />
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
            <div className="alert-box alert-box--error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span><b>Claim Conflict:</b> {claimError}</span>
            </div>
          )}

          {/* Diagnostic Banner if batches exist outside radius */}
          {availableListings.length === 0 && allAvailableListings.length > 0 && (
            <Card style={{
              backgroundColor: 'var(--secondary)',
              borderColor: 'var(--border)',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--foreground)', fontWeight: 600, fontSize: '0.875rem' }}>
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
                          <Badge variant="success" style={{ fontSize: '0.72rem' }}>
                            ⭐ Priority Match for You ({lockMinsLeft}m window)
                          </Badge>
                        )}
                        {isLocked && (
                          <Badge variant="destructive" style={{ fontSize: '0.72rem' }}>
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
                          backgroundColor: isFeasible ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          borderRadius: 'var(--radius)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.74rem'
                        }}>
                          <span style={{ color: isFeasible ? 'var(--success-text)' : 'var(--destructive-text)', fontWeight: 600 }}>
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
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success-text)' }}>
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
                          <Badge variant="outline" style={{ marginLeft: '0.45rem', color: 'var(--success-text)', borderColor: 'var(--success-border)', fontSize: '0.68rem' }}>
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
                  className={`alert-box ${reqMsg.type === 'success' ? 'alert-box--success' : 'alert-box--error'}`}
                  style={{ marginBottom: '1rem' }}
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

                    {/* Rider Fleet Assignment Box */}
                    {delivery.assignment_id ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          padding: '0.75rem 1rem',
                          backgroundColor: 'rgba(56, 189, 248, 0.06)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          borderRadius: '8px',
                          margin: '0.75rem 0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#38bdf8',
                            }}
                          >
                            <Bike size={16} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f3f4f6' }}>
                              Assigned Rider: {delivery.rider_name || 'Rider Assigned'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                              {delivery.rider_phone ? `Phone: ${delivery.rider_phone} • ` : ''}
                              Status: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{delivery.assignment_status || 'ASSIGNED'}</span>
                            </div>
                          </div>
                        </div>

                        {delivery.status !== 'DELIVERED' && delivery.status !== 'IN_TRANSIT' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAssigningDelivery(delivery)}
                              style={{ fontSize: '0.75rem' }}
                            >
                              Change Rider
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={cancellingAssignId === delivery.assignment_id}
                              onClick={() => handleCancelAssignment(delivery.assignment_id)}
                              style={{ fontSize: '0.75rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            >
                              Cancel Rider
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          padding: '0.75rem 1rem',
                          backgroundColor: 'rgba(234, 179, 8, 0.08)',
                          border: '1px solid rgba(234, 179, 8, 0.25)',
                          borderRadius: '8px',
                          margin: '0.75rem 0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(234, 179, 8, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#eab308',
                            }}
                          >
                            <Bike size={16} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f3f4f6' }}>
                              Rider Not Dispatched Yet
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                              Dispatch an authorized shelter rider to retrieve this parcel.
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => setAssigningDelivery(delivery)}
                          style={{
                            backgroundColor: '#38bdf8',
                            color: '#090a0f',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                          }}
                        >
                          <Bike size={13} style={{ marginRight: '0.35rem' }} />
                          <span>Assign Fleet Rider</span>
                        </Button>
                      </div>
                    )}

                    {/* Digital Custody Security Notice */}
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.775rem',
                        color: '#9ca3af',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <ShieldCheck size={15} color="#38bdf8" />
                      <span>
                        {delivery.assignment_id
                          ? "Authorized single-use OTP pass is active on the assigned rider's mobile terminal. Donor verifies code at physical release."
                          : 'Pickup OTP pass will be generated exclusively for the assigned rider upon dispatch.'}
                      </span>
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
                            color: 'var(--destructive-text)',
                            borderColor: 'var(--destructive-border)',
                            backgroundColor: 'var(--card)',
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
                          color: 'var(--foreground)',
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
                      <div className="alert-box alert-box--success" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', marginBottom: 0 }}>
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

        {/* ========================================================================= */}
        {/* TAB 4: RIDER FLEET DISPATCH & MANAGEMENT                                  */}
        {/* ========================================================================= */}
        <TabsContent value="riders">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Register New Rider Form Card */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={18} color="#38bdf8" />
                  <CardTitle style={{ fontSize: '1.05rem' }}>Register Fleet Rider</CardTitle>
                </div>
                <CardDescription>
                  Invite or register an authorized courier to collect surplus batches for your shelter.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {riderError && (
                  <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#f87171', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertCircle size={14} />
                    <span>{riderError}</span>
                  </div>
                )}
                {riderSuccess && (
                  <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: '#34d399', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={14} />
                    <span>{riderSuccess}</span>
                  </div>
                )}
                <form onSubmit={handleRegisterRider} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.35rem' }}>
                      Rider Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikram Singh"
                      value={newRiderName}
                      onChange={(e) => setNewRiderName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: 'var(--foreground)',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.35rem' }}>
                      Email Address (Login) *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. vikram.rider@hopehaven.org"
                      value={newRiderEmail}
                      onChange={(e) => setNewRiderEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: 'var(--foreground)',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.35rem' }}>
                      Mobile Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={newRiderPhone}
                      onChange={(e) => setNewRiderPhone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: 'var(--foreground)',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.35rem' }}>
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      placeholder="password123"
                      value={newRiderPassword}
                      onChange={(e) => setNewRiderPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: 'var(--foreground)',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={registeringRider || !newRiderName || !newRiderEmail}
                    style={{
                      marginTop: '0.5rem',
                      backgroundColor: '#38bdf8',
                      color: '#090a0f',
                      fontWeight: 600,
                    }}
                  >
                    <UserPlus size={14} style={{ marginRight: '0.4rem' }} />
                    <span>{registeringRider ? 'Registering...' : 'Register Rider to Fleet'}</span>
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Registered Fleet List Card */}
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} color="#38bdf8" />
                    <CardTitle style={{ fontSize: '1.05rem' }}>Shelter Rider Fleet</CardTitle>
                  </div>
                  <Badge variant="outline">{shelterRiders.length} Registered</Badge>
                </div>
                <CardDescription>
                  Riders authorized to receive dispatch missions and digital pickup OTP passes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {shelterRiders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted-foreground)' }}>
                    <Bike size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No riders registered yet.</p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', opacity: 0.7 }}>
                      Use the form on the left to add couriers to your fleet.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {shelterRiders.map((r) => {
                      const activeCount = parseInt(r.active_tasks_count || 0, 10);
                      return (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                                border: '1px solid rgba(56, 189, 248, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#38bdf8',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                              }}
                            >
                              {r.full_name.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                                {r.full_name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                {r.email} {r.phone ? `• ${r.phone}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {r.is_available === false ? (
                              <Badge variant="outline" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.7rem' }}>
                                Off Duty / Unavailable
                              </Badge>
                            ) : activeCount === 0 ? (
                              <Badge variant="outline" style={{ color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)', fontSize: '0.7rem' }}>
                                Available
                              </Badge>
                            ) : (
                              <Badge variant="outline" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)', fontSize: '0.7rem' }}>
                                {activeCount} active task{activeCount > 1 ? 's' : ''}
                              </Badge>
                            )}
                            <Badge variant="secondary" style={{ fontSize: '0.7rem' }}>
                              {r.role}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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

      {/* Rider Assignment Modal */}
      <AssignRiderModal
        delivery={assigningDelivery}
        isOpen={Boolean(assigningDelivery)}
        onClose={() => setAssigningDelivery(null)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
