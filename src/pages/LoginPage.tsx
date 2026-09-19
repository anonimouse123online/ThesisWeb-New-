import React, { useState } from 'react';
import {
  ShieldCheck,
  EyeOff,
  Eye,
  X,
  Mail,
  KeyRound,
  CheckCircle,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';
import '../components/login.css';

const LoginPage: React.FC = () => {
  // ============================================================
  // LOGIN STATE
  // ============================================================

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const navigate =
    useNavigate();

  const BACKEND_URL =
    API_BASE_URL;


  // ============================================================
  // REMEMBER ME
  // ============================================================

  const [rememberMe, setRememberMe] =
    useState(() => {
      return (
        localStorage.getItem('remember_me') ===
        'true'
      );
    });


  React.useEffect(() => {
    const savedEmail =
      localStorage.getItem(
        'remembered_email'
      );

    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);


  // ============================================================
  // FORGOT PASSWORD STATE
  //
  // STEP 1 = EMAIL
  // STEP 2 = OTP
  // STEP 3 = NEW PASSWORD
  // STEP 4 = SUCCESS
  // ============================================================

  const [showForgotPassword, setShowForgotPassword] =
    useState(false);

  const [resetStep, setResetStep] =
    useState(1);

  const [resetEmail, setResetEmail] =
    useState('');

  const [otp, setOtp] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [resetMessage, setResetMessage] =
    useState('');

  const [resetError, setResetError] =
    useState('');

  const [resetLoading, setResetLoading] =
    useState(false);


  // ============================================================
  // LOGIN
  // ============================================================

  const handleLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      console.log(
        'Attempting login...'
      );

      const response =
        await fetch(
          `${BACKEND_URL}/auth/login`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              email:
                email
                  .trim()
                  .toLowerCase(),

              password,
            }),
          }
        );


      const data =
        await response.json();


      console.log(
        'LOGIN STATUS:',
        response.status
      );

      console.log(
        'LOGIN RESPONSE:',
        data
      );

      console.log(
        'LOGIN ROLE:',
        data.user?.role
      );

      console.log(
        'TOKEN RECEIVED:',
        data.token
          ? 'YES'
          : 'NO'
      );


      if (!response.ok) {
        setError(
          data.error ||
          data.message ||
          'Login failed. Please try again.'
        );

        return;
      }


      if (
        !data.token ||
        !data.user
      ) {
        setError(
          'Invalid login response from server.'
        );

        return;
      }


      // ========================================================
      // ONLY ADMIN CAN ACCESS WEB
      // ========================================================

      const userRole =
        data.user.role
          ?.trim()
          .toLowerCase();


      if (
        userRole !== 'admin'
      ) {
        setError(
          'Access Restricted: Only Administrators can log in to the web management portal. Site Engineers and field personnel must use the SitePulse mobile app.'
        );

        return;
      }


      // ========================================================
      // SAVE AUTH
      // ========================================================

      localStorage.setItem(
        'token',
        data.token
      );

      localStorage.setItem(
        'user',
        JSON.stringify(
          data.user
        )
      );


      if (rememberMe) {
        localStorage.setItem(
          'remember_me',
          'true'
        );

        localStorage.setItem(
          'remembered_email',
          email
            .trim()
            .toLowerCase()
        );
      } else {
        localStorage.removeItem(
          'remember_me'
        );

        localStorage.removeItem(
          'remembered_email'
        );
      }


      navigate(
        '/dashboard',
        {
          replace: true,
        }
      );

    } catch (err) {
      console.error(
        'Login failed:',
        err
      );

      setError(
        'Cannot connect to server. Check your connection.'
      );

    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // OPEN FORGOT PASSWORD
  // ============================================================

  const handleForgotPassword = (
    e: React.MouseEvent
  ) => {
    e.preventDefault();

    setResetStep(1);

    // Pre-fill reset email using login email
    setResetEmail(
      email
        .trim()
        .toLowerCase()
    );

    setOtp('');
    setNewPassword('');
    setConfirmPassword('');

    setResetError('');
    setResetMessage('');

    setShowForgotPassword(
      true
    );
  };


  // ============================================================
  // CLOSE FORGOT PASSWORD
  // ============================================================

  const closeForgotPassword = () => {
    if (resetLoading) {
      return;
    }

    setShowForgotPassword(
      false
    );

    setResetStep(1);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetMessage('');
  };


  // ============================================================
  // SEND OTP
  // ============================================================

  const handleSendCode =
    async () => {

      const cleanEmail =
        resetEmail
          .trim()
          .toLowerCase();


      setResetError('');
      setResetMessage('');


      if (!cleanEmail) {
        setResetError(
          'Please enter your email address.'
        );

        return;
      }


      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


      if (
        !emailRegex.test(
          cleanEmail
        )
      ) {
        setResetError(
          'Please enter a valid email address.'
        );

        return;
      }


      setResetLoading(
        true
      );


      try {
        console.log(
          'Sending reset code to:',
          cleanEmail
        );


        const response =
          await fetch(
            `${BACKEND_URL}/auth/forgot-password`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  email:
                    cleanEmail,
                }),
            }
          );


        const data =
          await response.json();


        console.log(
          'FORGOT PASSWORD STATUS:',
          response.status
        );

        console.log(
          'FORGOT PASSWORD RESPONSE:',
          data
        );


        if (!response.ok) {
          setResetError(
            data.message ||
            data.error ||
            'Unable to send verification code.'
          );

          return;
        }


        setResetEmail(
          cleanEmail
        );

        setResetStep(
          2
        );

        setResetMessage(
          data.message ||
          'Verification code sent successfully.'
        );

      } catch (err) {
        console.error(
          'FORGOT PASSWORD ERROR:',
          err
        );

        setResetError(
          'Cannot connect to the server.'
        );

      } finally {
        setResetLoading(
          false
        );
      }
    };


  // ============================================================
  // VERIFY OTP
  // ============================================================

  const handleVerifyOtp =
    async () => {

      setResetError('');
      setResetMessage('');


      if (
        otp.length !== 6
      ) {
        setResetError(
          'Please enter the 6-digit verification code.'
        );

        return;
      }


      setResetLoading(
        true
      );


      try {
        console.log(
          'Verifying OTP...'
        );


        const response =
          await fetch(
            `${BACKEND_URL}/auth/verify-reset-code`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  email:
                    resetEmail,

                  code:
                    otp,
                }),
            }
          );


        const data =
          await response.json();


        console.log(
          'VERIFY OTP STATUS:',
          response.status
        );

        console.log(
          'VERIFY OTP RESPONSE:',
          data
        );


        if (!response.ok) {
          setResetError(
            data.message ||
            data.error ||
            'Incorrect or expired verification code.'
          );

          return;
        }


        setResetStep(
          3
        );

        setResetMessage(
          'Verification successful. Create your new password.'
        );

      } catch (err) {
        console.error(
          'VERIFY OTP ERROR:',
          err
        );

        setResetError(
          'Unable to verify the verification code.'
        );

      } finally {
        setResetLoading(
          false
        );
      }
    };


  // ============================================================
  // RESET PASSWORD
  // ============================================================

  const handleResetPassword =
    async () => {

      setResetError('');
      setResetMessage('');


      if (
        newPassword.length < 8
      ) {
        setResetError(
          'Password must contain at least 8 characters.'
        );

        return;
      }


      if (
        newPassword !==
        confirmPassword
      ) {
        setResetError(
          'Passwords do not match.'
        );

        return;
      }


      setResetLoading(
        true
      );


      try {
        console.log(
          'Resetting password...'
        );


        const response =
          await fetch(
            `${BACKEND_URL}/auth/reset-password`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  email:
                    resetEmail,

                  code:
                    otp,

                  newPassword:
                    newPassword,
                }),
            }
          );


        const data =
          await response.json();


        console.log(
          'RESET PASSWORD STATUS:',
          response.status
        );

        console.log(
          'RESET PASSWORD RESPONSE:',
          data
        );


        if (!response.ok) {
          setResetError(
            data.message ||
            data.error ||
            'Unable to reset password.'
          );

          return;
        }


        // Put reset email back in login field
        setEmail(
          resetEmail
        );

        setPassword(
          ''
        );


        setResetStep(
          4
        );

        setResetMessage(
          data.message ||
          'Password successfully changed.'
        );

      } catch (err) {
        console.error(
          'RESET PASSWORD ERROR:',
          err
        );

        setResetError(
          'Cannot connect to the server.'
        );

      } finally {
        setResetLoading(
          false
        );
      }
    };


  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <>
      <div className="login-wrapper">

        {/* ====================================================
            LEFT PANEL
        ==================================================== */}

        <div className="left-panel">

          <div className="header-blue">

            <h1 className="welcome-title">
              Welcome back !
            </h1>

            <p className="subtitle">
              Real Time Field-Tracking and Issue Reporting
            </p>

          </div>


          <div className="form-section">

            <form
              onSubmit={
                handleLogin
              }
            >

              {/* EMAIL */}

              <div className="input-group">

                <label className="label-sm">
                  Username / Email
                </label>

                <input
                  type="text"
                  placeholder="Enter your email"
                  className="text-input"
                  value={email}

                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }

                  required
                />

              </div>


              {/* PASSWORD */}

              <div className="input-group">

                <label className="label-sm">
                  Password
                </label>


                <div className="pass-wrapper">

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }

                    placeholder="Enter your password"

                    className="text-input"

                    value={
                      password
                    }

                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }

                    required

                    style={{
                      backgroundColor:
                        '#F9F9F9',

                      paddingRight:
                        '2.5rem',
                    }}
                  />


                  <span
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }

                    style={{
                      cursor:
                        'pointer',
                    }}
                  >

                    {showPassword ? (
                      <Eye
                        className="eye-btn"
                        size={18}
                      />
                    ) : (
                      <EyeOff
                        className="eye-btn"
                        size={18}
                      />
                    )}

                  </span>

                </div>

              </div>


              {/* LOGIN ERROR */}

              {error && (
                <p
                  style={{
                    color:
                      '#dc2626',

                    fontSize:
                      '12px',

                    marginBottom:
                      '8px',
                  }}
                >
                  {error}
                </p>
              )}


              {/* REMEMBER + FORGOT PASSWORD */}

              <div className="row-links">

                <label
                  className="check-item"

                  style={{
                    cursor:
                      'pointer',
                  }}
                >

                  <input
                    type="checkbox"

                    checked={
                      rememberMe
                    }

                    onChange={(e) =>
                      setRememberMe(
                        e.target.checked
                      )
                    }
                  />

                  {' '}
                  Remember me

                </label>


                <a
                  href="#"

                  className="blue-link"

                  onClick={
                    handleForgotPassword
                  }
                >
                  Forgot Password?
                </a>

              </div>


              {/* LOGIN BUTTON */}

              <button
                type="submit"

                className="btn-submit"

                disabled={
                  loading
                }
              >

                {loading
                  ? 'Signing in...'
                  : 'Sign In'
                }

              </button>

            </form>


            {/* SIGNUP */}

            <p
              className="signup-text"

              style={{
                textAlign:
                  'center',

                marginTop:
                  '1.5rem',

                fontSize:
                  '13px',
              }}
            >

              Don't have an account?{' '}

              <span
                style={{
                  color:
                    '#ea580c',

                  fontWeight:
                    'bold',

                  cursor:
                    'pointer',
                }}

                onClick={() =>
                  navigate(
                    '/signup'
                  )
                }
              >
                Sign up
              </span>

            </p>


            {/* SECURITY */}

            <div
              className="shield-box"

              style={{
                display:
                  'flex',

                gap:
                  '10px',

                marginTop:
                  '2rem',
              }}
            >

              <ShieldCheck
                size={28}
                color="#0e7490"
              />

              <p
                style={{
                  fontSize:
                    '11px',

                  color:
                    '#475569',

                  lineHeight:
                    '1.4',
                }}
              >

                All activities are time-stamped and audit-tracked.
                <br />

                Your session is secured with end-to-end encryption.

              </p>

            </div>

          </div>

        </div>


        {/* ====================================================
            RIGHT PANEL
        ==================================================== */}

        <div className="right-panel">

          <h1 className="heading-xl">
            Revolutionize Site Management with SitePulse
          </h1>

          <p className="quote-text">

            "With its smart design and efficient workflow,
            SitePulse empowers every engineer to work faster,
            smarter, and with complete confidence in their data."

          </p>

        </div>

      </div>


      {/* ======================================================
          FORGOT PASSWORD MODAL
      ====================================================== */}

      {showForgotPassword && (

        <div
          style={{
            position:
              'fixed',

            inset:
              0,

            backgroundColor:
              'rgba(15, 23, 42, 0.55)',

            display:
              'flex',

            justifyContent:
              'center',

            alignItems:
              'center',

            zIndex:
              9999,

            padding:
              '20px',
          }}
        >

          <div
            style={{
              width:
                '100%',

              maxWidth:
                '440px',

              backgroundColor:
                '#ffffff',

              borderRadius:
                '18px',

              padding:
                '28px',

              boxShadow:
                '0 20px 60px rgba(0,0,0,0.22)',

              position:
                'relative',
            }}
          >

            {/* CLOSE */}

            {resetStep !== 4 && (

              <button
                type="button"

                onClick={
                  closeForgotPassword
                }

                disabled={
                  resetLoading
                }

                style={{
                  position:
                    'absolute',

                  right:
                    '18px',

                  top:
                    '18px',

                  border:
                    'none',

                  background:
                    'transparent',

                  cursor:
                    'pointer',

                  color:
                    '#64748b',
                }}
              >

                <X size={20} />

              </button>

            )}


            {/* ==================================================
                STEP 1 EMAIL
            ================================================== */}

            {resetStep === 1 && (

              <>

                <div
                  style={{
                    width:
                      '50px',

                    height:
                      '50px',

                    borderRadius:
                      '14px',

                    backgroundColor:
                      '#fff7ed',

                    display:
                      'flex',

                    alignItems:
                      'center',

                    justifyContent:
                      'center',

                    marginBottom:
                      '18px',

                    color:
                      '#ea580c',
                  }}
                >

                  <Mail size={24} />

                </div>


                <h2
                  style={{
                    margin:
                      '0 0 8px',

                    color:
                      '#0f172a',
                  }}
                >
                  Forgot Password?
                </h2>


                <p
                  style={{
                    color:
                      '#64748b',

                    fontSize:
                      '13px',

                    lineHeight:
                      '1.6',

                    marginBottom:
                      '22px',
                  }}
                >
                  Enter the email address registered with your SitePulse account.
                  We will send you a 6-digit verification code.
                </p>


                <label
                  style={{
                    display:
                      'block',

                    fontSize:
                      '13px',

                    fontWeight:
                      600,

                    marginBottom:
                      '7px',

                    color:
                      '#334155',
                  }}
                >
                  Email Address
                </label>


                <input
                  type="email"

                  value={
                    resetEmail
                  }

                  onChange={(e) => {
                    setResetEmail(
                      e.target.value
                    );

                    setResetError('');
                  }}

                  placeholder="Enter your email"

                  disabled={
                    resetLoading
                  }

                  style={
                    modalInputStyle
                  }
                />


                <ResetMessage
                  error={
                    resetError
                  }

                  message={
                    resetMessage
                  }
                />


                <button
                  type="button"

                  onClick={
                    handleSendCode
                  }

                  disabled={
                    resetLoading
                  }

                  style={
                    modalPrimaryButton
                  }
                >

                  {resetLoading
                    ? 'Sending...'
                    : 'Send Verification Code'
                  }

                </button>

              </>

            )}


            {/* ==================================================
                STEP 2 OTP
            ================================================== */}

            {resetStep === 2 && (

              <>

                <div
                  style={{
                    width:
                      '50px',

                    height:
                      '50px',

                    borderRadius:
                      '14px',

                    backgroundColor:
                      '#fff7ed',

                    display:
                      'flex',

                    alignItems:
                      'center',

                    justifyContent:
                      'center',

                    marginBottom:
                      '18px',

                    color:
                      '#ea580c',
                  }}
                >

                  <KeyRound size={24} />

                </div>


                <h2
                  style={{
                    margin:
                      '0 0 8px',

                    color:
                      '#0f172a',
                  }}
                >
                  Verify Code
                </h2>


                <p
                  style={{
                    color:
                      '#64748b',

                    fontSize:
                      '13px',

                    lineHeight:
                      '1.6',

                    marginBottom:
                      '22px',
                  }}
                >

                  Enter the 6-digit verification code sent to{' '}

                  <strong>
                    {resetEmail}
                  </strong>.

                </p>


                <input
                  type="text"

                  inputMode="numeric"

                  maxLength={6}

                  value={
                    otp
                  }

                  onChange={(e) => {

                    const value =
                      e.target.value.replace(
                        /\D/g,
                        ''
                      );

                    setOtp(
                      value
                    );

                    setResetError('');
                  }}

                  placeholder="000000"

                  disabled={
                    resetLoading
                  }

                  style={{
                    ...modalInputStyle,

                    textAlign:
                      'center',

                    fontSize:
                      '26px',

                    fontWeight:
                      700,

                    letterSpacing:
                      '10px',
                  }}
                />


                <ResetMessage
                  error={
                    resetError
                  }

                  message={
                    resetMessage
                  }
                />


                <button
                  type="button"

                  onClick={
                    handleVerifyOtp
                  }

                  disabled={
                    resetLoading
                  }

                  style={
                    modalPrimaryButton
                  }
                >

                  {resetLoading
                    ? 'Verifying...'
                    : 'Verify Code'
                  }

                </button>


                <button
                  type="button"

                  disabled={
                    resetLoading
                  }

                  onClick={() => {

                    setResetStep(
                      1
                    );

                    setResetMessage('');
                    setResetError('');

                  }}

                  style={
                    modalSecondaryButton
                  }
                >
                  Back
                </button>


                <button
                  type="button"

                  disabled={
                    resetLoading
                  }

                  onClick={
                    handleSendCode
                  }

                  style={{
                    ...modalSecondaryButton,

                    color:
                      '#ea580c',
                  }}
                >
                  Resend Code
                </button>

              </>

            )}


            {/* ==================================================
                STEP 3 NEW PASSWORD
            ================================================== */}

            {resetStep === 3 && (

              <>

                <div
                  style={{
                    width:
                      '50px',

                    height:
                      '50px',

                    borderRadius:
                      '14px',

                    backgroundColor:
                      '#fff7ed',

                    display:
                      'flex',

                    alignItems:
                      'center',

                    justifyContent:
                      'center',

                    marginBottom:
                      '18px',

                    color:
                      '#ea580c',
                  }}
                >

                  <ShieldCheck size={24} />

                </div>


                <h2
                  style={{
                    margin:
                      '0 0 8px',

                    color:
                      '#0f172a',
                  }}
                >
                  Create New Password
                </h2>


                <p
                  style={{
                    color:
                      '#64748b',

                    fontSize:
                      '13px',

                    lineHeight:
                      '1.6',

                    marginBottom:
                      '22px',
                  }}
                >
                  Enter your new password below.
                </p>


                <label
                  style={{
                    fontSize:
                      '13px',

                    fontWeight:
                      600,

                    color:
                      '#334155',
                  }}
                >
                  New Password
                </label>


                <div
                  style={{
                    position:
                      'relative',

                    marginTop:
                      '7px',

                    marginBottom:
                      '16px',
                  }}
                >

                  <input
                    type={
                      showNewPassword
                        ? 'text'
                        : 'password'
                    }

                    value={
                      newPassword
                    }

                    onChange={(e) => {
                      setNewPassword(
                        e.target.value
                      );

                      setResetError('');
                    }}

                    placeholder="Enter new password"

                    disabled={
                      resetLoading
                    }

                    style={{
                      ...modalInputStyle,

                      paddingRight:
                        '45px',

                      marginBottom:
                        0,
                    }}
                  />


                  <button
                    type="button"

                    onClick={() =>
                      setShowNewPassword(
                        !showNewPassword
                      )
                    }

                    style={
                      eyeButtonStyle
                    }
                  >

                    {showNewPassword
                      ? <Eye size={18} />
                      : <EyeOff size={18} />
                    }

                  </button>

                </div>


                <label
                  style={{
                    fontSize:
                      '13px',

                    fontWeight:
                      600,

                    color:
                      '#334155',
                  }}
                >
                  Confirm New Password
                </label>


                <div
                  style={{
                    position:
                      'relative',

                    marginTop:
                      '7px',
                  }}
                >

                  <input
                    type={
                      showConfirmPassword
                        ? 'text'
                        : 'password'
                    }

                    value={
                      confirmPassword
                    }

                    onChange={(e) => {
                      setConfirmPassword(
                        e.target.value
                      );

                      setResetError('');
                    }}

                    placeholder="Confirm new password"

                    disabled={
                      resetLoading
                    }

                    style={{
                      ...modalInputStyle,

                      paddingRight:
                        '45px',
                    }}
                  />


                  <button
                    type="button"

                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword
                      )
                    }

                    style={
                      eyeButtonStyle
                    }
                  >

                    {showConfirmPassword
                      ? <Eye size={18} />
                      : <EyeOff size={18} />
                    }

                  </button>

                </div>


                <p
                  style={{
                    color:
                      '#64748b',

                    fontSize:
                      '11px',

                    marginTop:
                      '-5px',

                    marginBottom:
                      '10px',
                  }}
                >
                  Password must contain at least 8 characters.
                </p>


                <ResetMessage
                  error={
                    resetError
                  }

                  message={
                    resetMessage
                  }
                />


                <button
                  type="button"

                  onClick={
                    handleResetPassword
                  }

                  disabled={
                    resetLoading
                  }

                  style={
                    modalPrimaryButton
                  }
                >

                  {resetLoading
                    ? 'Updating Password...'
                    : 'Reset Password'
                  }

                </button>


                <button
                  type="button"

                  disabled={
                    resetLoading
                  }

                  onClick={() => {

                    setResetStep(
                      2
                    );

                    setResetMessage('');
                    setResetError('');

                  }}

                  style={
                    modalSecondaryButton
                  }
                >
                  Back
                </button>

              </>

            )}


            {/* ==================================================
                STEP 4 SUCCESS
            ================================================== */}

            {resetStep === 4 && (

              <div
                style={{
                  textAlign:
                    'center',

                  padding:
                    '10px 0',
                }}
              >

                <div
                  style={{
                    width:
                      '64px',

                    height:
                      '64px',

                    borderRadius:
                      '50%',

                    backgroundColor:
                      '#ecfdf5',

                    color:
                      '#16a34a',

                    display:
                      'flex',

                    justifyContent:
                      'center',

                    alignItems:
                      'center',

                    margin:
                      '0 auto 18px',
                  }}
                >

                  <CheckCircle
                    size={34}
                  />

                </div>


                <h2
                  style={{
                    marginBottom:
                      '8px',

                    color:
                      '#0f172a',
                  }}
                >
                  Password Changed
                </h2>


                <p
                  style={{
                    color:
                      '#64748b',

                    fontSize:
                      '13px',

                    lineHeight:
                      '1.6',

                    marginBottom:
                      '24px',
                  }}
                >
                  Your SitePulse password has been successfully updated.
                  You can now sign in using your new password.
                </p>


                <button
                  type="button"

                  onClick={() => {
                    closeForgotPassword();

                    setError(
                      ''
                    );
                  }}

                  style={
                    modalPrimaryButton
                  }
                >
                  Back to Sign In
                </button>

              </div>

            )}

          </div>

        </div>

      )}

    </>
  );
};


