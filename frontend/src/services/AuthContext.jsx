import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, users, setTokens, clearTokens, setAuthErrorHandler } from './api';
import { markOnboardingPending } from './onboarding';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only show the loading state when there is a stored session to restore
  const [loading, setLoading] = useState(() => !!localStorage.getItem('accessToken'));

  const logout = useCallback(() => {
    auth.logout().catch(() => {});
    clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthErrorHandler(logout);
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Only an HTTP auth failure ends the session; offline (no cached profile) keeps the tokens
      auth.me().then(setUser).catch((err) => { if (err.status) clearTokens(); }).finally(() => setLoading(false));
    }
  }, [logout]);

  const login = async (email, password) => {
    const res = await auth.login({ email, password });
    setTokens(res.accessToken, res.refreshToken);
    const full = await auth.me();
    setUser(full);
    return full;
  };

  const register = async (data) => {
    const res = await auth.register(data);
    setTokens(res.accessToken, res.refreshToken);
    const full = await auth.me();
    // Flag before setUser: PublicRoute redirects into the app as soon as the user is set
    markOnboardingPending(full.id);
    setUser(full);
    return full;
  };

  const refreshUser = async () => {
    const u = await auth.me();
    setUser(u);
  };

  const deleteAccount = async () => {
    await users.deleteAccount();
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, deleteAccount, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives next to its provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
