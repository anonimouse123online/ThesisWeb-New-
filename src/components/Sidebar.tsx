import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const Icons: Record<string, React.FC> = {
  Dashboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Projects: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="17"/>
      <line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/>
    </svg>
  ),
  Tasks: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <polyline points="3 6 4 7 6 5"/>
      <polyline points="3 12 4 13 6 11"/>
      <polyline points="3 18 4 19 6 17"/>
    </svg>
  ),
  Timelog: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Resource: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/>
      <circle cx="5" cy="19" r="2"/>
      <circle cx="19" cy="19" r="2"/>
      <line x1="12" y1="7" x2="12" y2="13"/>
      <line x1="12" y1="13" x2="5" y2="17"/>
      <line x1="12" y1="13" x2="19" y2="17"/>
    </svg>
  ),
  Users: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      <path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
    </svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Logout: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

const NAV_ITEMS = [
  { icon: 'Dashboard',  label: 'Dashboard',      path: '/dashboard' },
  { icon: 'Projects',   label: 'Projects Hub',   path: '/projects' },
  { icon: 'Timelog',    label: 'Time log',       path: '/timelog' },
  { icon: 'Users',      label: 'Users',          path: '/users' },
  { icon: 'Settings',   label: 'Menu settings',  path: '/settings' },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const [userName, setUserName] = React.useState<string>('User');
  const [userRole, setUserRole] = React.useState<string>('Member');

  React.useEffect(() => {
    // Initial read from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserName(parsed.name || parsed.email?.split('@')[0] || 'User');
        setUserRole(parsed.role || 'Member');
      } catch { /* ignore */ }
    }

    // Live sync from /auth/me
    const syncUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.user) {
            setUserName(json.user.name || 'User');
            setUserRole(json.user.role || 'Member');
            localStorage.setItem('user', JSON.stringify(json.user));
          }
        }
      } catch { /* ignore */ }
    };
    syncUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">
          <div className="logo-diamond" />
        </div>
        <span>SitePulse</span>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map(({ icon, label, path }) => {
          const IconComponent = Icons[icon];
          return (
            <NavLink
              key={label}
              to={path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">
                <IconComponent />
              </span>
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User profile & logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{userName}</span>
            <span className="sidebar-user-role">{userRole}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout} title="Logout">
          <Icons.Logout />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;