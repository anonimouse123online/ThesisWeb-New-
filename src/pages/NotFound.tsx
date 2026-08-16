import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '120px',
        fontWeight: 800,
        lineHeight: 1,
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '8px',
      }}>
        404
      </div>

      <h1 style={{
        fontSize: '24px',
        fontWeight: 700,
        color: '#0f172a',
        margin: '0 0 12px',
      }}>
        Page Not Found
      </h1>

      <p style={{
        fontSize: '15px',
        color: '#64748b',
        maxWidth: '400px',
        lineHeight: 1.6,
        marginBottom: '32px',
      }}>
        The page you're looking for doesn't exist or has been moved. 
        Let's get you back on track.
      </p>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '12px 28px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#fff',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s',
          }}
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '12px 28px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#475569',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Go Back
        </button>
      </div>

      <p style={{
        fontSize: '12px',
        color: '#94a3b8',
        marginTop: '48px',
      }}>
        SitePulse — Real-Time Field Tracking
      </p>
    </div>
  );
};

export default NotFound;
