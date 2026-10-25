import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Copy, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function TokenModal({ token, listingId, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!token) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Badge variant="success" style={{ gap: '0.35rem' }}>
            <Sparkles size={12} />
            <span>Claim Committed</span>
          </Badge>
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

        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>
            Digital Handover Pass
          </h3>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem', marginTop: '0.35rem', lineHeight: '1.4' }}>
            Your distributed reservation lock is verified. Present this 6-digit cryptographic token at physical pickup:
          </p>

          <div className="otp-pass-card" style={{ margin: '1.25rem 0' }}>
            <div style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--muted-foreground)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              HMAC-SHA256 Handover Code
            </div>
            <div className="otp-digit-display">
              {token}
            </div>

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Code'}</span>
              </Button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
            marginBottom: '1.25rem'
          }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Dual-verified against PostgreSQL ledger & Redis Pub/Sub</span>
          </div>

          <Button
            size="lg"
            onClick={onClose}
            style={{ width: '100%' }}
          >
            Done &bull; Return to Deliveries
          </Button>
        </div>
      </div>
    </div>
  );
}
