import React from 'react';
import {
  Zap,
  Utensils,
  PackageCheck,
  Radio,
  Truck,
  MapPin,
  Building2,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function Sidebar({ activeTab, setActiveTab, session, onLogout }) {
  const isDonor = session?.user?.role === 'DONOR';
  const orgName = session?.org?.name || session?.user?.full_name || 'My Organization';
  const roleLabel = isDonor ? 'Food Producer' : 'Food Consumer';

  return (
    <aside className="sidebar">
      <div>
        {/* Brand Header */}
        <div
          className="sidebar-brand"
          onClick={() => setActiveTab(isDonor ? 'donor' : 'shelter')}
          title="RescueGrid Home"
        >
          <div className="brand-icon">
            <Zap size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-text">RescueGrid</div>
          </div>
          <Badge variant="info" className="brand-tag">
            v2.4
          </Badge>
        </div>

        {/* Navigation Section */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-label">
            {isDonor ? 'Kitchen Workflows' : 'Shelter Workflows'}
          </div>

          {/* Producer (Donor) Links */}
          {isDonor && (
            <>
              <button
                type="button"
                className={`sidebar-link ${activeTab === 'donor' || activeTab === 'donor_broadcast' ? 'active' : ''}`}
                onClick={() => setActiveTab('donor')}
              >
                <Utensils size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Broadcast Surplus</span>
                {(activeTab === 'donor' || activeTab === 'donor_broadcast') && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'donor_active' ? 'active' : ''}`}
                onClick={() => setActiveTab('donor_active')}
              >
                <PackageCheck size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Active Batches & OTP</span>
                {activeTab === 'donor_active' && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>
            </>
          )}

          {/* Consumer (Shelter) Links */}
          {!isDonor && (
            <>
              <button
                type="button"
                className={`sidebar-link ${activeTab === 'shelter' || activeTab === 'shelter_radar' ? 'active' : ''}`}
                onClick={() => setActiveTab('shelter')}
              >
                <Radio size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Inbound Food Radar</span>
                {(activeTab === 'shelter' || activeTab === 'shelter_radar') && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'shelter_deliveries' ? 'active' : ''}`}
                onClick={() => setActiveTab('shelter_deliveries')}
              >
                <Truck size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Claimed Deliveries</span>
                {activeTab === 'shelter_deliveries' && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>
            </>
          )}

          <div className="sidebar-nav-label" style={{ marginTop: '0.85rem' }}>
            System & Ledgers
          </div>

          <button
            type="button"
            className={`sidebar-link ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <MapPin size={17} strokeWidth={2} />
            <span style={{ flex: 1 }}>Live Dispatch Map</span>
            {activeTab === 'map' && <ChevronRight size={14} opacity={0.6} />}
          </button>

          <button
            type="button"
            className={`sidebar-link ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <Building2 size={17} strokeWidth={2} />
            <span style={{ flex: 1 }}>Facility Account</span>
            {activeTab === 'account' && <ChevronRight size={14} opacity={0.6} />}
          </button>
        </nav>
      </div>

      {/* Footer Profile & Actions */}
      <div className="sidebar-footer">
        <div className="user-profile-widget">
          <div className="user-avatar">
            {isDonor ? <Utensils size={15} /> : <ShieldCheck size={15} />}
          </div>
          <div className="user-info">
            <div className="user-name" title={orgName}>{orgName}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          title="Sign out of RescueGrid"
          style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--muted-foreground)' }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </Button>
      </div>
    </aside>
  );
}
