import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, setTokens, clearTokens, setAuthErrorHandler } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    auth.logout().catch(() => {});
    clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthErrorHandler(logout);
    const token = localStorage.getItem('accessToken');
    if (token) {
      auth.me().then(setUser).catch(() => clearTokens()).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [logout]);

  const login = async (email, password) => {
    const res = await auth.login({ email, password });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return res.user;
  };

  const register = async (data) => {
    const res = await auth.register(data);
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return res.user;
  };

  const refreshUser = async () => {
    const u = await auth.me();
    setUser(u);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
