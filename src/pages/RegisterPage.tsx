import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../components/register.css';

const RegisterPage: React.FC = () => {
  const [role, setRole]             = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  {/*const [agreed, setAgreed]         = useState(false);*/}
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const navigate = useNavigate();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!role) {
      setError('Please select a role.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password do not match.');
      return;
    }
    {/*if (!agreed) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }*/}

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }

      navigate('/login');
    } catch (err) {
      console.error('Register failed', err);
      setError('Cannot connect to server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">

      {/* ── LEFT PANEL — branding ── */}
      <div className="right-panel">
        <h1 className="heading-xl">Join the Future of Site Management with SitePulse</h1>
        <p className="quote-text">
          "With its smart design and efficient workflow, SitePulse empowers every engineer
          to work faster, smarter, and with complete confidence in their data."
        </p>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="left-panel">
        <div className="header-blue">
          <h1 className="welcome-title">Create Account</h1>
          <p className="subtitle">Real Time Field-Tracking and Issue Reporting</p>
        </div>

        <div className="rform-section">
          <form onSubmit={handleRegister}>

            {/* Role Dropdown */}
            <div className="input-group">
              <label className="label-sm">Role</label>
              <select
                className="text-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                style={{ backgroundColor: '#F9F9F9', cursor: 'pointer', color: role ? '#1a1a1a' : '#aaa' }}
              >
                <option value="" disabled>Select your role</option>
                <option value="Admin">Admin</option>
                <option value="Site Engineer">Site Engineer</option>
              </select>
            </div>

            {/* Email */}
            <div className="input-group">
              <label className="label-sm">Username / Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                className="text-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="input-group">
              <label className="label-sm">Password</label>
              <div className="pass-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  className="text-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ backgroundColor: '#F9F9F9', paddingRight: '2.5rem' }}
                />
                <span onClick={() => setShowPassword(!showPassword)} style={{ cursor: 'pointer' }}>
                  {showPassword
                    ? <Eye className="eye-btn" size={18} />
                    : <EyeOff className="eye-btn" size={18} />
                  }
                </span>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="input-group">
              <label className="label-sm">Confirm Password</label>
              <div className="pass-wrapper">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  className="text-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ backgroundColor: '#F9F9F9', paddingRight: '2.5rem' }}
                />
                <span onClick={() => setShowConfirm(!showConfirm)} style={{ cursor: 'pointer' }}>
                  {showConfirm
                    ? <Eye className="eye-btn" size={18} />
                    : <EyeOff className="eye-btn" size={18} />
                  }
                </span>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p style={{ color: 'red', fontSize: '12px', marginBottom: '8px' }}>
                {error}
              </p>
            )}

            {/* Terms checkbox */}
            {/*<div className="row-links" style={{ alignItems: 'flex-start' }}>
              <label className="check-item" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                  I agree to SitePulse's{' '}
                  <a href="#" className="blue-link">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="blue-link">Privacy Policy</a>
                </span>
              </label>
            </div>*/}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '13px', color: '#475569' }}>
            Already have an account?{' '}
            <span
              style={{ color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => navigate('/login')}
            >
              Sign in
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

    </div>
  );
};

export default RegisterPage;