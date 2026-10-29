import React, { useState, useEffect } from 'react';
import { Utensils, Building2, Bike, ShieldCheck, Sun, Moon } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import DonorPage from './pages/DonorPage';
import ShelterPage from './pages/ShelterPage';
import RiderPage from './pages/RiderPage';
import AdminPage from './pages/AdminPage';
import MasterMapPage from './pages/MasterMapPage';
import AccountPage from './pages/AccountPage';
import TokenModal from './components/TokenModal';
import { Button } from './components/ui/button';
import { getStoredSession, clearSession, saveSession, getProfile } from './services/api';

function getHeaderInfo(tab, session) {
  const role = session?.user?.role || 'DONOR';
  switch (tab) {
    case 'donor':
    case 'donor_broadcast':
      return { title: 'Broadcast Surplus Food', subtitle: 'List prepared surplus meals and notify nearby shelters' };
    case 'donor_active':
      return { title: 'Active Donations & Handover Gate', subtitle: 'Verify driver OTP codes and track physical custody release' };
    case 'donor_history':
      return { title: 'Donation History & Verified Log', subtitle: 'Verified redistribution and completed food surplus logs' };
    case 'shelter':
    case 'shelter_radar':
      return { title: 'Inbound Food Surplus Radar', subtitle: 'Real-time proximity radar for local hunger shelters' };
    case 'shelter_demand':
      return { title: 'Active Food Demand Registration', subtitle: 'Publish verifiable organizational needs to direct donor redistribution' };
    case 'shelter_deliveries':
      return { title: 'Active Deliveries & Fleet Dispatch', subtitle: 'Assign organization riders and confirm physical receipt' };
    case 'shelter_history':
      return { title: 'Delivery History & Verified Log', subtitle: 'Chronological record of completed surplus deliveries received at your facility' };
    case 'shelter_riders':
      return { title: 'Shelter Courier Fleet Management', subtitle: 'Register and manage authorized couriers for your facility' };
    case 'rider':
      return { title: 'Rider Task Portal', subtitle: 'Live dispatch missions, GPS navigation, and digital OTP custody pass' };
    case 'admin':
    case 'admin_overview':
      return { title: 'Platform Control Tower', subtitle: 'Redistribution throughput, system health, and logistics metrics' };
    case 'admin_orgs':
      return { title: 'Organization Verification Queue', subtitle: 'Inspect and approve food donor facilities and hunger shelters' };
    case 'admin_map':
    case 'map':
      return { title: 'City-Wide Live Dispatch Map', subtitle: 'Live map of active surplus food pickups and community deliveries' };
    case 'admin_audits':
      return { title: 'Compliance & Custody Ledger', subtitle: 'Cryptographically hashed zero-secret verification audit trail' };
    case 'account':
      return {
        title: role === 'RIDER' ? 'Rider Profile' : role === 'ADMIN' ? 'Platform Operator Profile' : 'Facility Account & Profile',
        subtitle: 'Manage organization details, address, and profile settings',
      };
    default:
      return {
        title: role === 'DONOR' ? 'Kitchen Surplus Portal' : role === 'SHELTER' ? 'Shelter Claiming Portal' : role === 'RIDER' ? 'Rider Delivery Terminal' : 'Platform Operations Tower',
        subtitle: 'RescueGrid Zero-Waste Redistribution Network',
      };
  }
}

