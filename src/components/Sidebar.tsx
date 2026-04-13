import React from 'react';
import { NavLink } from 'react-router-dom'; 
import './Sidebar.css';

const NAV_ITEMS = [
  { icon: '▦', label: 'Dashboard', path: '/dashboard' },
  { icon: '💼', label: 'Projects',  path: '/projects' },
  { icon: '☑', label: 'Tasks',     path: '/tasks' },
  { icon: '⏱', label: 'Time log',  path: '/timelog' },
  { icon: '👥', label: 'Resource mgnt', path: '/resources' },
  { icon: '👤', label: 'Users',    path: '/users' },
  { icon: '⚙', label: 'Menu settings', path: '/settings' },
];

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">
          <div className="logo-diamond" />
        </div>
        <span>SitePulse</span>
      </div>

      <button className="create-btn">
        <div className="plus-circle">+</div>
        Create new project
      </button>

      <nav className="nav">
        {NAV_ITEMS.map(({ icon, label, path }) => (
          <NavLink 
            key={label} 
            to={path} 
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="help-btn">?</div>
      </div>
    </aside>
  );
};

export default Sidebar;