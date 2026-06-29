import { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { User, Mail, Lock, Shield, Building2, Camera, Save, Key } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pwdForm, setPwdForm] = useState({ password: '', password_confirmation: '' });
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${user.id}`, form);
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.password !== pwdForm.password_confirmation) {
      toast.error('Passwords do not match');
      return;
    }
    setSavingPwd(true);
    try {
      await api.put(`/users/${user.id}/password`, pwdForm);
      toast.success('Password changed successfully');
      setPwdForm({ password: '', password_confirmation: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setSavingPwd(false); }
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    const fd = new FormData();
    fd.append('avatar', avatarFile);
    try {
      await api.post('/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success('Avatar updated');
    } catch { toast.error('Failed to upload avatar'); }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const avatarSrc = avatarPreview || user?.avatar;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account settings and preferences</p>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column — Profile Card */}
        <div className="col-md-4 col-lg-3">
          <div className="profile-section-card">
            {/* Hero cover */}
            <div className="profile-hero" />

            {/* Avatar + info */}
            <div style={{ paddingBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingRight: 20 }}>
                <div className="profile-avatar-wrap">
                  <div className="profile-avatar-large">
                    {avatarSrc
                      ? <img src={avatarSrc} alt={user?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials
                    }
                  </div>
                  <div
                    className="profile-avatar-upload"
                    onClick={() => fileInputRef.current?.click()}
                    title="Change avatar"
                  >
                    <Camera size={20} color="#fff" />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarFileChange}
                  />
                </div>
                {avatarFile && (
                  <button
                    className="btn-accent"
                    style={{ padding: '6px 14px', fontSize: 12 }}
                    onClick={handleAvatarUpload}
                  >
                    <Save size={13} />
                    Save
                  </button>
                )}
              </div>

              <div className="profile-info-section">
                <div className="profile-name">{user?.name}</div>
                <div className="profile-email">{user?.email}</div>
                <div className="profile-chips">
                  {user?.role && (
                    <span className="profile-chip">
                      <Shield size={11} />
                      {user.role.display_name}
                    </span>
                  )}
                  {user?.department && (
                    <span className="profile-chip dept">
                      <Building2 size={11} />
                      {user.department.name}
                    </span>
                  )}
                </div>

                <div style={{
                  marginTop: 20,
                  padding: '14px 16px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
                    Account Info
                  </div>
                  {[
                    { icon: User, label: 'Name', value: user?.name },
                    { icon: Mail, label: 'Email', value: user?.email },
                    { icon: Shield, label: 'Role', value: user?.role?.display_name || '—' },
                    { icon: Building2, label: 'Dept', value: user?.department?.name || '—' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Icon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 36 }}>{label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column — Forms */}
        <div className="col-md-8 col-lg-9">
          <div className="d-flex flex-column gap-4">

            {/* Edit Profile */}
            <div className="profile-section-card">
              <div className="profile-section-header">
                <div
                  className="profile-section-icon"
                  style={{ background: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  <User size={16} color="var(--accent)" />
                </div>
                <div>
                  <div className="profile-section-title">Personal Information</div>
                  <div className="profile-section-subtitle">Update your name and email address</div>
                </div>
              </div>
              <div className="profile-section-body">
                <form onSubmit={handleProfile}>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label">Full Name</label>
                      <div style={{ position: 'relative' }}>
                        <User size={15} style={{
                          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                          color: 'var(--text-muted)', pointerEvents: 'none',
                        }} />
                        <input
                          className="form-control"
                          style={{ paddingLeft: 36 }}
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Your full name"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email Address</label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={15} style={{
                          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                          color: 'var(--text-muted)', pointerEvents: 'none',
                        }} />
                        <input
                          type="email"
                          className="form-control"
                          style={{ paddingLeft: 36 }}
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="btn-accent" disabled={saving}>
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            </div>

            {/* Change Password */}
            <div className="profile-section-card">
              <div className="profile-section-header">
                <div
                  className="profile-section-icon"
                  style={{ background: 'var(--warning-light)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <Key size={16} color="var(--warning)" />
                </div>
                <div>
                  <div className="profile-section-title">Security</div>
                  <div className="profile-section-subtitle">Change your password to keep your account safe</div>
                </div>
              </div>
              <div className="profile-section-body">
                <form onSubmit={handlePassword}>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label">New Password</label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={15} style={{
                          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                          color: 'var(--text-muted)', pointerEvents: 'none',
                        }} />
                        <input
                          type="password"
                          className="form-control"
                          style={{ paddingLeft: 36 }}
                          value={pwdForm.password}
                          onChange={e => setPwdForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="At least 8 characters"
                          required
                          minLength={8}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Confirm New Password</label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={15} style={{
                          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                          color: 'var(--text-muted)', pointerEvents: 'none',
                        }} />
                        <input
                          type="password"
                          className="form-control"
                          style={{ paddingLeft: 36 }}
                          value={pwdForm.password_confirmation}
                          onChange={e => setPwdForm(f => ({ ...f, password_confirmation: e.target.value }))}
                          placeholder="Repeat new password"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password strength hint */}
                  <div style={{
                    padding: '12px 16px',
                    background: 'var(--info-light)',
                    border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 16,
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <Shield size={14} color="var(--info)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12, color: 'var(--info)' }}>
                      Use at least 8 characters with a mix of letters, numbers and symbols for a strong password.
                    </div>
                  </div>

                  <button type="submit" className="btn-accent" disabled={savingPwd}
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)', boxShadow: '0 2px 8px rgba(245,158,11,0.3)' }}
                  >
                    <Key size={14} />
                    {savingPwd ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
