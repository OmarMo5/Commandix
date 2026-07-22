import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Mail, Lock, Zap, LogIn, ShieldCheck, Users2, ListChecks, Eye, EyeOff, LifeBuoy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const FEATURES = [
  { icon: ShieldCheck, text: 'Role-based access control for every team' },
  { icon: Users2, text: 'Cross-department collaboration on shared tasks' },
  { icon: ListChecks, text: 'Real-time task tracking from assignment to done' },
];

const MOCK_TASKS = [
  { color: '#f59e0b', width: '78%' },
  { color: '#6366f1', width: '55%' },
  { color: '#10b981', width: '66%' },
];

function BrandMark({ appName, logoUrl, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.27,
      background: logoUrl ? 'transparent' : 'var(--accent-gradient)',
      border: logoUrl ? '1px solid rgba(255,255,255,0.14)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
      boxShadow: logoUrl ? 'none' : '0 6px 20px rgba(99,102,241,0.4)',
    }}>
      {logoUrl
        ? <img src={logoUrl} alt={appName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Zap size={size * 0.48} color="#fff" strokeWidth={2.5} />}
    </div>
  );
}

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { appName, logoUrl } = useSettings();
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">

        {/* Brand panel — hidden on narrow screens */}
        <div className="auth-brand-panel">
          <div className="auth-brand-top">
            <div className="auth-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 34 }}>
              <BrandMark appName={appName} logoUrl={logoUrl} />
              <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>{appName}</span>
            </div>

            <span className="auth-eyebrow auth-fade-in" style={{ animationDelay: '0.05s' }}>Team Workspace</span>

            <h1 className="auth-fade-in" style={{ fontSize: 33, fontWeight: 800, lineHeight: 1.18, letterSpacing: '-0.02em', marginBottom: 14, animationDelay: '0.08s' }}>
              Work flows better<br />when access is clear.
            </h1>
            <p className="auth-fade-in" style={{ fontSize: 14.5, color: '#8b9db5', marginBottom: 28, lineHeight: 1.6, maxWidth: 380, animationDelay: '0.12s' }}>
              Super Admin, Admin, Manager, Employee — everyone gets exactly the access they need, nothing they don't.
            </p>

            <div className="auth-fade-in" style={{ animationDelay: '0.16s' }}>
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div className="auth-feature" key={i}>
                    <div className="auth-feature-icon">
                      <Icon size={14} color="#a5b4fc" strokeWidth={2.2} />
                    </div>
                    <span style={{ fontSize: 13.5, color: '#c3cde0' }}>{f.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="auth-brand-bottom">
            {/* Decorative task-board preview */}
            <div className="auth-mock-card auth-fade-in" style={{ animationDelay: '0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7fa3' }}>
                  Today's Tasks
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#a5b4fc', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: 20 }}>
                  Live
                </span>
              </div>
              {MOCK_TASKS.map((t, i) => (
                <div className="auth-mock-row" key={i}>
                  <span className="auth-mock-dot" style={{ background: t.color }} />
                  <span className="auth-mock-bar" style={{ width: t.width }} />
                </div>
              ))}
            </div>

            <div className="auth-fade-in" style={{ marginTop: 22, fontSize: 12, color: '#3d4761', animationDelay: '0.24s' }}>
              © {year} {appName}. All rights reserved.
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="auth-form-panel">
          <div className="auth-card auth-fade-in">

            {/* Brand — shown only on narrow screens where the left panel is hidden */}
            <div className="auth-form-brand" style={{ textAlign: 'center', marginBottom: 26 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <BrandMark appName={appName} logoUrl={logoUrl} size={48} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 17, color: '#f0f6ff' }}>{appName}</span>
            </div>

            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontWeight: 800, fontSize: 22, color: '#f0f6ff', letterSpacing: '-0.02em', marginBottom: 6 }}>
                Welcome back
              </h2>
              <p style={{ color: '#5c6885', fontSize: 13.5 }}>Sign in to your {appName} workspace</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" style={{ color: '#8b9db5' }}>Email Address</label>
                <div className="auth-input-wrap">
                  <Mail size={15} style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: '#465066', pointerEvents: 'none',
                  }} />
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className="form-label" style={{ color: '#8b9db5' }}>Password</label>
                <div className="auth-input-wrap">
                  <Lock size={15} style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: '#465066', pointerEvents: 'none',
                  }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input"
                    style={{ paddingRight: 40 }}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    className="auth-pwd-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, fontSize: 12, color: '#465066' }}>
                <LifeBuoy size={12} />
                <span>Forgot your password? Contact your administrator.</span>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <span className="auth-spinner" /> : <LogIn size={16} />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
