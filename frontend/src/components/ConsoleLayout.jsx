import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Monitor, Activity, BarChart2, Cpu, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || "";

export default function ConsoleLayout({ user, onLogout, activeTab, onTabChange, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [whitelabel, setWhitelabel] = useState({
    clientName: 'Swarm Agentic Lab',
    logo: '/favicon.svg',
    theme: {
      primary: '#3b82f6',
      accent: '#10b981'
    }
  });

  useEffect(() => {
    axios.get(`${API}/api/whitelabel/config`)
      .then(res => {
        if (res.data) {
          setWhitelabel({
            clientName: res.data.clientName || 'Swarm Agentic Lab',
            logo: res.data.theme?.logo || '/favicon.svg',
            theme: {
              primary: res.data.theme?.primary || '#3b82f6',
              accent: res.data.theme?.accent || '#10b981'
            }
          });
        }
      })
      .catch(err => console.warn('Could not fetch whitelabel configuration:', err.message));
  }, []);

  const menuItems = [
    { id: 'fleet',     label: 'Fleet Control',   Icon: Monitor   },
    { id: 'telemetry', label: 'Observability',    Icon: Activity  },
    { id: 'analytics', label: 'Analytics & Costs', Icon: BarChart2 },
  ];

  const getBreadcrumb = () => {
    const activeItem = menuItems.find(item => item.id === activeTab);
    return activeItem ? activeItem.label : 'Dashboard';
  };

  return (
    <div className="console-container">
      {/* Sidebar navigation */}
      <aside className={`console-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div style={{ position: 'relative' }}>
          {/* Collapse Toggle Button */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              position: 'absolute',
              right: isCollapsed ? '-8px' : '-4px',
              top: '8px',
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              color: '#0f172a',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.75rem',
              zIndex: 10,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
            }}
          >
            {isCollapsed ? <ChevronRight size={13} strokeWidth={2.5} /> : <ChevronLeft size={13} strokeWidth={2.5} />}
          </button>

          {/* Sidebar Brand header */}
          <div className="sidebar-brand">
            <span className="brand-icon" style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: `linear-gradient(135deg, ${whitelabel.theme.primary}, ${whitelabel.theme.accent || '#10b981'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Cpu size={18} color="#ffffff" strokeWidth={2} />
            </span>
            <span className="brand-full sidebar-text" style={{ fontSize: '1.05rem', fontWeight: '900', letterSpacing: '1px' }}>
              {whitelabel.clientName.split(' ')[0].toUpperCase()}{' '}
              <span style={{ color: whitelabel.theme.primary }}>CONSOLE</span>
            </span>
          </div>

          {/* Nav List */}
          <nav className="sidebar-list">
            {menuItems.map(({ id, label, Icon }) => (
              <div
                key={id}
                onClick={() => onTabChange(id)}
                className={`sidebar-item ${activeTab === id ? 'active' : ''}`}
                style={{
                  color: activeTab === id ? whitelabel.theme.primary : 'var(--text-muted)'
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={activeTab === id ? 2.2 : 1.8}
                  color={activeTab === id ? whitelabel.theme.primary : 'var(--text-muted)'}
                />
                <span className="sidebar-text">{label}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* User Card footer */}
        {user && (
          <div className="user-section">
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              background: `linear-gradient(135deg, ${whitelabel.theme.primary}, ${whitelabel.theme.accent || '#10b981'})`,
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: '800', 
              fontSize: '0.9rem',
              flexShrink: 0
            }}>
              {user.username ? user.username.substring(0, 2).toUpperCase() : 'OP'}
            </div>
            
            <div className="user-text" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user.username}
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', color: whitelabel.theme.primary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {user.role}
              </span>
            </div>

            <button 
              onClick={onLogout}
              title="Sign Out"
              style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: 'none',
                color: '#f43f5e',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)'}
            >
              <LogOut size={15} strokeWidth={2} />
            </button>
          </div>
        )}
      </aside>

      {/* Main Workspace Frame */}
      <main className="console-main">
        {/* Workspace header */}
        <header className="console-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            <span>Console</span>
            <span>/</span>
            <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>{getBreadcrumb()}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Health status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--success)' }}>
              <span className="online-dot" />
              <span>FLEET SYSTEM RUNNING</span>
            </div>
            
            <div style={{ fontSize: '0.75rem', background: 'rgba(15, 23, 42, 0.03)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '8px', color: 'var(--text-muted)' }}>
              Client: <strong>{user?.companyName || 'Nexus Swarm'}</strong>
            </div>
          </div>
        </header>

        {/* Workspace body */}
        <div className="console-workspace">
          {children}
        </div>
      </main>
    </div>
  );
}
