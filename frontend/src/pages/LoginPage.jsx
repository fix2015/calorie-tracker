import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <h1 className="page-title" style={{ textAlign: 'center' }}>Sign In</h1>

        <p className={`error-text${error ? ' visible' : ''}`} style={{ marginBottom: error ? 'var(--space-md)' : 0 }}><span>{error}</span></p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Your password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>

        <p className="legal-links">
          <Link to="/terms">Terms of Service</Link>
          <span className="legal-links-sep">&middot;</span>
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
