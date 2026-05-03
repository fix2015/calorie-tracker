import { useState, useEffect, useCallback, useRef } from 'react';
import { photoSrc } from '../services/photoUrl';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function adminFetch(path, opts = {}) {
  const creds = sessionStorage.getItem('adminCreds');
  if (!creds) throw new Error('Not authenticated');
  return fetch(`${API}/admin${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${creds}`, ...opts.headers },
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    return r.json();
  });
}

function StatCard({ label, value, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)',
        boxShadow: 'var(--shadow-sm)', textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
    >
      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)' }}>{value}</div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('adminCreds'));
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [meals, setMeals] = useState([]);
  const [mealsCursor, setMealsCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [mealSearch, setMealSearch] = useState('');
  const [mealSource, setMealSource] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const mealSearchTimer = useRef(null);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const creds = btoa(`${user}:${pass}`);
    sessionStorage.setItem('adminCreds', creds);
    fetch(`${API}/admin/stats`, { headers: { Authorization: `Basic ${creds}` } })
      .then((r) => { if (!r.ok) throw new Error('Invalid'); return r.json(); })
      .then(() => setAuthed(true))
      .catch(() => { sessionStorage.removeItem('adminCreds'); setLoginError('Invalid credentials'); });
  };

  const loadStats = useCallback(() => {
    adminFetch('/stats').then(setStats).catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    adminFetch('/users').then((d) => setUsers(d.users)).catch(() => {});
  }, []);

  const loadMeals = useCallback((cursor = null, source = '', search = '') => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('cursor', cursor);
    if (source) params.set('source', source);
    if (search) params.set('search', search);
    adminFetch(`/meals?${params}`)
      .then((d) => {
        setMeals((prev) => cursor ? [...prev, ...d.meals] : d.meals);
        setMealsCursor(d.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadSuggestions = useCallback(() => {
    adminFetch('/suggestions').then((d) => setSuggestions(d.suggestions)).catch(() => {});
  }, []);

  useEffect(() => {
    if (authed) { loadStats(); loadUsers(); loadMeals(); }
  }, [authed]);

  // Debounced meal search
  useEffect(() => {
    if (!authed) return;
    clearTimeout(mealSearchTimer.current);
    mealSearchTimer.current = setTimeout(() => {
      loadMeals(null, mealSource, mealSearch);
    }, 300);
  }, [mealSearch, mealSource]);

  const handleDeleteUser = async (id, name) => {
    const input = prompt(`Type "DELETE ${name}" to permanently remove this user and all their data:`);
    if (input !== `DELETE ${name}`) return;
    await adminFetch(`/users/${id}`, { method: 'DELETE' });
    loadUsers();
    loadStats();
  };

  const handleDeleteMeal = async (id, name) => {
    if (!confirm(`Delete meal "${name}"?`)) return;
    await adminFetch(`/meals/${id}`, { method: 'DELETE' });
    setMeals((prev) => prev.filter((m) => m.id !== id));
    loadStats();
  };

  const handleUpdateUser = async (id, data) => {
    await adminFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    loadUsers();
    setEditUser(null);
  };

  const showAiMeals = () => {
    setTab('meals');
    setMealSource('photo_ai');
    setMealSearch('');
    loadMeals(null, 'photo_ai', '');
  };

  const showManualMeals = () => {
    setTab('meals');
    setMealSource('manual');
    setMealSearch('');
    loadMeals(null, 'manual', '');
  };

  const showAllMeals = () => {
    setTab('meals');
    setMealSource('');
    setMealSearch('');
    loadMeals(null, '', '');
  };

  const showSuggestionsPanel = () => {
    setShowSuggestions(true);
    loadSuggestions();
  };

  const filteredUsers = userSearch
    ? users.filter((u) =>
        (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  if (!authed) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Admin Panel</h1>
          <p className="auth-subtitle">Enter admin credentials</p>
          {loginError && <p style={{ color: 'var(--color-danger)', textAlign: 'center', marginBottom: 'var(--space-md)' }}>{loginError}</p>}
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={user} onChange={(e) => setUser(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary btn-block">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Admin Dashboard</h1>
        <button className="btn btn-secondary" onClick={() => { sessionStorage.removeItem('adminCreds'); setAuthed(false); }}>Logout</button>
      </div>

      <div className="dash-tabs" style={{ marginBottom: 'var(--space-lg)' }}>
        <button className={`dash-tab${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`dash-tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>Users</button>
        <button className={`dash-tab${tab === 'meals' ? ' active' : ''}`} onClick={() => { setTab('meals'); if (!mealSource && !mealSearch) loadMeals(); }}>Meals</button>
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <StatCard label="Total Users" value={stats.users} sub={`+${stats.usersToday} today`} />
            <StatCard label="Total Meals" value={stats.meals} sub={`+${stats.mealsToday} today`} onClick={showAllMeals} />
            <StatCard label="Likes" value={stats.likes} />
            <StatCard label="Comments" value={stats.comments} />
            <StatCard label="Follows" value={stats.follows} />
            <StatCard label="Messages" value={stats.messages} />
            <StatCard label="Saved Meals" value={stats.savedMeals} />
            <StatCard label="Weight Logs" value={stats.weightLogs} />
          </div>

          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-md)' }}>AI Usage</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <StatCard label="AI Scanned" value={stats.photoAiMeals} onClick={showAiMeals} />
            <StatCard label="Manual Meals" value={stats.manualMeals} onClick={showManualMeals} />
            <StatCard label="AI Suggestions" value={stats.suggestions} sub={`${stats.aiCallsToday} today`} onClick={showSuggestionsPanel} />
            <StatCard label="Notifications" value={stats.notifications} />
          </div>
        </>
      )}

      {/* Users */}
      {tab === 'users' && (
        <>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <input
              type="text"
              placeholder="Search users by name, email, or username..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ width: '100%', padding: 'var(--space-sm) var(--space-md)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-input)' }}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: 'var(--space-sm)' }}>User</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Email</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Meals</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Public</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Joined</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      {u.avatarUrl ? (
                        <img src={photoSrc(u.avatarUrl)} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 700, flexShrink: 0 }}>
                          {u.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>@{u.username || '—'}</div>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-sm)' }}>{u.email}</td>
                    <td style={{ padding: 'var(--space-sm)' }}>{u._count.meals}</td>
                    <td style={{ padding: 'var(--space-sm)' }}>
                      <span style={{ color: u.isPublic ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{u.isPublic ? 'Yes' : 'No'}</span>
                    </td>
                    <td style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-xs)' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 'var(--space-sm)' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)', minHeight: 'auto' }}
                          onClick={() => setEditUser(u)}>Edit</button>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)', minHeight: 'auto', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
                          onClick={() => handleDeleteUser(u.id, u.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-lg)' }}>No users found</p>}
          </div>
        </>
      )}

      {/* Meals */}
      {tab === 'meals' && (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search meals..."
              value={mealSearch}
              onChange={(e) => setMealSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: 'var(--space-sm) var(--space-md)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-input)' }}
            />
            <select
              value={mealSource}
              onChange={(e) => setMealSource(e.target.value)}
              style={{ padding: 'var(--space-sm) var(--space-md)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', background: 'var(--color-surface)' }}
            >
              <option value="">All sources</option>
              <option value="photo_ai">AI Scanned</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: 'var(--space-sm)' }}>Meal</th>
                  <th style={{ padding: 'var(--space-sm)' }}>User</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Kcal</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Source</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Likes</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Date</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      {m.photoUrl && <img src={photoSrc(m.photoUrl)} alt="" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />}
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                    </td>
                    <td style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-xs)' }}>{m.user?.name || m.user?.email}</td>
                    <td style={{ padding: 'var(--space-sm)' }}>{m.calories}</td>
                    <td style={{ padding: 'var(--space-sm)' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', background: m.source === 'photo_ai' ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: m.source === 'photo_ai' ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)' }}>
                        {m.source === 'photo_ai' ? 'AI' : 'Manual'}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-sm)' }}>{m._count.likes}</td>
                    <td style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-xs)' }}>{new Date(m.consumedAt).toLocaleDateString()}</td>
                    <td style={{ padding: 'var(--space-sm)' }}>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)', minHeight: 'auto', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
                        onClick={() => handleDeleteMeal(m.id, m.name)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meals.length === 0 && !loading && <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-lg)' }}>No meals found</p>}
          </div>
          {mealsCursor && (
            <button className="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-md)' }} onClick={() => loadMeals(mealsCursor, mealSource, mealSearch)} disabled={loading}>
              {loading ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>Edit User: {editUser.name}</h2>
            <EditUserForm user={editUser} onSave={(data) => handleUpdateUser(editUser.id, data)} onCancel={() => setEditUser(null)} />
          </div>
        </div>
      )}

      {/* Suggestions modal */}
      {showSuggestions && (
        <div className="modal-overlay" onClick={() => setShowSuggestions(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2 style={{ margin: 0 }}>AI Suggestions ({suggestions.length})</h2>
              <button onClick={() => setShowSuggestions(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>&times;</button>
            </div>
            {suggestions.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>No suggestions yet</p>
            ) : suggestions.map((s) => (
              <div key={s.id} style={{ borderBottom: '1px solid var(--color-border)', padding: 'var(--space-sm) 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
                  <span>{s.user?.name || s.user?.email}</span>
                  <span>{new Date(s.createdAt).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.5, margin: 0 }}>{s.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EditUserForm({ user, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: user.name || '',
    username: user.username || '',
    email: user.email || '',
    isPublic: user.isPublic,
    followersOnly: user.followersOnly,
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div className="form-group">
        <label>Name</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Username</label>
        <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Public Profile</span>
        <label className="toggle-switch">
          <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Followers Only</span>
        <label className="toggle-switch">
          <input type="checkbox" checked={form.followersOnly} onChange={(e) => setForm({ ...form, followersOnly: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save</button>
      </div>
    </form>
  );
}
