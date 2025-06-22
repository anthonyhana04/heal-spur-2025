import React, { createContext, useContext, useState, useEffect } from 'react';

// Simple authentication context that stores userId & sessionId in localStorage
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Initialize state from localStorage so refreshes remain logged in
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('sessionId'));
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = Boolean(userId && sessionId);

  // Helper to persist/clear values from localStorage
  const persistCredentials = (id, session) => {
    if (id && session) {
      localStorage.setItem('userId', id);
      localStorage.setItem('sessionId', session);
    } else {
      localStorage.removeItem('userId');
      localStorage.removeItem('sessionId');
    }
  };

  // Login: send credentials (or anything) to backend, expect { userId, sessionId } in response.
  // You can adjust the endpoint/credentials to match your backend implementation.
  const login = async (credentials = {}) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      if (!res.ok) {
        throw new Error('Login failed');
      }

      const data = await res.json();
      // Expect backend to send back { userId, sessionId }
      setUserId(data.userId);
      setSessionId(data.sessionId);
      persistCredentials(data.userId, data.sessionId);
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout: inform backend then clear local credentials
  const logout = async () => {
    setIsLoading(true);
    try {
      if (sessionId) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUserId(null);
      setSessionId(null);
      persistCredentials(null, null);
      setIsLoading(false);
    }
  };

  const value = {
    userId,
    sessionId,
    isAuthenticated,
    isLoading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}; 