import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Monitor, BarChart2, Cpu, LogOut, ChevronLeft, ChevronRight, Shield } from 'lucide-react';

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
    // Note: using direct fetch or axios, but keep existing imports
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
    { id: 'fleet',      label: 'Fleet Control',   Icon: Monitor   },
    { id: 'analytics',  label: 'Analytics & Costs', Icon: BarChart2 },
    { id: 'compliance', label: 'Compliance Hub',  Icon: Shield    },
    { id: 'agent-ops',  label: 'Agent Ops',       Icon: Cpu       },
  ];

  const getBreadcrumb = () => {
    const activeItem = menuItems.find(item => item.id === activeTab);
    return activeItem ? activeItem.label : 'Dashboard';
  };

  const isDarkTab = activeTab === 'compliance';

  return (
    <div className="console-container" style={isDarkTab ? { backgroundColor: '#070913', minHeight: '100vh' } : {}}>
      {/* Sidebar navigation */}
      <aside 
        className={`console-sidebar ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          width: isCollapsed ? '80px' : '260px',
          background: isDarkTab ? 'rgba(7, 10, 20, 0.85)' : 'rgba(248, 250, 252, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRight: isDarkTab ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '2rem 1.2rem',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1000,
          position: 'relative'
        }}
      >
        <div style={{ position: 'relative' }}>
          {/* Collapse Toggle Button */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              position: 'absolute',
              right: isCollapsed ? '-8px' : '-4px',
              top: '8px',
              background: isDarkTab ? '#0d1326' : '#ffffff',
              border: isDarkTab ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(0, 0, 0, 0.08)',
              color: isDarkTab ? '#38bdf8' : '#0f172a',
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
            <span className="brand-full sidebar-text" style={{ fontSize: '1.05rem', fontWeight: '900', letterSpacing: '1px', color: isDarkTab ? '#ffffff' : 'var(--text-main)' }}>
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
                  color: activeTab === id ? whitelabel.theme.primary : (isDarkTab ? '#94a3b8' : 'var(--text-muted)'),
                  background: activeTab === id ? (isDarkTab ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)') : 'transparent',
                  borderColor: activeTab === id ? (isDarkTab ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.1)') : 'transparent',
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={activeTab === id ? 2.2 : 1.8}
                  color={activeTab === id ? whitelabel.theme.primary : (isDarkTab ? '#94a3b8' : 'var(--text-muted)')}
                />
                <span className="sidebar-text">{label}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* User Card footer */}
        {user && (
          <div className="user-section" style={{ borderTop: isDarkTab ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border)' }}>
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
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isDarkTab ? '#f3f4f6' : 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
      <main className="console-main" style={isDarkTab ? { backgroundColor: '#070913', color: '#f3f4f6' } : {}}>
        {/* Workspace header */}
        <header 
          className="console-header"
          style={{
            background: isDarkTab ? 'rgba(7, 10, 20, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            borderBottom: isDarkTab ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid var(--border)',
            padding: '1.5rem 3rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: isDarkTab ? '#94a3b8' : 'var(--text-muted)', fontWeight: '600' }}>
            <span>Console</span>
            <span>/</span>
            <span style={{ color: isDarkTab ? '#ffffff' : 'var(--text-main)', fontWeight: '700' }}>{getBreadcrumb()}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Health status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--success)' }}>
              <span className="online-dot" />
              <span>FLEET SYSTEM RUNNING</span>
            </div>
            
            <div style={{ 
              fontSize: '0.75rem', 
              background: isDarkTab ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)', 
              border: isDarkTab ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border)', 
              padding: '4px 10px', 
              borderRadius: '8px', 
              color: isDarkTab ? '#94a3b8' : 'var(--text-muted)' 
            }}>
              Client: <strong>{user?.companyName || 'Nexus Swarm'}</strong>
            </div>
          </div>
        </header>

        {/* Workspace body */}
        <div className="console-workspace" style={{ padding: '0', flexGrow: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
