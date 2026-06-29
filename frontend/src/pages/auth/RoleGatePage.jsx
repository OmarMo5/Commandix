import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Users, ShieldCheck, Zap, Check,
  ArrowRight, KeyRound, LogIn, UserPlus,
  ChevronLeft, Eye, EyeOff, AlertCircle,
} from 'lucide-react';

const MANAGER_CODE = import.meta.env.VITE_MANAGER_CODE || 'MANAGER2024';

const ROLES = [
  {
    id: 'employee',
    title: 'Employee',
    subtitle: 'Team Member',
    icon: User,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.2)',
    activeBg: 'rgba(16,185,129,0.15)',
    activeBorder: 'rgba(16,185,129,0.4)',
    permissions: ['View & update assigned tasks', 'Upload files & add comments', 'Receive task notifications'],
    desc: 'For team members working on assigned tasks',
    requiresCode: false,
    canRegister: true,
  },
  {
    id: 'manager',
    title: 'Manager',
    subtitle: 'Department Lead',
    icon: Users,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)',
    border: 'rgba(59,130,246,0.2)',
    activeBg: 'rgba(59,130,246,0.15)',
    activeBorder: 'rgba(59,130,246,0.4)',
    permissions: ['Manage department tasks & team', 'View team progress dashboard', 'Assign tasks to members'],
    desc: 'For team leads & department managers',
    requiresCode: true,
    canRegister: true,
  },
  {
    id: 'admin',
    title: 'Admin',
    subtitle: 'System Administrator',
    icon: ShieldCheck,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.2)',
    activeBg: 'rgba(99,102,241,0.15)',
    activeBorder: 'rgba(99,102,241,0.4)',
    permissions: ['Full system access & configuration', 'Manage all users, roles & departments', 'View all activity & reports'],
    desc: 'For system administrators only',
    requiresCode: false,
    canRegister: false,
  },
];

