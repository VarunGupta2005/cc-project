import React, { useState, useEffect } from 'react';
import { Utensils, Building2, Activity } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import DonorPage from './pages/DonorPage';
import ShelterPage from './pages/ShelterPage';
import MasterMapPage from './pages/MasterMapPage';
import AccountPage from './pages/AccountPage';
import TokenModal from './components/TokenModal';
import { Badge } from './components/ui/badge';
import { getStoredSession, clearSession, loginUser, saveSession } from './services/api';

function getHeaderInfo(tab, session) {
  const isDonor = session?.user?.role === 'DONOR';
  switch (tab) {
    case 'donor':
    case 'donor_broadcast':
      return { title: 'Broadcast Surplus Food', subtitle: 'List prepared surplus meals and notify nearby shelters' };
    case 'donor_active':
      return { title: 'Active Donations & Handover Gate', subtitle: 'Verify driver OTP codes and track active deliveries' };
    case 'shelter':
    case 'shelter_radar':
      return { title: 'Inbound Food Surplus Radar', subtitle: 'Real-time Redis proximity radar for local hunger shelters' };
    case 'shelter_deliveries':
      return { title: 'Claimed Deliveries & Verification', subtitle: 'Track courier arrival and verify digital handover tokens' };
    case 'map':
      return { title: 'City-Wide Live Dispatch Map', subtitle: 'Real-time Redis geospatial pins & PostgreSQL audit ledger' };
    case 'account':
      return { title: 'Facility Account & Profile', subtitle: 'Manage organization details, GPS location, and cloud credentials' };
    default:
      return {
        title: isDonor ? 'Kitchen Surplus Portal' : 'Shelter Claiming Portal',
        subtitle: 'RescueGrid Zero-Waste Redistribution Network',
      };
  }
}

export default function App() {
  const [session, setSession] = useState(getStoredSession);
  const [activeTab, setActiveTab] = useState(() => {
    const saved = getStoredSession();
    if (!saved) return 'auth';
    return saved.user.role === 'DONOR' ? 'donor' : 'shelter';
  });

  const [tokenModalData, setTokenModalData] = useState(null);

  // Clean up legacy query params
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLoginSuccess = (user, organization) => {
    const newSession = getStoredSession();
    setSession(newSession);
    setActiveTab(user.role === 'DONOR' ? 'donor' : 'shelter');
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setActiveTab('auth');
  };

  const handleSwitchRole = async (targetRole) => {
    try {
      const email = targetRole === 'DONOR' ? 'donor@grandhotel.com' : 'director@hopehaven.org';
      const data = await loginUser(email, 'password123');
      saveSession(data.token, data.user, data.organization);
      const newSession = getStoredSession();
      setSession(newSession);
      setActiveTab(targetRole === 'DONOR' ? 'donor' : 'shelter');
    } catch (err) {
      console.error('Role switch failed:', err);
      handleLogout();
    }
  };

  const handleOpenTokenModal = (token, listingId) => {
    setTokenModalData({ token, listingId });
  };

  const header = getHeaderInfo(activeTab, session);

  if (!session || activeTab === 'auth') {
    return (
      <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh', padding: '2rem 1rem' }}>
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sleek Vertical Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        onLogout={handleLogout}
      />

      {/* Main Workspace Area */}
      <div className="main-wrapper">
        <header className="top-bar">
          <div>
            <h1 className="top-bar-title">{header.title}</h1>
            <p className="top-bar-subtitle">{header.subtitle}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Badge variant="success" style={{ gap: '0.35rem', padding: '0.25rem 0.65rem' }}>
              <Activity size={12} strokeWidth={2.5} />
              <span>3x Replicas Active</span>
            </Badge>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.8125rem',
              color: 'var(--muted-foreground)',
              backgroundColor: 'var(--card)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              {session?.user?.role === 'DONOR' ? (
                <Utensils size={14} color="#2563eb" />
              ) : (
                <Building2 size={14} color="#2563eb" />
              )}
              <span style={{ fontWeight: '600', color: 'var(--foreground)' }}>
                {session?.org?.name || session?.user?.full_name}
              </span>
            </div>
          </div>
        </header>

        <main className="content-area">
          {/* Producer (Donor) Views */}
          {session?.user?.role === 'DONOR' && (
            <>
              {(activeTab === 'donor' || activeTab === 'donor_broadcast') && (
                <DonorPage session={session} initialSegment="broadcast" />
              )}
              {activeTab === 'donor_active' && (
                <DonorPage session={session} initialSegment="active" />
              )}
            </>
          )}

          {/* Consumer (Shelter) Views */}
          {session?.user?.role === 'SHELTER' && (
            <>
              {(activeTab === 'shelter' || activeTab === 'shelter_radar') && (
                <ShelterPage
                  session={session}
                  initialSegment="radar"
                  onOpenTokenModal={handleOpenTokenModal}
                />
              )}
              {activeTab === 'shelter_deliveries' && (
                <ShelterPage
                  session={session}
                  initialSegment="deliveries"
                  onOpenTokenModal={handleOpenTokenModal}
                />
              )}
            </>
          )}

          {/* Map and Account Views */}
          {activeTab === 'map' && <MasterMapPage />}
          {activeTab === 'account' && (
            <AccountPage
              session={session}
              onLogout={handleLogout}
              onSwitchRole={handleSwitchRole}
            />
          )}
        </main>
      </div>

      <TokenModal
        token={tokenModalData?.token}
        listingId={tokenModalData?.listingId}
        onClose={() => setTokenModalData(null)}
      />
    </div>
  );
}
