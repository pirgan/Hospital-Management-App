/**
 * Axios instance
 * Centralises base URL and auth header injection so every API call
 * automatically includes the JWT without the caller having to set it.
 *
 * Request interceptor: reads the token from localStorage and attaches
 *   Authorization: Bearer <token>
 * Response interceptor: on 401, clears localStorage and redirects to /login
 *   so expired/invalid tokens immediately force a new login.
 */
import axios from 'axios';

// Create a shared Axios instance with the backend base URL.
// VITE_API_URL is set in production; falls back to the local dev server.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Attach JWT token to every outgoing request.
// Reading from localStorage here (rather than module scope) means we always
// send the latest token even if it was refreshed after the module loaded.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Standard Bearer token format expected by authMiddleware.js on the server
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear stored auth and redirect to login page.
// Using window.location.href (hard redirect) rather than React Router's navigate()
// because this interceptor lives outside the React component tree.
api.interceptors.response.use(
  (response) => response, // pass successful responses straight through
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear both storage keys and force re-login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    // Re-reject so individual callers can still catch and handle other errors
    return Promise.reject(error);
  }
);

export default api;
