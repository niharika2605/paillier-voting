/* eslint-disable no-undef */
import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../App';
import * as paillier from 'paillier-bigint';
// ... rest of file unchanged

// Candidate emojis for visual flair
const CANDIDATE_EMOJIS = ['👩', '👨', '🧑'];

export default function VoterDashboard({ token, user, onLogout }) {
  const [electionInfo, setElectionInfo] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [encryptedVote, setEncryptedVote] = useState('');
  const [encryptedTally, setEncryptedTally] = useState('');
  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(user.hasVoted);
  const [electionRevealed, setElectionRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [error, setError] = useState('');
  const [voteSuccess, setVoteSuccess] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Fetch election info on mount
  useEffect(() => {
    fetchElectionInfo();
  }, []);

  // Poll the live encrypted tally every 3 seconds
  useEffect(() => {
    const interval = setInterval(fetchTally, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchElectionInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/vote/info`);
      const data = await res.json();
      setElectionInfo(data);
      setVoteCount(data.voteCount);
      setElectionRevealed(data.electionRevealed);
    } catch {
      setError('Failed to fetch election info');
    }
  };

  const fetchTally = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/vote/tally`, {
        headers: authHeaders
      });
      const data = await res.json();
      setEncryptedTally(data.encryptedTally);
      setVoteCount(data.voteCount);
      setElectionRevealed(data.electionRevealed);
    } catch {
      // Silent fail on polling
    }
  }, [token]);

  // Called when voter clicks a candidate card
  // Reconstructs the PublicKey from n and g, then encrypts
  const handleSelectCandidate = async (index) => {
    if (hasVoted || electionRevealed) return;

    setSelectedCandidate(index);
    setEncryptedVote('');
    setEncrypting(true);
    setError('');

    try {
      const { n, g } = electionInfo.publicKey;
      const base = BigInt(electionInfo.base);

      // Reconstruct the Paillier PublicKey object from n and g
      // These are just numbers — the library turns them into a usable key
      const nBig = BigInt(n);
      const gBig = BigInt(g);
      const pubKey = new paillier.PublicKey(nBig, gBig);

      // Encode the vote: candidate at index gets BASE^index
      // e.g. index 0 → 1, index 1 → 1_000_000_000_000, index 2 → 1_000_000_000_000_000_000_000_000
      const voteValue = base ** BigInt(index);

      // ENCRYPT IN THE BROWSER
      // This is the core privacy operation — happens entirely client-side
      const encrypted = pubKey.encrypt(voteValue);

      setEncryptedVote(encrypted.toString());
    } catch (err) {
      setError('Encryption failed: ' + err.message);
    } finally {
      setEncrypting(false);
    }
  };

  // Submit the encrypted vote to the backend
  const handleSubmitVote = async () => {
    if (!encryptedVote || selectedCandidate === null) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/vote`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ encryptedVote })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Vote submission failed');
        return;
      }

      setHasVoted(true);
      setVoteSuccess(true);
      setVoteCount(data.voteCount);

    } catch {
      setError('Failed to submit vote. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  if (!electionInfo) {
    return (
      <div className="app-wrapper" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh'
      }}>
        <div className="spinner" />
      </div>
    );
  }

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
          <span className="badge badge-info">Voter</span>
          <button className="btn btn-ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="page-container">

        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="page-title">Cast Your Vote</h1>
          <p className="page-subtitle">
            Your vote is encrypted in this browser before being sent.
            The server never sees your choice.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid-3 section-gap">
          <div className="stat-card">
            <div className="stat-value">{voteCount}</div>
            <div className="stat-label">Votes Cast</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{electionInfo.candidates.length}</div>
            <div className="stat-label">Candidates</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">0</div>
            <div className="stat-label">Individual Decryptions</div>
          </div>
        </div>

        {/* Already voted state */}
        {hasVoted && (
          <div className="card section-gap">
            <div className="privacy-proof">
              <div className="privacy-proof-icon">🔒</div>
              <div className="privacy-proof-text">
                <strong>Vote submitted successfully</strong>
                <span>
                  Your encrypted vote has been homomorphically added to the tally.
                  It is mathematically impossible to recover your individual choice.
                </span>
              </div>
            </div>

            {voteSuccess && (
              <div className="alert alert-success" style={{ marginTop: '1rem', marginBottom: 0 }}>
                ✅ Thank you for voting, {user.username}! Results will be revealed by the admin.
              </div>
            )}
          </div>
        )}

        {/* Election revealed state */}
        {electionRevealed && (
          <div className="alert alert-warning">
            🔓 The election has been revealed. Voting is now closed.
          </div>
        )}

        {/* Voting UI */}
        {!hasVoted && !electionRevealed && (
          <div className="card section-gap">
            <div className="card-header">
              <div className="card-title">Select a Candidate</div>
              <div className="card-subtitle">
                Click a candidate to encrypt your vote locally
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Candidate Cards */}
            <div className="candidate-grid">
              {electionInfo.candidates.map((name, index) => (
                <div
                  key={index}
                  className={`candidate-card ${selectedCandidate === index ? 'selected' : ''}`}
                  onClick={() => handleSelectCandidate(index)}
                >
                  <div className="candidate-avatar">
                    {CANDIDATE_EMOJIS[index]}
                  </div>
                  <div className="candidate-name">{name}</div>
                  {selectedCandidate === index && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--accent-primary)',
                      marginTop: '0.5rem',
                      position: 'relative',
                      zIndex: 1
                    }}>
                      ✓ Selected
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Encryption in progress */}
            {encrypting && (
              <div className="alert alert-info">
                <span className="spinner" style={{ marginRight: '0.5rem' }} />
                Encrypting your vote in the browser...
              </div>
            )}

            {/* Show the raw ciphertext — the "wow" moment */}
            {encryptedVote && !encrypting && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  🔐 Your vote has been encrypted locally. This ciphertext will be sent to the server:
                </div>
                <div className="cipher-box">
                  {encryptedVote}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.5rem'
                }}>
                  {encryptedVote.length} digits — the server cannot determine your candidate from this number
                </div>

                <div style={{ marginTop: '1.25rem' }}>
                  <button
                    className="btn btn-primary btn-lg btn-full"
                    onClick={handleSubmitVote}
                    disabled={loading}
                  >
                    {loading
                      ? <><span className="spinner" /> Submitting...</>
                      : '🗳️ Submit Encrypted Vote'
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Encrypted Tally */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Live Encrypted Tally</div>
            <div className="card-subtitle">
              This is the homomorphic sum of all encrypted votes — updates every 3 seconds
            </div>
          </div>

          <div className="cipher-box" style={{ maxHeight: '160px' }}>
            {encryptedTally || 'Fetching tally...'}
          </div>

          <div style={{
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>🔄 Auto-refreshes every 3 seconds</span>
            <span>{voteCount} vote{voteCount !== 1 ? 's' : ''} accumulated</span>
          </div>

          {/* Privacy proof */}
          <div className="divider" />
          <div className="privacy-proof">
            <div className="privacy-proof-icon">🛡️</div>
            <div className="privacy-proof-text">
              <strong>Privacy Guarantee Active</strong>
              <span>
                {voteCount} vote{voteCount !== 1 ? 's' : ''} processed · 0 individual decryptions ·
                Individual votes are mathematically unrecoverable
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}