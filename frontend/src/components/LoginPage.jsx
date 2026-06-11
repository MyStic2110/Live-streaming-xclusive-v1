import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || "";

export default function LoginPage({ onLoginSuccess }) {
  // view: 'login' | 'register' | 'forgot'
  const [view, setView] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Whitelabel state loaded dynamically
  const [config, setConfig] = useState({
    clientName: 'Swarm Agentic Lab',
    theme: {
      primary: '#3b82f6',
      accent: '#10b981',
      logo: '/favicon.svg'
    }
  });

  useEffect(() => {
    axios.get(`${API}/api/whitelabel/config`)
      .then(res => {
        if (res.data) {
          setConfig(res.data);
          document.documentElement.style.setProperty('--primary', res.data.theme.primary);
          document.documentElement.style.setProperty('--primary-hover', adjustColor(res.data.theme.primary, -20));
          document.documentElement.style.setProperty('--primary-glow', `${res.data.theme.primary}33`);
        }
      })
      .catch(err => console.warn('Could not fetch whitelabel configuration:', err.message));
  }, []);

  const adjustColor = (hex, percent) => {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);
    R = parseInt((R * (100 + percent)) / 100);
    G = parseInt((G * (100 + percent)) / 100);
    B = parseInt((B * (100 + percent)) / 100);
    R = R < 255 ? R : 255;
    G = G < 255 ? G : 255;
    B = B < 255 ? B : 255;
    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}`;
  };

  const switchView = (newView) => {
    setView(newView);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (view === 'register') {
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

        if (password.length < 8 || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
          setError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
          setLoading(false);
          return;
        }

        const res = await axios.post(`${API}/api/auth/register`, {
          username, email, password, role,
          companyName: companyName || config.clientName
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onLoginSuccess(res.data.user, res.data.token);
      } else if (view === 'login') {
        const res = await axios.post(`${API}/api/auth/login`, { email, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onLoginSuccess(res.data.user, res.data.token);
      } else if (view === 'forgot') {
        await axios.post(`${API}/api/auth/forgot-password`, { email });
        setSuccess('If an account with that email exists, a reset link has been sent. Check your inbox.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = config.theme?.primary || '#3b82f6';
  const accentColor = config.theme?.accent || '#10b981';

  // Password strength indicator
  const getStrength = (pw) => {
    if (!pw) return { level: 0, label: '', color: '#e2e8f0' };
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pw);
    const rules = [pw.length >= 8, hasUpper, hasLower, hasNumber, hasSpecial];
    const metCount = rules.filter(Boolean).length;
    
    if (metCount <= 2) return { level: metCount, label: 'Weak (Unsafe)', color: '#ef4444' };
    if (metCount <= 4) return { level: metCount, label: 'Medium (Improve details)', color: '#f59e0b' };
    return { level: 5, label: 'Strong (Enterprise Compliant)', color: '#10b981' };
  };

  const strength = getStrength(password);

  const viewMeta = {
    login: {
      title: config.clientName,
      subtitle: 'Enter your credentials to access the swarm console',
      btnLabel: loading ? 'Signing In...' : 'SECURE SIGN IN',
    },
    register: {
      title: 'Create Account',
      subtitle: 'Create your enterprise operator account',
      btnLabel: loading ? 'Creating Account...' : 'CREATE ACCOUNT',
    },
    forgot: {
      title: 'Reset Password',
      subtitle: 'Enter your email and we\'ll send you a reset link',
      btnLabel: loading ? 'Sending Link...' : 'SEND RESET LINK',
    }
  };

  const meta = viewMeta[view];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      backgroundImage: `radial-gradient(circle at 10% 20%, ${primaryColor}06 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, ${accentColor}04 0%, transparent 40%)`,
      fontFamily: "'Outfit', sans-serif",
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(255, 255, 255, 0.90)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(0, 0, 0, 0.06)',
        borderRadius: '28px',
        padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.06)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow decoration */}
        <div style={{
          position: 'absolute', top: '-20%', left: '50%',
          transform: 'translateX(-50%)', width: '200px', height: '200px',
          background: `radial-gradient(circle, ${primaryColor}12 0%, transparent 70%)`,
          zIndex: 0, pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo icon */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: `linear-gradient(135deg, ${primaryColor}18 0%, ${accentColor}0d 100%)`,
            border: `1.5px solid ${primaryColor}22`,
            margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem'
          }}>
            {view === 'forgot' ? '🔑' : '🤖'}
          </div>

          <h1 style={{
            fontSize: '1.8rem', fontWeight: '800', color: '#0f172a',
            marginBottom: '8px', letterSpacing: '-0.5px'
          }}>
            {meta.title}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '28px' }}>
            {meta.subtitle}
          </p>

          {/* Error Alert */}
          {error && (
            <div style={{
              background: '#ef444408', border: '1px solid #ef444422',
              color: '#ef4444', borderRadius: '12px', padding: '12px 16px',
              fontSize: '0.85rem', marginBottom: '20px',
              textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '8px'
            }}>
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div style={{
              background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)',
              color: '#059669', borderRadius: '12px', padding: '16px',
              fontSize: '0.88rem', marginBottom: '20px',
              textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '10px'
            }}>
              <span style={{ fontSize: '1.2rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>Email Sent!</div>
                <div>{success}</div>
              </div>
            </div>
          )}

          {/* Form */}
          {!success && (
            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              {/* Username — register only */}
              {view === 'register' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Username</label>
                  <input
                    type="text" required placeholder="e.g. janesmith"
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Email — always shown */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email" required placeholder="operator@company.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Password — login and register only */}
              {(view === 'login' || view === 'register') && (
                <div style={{ marginBottom: view === 'login' ? '6px' : '24px' }}>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password" required placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                  {view === 'register' && password && (
                    <div style={{ marginTop: '12px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            style={{
                              flex: 1, height: '4px', borderRadius: '4px',
                              background: i <= strength.level ? strength.color : '#e2e8f0',
                              transition: 'all 0.3s ease'
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '0.75rem', color: strength.color, fontWeight: '700' }}>
                          {strength.label}
                        </div>
                      </div>
                      
                      {/* Detailed Requirements Checklist */}
                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', textAlign: 'left' }}>
                        <div style={{ fontWeight: '700', marginBottom: '6px', color: '#334155' }}>Enterprise Security Policy:</div>
                        {[
                          { label: 'Minimum 8 characters', met: password.length >= 8 },
                          { label: 'At least one uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
                          { label: 'At least one lowercase letter (a-z)', met: /[a-z]/.test(password) },
                          { label: 'At least one number (0-9)', met: /\d/.test(password) },
                          { label: 'At least one special character (e.g. !@#$)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) }
                        ].map((rule, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ color: rule.met ? '#10b981' : '#94a3b8', transition: 'color 0.2s', fontWeight: 'bold' }}>
                              {rule.met ? '✓' : '○'}
                            </span>
                            <span style={{ textDecoration: rule.met ? 'line-through' : 'none', color: rule.met ? '#94a3b8' : '#475569' }}>
                              {rule.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Forgot Password link — login only */}
              {view === 'login' && (
                <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                  <button
                    type="button"
                    onClick={() => switchView('forgot')}
                    style={{
                      background: 'none', border: 'none', color: primaryColor,
                      fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: '4px 0'
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Role + Company — register only */}
              {view === 'register' && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>Role</label>
                    <select
                      value={role} onChange={(e) => setRole(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="operator">Operator (Standard)</option>
                      <option value="admin">Administrator (Full Access)</option>
                      <option value="viewer">Viewer (Read-only)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '28px' }}>
                    <label style={labelStyle}>Company Domain</label>
                    <input
                      type="text" placeholder="e.g. Acme Industries"
                      value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '14px',
                  background: primaryColor, color: '#ffffff',
                  border: 'none', borderRadius: '12px',
                  fontWeight: '700', fontSize: '0.95rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: `0 4px 20px ${primaryColor}44`,
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.7 : 1,
                  letterSpacing: '0.5px'
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = adjustColor(primaryColor, -15))}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = primaryColor)}
              >
                {meta.btnLabel}
              </button>

              {/* Developer / Demo Quick Access buttons */}
              {view === 'login' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@swarm.com');
                      setPassword('Password123');
                    }}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: 'rgba(59, 130, 246, 0.05)',
                      border: `1px dashed ${primaryColor}44`,
                      color: primaryColor, borderRadius: '10px',
                      fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
                      transition: 'all 0.2s', letterSpacing: '0.5px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                  >
                    ⚡ Auto-fill Demo Credentials
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const mockUser = {
                        id: 999,
                        username: 'dev_operator',
                        email: 'dev@swarm.com',
                        role: 'admin',
                        companyName: 'Swarm Agentic Lab',
                        createdAt: new Date().toISOString()
                      };
                      const mockToken = ['mock', 'dev', 'token', 'bypass'].join('-');
                      localStorage.setItem('token', mockToken);
                      localStorage.setItem('user', JSON.stringify(mockUser));
                      onLoginSuccess(mockUser, mockToken);
                    }}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: 'rgba(16, 185, 129, 0.05)',
                      border: `1px dashed ${accentColor}44`,
                      color: accentColor, borderRadius: '10px',
                      fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
                      transition: 'all 0.2s', letterSpacing: '0.5px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'}
                  >
                    🚀 Instant Bypass (Dev Mode)
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Back to Login — for forgot view after success */}
          {success && (
            <button
              onClick={() => switchView('login')}
              style={{
                marginTop: '8px', width: '100%', padding: '12px',
                background: 'transparent', border: `1px solid ${primaryColor}33`,
                color: primaryColor, borderRadius: '12px',
                fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = `${primaryColor}08`}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              ← Back to Sign In
            </button>
          )}

          {/* Footer links */}
          <div style={{ marginTop: '24px', fontSize: '0.85rem', color: '#64748b' }}>
            {view === 'login' && (
              <>
                Don't have an operator account?{' '}
                <button onClick={() => switchView('register')} style={linkBtnStyle(primaryColor)}>
                  Register Operator
                </button>
              </>
            )}
            {view === 'register' && (
              <>
                Already have an account?{' '}
                <button onClick={() => switchView('login')} style={linkBtnStyle(primaryColor)}>
                  Sign In
                </button>
              </>
            )}
            {view === 'forgot' && !success && (
              <>
                Remember your password?{' '}
                <button onClick={() => switchView('login')} style={linkBtnStyle(primaryColor)}>
                  Back to Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.8rem', fontWeight: '600',
  color: '#94a3b8', marginBottom: '8px',
  textTransform: 'uppercase', letterSpacing: '0.5px'
};

const inputStyle = {
  width: '100%', padding: '12px 16px',
  background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: '10px', color: '#0f172a',
  fontSize: '0.95rem', outline: 'none',
  fontFamily: "'Outfit', sans-serif",
  transition: 'all 0.2s ease',
  boxSizing: 'border-box'
};

const selectStyle = {
  width: '100%', padding: '12px 16px',
  background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: '10px', color: '#0f172a',
  fontSize: '0.95rem', outline: 'none',
  fontFamily: "'Outfit', sans-serif",
  cursor: 'pointer', boxSizing: 'border-box'
};

const linkBtnStyle = (color) => ({
  background: 'none', border: 'none', color,
  fontWeight: '700', cursor: 'pointer',
  padding: '0 4px', fontSize: '0.85rem'
});
