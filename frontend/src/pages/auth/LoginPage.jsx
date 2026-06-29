import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Mail, Lock, Zap, LogIn, ChevronLeft, User, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ROLE_ICONS = { employee: User, manager: Users, admin: ShieldCheck };
const ROLE_COLORS = { employee: '#10b981', manager: '#3b82f6', admin: '#6366f1' };

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const roleId = location.state?.role || null;
  const roleTitle = location.state?.roleTitle || null;
  const RoleIcon = roleId ? ROLE_ICONS[roleId] : null;
  const roleColor = roleId ? ROLE_COLORS[roleId] : '#6366f1';

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
      <div className="auth-card" style={{ maxWidth: 420 }}>

        {/* Back to role selection */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: '#4a5568',
            cursor: 'pointer', fontSize: 13, marginBottom: 24,
            padding: 0, transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#8b9db5'}
          onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}
        >
          <ChevronLeft size={16} /> Back
        </button>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 50, height: 50,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 6px 20px rgba(99,102,241,0.4)',
          }}>
            <Zap size={24} color="#fff" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 20, color: '#f0f6ff', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Welcome back
          </h2>
          <p style={{ color: '#4a5568', fontSize: 13.5 }}>Sign in to your workspace</p>
        </div>

        {/* Role badge */}
        {roleId && RoleIcon && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            background: `rgba(${roleId === 'employee' ? '16,185,129' : roleId === 'manager' ? '59,130,246' : '99,102,241'},0.1)`,
            border: `1px solid ${roleColor}30`,
            borderRadius: 10, marginBottom: 22,
          }}>
            <RoleIcon size={16} color={roleColor} />
            <span style={{ fontSize: 13, color: '#8b9db5' }}>
              Signing in as <strong style={{ color: roleColor }}>{roleTitle}</strong>
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" style={{ color: '#8b9db5' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{
                position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                color: '#4a5568', pointerEvents: 'none',
              }} />
              <input
                type="email"
                className="form-control"
                style={{ paddingLeft: 38, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', color: '#f0f6ff' }}
                placeholder="your@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoFocus
              />
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ color: '#8b9db5' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{
                position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                color: '#4a5568', pointerEvents: 'none',
              }} />
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: 38, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', color: '#f0f6ff' }}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-accent w-100"
            disabled={loading}
            style={{
              padding: '11px', fontSize: 14, justifyContent: 'center',
              background: `linear-gradient(135deg,${roleColor},${roleColor}bb)`,
              boxShadow: `0 4px 14px ${roleColor}35`,
            }}
          >
            <LogIn size={16} />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#4a5568', marginTop: 18 }}>
          Don't have an account?{' '}
          <Link
            to="/register"
            state={location.state}
            style={{ color: roleColor, textDecoration: 'none', fontWeight: 600 }}
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
