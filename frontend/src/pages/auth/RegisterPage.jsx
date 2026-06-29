import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { User, Mail, Lock, Zap, UserPlus, ChevronLeft, Users, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const ROLE_ICONS = { employee: User, manager: Users, admin: ShieldCheck };
const ROLE_COLORS = { employee: '#10b981', manager: '#3b82f6', admin: '#6366f1' };

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const roleId = location.state?.role || 'employee';
  const roleTitle = location.state?.roleTitle || 'Employee';
  const RoleIcon = ROLE_ICONS[roleId] || User;
  const roleColor = ROLE_COLORS[roleId] || '#10b981';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.password_confirmation) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', { ...form, role: roleId });
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'name', label: 'Full Name', type: 'text', icon: User, placeholder: 'Your full name' },
    { key: 'email', label: 'Email Address', type: 'email', icon: Mail, placeholder: 'your@email.com' },
    { key: 'password', label: 'Password', type: 'password', icon: Lock, placeholder: 'At least 8 characters' },
    { key: 'password_confirmation', label: 'Confirm Password', type: 'password', icon: Lock, placeholder: 'Repeat password' },
  ];

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>

        {/* Back button */}
        <button
          onClick={() => navigate('/', { state: location.state })}
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
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
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
            Create Account
          </h2>
          <p style={{ color: '#4a5568', fontSize: 13.5 }}>Join Commandix today</p>
        </div>

        {/* Role badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px',
          background: `${roleColor}18`,
          border: `1px solid ${roleColor}30`,
          borderRadius: 10, marginBottom: 22,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: `${roleColor}20`, border: `1px solid ${roleColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RoleIcon size={15} color={roleColor} strokeWidth={1.8} />
          </div>
          <div>
            <span style={{ fontSize: 13, color: '#8b9db5' }}>
              Registering as{' '}
              <strong style={{ color: roleColor }}>{roleTitle}</strong>
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={13} color="#10b981" />
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Verified</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            {fields.map(({ key, label, type, icon: Icon, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#8b9db5', display: 'block', marginBottom: 7, letterSpacing: '0.03em' }}>
                  {label}
                </label>
                <div style={{ position: 'relative' }}>
                  <Icon size={14} style={{
                    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                    color: '#4a5568', pointerEvents: 'none',
                  }} />
                  <input
                    type={type}
                    className="form-control"
                    style={{ paddingLeft: 37, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', color: '#f0f6ff' }}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required
                    minLength={key === 'password' ? 8 : undefined}
                    autoFocus={key === 'name'}
                  />
                </div>
              </div>
            ))}
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
            <UserPlus size={16} />
            {loading ? 'Creating account...' : `Create ${roleTitle} Account`}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#4a5568', marginTop: 18 }}>
          Already have an account?{' '}
          <Link
            to="/login"
            state={location.state}
            style={{ color: roleColor, textDecoration: 'none', fontWeight: 600 }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
