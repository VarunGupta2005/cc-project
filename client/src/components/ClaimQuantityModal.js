import React, { useState, useEffect } from 'react';
import { Zap, X, AlertCircle, PieChart } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function ClaimQuantityModal({
  listing,
  isOpen,
  onClose,
  onConfirmClaim,
  claiming = false,
  claimError = null,
}) {
  const maxAvailable = listing
    ? parseFloat(listing.quantity_remaining !== undefined ? listing.quantity_remaining : listing.quantity_kg)
    : 0;

  const [claimType, setClaimType] = useState('FULL'); // 'FULL' or 'PARTIAL'
  const [partialKg, setPartialKg] = useState('');

  useEffect(() => {
    if (listing) {
      setClaimType('FULL');
      setPartialKg(maxAvailable.toString());
    }
  }, [listing, maxAvailable]);

  if (!isOpen || !listing) return null;

  const effectiveClaimKg = claimType === 'FULL' ? maxAvailable : (parseFloat(partialKg) || 0);
  const remainingAfterClaim = Math.max(0, maxAvailable - effectiveClaimKg);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (claimType === 'FULL') {
      onConfirmClaim(maxAvailable);
    } else {
      const val = parseFloat(partialKg);
      if (isNaN(val) || val <= 0 || val > maxAvailable) return;
      onConfirmClaim(val);
    }
  };

  const handlePercentageSelect = (pct) => {
    setClaimType('PARTIAL');
    const val = Math.round((maxAvailable * pct) * 10) / 10;
    setPartialKg(val.toString());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <Badge variant="info" style={{ gap: '0.35rem', marginBottom: '0.35rem' }}>
              <Zap size={12} />
              <span>Surplus Batch Allocation</span>
            </Badge>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {listing.food_type}
            </h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
              📍 {listing.pickup_address || 'Donor Location'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              padding: '0.25rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Error notification if priority locked or conflict */}
        {claimError && (
          <div className="alert-box alert-box--error" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
            <AlertCircle size={16} />
            <span>{claimError}</span>
          </div>
        )}

        {/* Batch Capacity Overview Card */}
        <div style={{
          backgroundColor: 'var(--secondary)',
          borderRadius: 'var(--radius)',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted-foreground)', fontWeight: 700 }}>
              Currently Available
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success-text)' }}>
              {maxAvailable} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>kg</span>
            </div>
          </div>
          {listing.quantity_remaining !== undefined && listing.quantity_remaining < listing.quantity_kg && (
            <Badge variant="outline" style={{ color: 'var(--success-text)', borderColor: 'var(--success-border)' }}>
              Previously Split Batch
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Claim Mode Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div
              onClick={() => setClaimType('FULL')}
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: `2px solid ${claimType === 'FULL' ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: claimType === 'FULL' ? 'var(--accent)' : 'var(--card)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Claim Entire Batch
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Take all {maxAvailable} kg
              </div>
            </div>

            <div
              onClick={() => {
                setClaimType('PARTIAL');
                if (!partialKg || parseFloat(partialKg) >= maxAvailable) {
                  setPartialKg(Math.round(maxAvailable / 2).toString());
                }
              }}
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: `2px solid ${claimType === 'PARTIAL' ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: claimType === 'PARTIAL' ? 'var(--accent)' : 'var(--card)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Claim Partial Portion
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Split based on immediate headcount needs
              </div>
            </div>
          </div>

          {/* Partial Input Slider & Number */}
          {claimType === 'PARTIAL' && (
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1rem',
              marginBottom: '1.25rem',
              backgroundColor: 'var(--card)',
            }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--foreground)' }}>
                Custom Portioned Amount (kg):
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <input
                  type="number"
                  step="any"
                  min="0.5"
                  max={maxAvailable}
                  value={partialKg}
                  onChange={(e) => setPartialKg(e.target.value)}
                  required
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: '1rem',
                    fontWeight: 700,
                  }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  of {maxAvailable} kg
                </span>
              </div>

              {/* Percentage Quick Chips */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {[0.25, 0.5, 0.75].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handlePercentageSelect(pct)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--secondary)',
                      color: 'var(--foreground)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {pct * 100}% ({Math.round(maxAvailable * pct)} kg)
                  </button>
                ))}
              </div>

              {/* Split Outcome Summary */}
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--muted-foreground)',
                backgroundColor: 'var(--secondary)',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginTop: '0.5rem',
              }}>
                <PieChart size={13} />
                <span>
                  You will receive <b>{effectiveClaimKg} kg</b>. The remaining <b>{remainingAfterClaim} kg</b> stays active on the radar map for other shelters.
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={claiming}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={claiming || effectiveClaimKg <= 0 || effectiveClaimKg > maxAvailable}
              style={{ minWidth: '160px' }}
            >
              {claiming ? 'Acquiring Lock...' : `Lock Claim (${effectiveClaimKg} kg)`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
