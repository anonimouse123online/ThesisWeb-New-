import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!userStr) {
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);

    const userRole = user.role
      ?.trim()
      .toLowerCase();

    // Web portal is Admin-only
    if (userRole !== 'admin') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      return <Navigate to="/login" replace />;
    }

  } catch (error) {
    console.error('Invalid stored user data:', error);

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;