export default function RoleGatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('select'); // 'select' | 'verify' | 'action'
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const role = ROLES.find(r => r.id === selected);

  const handleRoleSelect = (roleId) => {
    setSelected(roleId);
    const r = ROLES.find(x => x.id === roleId);
    if (r.requiresCode) {
      setStep('verify');
    } else {
      setStep('action');
    }
    setCode('');
    setCodeError('');
  };

  const handleVerifyCode = () => {
    if (!code.trim()) { setCodeError('Please enter the access code'); return; }
    setVerifying(true);
    setTimeout(() => {
      if (code.trim() === MANAGER_CODE) {
        setStep('action');
        setCodeError('');
      } else {
        setCodeError('Invalid access code. Please contact your administrator.');
      }
      setVerifying(false);
    }, 600);
  };

  const goBack = () => {
    setStep('select');
    setSelected(null);
    setCode('');
    setCodeError('');
  };

  return (
    <div className="auth-page" style={{ flexDirection: 'column', padding: '24px 16px' }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        top: '10%', left: '50%', transform: 'translateX(-50%)',
        pointerEvents: 'none',
      }} />

      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 36, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 56, height: 56,
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
        }}>
          <Zap size={28} color="#fff" strokeWidth={2.5} />
        </div>
        <h1 style={{ fontWeight: 800, fontSize: 26, color: '#f0f6ff', letterSpacing: '-0.03em', marginBottom: 6 }}>
          Commandix
        </h1>
        <p style={{ color: '#4a5568', fontSize: 14 }}>Task management for modern teams</p>
      </div>

      {/* Step: Role Selection */}
      {step === 'select' && (
        <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#c8d8f0', marginBottom: 6 }}>
              Who are you?
            </h2>
            <p style={{ fontSize: 13, color: '#4a5568' }}>
              Select your role to get started
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => handleRoleSelect(r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    padding: '16px 20px',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid rgba(255,255,255,0.07)`,
                    borderRadius: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = r.bg;
                    e.currentTarget.style.borderColor = r.border;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: 50, height: 50, borderRadius: 12, flexShrink: 0,
                    background: r.bg, border: `1px solid ${r.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={22} color={r.color} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#dce8f8' }}>{r.title}</span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, padding: '2px 8px',
                        background: r.bg, color: r.color, border: `1px solid ${r.border}`,
                        borderRadius: 20,
                      }}>
                        {r.subtitle}
                      </span>
                      {r.requiresCode && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px',
                          background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                          border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20,
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <KeyRound size={9} /> Code required
                        </span>
                      )}
                      {!r.canRegister && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px',
                          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                          border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20,
                        }}>
                          Login only
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#4a5568', lineHeight: 1.4 }}>{r.desc}</div>
                  </div>
                  <ArrowRight size={16} color="#2d3f5a" strokeWidth={2} style={{ flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step: Verify Code (Manager) */}
      {step === 'verify' && role && (
        <div style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(17,24,39,0.8)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20, padding: 36,
          backdropFilter: 'blur(12px)',
          position: 'relative', zIndex: 1,
        }}>
          <button
            onClick={goBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none',
              border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 13,
              marginBottom: 24, padding: 0, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#8b9db5'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}
          >
            <ChevronLeft size={16} /> Back to roles
          </button>

          {/* Selected role badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: role.bg, border: `1px solid ${role.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(() => { const Icon = role.icon; return <Icon size={22} color={role.color} strokeWidth={1.8} />; })()}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#dce8f8' }}>{role.title} Access</div>
              <div style={{ fontSize: 12.5, color: '#4a5568', marginTop: 2 }}>{role.desc}</div>
            </div>
          </div>

          <div style={{
            padding: '14px 16px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.15)',
            borderRadius: 10, marginBottom: 24,
            display: 'flex', gap: 10,
          }}>
            <KeyRound size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: '#d97706', lineHeight: 1.5 }}>
              Manager access requires a special code provided by your administrator.
            </div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8b9db5', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
              ACCESS CODE
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={15} style={{
                position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                color: '#4a5568', pointerEvents: 'none',
              }} />
              <input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={e => { setCode(e.target.value); setCodeError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                placeholder="Enter your access code"
                style={{
                  width: '100%', padding: '10px 42px 10px 38px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${codeError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 9, color: '#f0f6ff', fontSize: 14,
                  outline: 'none', letterSpacing: showCode ? 'normal' : '0.1em',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { if (!codeError) e.target.style.borderColor = role.border; }}
                onBlur={e => { if (!codeError) e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
              <button
                type="button"
                onClick={() => setShowCode(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568',
                  display: 'flex', padding: 0,
                }}
              >
                {showCode ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {codeError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#ef4444' }}>
                <AlertCircle size={13} /> {codeError}
              </div>
            )}
          </div>

          <button
            onClick={handleVerifyCode}
            disabled={verifying}
            style={{
              width: '100%', marginTop: 20, padding: '11px',
              background: `linear-gradient(135deg,${role.color},${role.color}cc)`,
              border: 'none', borderRadius: 10, color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: verifying ? 0.7 : 1, transition: 'all 0.15s',
              boxShadow: `0 4px 14px ${role.color}40`,
            }}
          >
            {verifying ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Verifying...
              </span>
            ) : (
              <><KeyRound size={15} /> Verify Code</>
            )}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step: Action (Login / Register) */}
      {step === 'action' && role && (
        <div style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(17,24,39,0.8)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20, padding: 36,
          backdropFilter: 'blur(12px)',
          position: 'relative', zIndex: 1,
        }}>
          <button
            onClick={goBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none',
              border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 13,
              marginBottom: 24, padding: 0, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#8b9db5'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}
          >
            <ChevronLeft size={16} /> Change role
          </button>

          {/* Selected role summary */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px',
            background: role.activeBg,
            border: `1px solid ${role.activeBorder}`,
            borderRadius: 12, marginBottom: 28,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: role.bg, border: `1px solid ${role.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(() => { const Icon = role.icon; return <Icon size={19} color={role.color} strokeWidth={1.8} />; })()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#dce8f8' }}>
                Signed in as{' '}
                <span style={{ color: role.color }}>{role.title}</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#4a5568', marginTop: 2 }}>{role.subtitle}</div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={13} color="#10b981" strokeWidth={2.5} />
            </div>
          </div>

          {/* Permissions list */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2d3f5a', marginBottom: 10 }}>
              Your access includes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {role.permissions.map((perm, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: role.bg, border: `1px solid ${role.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={10} color={role.color} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 13, color: '#8b9db5' }}>{perm}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Admin: login only message */}
          {!role.canRegister && (
            <div style={{
              padding: '12px 14px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 10, marginBottom: 20,
              display: 'flex', gap: 10,
            }}>
              <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: '#f87171', lineHeight: 1.5 }}>
                Admin accounts are managed internally. New admins can only be created by an existing administrator.
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => navigate('/login', { state: { role: role.id, roleTitle: role.title } })}
              style={{
                width: '100%', padding: '12px',
                background: `linear-gradient(135deg,${role.color},${role.color}bb)`,
                border: 'none', borderRadius: 10, color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                boxShadow: `0 4px 14px ${role.color}35`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <LogIn size={16} />
              Sign In as {role.title}
            </button>

            {role.canRegister && (
              <button
                onClick={() => navigate('/register', { state: { role: role.id, roleTitle: role.title } })}
                style={{
                  width: '100%', padding: '12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderRadius: 10, color: '#8b9db5',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = role.bg;
                  e.currentTarget.style.borderColor = role.border;
                  e.currentTarget.style.color = role.color;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = '#8b9db5';
                }}
              >
                <UserPlus size={16} />
                Create {role.title} Account
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
