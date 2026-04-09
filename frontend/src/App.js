import { useState, useEffect } from 'react';
import './App.css';
import AuthPage from './components/AuthPage';
import VoterDashboard from './components/VoterDashboard';
import AdminDashboard from './components/AdminDashboard';

// Base URL for all API calls
// Change this when deploying to production
export const API_BASE = 'https://paillier-voting-backend.onrender.com';

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount — check if a token exists in sessionStorage
  // sessionStorage clears when the browser tab closes (safer than localStorage)
  useEffect(() => {
    const savedToken = sessionStorage.getItem('voting_token');
    const savedUser = sessionStorage.getItem('voting_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    setLoading(false);
  }, []);

  // Called by AuthPage after successful login
  const handleLogin = (tokenValue, userData) => {
    setToken(tokenValue);
    setUser(userData);
    sessionStorage.setItem('voting_token', tokenValue);
    sessionStorage.setItem('voting_user', JSON.stringify(userData));
  };

  // Called by navbar logout button
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('voting_token');
    sessionStorage.removeItem('voting_user');
  };

  // Show nothing while checking sessionStorage
  if (loading) {
    return (
      <div className="app-wrapper" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div className="spinner" />
      </div>
    );
  }

  // Not logged in — show auth page
  if (!token || !user) {
    return (
      <div className="app-wrapper">
        <AuthPage onLogin={handleLogin} />
      </div>
    );
  }

  // Logged in as admin
  if (user.role === 'admin') {
    return (
      <div className="app-wrapper">
        <AdminDashboard
          token={token}
          user={user}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // Logged in as voter
  return (
    <div className="app-wrapper">
      <VoterDashboard
        token={token}
        user={user}
        onLogout={handleLogout}
      />
    </div>
  );
}