import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import './Dropdown.css';

const BACKEND_URL = API_BASE_URL;

interface ProfileDropdownProps {
  userName?: string;
  userRole?: string;
  className?: string;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  userName: propName,
  userRole: propRole,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState(propName || 'User');
  const [userRole, setUserRole] = useState(propRole || 'Member');
  const [userEmail, setUserEmail] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load from localStorage first
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!propName) setUserName(parsed.name || parsed.email?.split('@')[0] || 'User');
        if (!propRole) setUserRole(parsed.role || 'Member');
        setUserEmail(parsed.email || '');
      }
    } catch { /* ignore */ }

    // Silently refresh current profile from backend /auth/me
    const refreshProfile = async () => {
      try {
        const res = await fetchWithAuth(`${BACKEND_URL}/auth/me`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setUserName(json.data.name || 'User');
            setUserRole(json.data.role || 'Member');
            setUserEmail(json.data.email || '');
            localStorage.setItem('user', JSON.stringify({
              id: json.data.id,
              name: json.data.name,
              email: json.data.email,
              role: json.data.role,
            }));
          }
        }
      } catch { /* offline / network error fallback to localStorage */ }
    };

    refreshProfile();
  }, [propName, propRole]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className={`sp-profile-wrap ${className}`} ref={menuRef}>
      <button
        type="button"
        className={`sp-profile-btn ${isOpen ? 'sp-profile-btn--active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName)}`}
          alt={userName}
          className="user-avatar"
          style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }}
        />
        <div className="profile-info" style={{ textAlign: 'left' }}>
          <p className="profile-name" style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.2 }}>
            {userName}
          </p>
          <p className="profile-role" style={{ margin: 0, fontSize: '11px', color: '#8e8e8e' }}>
            {userRole}
          </p>
        </div>
        <span className={`chevron ${isOpen ? 'sp-dropdown-chevron--open' : ''}`} style={{ fontSize: '12px', color: '#bbb' }}>
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="sp-profile-menu">
          <div className="sp-profile-header">
            <p className="sp-profile-header-name">{userName}</p>
            {userEmail && (
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                {userEmail}
              </p>
            )}
            <span className="sp-profile-header-role">{userRole}</span>
          </div>

          <button
            type="button"
            className="sp-profile-action"
            onClick={() => { setIsOpen(false); navigate('/dashboard'); }}
          >
            <span>📊</span>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className="sp-profile-action"
            onClick={() => { setIsOpen(false); navigate('/projects'); }}
          >
            <span>📁</span>
            <span>Projects Hub</span>
          </button>

          <button
            type="button"
            className="sp-profile-action"
            onClick={() => { setIsOpen(false); navigate('/tasks'); }}
          >
            <span>✅</span>
            <span>Task Management</span>
          </button>

          <button
            type="button"
            className="sp-profile-action"
            onClick={() => { setIsOpen(false); navigate('/users'); }}
          >
            <span>👥</span>
            <span>User Management</span>
          </button>

          <button
            type="button"
            className="sp-profile-action"
            onClick={() => { setIsOpen(false); navigate('/settings'); }}
          >
            <span>⚙️</span>
            <span>Menu Settings</span>
          </button>

          <div className="sp-profile-divider" />

          <button
            type="button"
            className="sp-profile-action sp-profile-action--danger"
            onClick={handleLogout}
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
