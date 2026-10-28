import React from 'react';

export default function Navbar({ activeTab, setActiveTab, session, onLogout }) {
  const isDonor = session?.user?.role === 'DONOR';
  const isShelter = session?.user?.role === 'SHELTER';

  return (
    <nav className="navbar">
      <div className="nav-brand" onClick={() => session ? setActiveTab(isDonor ? 'donor' : 'shelter') : setActiveTab('auth')} style={{ cursor: 'pointer' }}>
        <span>⚡ RescueGrid</span>
        <span className="nav-badge">Cloud Capstone</span>
      </div>

      <div className="nav-tabs">
        {/* If logged in as Producer: ONLY Producer Portal & Map & Account */}
        {isDonor && (
          <button
            className={`nav-tab ${activeTab === 'donor' ? 'active' : ''}`}
            onClick={() => setActiveTab('donor')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🍲</span>
            <span>Producer Portal</span>
          </button>
        )}

        {/* If logged in as Consumer: ONLY Consumer Portal & Map & Account */}
        {isShelter && (
          <button
            className={`nav-tab ${activeTab === 'shelter' ? 'active' : ''}`}
            onClick={() => setActiveTab('shelter')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🏢</span>
            <span>Consumer Portal</span>
          </button>
        )}

        {/* Dispatch Map accessible to authenticated users or visitors */}
        {session && (
          <button
            className={`nav-tab ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>📍</span>
            <span>Live Dispatch Map</span>
          </button>
        )}

        {/* Dedicated Account tab */}
        {session && (
          <button
            className={`nav-tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>👤</span>
            <span>Account</span>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {session ? (
          /* User Profile Pill & Sign Out */
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              onClick={() => setActiveTab('account')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#1e293b',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #334155',
                cursor: 'pointer',
              }}
              title="Click to view Account details"
            >
              <span style={{ fontSize: '0.9rem' }}>{isDonor ? '🍲' : '🏢'}</span>
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#fff' }}>
                  {session.org?.name || session.user?.full_name}
                </div>
                <div style={{ fontSize: '0.65rem', color: isDonor ? '#38bdf8' : '#4ade80', fontWeight: '600' }}>
                  {isDonor ? 'Food Producer' : 'Food Consumer'}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              style={{
                backgroundColor: '#7f1d1d33',
                border: '1px solid #dc2626',
                color: '#f87171',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Log out of RescueGrid"
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          /* Logged out state */
          <button
            onClick={() => setActiveTab('auth')}
            style={{
              backgroundColor: 'var(--primary)',
              border: 'none',
              color: 'var(--primary-foreground)',
              padding: '0.45rem 1.1rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            Sign In / Register
          </button>
        )}

        <div className="cluster-status">
          <span className="status-dot"></span>
          <span>RescueGrid Operational</span>
        </div>
      </div>
    </nav>
  );
}
