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
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return request('/users/avatar', { method: 'POST', body: fd });
  },
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

export const publicApi = {
  search: (q) => request(`/public/search?q=${encodeURIComponent(q)}`),
  popularUsers: (offset = 0, limit = 10) => request(`/public/popular-users?offset=${offset}&limit=${limit}`),
  trending: (cursor, limit = 12) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', limit);
    return request(`/public/trending?${params}`);
  },
  suggestions: () => request('/public/suggestions'),
  feed: (cursor, limit = 12) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', limit);
    return request(`/public/feed?${params}`);
  },
  follow: (username) => request(`/public/u/${username}/follow`, { method: 'POST' }),
  getFollowers: (username, cursor) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    return request(`/public/u/${username}/followers?${params}`);
  },
  getFollowing: (username, cursor) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    return request(`/public/u/${username}/following?${params}`);
  },
  getProfile: (username) => request(`/public/u/${username}`),
  getMeals: (username, cursor, limit = 12, date) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', limit);
    if (date) params.set('date', date);
    return request(`/public/u/${username}/meals?${params}`);
  },
  getMealDetail: (mealId) => request(`/public/meals/${mealId}`),
  toggleLike: (mealId) => request(`/public/meals/${mealId}/like`, { method: 'POST' }),
  addComment: (mealId, text) => request(`/public/meals/${mealId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
  getComments: (mealId, cursor) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    return request(`/public/meals/${mealId}/comments?${params}`);
  },
};

export const notificationsApi = {
  list: (cursor) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    return request(`/notifications?${params}`);
  },
  unreadCount: () => request('/notifications/unread-count'),
  readAll: () => request('/notifications/read-all', { method: 'PATCH' }),
  read: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
};

export const messagesApi = {
  list: () => request('/messages'),
  start: (userId) => request('/messages', { method: 'POST', body: JSON.stringify({ userId }) }),
  getMessages: (convId, cursor) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    return request(`/messages/${convId}?${params}`);
  },
  send: (convId, text) => request(`/messages/${convId}`, { method: 'POST', body: JSON.stringify({ text }) }),
  markRead: (convId) => request(`/messages/${convId}/read`, { method: 'PATCH' }),
};
