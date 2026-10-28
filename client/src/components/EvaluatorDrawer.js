import React, { useState } from 'react';
import {
  Layers,
  Utensils,
  Building2,
  Bike,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Check,
  Sparkles,
} from 'lucide-react';
import { Badge } from './ui/badge';

const DEMO_PERSONAS = [
  {
    role: 'DONOR',
    name: 'Grand Palace Hotel',
    email: 'donor@grandhotel.com',
    password: 'password123',
    title: 'Food Donor',
    badge: 'Donor Portal',
    badgeColor: '#f59e0b',
    description: 'Broadcasts hot surplus trays & verifies pickup OTP at kitchen release.',
    defaultTab: 'donor',
    icon: Utensils,
  },
  {
    role: 'SHELTER',
    name: 'Hope Haven Shelter',
    email: 'director@hopehaven.org',
    password: 'password123',
    title: 'Shelter Manager',
    badge: 'Shelter Portal',
    badgeColor: '#10b981',
    description: 'Monitors inbound radar, claims batches, dispatches couriers, and confirms receipts.',
    defaultTab: 'shelter',
    icon: Building2,
  },
  {
    role: 'RIDER',
    name: 'Vikram Singh',
    email: 'rider@hopehaven.org',
    password: 'password123',
    title: 'Fleet Courier',
    badge: 'Rider Portal',
    badgeColor: '#38bdf8',
    description: 'Receives authorized pickup missions, GPS directions, and single-use pickup pass.',
    defaultTab: 'rider',
    icon: Bike,
  },
  {
    role: 'ADMIN',
    name: 'RescueGrid Admin',
    email: 'admin@rescuegrid.org',
    password: 'password123',
    title: 'Platform Operator',
    badge: 'Admin Tower',
    badgeColor: '#a855f7',
    description: 'Verifies organizations, monitors global dispatch, and reviews zero-secret compliance audit logs.',
    defaultTab: 'admin',
    icon: ShieldCheck,
  },
];

export default function EvaluatorDrawer({ session, onSwitchUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const currentEmail = session?.user?.email;
  const currentRole = session?.user?.role;

  const handleSelect = async (persona) => {
    if (currentEmail === persona.email) return;
    setSwitching(true);
    try {
      if (onSwitchUser) {
        await onSwitchUser(persona.email, persona.password, persona.defaultTab);
      }
    } catch (err) {
      console.error('Failed to switch evaluator persona:', err);
    } finally {
      setSwitching(false);
      setIsOpen(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 99999,
        fontFamily: 'inherit',
      }}
    >
      {/* Expanded Persona Switcher Card */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '3.25rem',
            right: 0,
            width: '360px',
            backgroundColor: '#090a0f',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '14px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 20px rgba(56, 189, 248, 0.15)',
            overflow: 'hidden',
            backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1rem 1.15rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="#38bdf8" />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6' }}>
                  Evaluator Role Dock
                </div>
                <div style={{ fontSize: '0.725rem', color: '#9ca3af' }}>
                  1-Click Role & Portal Switching
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {/* List of Personas */}
          <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {DEMO_PERSONAS.map((p) => {
              const isCurrent = currentEmail === p.email || currentRole === p.role;
              const Icon = p.icon;
              return (
                <div
                  key={p.role}
                  onClick={() => !switching && handleSelect(p)}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: '9px',
                    border: isCurrent
                      ? `1px solid ${p.badgeColor}`
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    backgroundColor: isCurrent
                      ? `${p.badgeColor}15`
                      : 'rgba(255, 255, 255, 0.02)',
                    cursor: isCurrent ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: `${p.badgeColor}20`,
                      border: `1px solid ${p.badgeColor}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: p.badgeColor,
                      flexShrink: 0,
                      marginTop: '0.1rem',
                    }}
                  >
                    <Icon size={16} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f3f4f6' }}>
                        {p.name}
                      </span>
                      {isCurrent ? (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            fontSize: '0.675rem',
                            fontWeight: 700,
                            color: p.badgeColor,
                            textTransform: 'uppercase',
                          }}
                        >
                          <Check size={11} strokeWidth={3} /> Active
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.4rem',
                            color: p.badgeColor,
                            borderColor: `${p.badgeColor}40`,
                          }}
                        >
                          {p.title}
                        </Badge>
                      )}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.725rem',
                        color: '#9ca3af',
                        lineHeight: 1.35,
                      }}
                    >
                      {p.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: '0.5rem 0.85rem',
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '0.675rem',
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            Authentication tokens auto-refresh on persona swap
          </div>
        </div>
      )}

      {/* Floating Pill Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.55rem 0.95rem',
          backgroundColor: '#090a0f',
          color: '#f3f4f6',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '9999px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.2)',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 600,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#38bdf8';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        title="Quick Role Switcher for Demonstrations"
      >
        <Layers size={15} color="#38bdf8" />
        <span>Evaluator Dock</span>
        <span
          style={{
            fontSize: '0.675rem',
            padding: '0.15rem 0.45rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {currentRole || 'DEMO'}
        </span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  );
}
