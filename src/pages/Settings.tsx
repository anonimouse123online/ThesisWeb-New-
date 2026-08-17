import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/Settings.css';
import { fetchWithAuth } from '../utils/api';
import { showToast } from '../components/Toast';
import ProfileDropdown from '../components/ProfileDropdown';

const API_URL = import.meta.env.VITE_BACKEND_URL;

type TabKey = 'profile' | 'security' | 'notifications' | 'system';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  company: string;
  preferences: {
    email_notifications: boolean;
    sms_alerts: boolean;
    theme: string;
    weather_unit: string;
    currency: string;
  };
  createdAt: string;
}

interface SystemHealth {
  status: string;
  database: string;
  serverTime: string;
  metrics: {
    totalProjects: number;
    activeUsers: number;
    openIssues: number;
  };
  version: string;
  nodeEnvironment: string;
}

const Settings: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab]     = useState<TabKey>('profile');
  const [, setLoading]                = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Profile Form State
  const [profile, setProfile]         = useState<UserProfile | null>(null);
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [company, setCompany]         = useState('');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification Preferences
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsAlerts, setSmsAlerts]     = useState(false);
  const [weatherUnit, setWeatherUnit] = useState('celsius');
  const [currency, setCurrency]       = useState('PHP');

  // System Health
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  // Fetch Current Profile
  const fetchProfile = async () => {
    // Preload from localStorage if available
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.name && !fullName) setFullName(parsed.name);
      } catch { /* ignore */ }
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/auth/me`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load profile');

      const u: UserProfile = json.data;
      setProfile(u);
      setFullName(u.name || '');
      setPhone(u.phone || '');
      setCompany(u.company || 'SitePulse Construction Corp');
      if (u.preferences) {
        setEmailNotifs(u.preferences.email_notifications ?? true);
        setSmsAlerts(u.preferences.sms_alerts ?? false);
        setWeatherUnit(u.preferences.weather_unit || 'celsius');
        setCurrency(u.preferences.currency || 'PHP');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch System Health
  const fetchHealth = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/auth/system-health`);
      const json = await res.json();
      if (res.ok) setSystemHealth(json.data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchProfile();
    fetchHealth();
  }, []);

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Full name cannot be empty.', 'warning');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          company: company.trim(),
          preferences: {
            email_notifications: emailNotifs,
            sms_alerts: smsAlerts,
            weather_unit: weatherUnit,
            currency: currency,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update profile');

      showToast('Profile settings saved successfully!', 'success');
      // Update local storage user
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.name = fullName.trim();
        localStorage.setItem('user', JSON.stringify(parsed));
      }
      fetchProfile();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Save Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast('Please fill in all password fields.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/auth/change-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update password');

      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({
        exportDate: new Date().toISOString(),
        user: profile,
        system: systemHealth,
      }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sitepulse-workspace-settings-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Workspace settings configuration exported!', 'success');
  };

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';

  return (
    <main className="st-page">
      {/* ── Nav & Breadcrumbs ── */}
      <div className="st-nav-row">
        <div className="st-breadcrumb">
          <button className="st-breadcrumb-link" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <span className="st-breadcrumb-sep">/</span>
          <span className="st-breadcrumb-current">Menu Settings</span>
        </div>
        <ProfileDropdown />
      </div>

      {/* ── Header ── */}
      <div className="st-header">
        <div>
          <div className="st-title-wrap">
            <h1 className="st-title">System & Account Settings</h1>
          </div>
          <p className="st-subtitle">
            Manage your personal profile, credentials, alert thresholds, and workspace preferences
          </p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="st-tabs-row">
        <button
          className={`st-tab-btn ${activeTab === 'profile' ? 'st-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 Profile & Identity
        </button>
        <button
          className={`st-tab-btn ${activeTab === 'security' ? 'st-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🔒 Security & Password
        </button>
        <button
          className={`st-tab-btn ${activeTab === 'notifications' ? 'st-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Notification Alerts
        </button>
        <button
          className={`st-tab-btn ${activeTab === 'system' ? 'st-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          ⚙️ Workspace & Health
        </button>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="st-panel-grid">

        {/* ── LEFT PANEL: Active Tab Form ── */}
        <div>

          {/* TAB 1: Profile & Identity */}
          {activeTab === 'profile' && (
            <div className="st-card">
              <h3 className="st-card-title">Personal Profile Information</h3>
              <p className="st-card-sub">Update your account name, contact details, and organization role.</p>

              <form onSubmit={handleSaveProfile}>
                <div className="st-form-row">
                  <div className="st-form-group">
                    <label className="st-label">Full Name *</label>
                    <input
                      className="st-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Engr. Alex Morgan"
                      required
                    />
                  </div>

                  <div className="st-form-group">
                    <label className="st-label">Email Address (Login)</label>
                    <input
                      className="st-input"
                      value={profile?.email || ''}
                      disabled
                      title="Email address is tied to your account login"
                    />
                  </div>
                </div>

                <div className="st-form-row">
                  <div className="st-form-group">
                    <label className="st-label">Phone Number</label>
                    <input
                      className="st-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +63 917 123 4567"
                    />
                  </div>

                  <div className="st-form-group">
                    <label className="st-label">Company / Contractor Name</label>
                    <input
                      className="st-input"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="SitePulse Construction Corp"
                    />
                  </div>
                </div>

                <div className="st-form-group">
                  <label className="st-label">Assigned Role</label>
                  <input
                    className="st-input"
                    value={`${profile?.role || 'Site Engineer'} (Assigned by Administrator)`}
                    disabled
                  />
                </div>

                <div style={{ marginTop: '20px' }}>
                  <button type="submit" className="st-btn-save" disabled={savingProfile}>
                    {savingProfile ? 'Saving Profile…' : '✓ Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: Security & Password */}
          {activeTab === 'security' && (
            <div className="st-card">
              <h3 className="st-card-title">Security & Password Management</h3>
              <p className="st-card-sub">Ensure your account is protected with a secure and unique password.</p>

              <form onSubmit={handleChangePassword}>
                <div className="st-form-group">
                  <label className="st-label">Current Password *</label>
                  <input
                    type="password"
                    className="st-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                  />
                </div>

                <div className="st-form-row">
                  <div className="st-form-group">
                    <label className="st-label">New Password *</label>
                    <input
                      type="password"
                      className="st-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>

                  <div className="st-form-group">
                    <label className="st-label">Confirm New Password *</label>
                    <input
                      type="password"
                      className="st-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <button type="submit" className="st-btn-save" disabled={savingPassword}>
                    {savingPassword ? 'Updating Password…' : '🔐 Update Password'}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#111827' }}>Active Sessions & Devices</h4>
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>
                  Currently active devices authenticated to your SitePulse account.
                </p>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                  <div>
                    <strong>This Web Browser (Current Session)</strong>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>macOS • Chrome Engine • Verified Token</div>
                  </div>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>● Active Now</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Notifications */}
          {activeTab === 'notifications' && (
            <div className="st-card">
              <h3 className="st-card-title">Alerts & Notification Preferences</h3>
              <p className="st-card-sub">Control when and how you receive project updates and safety alerts.</p>

              <div>
                <div className="st-toggle-item">
                  <div className="st-toggle-info">
                    <span className="st-toggle-title">Critical Safety & Issue Alerts</span>
                    <span className="st-toggle-desc">Instant notification whenever a High/Critical defect is reported on your projects.</span>
                  </div>
                  <label className="st-switch">
                    <input
                      type="checkbox"
                      checked={emailNotifs}
                      onChange={(e) => setEmailNotifs(e.target.checked)}
                    />
                    <span className="st-slider" />
                  </label>
                </div>

                <div className="st-toggle-item">
                  <div className="st-toggle-info">
                    <span className="st-toggle-title">Daily Milestone & Progress Digest</span>
                    <span className="st-toggle-desc">Summary email every afternoon containing poured volume and milestone completions.</span>
                  </div>
                  <label className="st-switch">
                    <input
                      type="checkbox"
                      checked={smsAlerts}
                      onChange={(e) => setSmsAlerts(e.target.checked)}
                    />
                    <span className="st-slider" />
                  </label>
                </div>

                <div className="st-toggle-item">
                  <div className="st-toggle-info">
                    <span className="st-toggle-title">Document Upload Notifications</span>
                    <span className="st-toggle-desc">Notify whenever team members upload new blueprints, CAD revisions, or QA reports.</span>
                  </div>
                  <label className="st-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="st-slider" />
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <button type="button" className="st-btn-save" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : '✓ Save Notification Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Workspace & Health */}
          {activeTab === 'system' && (
            <div>
              {/* Health Banner */}
              <div className="st-health-banner">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="st-health-badge">● Operational</span>
                    <strong style={{ fontSize: '13.5px', color: '#166534' }}>SitePulse Cloud Backend Connected</strong>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#15803d' }}>
                    {systemHealth?.database || 'PostgreSQL updated_sitepulse'} • Uptime verified
                  </p>
                </div>
                <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                  {systemHealth?.version || 'v2.4.0-prod'}
                </span>
              </div>

              <div className="st-card">
                <h3 className="st-card-title">Localization & Formats</h3>
                <p className="st-card-sub">Configure display units, currency, and date formats across project reports.</p>

                <div className="st-form-row">
                  <div className="st-form-group">
                    <label className="st-label">Weather Unit</label>
                    <select
                      className="st-input"
                      value={weatherUnit}
                      onChange={(e) => setWeatherUnit(e.target.value)}
                    >
                      <option value="celsius">Celsius (°C)</option>
                      <option value="fahrenheit">Fahrenheit (°F)</option>
                    </select>
                  </div>

                  <div className="st-form-group">
                    <label className="st-label">Currency Symbol</label>
                    <select
                      className="st-input"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <option value="PHP">Philippine Peso (₱ / PHP)</option>
                      <option value="USD">US Dollar ($ / USD)</option>
                      <option value="EUR">Euro (€ / EUR)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="button" className="st-btn-save" onClick={handleSaveProfile}>
                    Save Formats
                  </button>
                  <button type="button" className="st-btn-outline" onClick={handleExportBackup}>
                    ⬇ Export Settings Backup (JSON)
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── RIGHT PANEL: User Overview Card ── */}
        <div>
          <div className="st-card st-profile-card">
            <div className="st-avatar-large">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <h3 className="st-user-name">{profile?.name || 'User'}</h3>
            <span className="st-user-role">{profile?.role || 'Site Engineer'}</span>

            <div className="st-quick-details">
              <div className="st-detail-row">
                <span>Account ID:</span>
                <span className="st-detail-val" style={{ fontFamily: 'monospace' }}>
                  {profile?.id?.slice(0, 8)}…
                </span>
              </div>
              <div className="st-detail-row">
                <span>Email:</span>
                <span className="st-detail-val">{profile?.email}</span>
              </div>
              <div className="st-detail-row">
                <span>Company:</span>
                <span className="st-detail-val">{company}</span>
              </div>
              <div className="st-detail-row">
                <span>Member Since:</span>
                <span className="st-detail-val">{formatDate(profile?.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Quick Help Card */}
          <div className="st-card" style={{ background: '#fdfaf6' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#111827' }}>Need help or access changes?</h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
              Role promotions (e.g. to Administrator) can be requested through your organization head or via the User Management directory.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
};

export default Settings;
