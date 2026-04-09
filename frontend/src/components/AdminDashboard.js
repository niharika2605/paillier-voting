import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../App';

export default function AdminDashboard({ token, user, onLogout }) {
  const [voters, setVoters] = useState([]);
  const [voteCount, setVoteCount] = useState(0);
  const [totalVoters, setTotalVoters] = useState(0);
  const [electionRevealed, setElectionRevealed] = useState(false);
  const [results, setResults] = useState(null);
  const [encryptedTally, setEncryptedTally] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  useEffect(() => {
    fetchUsers();
    fetchTally();
  }, []);

  // Poll users + tally every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers();
      fetchTally();
    }, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: authHeaders
      });
      const data = await res.json();
      setVoters(data.users.filter(u => u.role === 'voter'));
      setVoteCount(data.voteCount);
      setTotalVoters(data.totalVoters);
    } catch {
      // Silent fail on polling
    }
  }, [token]);

  const fetchTally = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/vote/tally`, {
        headers: authHeaders
      });
      const data = await res.json();
      setEncryptedTally(data.encryptedTally);
      setElectionRevealed(data.electionRevealed);
    } catch {
      // Silent fail
    }
  }, [token]);

  const handleReveal = async () => {
    if (!window.confirm(
      `Reveal results now? This will decrypt the tally using a single decryption and lock the election permanently.`
    )) return;

    setRevealing(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/admin/reveal`, {
        method: 'POST',
        headers: authHeaders
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Reveal failed');
        return;
      }

      setResults(data);
      setElectionRevealed(true);

    } catch {
      setError('Failed to reveal results. Is the backend running?');
    } finally {
      setRevealing(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(
      'Reset the entire election? All votes will be cleared and a new keypair will be generated. Voter accounts are kept.'
    )) return;

    setResetting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/admin/reset`, {
        method: 'POST',
        headers: authHeaders
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Reset failed');
        return;
      }

      // Reset all local state
      setResults(null);
      setElectionRevealed(false);
      setVoteCount(0);
      setVoters(prev => prev.map(v => ({ ...v, hasVoted: false })));
      setEncryptedTally('');

    } catch {
      setError('Failed to reset election.');
    } finally {
      setResetting(false);
    }
  };

  // Calculate bar width percentage for results
  const getBarWidth = (count) => {
    if (!results) return 0;
    const max = Math.max(...results.results.map(r => r.count));
    if (max === 0) return 0;
    return Math.round((count / max) * 100);
  };

  const isWinner = (candidate) => {
    return results?.winners?.includes(candidate);
  };

  return (
    <div className="app-wrapper">

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-brand-icon">🗳️</div>
          SecureVote
        </div>
        <div className="navbar-right">
          <span className="navbar-user">
            Logged in as <span>{user.username}</span>
          </span>
          <span className="badge badge-warning">Admin</span>
          <button className="btn btn-ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="page-container">

        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">
            Monitor the election, manage voters, and reveal results.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Stats Row */}
        <div className="grid-3 section-gap">
          <div className="stat-card">
            <div className="stat-value">{voteCount}</div>
            <div className="stat-label">Votes Cast</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalVoters}</div>
            <div className="stat-label">Registered Voters</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">0</div>
            <div className="stat-label">Individual Decryptions</div>
          </div>
        </div>

        <div className="grid-2">

          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Reveal / Reset Controls */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Election Controls</div>
                <div className="card-subtitle">
                  {electionRevealed
                    ? 'Election has been revealed and locked'
                    : `${voteCount} of ${totalVoters} voters have voted`
                  }
                </div>
              </div>

              {!electionRevealed ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    className="btn btn-success btn-full btn-lg"
                    onClick={handleReveal}
                    disabled={revealing || voteCount === 0}
                  >
                    {revealing
                      ? <><span className="spinner" /> Decrypting...</>
                      : '🔓 Reveal Results'
                    }
                  </button>
                  {voteCount === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Waiting for at least 1 vote before revealing
                    </p>
                  )}
                  <button
                    className="btn btn-danger btn-full"
                    onClick={handleReset}
                    disabled={resetting}
                  >
                    {resetting
                      ? <><span className="spinner" /> Resetting...</>
                      : '🔄 Reset Election'
                    }
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="alert alert-success" style={{ marginBottom: 0 }}>
                    ✅ Election revealed. Results are final.
                  </div>
                  <button
                    className="btn btn-danger btn-full"
                    onClick={handleReset}
                    disabled={resetting}
                  >
                    {resetting
                      ? <><span className="spinner" /> Resetting...</>
                      : '🔄 Reset Election'
                    }
                  </button>
                </div>
              )}
            </div>

            {/* Privacy Proof */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Privacy Proof</div>
                <div className="card-subtitle">
                  Cryptographic guarantee of voter privacy
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="privacy-proof">
                  <div className="privacy-proof-icon">🔢</div>
                  <div className="privacy-proof-text">
                    <strong>{voteCount} votes processed</strong>
                    <span>All votes homomorphically added as ciphertexts</span>
                  </div>
                </div>

                <div className="privacy-proof">
                  <div className="privacy-proof-icon">🔒</div>
                  <div className="privacy-proof-text">
                    <strong>0 individual decryptions</strong>
                    <span>No single vote was ever decrypted by the server</span>
                  </div>
                </div>

                <div className="privacy-proof">
                  <div className="privacy-proof-icon">🧮</div>
                  <div className="privacy-proof-text">
                    <strong>{electionRevealed ? '1' : '0'} total decryptions</strong>
                    <span>
                      {electionRevealed
                        ? 'Final tally decrypted once to reveal results'
                        : 'No decryptions performed yet'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Results (shown after reveal) */}
            {results && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    🏆 {results.message}
                  </div>
                  <div className="card-subtitle">
                    {results.totalVotes} vote{results.totalVotes !== 1 ? 's' : ''} · 
                    single decryption · {results.individualDecryptions} individual decryptions
                  </div>
                </div>

                <div className="results-list">
                  {results.results.map((r, i) => (
                    <div key={i} className="result-item">
                      <div className="result-header">
                        <div className="result-name">
                          {r.candidate}
                          {isWinner(r.candidate) && (
                            <span className="badge badge-success">Winner</span>
                          )}
                        </div>
                        <div className="result-count">
                          {r.count} vote{r.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="result-bar-bg">
                        <div
                          className={`result-bar-fill ${isWinner(r.candidate) ? 'winner' : ''}`}
                          style={{ width: `${getBarWidth(r.count)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Voter Status Table */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Voter Status</div>
                <div className="card-subtitle">
                  {voteCount} of {totalVoters} have voted · updates every 3 seconds
                </div>
              </div>

              {voters.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No voters registered yet.
                </p>
              ) : (
                <table className="voter-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voters.map((v, i) => (
                      <tr key={i}>
                        <td>{v.username}</td>
                        <td>
                          {v.hasVoted
                            ? <span className="badge badge-success">Voted</span>
                            : <span className="badge badge-warning">Pending</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Live Encrypted Tally */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Live Encrypted Tally</div>
                <div className="card-subtitle">
                  Homomorphic sum of all ciphertexts
                </div>
              </div>
              <div className="cipher-box">
                {encryptedTally || 'No votes yet...'}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}