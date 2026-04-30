const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');
let onAuthError = null;

export function setAuthErrorHandler(fn) { onAuthError = fn; }

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(`${API}${path}`, { ...options, headers });

  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setTokens(data.accessToken, data.refreshToken);
      headers['Authorization'] = `Bearer ${data.accessToken}`;
      res = await fetch(`${API}${path}`, { ...options, headers });
    } else {
      clearTokens();
      if (onAuthError) onAuthError();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const auth = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};

export const users = {
  updateProfile: (data) => request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: () => request('/users/me', { method: 'DELETE' }),
};

export const meals = {
  manual: (data) => request('/meals/manual', { method: 'POST', body: JSON.stringify(data) }),
  photo: (formData) => request('/meals/photo', { method: 'POST', body: formData }),
  list: (from, to) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request(`/meals?${params}`);
  },
  update: (id, data) => request(`/meals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id) => request(`/meals/${id}`, { method: 'DELETE' }),
};

export const reports = {
  daily: (date) => request(`/reports/daily${date ? `?date=${date}` : ''}`),
  weekly: () => request('/reports/weekly'),
  suggestion: () => request('/reports/suggestion'),
  analyze: () => request('/reports/analyze'),
};
