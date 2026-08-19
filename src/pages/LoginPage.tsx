import React, { useState } from 'react';
import { ShieldCheck, EyeOff, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';
import '../components/login.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const BACKEND_URL = API_BASE_URL;

  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('remember_me') === 'true';
  });

  // Pre-fill email if remembered
  React.useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) setEmail(savedEmail);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password}),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }

      // Restrict web portal access to Admin users only
      if (data.user?.role && data.user.role !== 'Admin') {
        setError('Access Restricted: Only Administrators can log in to the web management portal. Site Engineers and field personnel must use the SitePulse mobile app.');
        return;
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remember_me');
        localStorage.removeItem('remembered_email');
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Login failed', err);
      setError('Cannot connect to server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    alert('Password resets are managed by your System Administrator. Please contact your organization admin or update your password in Settings > Security.');
  };

  return (
    <div className="login-wrapper">
      <div className="left-panel">
        <div className="header-blue">
          <h1 className="welcome-title">Welcome back !</h1>
          <p className="subtitle">Real Time Field-Tracking and Issue Reporting</p>
        </div>

        <div className="form-section">
          <form onSubmit={handleLogin}>

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
                  style={{ backgroundColor: '#F9F9F9', paddingRight: '2.5rem' }}
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
              <label className="check-item" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                /> Remember me
              </label>
              <a href="#" className="blue-link" onClick={handleForgotPassword}>Forgot Password?</a>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="signup-text" style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '13px' }}>
            Don't have an account?{' '}
            <span
              style={{ color: '#ea580c', fontWeight: 'bold', cursor: 'pointer' }}
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
        
      </div>
    </div>
  );
};

export default LoginPage;
