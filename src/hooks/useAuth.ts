import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [session, setSession] = useState(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        return { user: JSON.parse(storedUser) as UserInfo | null, token: storedToken, corrupted: false };
      } catch {
        return { user: null, token: null, corrupted: true };
      }
    }
    return { user: null, token: null, corrupted: false };
  });
  const { user, token } = session;
  const navigate = useNavigate();

  useEffect(() => {
    if (session.corrupted) {
      // Keep storage writes outside the state initializer.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [session.corrupted]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession({ user: null, token: null, corrupted: false });
    navigate('/login');
  }, [navigate]);

  const isLoggedIn = !!token && !!user;

  return { user, token, isLoggedIn, logout };
}