// ============================================================
// RESET STATUS MESSAGE
// ============================================================

const ResetMessage = ({
  error,
  message,
}: {
  error: string;
  message: string;
}) => {

  if (!error && !message) {
    return null;
  }


  return (
    <div
      style={{
        padding:
          '10px 12px',

        marginBottom:
          '14px',

        borderRadius:
          '8px',

        fontSize:
          '12px',

        lineHeight:
          '1.5',

        backgroundColor:
          error
            ? '#fef2f2'
            : '#f0fdf4',

        color:
          error
            ? '#dc2626'
            : '#15803d',

        border:
          error
            ? '1px solid #fecaca'
            : '1px solid #bbf7d0',
      }}
    >
      {error || message}
    </div>
  );
};


// ============================================================
// MODAL STYLES
// ============================================================

const modalInputStyle:
  React.CSSProperties = {

  width:
    '100%',

  boxSizing:
    'border-box',

  padding:
    '12px 14px',

  border:
    '1px solid #dbe1e8',

  borderRadius:
    '10px',

  outline:
    'none',

  fontSize:
    '14px',

  marginBottom:
    '14px',

  backgroundColor:
    '#f9fafb',

  color:
    '#0f172a',
};


const modalPrimaryButton:
  React.CSSProperties = {

  width:
    '100%',

  border:
    'none',

  borderRadius:
    '10px',

  padding:
    '12px 16px',

  backgroundColor:
    '#ea580c',

  color:
    '#ffffff',

  fontSize:
    '14px',

  fontWeight:
    700,

  cursor:
    'pointer',

  marginTop:
    '4px',
};


const modalSecondaryButton:
  React.CSSProperties = {

  width:
    '100%',

  border:
    'none',

  backgroundColor:
    'transparent',

  color:
    '#64748b',

  fontSize:
    '13px',

  fontWeight:
    600,

  cursor:
    'pointer',

  padding:
    '10px',

  marginTop:
    '5px',
};


const eyeButtonStyle:
  React.CSSProperties = {

  position:
    'absolute',

  right:
    '12px',

  top:
    '50%',

  transform:
    'translateY(-50%)',

  border:
    'none',

  background:
    'transparent',

  cursor:
    'pointer',

  color:
    '#64748b',

  display:
    'flex',

  alignItems:
    'center',

  justifyContent:
    'center',
};


export default LoginPage;