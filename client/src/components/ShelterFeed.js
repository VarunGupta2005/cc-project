import React, { useState, useEffect } from 'react';
import { fetchNearbyListings, claimFoodListing } from '../services/api';
import { getSocket } from '../services/socket';

export default function ShelterFeed({ onClaimSuccess }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimError, setClaimError] = useState(null);
  const [activeShelterId] = useState('33333333-3333-3333-3333-333333333333'); // Hope Haven Shelter ID

  const loadListings = async () => {
    try {
      const data = await fetchNearbyListings(12.9800, 77.6050, 15);
      setListings(data.listings || []);
    } catch (err) {
      console.error('[Error fetching listings]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();

    const socket = getSocket();

    // 1. New food alert broadcast
    socket.on('food:new_alert', (data) => {
      console.log('[WebSocket Alert] New food batch available!', data);
      loadListings();
    });

    // 2. Food claimed by any shelter -> remove or update
    socket.on('food:claimed', (data) => {
      console.log('[WebSocket Alert] Food batch claimed:', data);
      setListings((prev) => prev.filter((item) => item.id !== data.listingId));
    });

    // 3. TTL Expired hook -> remove from feed immediately
    socket.on('food:expired', (data) => {
      console.log('[WebSocket Alert] Food batch expired:', data);
      setListings((prev) => prev.filter((item) => item.id !== data.listingId));
    });

    return () => {
      socket.off('food:new_alert');
      socket.off('food:claimed');
      socket.off('food:expired');
    };
  }, []);

  // Countdown timer tick for active cards
  useEffect(() => {
    const timer = setInterval(() => {
      setListings((prev) =>
        prev
          .map((item) => {
            const currentTtl = parseInt(item.ttl_remaining_seconds || 0);
            return {
              ...item,
              ttl_remaining_seconds: Math.max(0, currentTtl - 1),
            };
          })
          .filter((item) => item.ttl_remaining_seconds > 0)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleClaim = async (listingId) => {
    setClaimError(null);
    try {
      const data = await claimFoodListing(listingId, activeShelterId);
      // Remove from active list
      setListings((prev) => prev.filter((item) => item.id !== listingId));
      if (onClaimSuccess) {
        onClaimSuccess(data.handover?.verification_code, listingId);
      }
    } catch (err) {
      setClaimError(err.message);
    }
  };

  const formatTtl = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="card-title">🏢 Verified Shelter Live Claim Feed</h2>
          <p className="card-subtitle">
            Sub-millisecond Redis radial search. 1-Click atomic claim with race-condition prevention.
          </p>
        </div>
        <button
          onClick={loadListings}
          style={{ background: '#1e293b', border: '1px solid #374151', color: '#9ca3af', padding: '0.4rem 0.8rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem' }}
        >
          🔄 Refresh
        </button>
      </div>

      {claimError && (
        <div style={{ backgroundColor: '#7f1d1d22', border: '1px solid #dc2626', padding: '0.75rem', borderRadius: '0.375rem', color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>
          <b>Race Condition Prevented:</b> {claimError}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Searching Redis geospatial index...</p>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🍽️</p>
          <p style={{ fontWeight: '500' }}>No surplus food currently available within 15 km.</p>
          <p style={{ fontSize: '0.8rem' }}>Post a donation on the Donor tab to see it appear here in real time!</p>
        </div>
      ) : (
        <div>
          {listings.map((item) => (
            <div key={item.id} className="batch-card">
              <div className="batch-header">
                <div>
                  <h3 className="batch-title">{item.food_type}</h3>
                  <p className="batch-meta">📍 {item.pickup_address}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge-distance">
                    {item.distance_km ? `${item.distance_km} km` : 'Near you'}
                  </span>
                  <span className="badge-ttl">
                    ⏱️ {formatTtl(item.ttl_remaining_seconds)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: '600' }}>
                  ⚖️ {item.quantity_kg} kg Surplus
                </span>
                <button
                  className="btn btn-claim"
                  style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                  onClick={() => handleClaim(item.id)}
                >
                  ⚡ Claim Surplus Batch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