export default function App() {
  const [session, setSession] = useState(getStoredSession);
  const [activeTab, setActiveTab] = useState(() => {
    const saved = getStoredSession();
    if (!saved) return 'auth';
    const r = saved.user?.role;
    if (r === 'DONOR') return 'donor';
    if (r === 'SHELTER') return 'shelter_radar';
    if (r === 'RIDER' || r === 'COURIER') return 'rider';
    if (r === 'ADMIN') return 'admin_overview';
    return 'donor';
  });

  const [tokenModalData, setTokenModalData] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rg_theme') || 'dark';
  });

  // Apply dark class to <html> element and persist user preference
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('rg_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Clean up legacy query params
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Synchronize session across multi-tab activities
  useEffect(() => {
    const handleStorageChange = () => {
      const current = getStoredSession();
      setSession(current);
      if (!current) {
        setActiveTab('auth');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Periodically refresh profile verification status from API to keep UI updated in real-time
  useEffect(() => {
    if (!session?.token) return;
    let isMounted = true;
    const fetchLatestProfile = async () => {
      try {
        const data = await getProfile(session.token);
        if (data && data.user && isMounted) {
          saveSession(session.token, data.user, data.organization);
          setSession((prev) => ({
            ...prev,
            user: data.user,
            org: data.organization,
          }));
        }
      } catch (e) {
        // Silent catch if network blip
      }
    };

    fetchLatestProfile();
    const interval = setInterval(fetchLatestProfile, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [session?.token]);

  const handleLoginSuccess = (user) => {
    const newSession = getStoredSession();
    setSession(newSession);
    const r = user?.role;
    if (r === 'DONOR') setActiveTab('donor');
    else if (r === 'SHELTER') setActiveTab('shelter_radar');
    else if (r === 'RIDER' || r === 'COURIER') setActiveTab('rider');
    else if (r === 'ADMIN') setActiveTab('admin_overview');
    else setActiveTab('donor');
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setActiveTab('auth');
  };

  const handleOpenTokenModal = (token, listingId) => {
    setTokenModalData({ token, listingId });
  };

  const handleTabChange = (newTab) => {
    // Re-sync session state with latest localStorage in case profile/coordinates updated
    const fresh = getStoredSession();
    if (fresh) {
      setSession(fresh);
    }
    setActiveTab(newTab);
  };

  const header = getHeaderInfo(activeTab, session);
  const role = session?.user?.role;

  if (!session || activeTab === 'auth') {
    return (
      <div style={{ backgroundColor: 'var(--background)', minHeight: '100vh', padding: '2rem 1rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', zIndex: 100 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            style={{
              gap: '0.45rem',
              cursor: 'pointer',
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              boxShadow: 'var(--shadow-sm)',
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={15} style={{ color: '#f59e0b' }} />
                <span style={{ fontWeight: 600 }}>Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={15} style={{ color: '#6366f1' }} />
                <span style={{ fontWeight: 600 }}>Dark Mode</span>
              </>
            )}
          </Button>
        </div>
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sleek Vertical Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
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
            {/* Theme Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              style={{
                gap: '0.45rem',
                cursor: 'pointer',
                padding: '0.35rem 0.75rem',
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                boxShadow: 'var(--shadow-xs)',
              }}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={14} style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon size={14} style={{ color: '#6366f1' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Dark Mode</span>
                </>
              )}
            </Button>

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
              {role === 'DONOR' ? (
                <Utensils size={14} color="#f59e0b" />
              ) : role === 'SHELTER' ? (
                <Building2 size={14} color="#10b981" />
              ) : role === 'RIDER' ? (
                <Bike size={14} color="#38bdf8" />
              ) : (
                <ShieldCheck size={14} color="#a855f7" />
              )}
              <span style={{ fontWeight: '600', color: 'var(--foreground)' }}>
                {role === 'RIDER'
                  ? (session?.user?.full_name || 'Fleet Courier')
                  : (session?.org?.name || session?.user?.full_name || 'RescueGrid Facility')}
              </span>
            </div>
          </div>
        </header>

        <main className="content-area">
          {/* 1. Producer (Donor) Views */}
          {role === 'DONOR' && activeTab !== 'account' && (
            <DonorPage
              session={session}
              initialSegment={
                activeTab === 'donor_active'
                  ? 'active'
                  : activeTab === 'donor_history'
                  ? 'history'
                  : 'broadcast'
              }
              onSegmentChange={(seg) => {
                if (seg === 'broadcast') setActiveTab('donor');
                else if (seg === 'active') setActiveTab('donor_active');
                else if (seg === 'history') setActiveTab('donor_history');
              }}
            />
          )}

          {/* 2. Consumer (Shelter) Views */}
          {role === 'SHELTER' && activeTab !== 'account' && (
            <ShelterPage
              session={session}
              initialSegment={
                activeTab === 'shelter_demand'
                  ? 'demand'
                  : activeTab === 'shelter_deliveries'
                  ? 'deliveries'
                  : activeTab === 'shelter_history'
                  ? 'history'
                  : activeTab === 'shelter_riders'
                  ? 'riders'
                  : 'radar'
              }
              onOpenTokenModal={handleOpenTokenModal}
              onSegmentChange={(seg) => {
                if (seg === 'radar') setActiveTab('shelter_radar');
                else if (seg === 'demand') setActiveTab('shelter_demand');
                else if (seg === 'deliveries') setActiveTab('shelter_deliveries');
                else if (seg === 'history') setActiveTab('shelter_history');
                else if (seg === 'riders') setActiveTab('shelter_riders');
              }}
            />
          )}

          {/* 3. Rider Views */}
          {(role === 'RIDER' || role === 'COURIER') && activeTab !== 'account' && (
            <RiderPage session={session} />
          )}

          {/* 4. Platform Admin Views */}
          {role === 'ADMIN' && activeTab !== 'account' && (
            <AdminPage
              session={session}
              initialTab={activeTab}
              onTabChange={(newTab) => setActiveTab(newTab)}
            />
          )}

          {/* Common Map & Account Views */}
          {activeTab === 'map' && <MasterMapPage />}
          {activeTab === 'account' && (
            <AccountPage
              session={session}
              onLogout={handleLogout}
              onUpdateSession={(updatedSession) => setSession(updatedSession)}
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
