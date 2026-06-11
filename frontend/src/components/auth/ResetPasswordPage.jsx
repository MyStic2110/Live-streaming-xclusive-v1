import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || "";

export default function ResetPasswordPage({ onBack }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState('');
  const [tokenValid, setTokenValid] = useState(true); // optimistic

  const [config, setConfig] = useState({
    clientName: 'Swarm Agentic Lab',
    theme: { primary: '#3b82f6', accent: '#10b981' }
  });

  useEffect(() => {
    // Extract token from URL query string
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setTokenValid(false);
      setError('No reset token found in the URL. Please request a new password reset.');
    }
    setToken(t || '');

    // Fetch branding
    axios.get(`${API}/api/whitelabel/config`)
      .then(res => { if (res.data) setConfig(res.data); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

    if (password.length < 8 || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/reset-password`, { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.');
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
        width: '100%', maxWidth: '460px',
        background: 'rgba(255, 255, 255, 0.90)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(0, 0, 0, 0.06)',
        borderRadius: '28px', padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.06)',
        textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        {/* Glow decoration */}
        <div style={{
          position: 'absolute', top: '-20%', left: '50%',
          transform: 'translateX(-50%)', width: '200px', height: '200px',
          background: `radial-gradient(circle, ${primaryColor}12 0%, transparent 70%)`,
          zIndex: 0, pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Icon */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: success
              ? 'rgba(16, 185, 129, 0.1)'
              : `linear-gradient(135deg, ${primaryColor}18 0%, ${accentColor}0d 100%)`,
            border: `1.5px solid ${success ? 'rgba(16,185,129,0.3)' : `${primaryColor}22`}`,
            margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem',
            transition: 'all 0.4s ease'
          }}>
            {success ? '✅' : tokenValid ? '🔑' : '⚠️'}
          </div>

          <h1 style={{
            fontSize: '1.8rem', fontWeight: '800', color: '#0f172a',
            marginBottom: '8px', letterSpacing: '-0.5px'
          }}>
            {success ? 'Password Updated!' : 'Set New Password'}
          </h1>

          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '28px' }}>
            {success
              ? 'Your password has been successfully changed. You can now sign in.'
              : tokenValid
              ? 'Choose a strong new password for your account.'
              : 'This reset link is invalid.'}
          </p>

          {/* Success state */}
          {success && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '14px', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left'
              }}>
                <div style={{ fontSize: '2rem' }}>🎉</div>
                <div>
                  <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>All set!</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5' }}>
                    Your new password is active. Use it next time you sign in to {config.clientName}.
                  </div>
                </div>
              </div>
              <button
                onClick={onBack}
                style={{
                  width: '100%', padding: '14px',
                  background: primaryColor, color: '#ffffff',
                  border: 'none', borderRadius: '12px',
                  fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
                  boxShadow: `0 4px 20px ${primaryColor}44`,
                  transition: 'all 0.2s ease', letterSpacing: '0.5px'
                }}
              >
                → SIGN IN NOW
              </button>
            </div>
          )}

          {/* Error state (invalid token, no form shown) */}
          {!success && !tokenValid && (
            <div>
              <div style={{
                background: '#ef444408', border: '1px solid #ef444422',
                color: '#ef4444', borderRadius: '12px', padding: '16px',
                fontSize: '0.85rem', marginBottom: '20px',
                textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '8px'
              }}>
                <span>⚠️</span>
                <div>{error}</div>
              </div>
              <button
                onClick={onBack}
                style={{
                  width: '100%', padding: '14px',
                  background: primaryColor, color: '#ffffff',
                  border: 'none', borderRadius: '12px',
                  fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
                  boxShadow: `0 4px 20px ${primaryColor}44`,
                }}
              >
                ← Request New Reset Link
              </button>
            </div>
          )}

          {/* Reset password form */}
          {!success && tokenValid && (
            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              {error && (
                <div style={{
                  background: '#ef444408', border: '1px solid #ef444422',
                  color: '#ef4444', borderRadius: '12px', padding: '12px 16px',
                  fontSize: '0.85rem', marginBottom: '20px',
                  display: 'flex', alignItems: 'flex-start', gap: '8px'
                }}>
                  <span>⚠️</span>
                  <div>{error}</div>
                </div>
              )}

              {/* New password */}
              <div style={{ marginBottom: '8px' }}>
                <label style={labelStyle}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '14px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1.1rem', color: '#94a3b8', padding: '0'
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Strength indicator */}
              {password && (
                <div style={{ marginBottom: '20px' }}>
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

              {/* Confirm password */}
              <div style={{ marginBottom: '28px' }}>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: confirmPassword && confirmPassword !== password
                      ? '#fca5a5' : '#e2e8f0'
                  }}
                />
                {confirmPassword && confirmPassword !== password && (
                  <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '6px', fontWeight: '600' }}>
                    Passwords don't match
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || (confirmPassword && confirmPassword !== password)}
                style={{
                  width: '100%', padding: '14px',
                  background: primaryColor, color: '#ffffff',
                  border: 'none', borderRadius: '12px',
                  fontWeight: '700', fontSize: '0.95rem',
                  cursor: (loading || (confirmPassword && confirmPassword !== password)) ? 'not-allowed' : 'pointer',
                  boxShadow: `0 4px 20px ${primaryColor}44`,
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.7 : 1,
                  letterSpacing: '0.5px'
                }}
              >
                {loading ? 'Updating Password...' : 'SET NEW PASSWORD'}
              </button>

              <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    background: 'none', border: 'none', color: primaryColor,
                    fontWeight: '700', cursor: 'pointer', padding: '0 4px', fontSize: '0.85rem'
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
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
  transition: 'all 0.2s ease', boxSizing: 'border-box'
};
