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
} from 'lucide-react';
import { fetchNearbyListings, claimFoodListing, confirmDelivery, fetchAllListings } from '../services/api';
import { getSocket } from '../services/socket';
import LocationPickerMap from '../components/LocationPickerMap';
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

  // Dynamic Radar Location
  const initialLat = parseFloat(session?.org?.latitude) || 12.9800;
  const initialLng = parseFloat(session?.org?.longitude) || 77.6050;
  const [radarLat, setRadarLat] = useState(initialLat);
  const [radarLng, setRadarLng] = useState(initialLng);
  const [radarAddress, setRadarAddress] = useState(session?.org?.name || 'My Location');
  const [radiusKm, setRadiusKm] = useState(50);
  const [showMap, setShowMap] = useState(true);

  const activeShelterId = session?.org?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const shelterName = session?.org?.name || 'Verified Shelter';

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
      const [nearbyData, allData] = await Promise.all([
        fetchNearbyListings(lat, lng, radius),
        fetchAllListings(),
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
    } catch (err) {
      console.error('[ShelterPage Error]', err);
    } finally {
      setLoading(false);
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
    socket.on('food:expired', refreshData);
    socket.on('delivery:update', refreshData);

    const syncTimer = setInterval(refreshData, 4000);

    return () => {
      clearInterval(syncTimer);
      socket.off('food:new_alert', refreshData);
      socket.off('food:claimed', refreshData);
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

  const handleClaim = async (listingId) => {
    setClaimError(null);
    try {
      const data = await claimFoodListing(listingId, activeShelterId, shelterName);
      if (data.verification_token) {
        onOpenTokenModal(data.verification_token, listingId);
      }
      await loadData();
      setActiveSegment('deliveries');
    } catch (err) {
      setClaimError(err.message);
    }
  };

  const handleConfirmDelivery = async (listingId) => {
    setConfirmingId(listingId);
    try {
      await confirmDelivery(listingId);
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
                    <option value="15">15 km (Neighborhood)</option>
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
                    <span>{showMap ? 'Hide Pin Map' : 'Adjust Pin'}</span>
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

            {/* Embedded Live Map Pin */}
            {showMap && (
              <CardContent style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <LocationPickerMap
                  initialLat={radarLat}
                  initialLng={radarLng}
                  label="Shelter Radar Center (Tap to relocate pin)"
                  onLocationSelect={handleLocationUpdate}
                  height="200px"
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

              {availableListings.map((item) => (
                <div key={item.id} className="batch-card">
                  <div className="batch-card-header">
                    <div>
                      <div className="batch-title">{item.food_type}</div>
                      <div className="batch-meta-row" style={{ marginTop: '0.25rem' }}>
                        <MapPin size={13} />
                        <span>{item.pickup_address}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <Badge variant="outline">
                        {item.distance_km ? `${item.distance_km} km away` : 'Near you'}
                      </Badge>
                      <Badge variant="warning">
                        <Clock size={11} />
                        <span>{formatTtl(item.ttl_remaining_seconds)}</span>
                      </Badge>
                    </div>
                  </div>

                  <div className="batch-card-footer">
                    <div>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {item.quantity_kg} kg
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginLeft: '0.35rem' }}>
                        prepared food available
                      </span>
                    </div>

                    <Button
                      variant="success"
                      onClick={() => handleClaim(item.id)}
                    >
                      <Zap size={14} />
                      <span>Claim Surplus Batch</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: CLAIMED DELIVERIES & HANDOVER OTP                                  */}
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
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.8125rem',
                        color: '#92400e',
                        backgroundColor: '#fffbeb',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #fde68a'
                      }}>
                        <Clock size={14} />
                        <span>Waiting for courier to arrive at donor kitchen and verify OTP.</span>
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
                          color: '#1d4ed8',
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
                        color: '#065f46',
                        backgroundColor: '#ecfdf5',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #a7f3d0'
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
    </div>
  );
}
