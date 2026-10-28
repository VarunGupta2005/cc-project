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
  Bike,
  Activity,
  FileText,
  UserCheck,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function Sidebar({ activeTab, setActiveTab, session, onLogout }) {
  const role = session?.user?.role || 'DONOR';
  const orgName = session?.org?.name || session?.user?.full_name || 'RescueGrid Node';

  const getRoleBadge = () => {
    switch (role) {
      case 'DONOR':
        return { label: 'Food Producer', variant: 'warning' };
      case 'SHELTER':
        return { label: 'Hunger Shelter', variant: 'success' };
      case 'RIDER':
        return { label: 'Fleet Courier', variant: 'info' };
      case 'ADMIN':
        return { label: 'Platform Operator', variant: 'secondary' };
      default:
        return { label: 'Authorized Node', variant: 'outline' };
    }
  };

  const roleMeta = getRoleBadge();

  return (
    <aside className="sidebar">
      <div>
        {/* Brand Header */}
        <div
          className="sidebar-brand"
          onClick={() => {
            if (role === 'DONOR') setActiveTab('donor');
            else if (role === 'SHELTER') setActiveTab('shelter');
            else if (role === 'RIDER') setActiveTab('rider');
            else if (role === 'ADMIN') setActiveTab('admin');
          }}
          title="RescueGrid Dashboard"
          style={{ cursor: 'pointer' }}
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
          {/* ======================================================== */}
          {/* 1. DONOR PORTAL NAVIGATION                               */}
          {/* ======================================================== */}
          {role === 'DONOR' && (
            <>
              <div className="sidebar-nav-label">Kitchen Workflows</div>

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

          {/* ======================================================== */}
          {/* 2. SHELTER PORTAL NAVIGATION                             */}
          {/* ======================================================== */}
          {role === 'SHELTER' && (
            <>
              <div className="sidebar-nav-label">Shelter Logistics</div>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'shelter' || activeTab === 'shelter_radar' ? 'active' : ''}`}
                onClick={() => setActiveTab('shelter_radar')}
              >
                <Radio size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Inbound Food Radar</span>
                {(activeTab === 'shelter' || activeTab === 'shelter_radar') && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'shelter_demand' ? 'active' : ''}`}
                onClick={() => setActiveTab('shelter_demand')}
              >
                <Utensils size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Active Food Demand</span>
                {activeTab === 'shelter_demand' && (
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

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'shelter_riders' ? 'active' : ''}`}
                onClick={() => setActiveTab('shelter_riders')}
              >
                <Bike size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Rider Fleet</span>
                {activeTab === 'shelter_riders' && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>
            </>
          )}

          {/* ======================================================== */}
          {/* 3. RIDER PORTAL NAVIGATION                               */}
          {/* ======================================================== */}
          {(role === 'RIDER' || role === 'COURIER') && (
            <>
              <div className="sidebar-nav-label">Courier Missions</div>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'rider' ? 'active' : ''}`}
                onClick={() => setActiveTab('rider')}
              >
                <Bike size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>My Active Tasks</span>
                {activeTab === 'rider' && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>
            </>
          )}

          {/* ======================================================== */}
          {/* 4. PLATFORM ADMIN TOWER NAVIGATION                       */}
          {/* ======================================================== */}
          {role === 'ADMIN' && (
            <>
              <div className="sidebar-nav-label">Platform Operations</div>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'admin' || activeTab === 'admin_overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin_overview')}
              >
                <Activity size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Cluster Overview</span>
                {(activeTab === 'admin' || activeTab === 'admin_overview') && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'admin_orgs' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin_orgs')}
              >
                <UserCheck size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Organization Queue</span>
                {activeTab === 'admin_orgs' && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'admin_map' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin_map')}
              >
                <MapPin size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Global Dispatch Map</span>
                {activeTab === 'admin_map' && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>

              <button
                type="button"
                className={`sidebar-link ${activeTab === 'admin_audits' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin_audits')}
              >
                <FileText size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>Compliance Audits</span>
                {activeTab === 'admin_audits' && (
                  <ChevronRight size={14} opacity={0.6} />
                )}
              </button>
            </>
          )}

          {/* ======================================================== */}
          {/* COMMON: FACILITY ACCOUNT & PROFILE                       */}
          {/* ======================================================== */}
          <div className="sidebar-nav-label" style={{ marginTop: '1rem' }}>
            Settings & Node
          </div>

          <button
            type="button"
            className={`sidebar-link ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <Building2 size={17} strokeWidth={2} />
            <span style={{ flex: 1 }}>
              {role === 'RIDER' ? 'Rider Profile' : role === 'ADMIN' ? 'Admin Node' : 'Facility Account'}
            </span>
            {activeTab === 'account' && <ChevronRight size={14} opacity={0.6} />}
          </button>
        </nav>
      </div>

      {/* Footer Profile & Actions */}
      <div className="sidebar-footer">
        <div className="user-profile-widget">
          <div className="user-avatar">
            {role === 'DONOR' ? (
              <Utensils size={15} />
            ) : role === 'SHELTER' ? (
              <ShieldCheck size={15} />
            ) : role === 'RIDER' ? (
              <Bike size={15} />
            ) : (
              <ShieldCheck size={15} />
            )}
          </div>
          <div className="user-info">
            <div className="user-name" title={orgName}>{orgName}</div>
            <div className="user-role">{roleMeta.label}</div>
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
