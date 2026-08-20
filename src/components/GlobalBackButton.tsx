import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './GlobalBackButton.css';

const ROOT_PATHS = [
  '/',
  '/dashboard',
  '/projects',
  '/tasks',
  '/timelog',
  '/resources',
  '/users',
  '/settings',
  '/login',
  '/signup',
];

const GlobalBackButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Do not show the back button on root pages
  if (ROOT_PATHS.includes(location.pathname)) {
    return null;
  }

  return (
    <button 
      className="global-back-button"
      onClick={() => navigate(-1)}
      title="Go Back"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
};

export default GlobalBackButton;
