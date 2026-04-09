import { useState } from 'react';
import { API_BASE } from '../App';

export default function AuthPage({ onLogin }) {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login form state
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    role: 'voter'
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Pass token + user info up to App.js
      onLogin(data.token, {
        username: data.username,
        role: data.role,
        hasVoted: data.hasVoted
      });

    } catch (err) {
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setSuccess(`Account created for ${data.username} (${data.role}). You can now log in.`);
      setTab('login');
      setLoginForm({ username: registerForm.username, password: '' });
      setRegisterForm({ username: '', password: '', role: 'voter' });

    } catch (err) {
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">

        {/* Logo + Title */}
        <div className="auth-logo">
          <div className="auth-logo-icon">🗳️</div>
          <h1>SecureVote</h1>
          <p>Homomorphic Encryption Voting System</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
          >
            Login
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); setSuccess(''); }}
          >
            Register
          </button>
        </div>

        {/* Alerts */}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter your username"
                value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Enter your password"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              type="submit"
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Login'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Choose a username"
                value={registerForm.username}
                onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Choose a password"
                value={registerForm.password}
                onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-select"
                value={registerForm.role}
                onChange={e => setRegisterForm({ ...registerForm, role: e.target.value })}
              >
                <option value="voter">Voter</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              type="submit"
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
        )}

        {/* Footer note */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            🔐 Votes are encrypted in your browser using<br />
            Paillier homomorphic encryption (2048-bit)
          </p>
        </div>

      </div>
    </div>
  );
}