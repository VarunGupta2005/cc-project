import React, { useState, useEffect } from 'react';
import {
  X,
  Bike,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { fetchShelterRiders, assignRiderToAllocation } from '../services/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function AssignRiderModal({
  isOpen,
  onClose,
  delivery,
  onSuccess,
}) {
  const [riders, setRiders] = useState([]);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setLoading(true);
      fetchShelterRiders()
        .then((res) => {
          const list = res.riders || [];
          setRiders(list);
          const availableList = list.filter((r) => r.is_available !== false);
          if (availableList.length > 0 && !selectedRiderId) {
            setSelectedRiderId(availableList[0].id);
          }
        })
        .catch((err) => {
          setError(err.message || 'Failed to load organization riders');
        })
        .finally(() => {
          setLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !delivery) return null;

  const allocationId = delivery.allocation_id || delivery.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allocationId) {
      setError('Missing allocation reference for this delivery.');
      return;
    }
    if (!selectedRiderId) {
      setError('Please select an active rider to dispatch.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await assignRiderToAllocation(allocationId, selectedRiderId, notes);
      setSuccessMsg('Rider assigned successfully! Single-use pickup pass dispatched to rider portal.');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to assign rider');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#090a0f',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '520px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Bike size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f3f4f6' }}>
                Assign Rider to Delivery
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>
                Dispatch authorized shelter rider with custody pass
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Summary Box */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e5e7eb' }}>
                {delivery.food_type}
              </span>
              <Badge variant="outline" style={{ fontSize: '0.75rem' }}>
                {delivery.allocated_kg || delivery.quantity_kg} kg
              </Badge>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              Pickup: <span style={{ color: '#d1d5db' }}>{delivery.pickup_address}</span>
            </div>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.825rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '0.825rem',
                marginBottom: '1.25rem',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Rider Selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#d1d5db',
                  marginBottom: '0.5rem',
                }}
              >
                Select Fleet Rider
              </label>

              {loading ? (
                <div style={{ fontSize: '0.85rem', color: '#9ca3af', padding: '0.5rem 0' }}>
                  Loading shelter riders...
                </div>
              ) : riders.length === 0 ? (
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>
                    No registered riders found for your shelter.
                  </p>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                    Please add a rider in the "Rider Fleet" tab before assigning.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {riders.map((r) => {
                    const isSelected = selectedRiderId === r.id;
                    const activeCount = parseInt(r.active_tasks_count || 0, 10);
                    const isRiderAvailable = r.is_available !== false;
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          if (isRiderAvailable) {
                            setSelectedRiderId(r.id);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          opacity: isRiderAvailable ? 1 : 0.6,
                          border: isSelected
                            ? '1px solid #38bdf8'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          backgroundColor: isSelected
                            ? 'rgba(56, 189, 248, 0.08)'
                            : 'rgba(255, 255, 255, 0.02)',
                          cursor: isRiderAvailable ? 'pointer' : 'not-allowed',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: isSelected
                                ? 'rgba(56, 189, 248, 0.2)'
                                : 'rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? '#38bdf8' : '#9ca3af',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                            }}
                          >
                            {r.full_name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f3f4f6' }}>
                              {r.full_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                              {r.phone || r.email}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {!isRiderAvailable ? (
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
                          <input
                            type="radio"
                            name="selected_rider"
                            checked={isSelected}
                            disabled={!isRiderAvailable}
                            onChange={() => {
                              if (isRiderAvailable) setSelectedRiderId(r.id);
                            }}
                            style={{ accentColor: '#38bdf8', cursor: isRiderAvailable ? 'pointer' : 'not-allowed' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Special Instructions / Notes */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#d1d5db',
                  marginBottom: '0.5rem',
                }}
              >
                Handling Instructions / Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Bring insulated hot box; call shelter intake manager upon arrival."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#f3f4f6',
                  fontSize: '0.85rem',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || riders.length === 0 || !selectedRiderId}
                style={{
                  backgroundColor: '#38bdf8',
                  color: '#090a0f',
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
