import React, { useState } from 'react';
import { ShieldCheck, EyeOff, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../components/login.css';

const LoginPage: React.FC = () => {
  const [role, setRole] = useState<'Site Engineer' | 'Admin'>('Site Engineer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      navigate('/dashboard');
    } catch (err) {
      console.error('Login failed', err);
      setError('Cannot connect to server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="left-panel">
        <div className="header-blue">
          <div className="logo-label">Site Pulse</div>
          <h1 className="welcome-title">Welcome back !</h1>
          <p className="subtitle">Real Time Field-Tracking and Issue Reporting</p>
        </div>

        <div className="form-section">
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="label-sm">Access Role</label>
              <div className="role-container">
                <button
                  type="button"
                  className={`role-tab ${role === 'Site Engineer' ? 'active' : ''}`}
                  onClick={() => setRole('Site Engineer')}
                >
                  Site Engineer
                </button>
                <button
                  type="button"
                  className={`role-tab ${role === 'Admin' ? 'active' : ''}`}
                  onClick={() => setRole('Admin')}
                >
                  Admin
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="label-sm">Username / Email</label>
              <input
                type="text"
                placeholder="Enter your email"
                className="text-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="label-sm">Password</label>
              <div className="pass-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="text-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {/* Toggle password visibility */}
                <span onClick={() => setShowPassword(!showPassword)} style={{ cursor: 'pointer' }}>
                  {showPassword
                    ? <Eye className="eye-btn" size={18} />
                    : <EyeOff className="eye-btn" size={18} />
                  }
                </span>
              </div>
            </div>

            {/* Show error message from backend */}
            {error && (
              <p style={{ color: 'red', fontSize: '12px', marginBottom: '8px' }}>
                {error}
              </p>
            )}

            <div className="row-links">
              <label className="check-item">
                <input type="checkbox" /> Remember me
              </label>
              <a href="#" className="blue-link">Forgot Password?</a>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="signup-text" style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '13px' }}>
            Don't have an account?{' '}
            <span
              style={{ color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => navigate('/signup')}
            >
              Sign up
            </span>
          </p>

          <div className="shield-box" style={{ display: 'flex', gap: '10px', marginTop: '2rem' }}>
            <ShieldCheck size={28} color="#0e7490" />
            <p style={{ fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>
              All activities are time-stamped and audit-tracked.<br />
              Your session is secured with end-to-end encryption.
            </p>
          </div>
        </div>
      </div>

      <div className="right-panel">
        <h1 className="heading-xl">Revolutionize Site Management with SitePulse</h1>
        <p className="quote-text">
          "With its smart design and efficient workflow, SitePulse empowers every engineer
          to work faster, smarter, and with complete confidence in their data."
        </p>
        <div className="user-card">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/e/ed/Elon_Musk_Royal_Society.jpg"
            alt="Yelong Mhu"
            className="user-avatar"
          />
          <div>
            <div className="user-name">Yelong Mhu</div>
            <div className="user-title">Head Engineer at Fedillaga Builders</div>
          </div>
        </div>
        <div className="teams-row">
          <span>JOIN 1K TEAMS</span>
          <div className="divider"></div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;