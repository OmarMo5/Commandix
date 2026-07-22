import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Palette, Type, Camera, Save } from 'lucide-react';
import api from '../../api/axios';
import { useSettings } from '../../context/SettingsContext';

export default function BrandingPage() {
  const { appName, logoUrl, refreshSettings } = useSettings();
  const [name, setName] = useState(appName);
  const [savingName, setSavingName] = useState(false);

  // Sync once the real settings finish loading (context starts with the default "Commandix").
  useEffect(() => { setName(appName); }, [appName]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const fileInputRef = useRef(null);

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await api.put('/settings', { app_name: name });
      await refreshSettings();
      toast.success('App name updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name');
    } finally { setSavingName(false); }
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setSavingLogo(true);
    const fd = new FormData();
    fd.append('logo', logoFile);
    try {
      await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshSettings();
      setLogoFile(null);
      setLogoPreview(null);
      toast.success('Logo updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload logo');
    } finally { setSavingLogo(false); }
  };

  const displayedLogo = logoPreview || logoUrl;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Branding</h1>
          <p className="page-subtitle">Super Admin only — customize the name and logo shown across the app and the login page</p>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-8 col-lg-6">
          {/* Logo */}
          <div className="profile-section-card mb-4">
            <div className="profile-section-header">
              <div className="profile-section-icon" style={{ background: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Camera size={16} color="var(--accent)" />
              </div>
              <div>
                <div className="profile-section-title">Logo</div>
                <div className="profile-section-subtitle">Shown in the sidebar and on the login page</div>
              </div>
            </div>
            <div className="profile-section-body">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div style={{
                  width: 64, height: 64, borderRadius: 14, overflow: 'hidden',
                  background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, border: '1px solid var(--border-color)',
                }}>
                  {displayedLogo
                    ? <img src={displayedLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Palette size={26} color="#fff" />}
                </div>
                <div>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                    Choose Image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoFileChange}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>PNG or JPG, up to 2MB</div>
                </div>
              </div>
              {logoFile && (
                <button className="btn-accent" onClick={handleLogoUpload} disabled={savingLogo}>
                  <Save size={14} />
                  {savingLogo ? 'Uploading...' : 'Save Logo'}
                </button>
              )}
            </div>
          </div>

          {/* App name */}
          <div className="profile-section-card">
            <div className="profile-section-header">
              <div className="profile-section-icon" style={{ background: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Type size={16} color="var(--accent)" />
              </div>
              <div>
                <div className="profile-section-title">App Name</div>
                <div className="profile-section-subtitle">Replaces "Commandix" throughout the interface</div>
              </div>
            </div>
            <div className="profile-section-body">
              <form onSubmit={handleNameSubmit}>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input
                    className="form-control"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
                <button type="submit" className="btn-accent" disabled={savingName}>
                  <Save size={14} />
                  {savingName ? 'Saving...' : 'Save Name'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
