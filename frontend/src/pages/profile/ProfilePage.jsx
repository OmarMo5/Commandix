import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pwdForm, setPwdForm] = useState({ password: '', password_confirmation: '' });
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  const handleProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${user.id}`, form);
      await refreshUser();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
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
      toast.success('Password changed');
      setPwdForm({ password: '', password_confirmation: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setSavingPwd(false); }
  };

  const handleAvatar = async () => {
    if (!avatarFile) return;
    const fd = new FormData();
    fd.append('avatar', avatarFile);
    try {
      await api.post('/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      toast.success('Avatar updated');
    } catch { toast.error('Failed to upload avatar'); }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      <div className="row g-4">
        <div className="col-md-4">
          <div className="card text-center">
            <div style={{ marginBottom: 16 }}>
              {user?.avatar
                ? <img src={user.avatar} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
                : <div className="avatar" style={{ width: 80, height: 80, fontSize: 24, margin: '0 auto' }}>{initials}</div>
              }
            </div>
            <h5 style={{ fontWeight: 700 }}>{user?.name}</h5>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{user?.email}</p>
            {user?.role && (
              <span style={{ fontSize: 12, background: 'var(--accent)20', color: 'var(--accent)', padding: '3px 12px', borderRadius: 20 }}>
                {user.role.display_name}
              </span>
            )}
            {user?.department && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>
                🏢 {user.department.name}
              </p>
            )}

            <hr style={{ borderColor: 'var(--border-color)' }} />

            <div>
              <label className="form-label">Change Avatar</label>
              <input
                type="file"
                className="form-control form-control-sm"
                accept="image/*"
                onChange={e => setAvatarFile(e.target.files[0])}
              />
              {avatarFile && (
                <button className="btn-accent mt-2 w-100" onClick={handleAvatar}>Upload</button>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card mb-4">
            <h6 style={{ fontWeight: 600, marginBottom: 20 }}>Edit Profile</h6>
            <form onSubmit={handleProfile}>
              <div className="mb-3">
                <label className="form-label">Full Name</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" className="btn-accent" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          <div className="card">
            <h6 style={{ fontWeight: 600, marginBottom: 20 }}>Change Password</h6>
            <form onSubmit={handlePassword}>
              <div className="mb-3">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwdForm.password}
                  onChange={e => setPwdForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwdForm.password_confirmation}
                  onChange={e => setPwdForm(f => ({ ...f, password_confirmation: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" className="btn-accent" disabled={savingPwd}>
                {savingPwd ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
