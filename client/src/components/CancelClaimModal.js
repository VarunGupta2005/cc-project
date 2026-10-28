import React from 'react';
import { AlertTriangle, Clock, X, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function CancelClaimModal({
  delivery,
  isOpen,
  onClose,
  onConfirmCancel,
  cancelling = false,
  error = null,
}) {
  if (!isOpen || !delivery) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <Badge variant="destructive" style={{ gap: '0.35rem', marginBottom: '0.35rem' }}>
              <AlertTriangle size={12} />
              <span>Cancel Claim & Release Surplus</span>
            </Badge>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>
              Release {delivery.food_type}?
            </h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
              📍 {delivery.pickup_address || 'Donor Location'}
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

        {error && (
          <div className="alert-box alert-box--error" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Biological Timer Preservation Notice */}
        <div style={{
          backgroundColor: 'var(--secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: 'var(--foreground)',
          lineHeight: '1.45',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.35rem' }}>
            <Clock size={15} />
            <span>Biological Countdown Preservation</span>
          </div>
          <div>
            Releasing this batch will immediately <b>re-broadcast the surplus on the live radar map</b> for other community shelters. The timer will <b>continue from its current biological countdown</b> without resetting the clock.
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>
          *Note: If less than 15 minutes remains on the biological shelf-life clock, the batch will automatically transition to EXPIRED to protect beneficiaries from food safety hazards.
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={cancelling}>
            Keep Delivery Claim
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirmCancel}
            disabled={cancelling}
            style={{ minWidth: '150px' }}
          >
            {cancelling ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <RefreshCw size={13} className="spin" />
                <span>Cancelling...</span>
              </span>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
