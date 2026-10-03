import React, { useState, useEffect } from 'react';
import { ShieldCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';
import '../components/register.css';

const RegisterPage: React.FC = () => {
  const [name, setName]                         = useState('');
  const [email, setEmail]                       = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword]                 = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [showPassword, setShowPassword]         = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [error, setError]                       = useState('');
  const [successMsg, setSuccessMsg]             = useState('');
  const [loading, setLoading]                   = useState(false);
  const [sendingCode, setSendingCode]           = useState(false);
  const [codeSent, setCodeSent]                 = useState(false);
  const [resendTimer, setResendTimer]           = useState(0);

  const navigate = useNavigate();
  const BACKEND_URL = API_BASE_URL;

  // Countdown timer for resending verification code
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleSendCode = async () => {
    setError('');
    setSuccessMsg('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address first.');
      return;
    }

    setSendingCode(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || 'Failed to send verification code.');
        return;
      }

      setCodeSent(true);
      setSuccessMsg('Verification code sent! Please check your email inbox.');
      setResendTimer(60);
    } catch (err) {
      console.error('Send verification code failed', err);
      setError('Cannot connect to server. Check your connection.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!verificationCode.trim()) {
      setError('Please enter the verification code sent to your email.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          verificationCode: verificationCode.trim(),
          password,
          role: 'Admin',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || 'Registration failed. Please try again.');
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

            {/* Full Name */}
            <div className="input-group">
              <label className="label-sm">Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Email + Send Code Button */}
            <div className="input-group">
              <label className="label-sm">Email Address</label>
              <div className="input-with-button">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="text-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn-send-code"
                  onClick={handleSendCode}
                  disabled={sendingCode || resendTimer > 0}
                >
                  {sendingCode
                    ? 'Sending...'
                    : resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : codeSent
                    ? 'Resend Code'
                    : 'Send Code'}
                </button>
              </div>
            </div>

            {/* Verification Code */}
            <div className="input-group">
              <label className="label-sm">Verification Code</label>
              <input
                type="text"
                placeholder="Enter 6-digit code sent to email"
                className="text-input"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
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

            {/* Success message */}
            {successMsg && (
              <p className="success-message">
                <CheckCircle2 size={14} /> {successMsg}
              </p>
            )}

            {/* Error message */}
            {error && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '13px', color: '#475569' }}>
            Already have an account?{' '}
            <span
              style={{ color: '#ea580c', fontWeight: 'bold', cursor: 'pointer' }}
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
