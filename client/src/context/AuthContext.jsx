/**
 * AuthContext
 * Global authentication state provider.
 *
 * Stores: user object (with role), token, loading flag.
 * On mount: rehydrates from localStorage so the user stays logged in on refresh.
 *
 * Exposed via useAuth() hook — any component can read user/token and call
 * login/logout/register without prop-drilling.
 */
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // true while rehydrating from storage

  // On first mount, restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  /**
   * login — POST /auth/login, store token + user, update state
   * @param {string} email
   * @param {string} password
   * @returns {object} user object from server
   */
  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  /**
   * register — POST /auth/register, immediately log in with returned credentials
   * @param {object} payload  — { name, email, password, role, department? }
   */
  async function register(payload) {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  /** logout — clear storage and reset state; redirected to /login by router */
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

/** useAuth — convenience hook; throws if used outside AuthProvider */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
