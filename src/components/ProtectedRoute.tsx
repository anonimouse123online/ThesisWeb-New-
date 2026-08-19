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

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.role && user.role !== 'Admin') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return <Navigate to="/login" replace />;
      }
    } catch {
      // ignore
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
