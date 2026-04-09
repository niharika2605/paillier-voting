// ============================================================
// SECTION A: Imports + Setup
// ============================================================

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as paillier from 'paillier-bigint';

const app = express();
const PORT = 5000;
const JWT_SECRET = 'paillier-voting-secret-2024';
const SALT_ROUNDS = 10;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://paillier-voting.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Voting server is running' });
});

// ============================================================
// SECTION B: Paillier Key Generation + Election State
// ============================================================

const CANDIDATES = ['Alice', 'Bob', 'Charlie'];
const BASE = BigInt('1000000000000');

const users = {};

let publicKey = null;
let privateKey = null;
let encryptedTally = null;
let voteCount = 0;
let electionRevealed = false;
let finalResults = null;

console.log('🔑 Generating Paillier keypair (2048-bit)...');

const { publicKey: pk, privateKey: sk } = await paillier.generateRandomKeys(2048);
publicKey = pk;
privateKey = sk;

encryptedTally = publicKey.encrypt(0n);

console.log('✅ Keypair ready. Public key n length:', publicKey.n.toString().length, 'digits');
console.log('🗳️  Election initialized. Candidates:', CANDIDATES.join(', '));

// ============================================================
// SECTION C: Auth Routes
// ============================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }

  if (!['admin', 'voter'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or voter' });
  }

  if (users[username]) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const adminExists = Object.values(users).some(u => u.role === 'admin');
  if (role === 'admin' && adminExists) {
    return res.status(409).json({ error: 'An admin already exists' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  users[username] = { passwordHash, role, hasVoted: false };

  console.log(`👤 Registered: ${username} (${role})`);
  res.status(201).json({ message: 'Registered successfully', username, role });
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = users[username];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log(`🔓 Login: ${username} (${user.role})`);
  res.json({ token, username, role: user.role, hasVoted: user.hasVoted });
});

// GET /auth/me
app.get('/auth/me', authenticateToken, (req, res) => {
  const user = users[req.user.username];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    username: req.user.username,
    role: user.role,
    hasVoted: user.hasVoted
  });
});

// ============================================================
// SECTION D: Voting Routes
// ============================================================

// GET /vote/info
app.get('/vote/info', (req, res) => {
  res.json({
    candidates: CANDIDATES,
    base: BASE.toString(),
    publicKey: {
      n: publicKey.n.toString(),
      g: publicKey.g.toString()
    },
    voteCount,
    electionRevealed
  });
});

// GET /vote/tally
app.get('/vote/tally', authenticateToken, (req, res) => {
  res.json({
    encryptedTally: encryptedTally.toString(),
    voteCount,
    electionRevealed
  });
});

// POST /vote
app.post('/vote', authenticateToken, (req, res) => {
  const { username } = req.user;
  const user = users[username];

  if (user.role !== 'voter') {
    return res.status(403).json({ error: 'Only voters can cast votes' });
  }

  if (user.hasVoted) {
    return res.status(409).json({ error: 'You have already voted' });
  }

  if (electionRevealed) {
    return res.status(400).json({ error: 'Election has already been revealed' });
  }

  const { encryptedVote } = req.body;
  if (!encryptedVote) {
    return res.status(400).json({ error: 'No encrypted vote provided' });
  }

  try {
    const encryptedVoteBigInt = BigInt(encryptedVote);

    encryptedTally = publicKey.addition(encryptedTally, encryptedVoteBigInt);

    user.hasVoted = true;
    voteCount++;

    console.log(`🗳️  Vote received from ${username}. Total votes: ${voteCount}`);
    console.log(`   Encrypted vote (first 40 digits): ${encryptedVote.toString().slice(0, 40)}...`);

    res.json({
      message: 'Vote cast successfully',
      voteCount,
      encryptedTallyPreview: encryptedTally.toString().slice(0, 60) + '...'
    });

  } catch (err) {
    console.error('Vote processing error:', err);
    res.status(400).json({ error: 'Invalid encrypted vote format' });
  }
});

// ============================================================
// SECTION E: Admin Routes
// ============================================================

// POST /admin/reveal
app.post('/admin/reveal', authenticateToken, requireAdmin, (req, res) => {
  if (electionRevealed) {
    return res.status(400).json({
      error: 'Election already revealed',
      results: finalResults
    });
  }

  if (voteCount === 0) {
    return res.status(400).json({ error: 'No votes have been cast yet' });
  }

  try {
    console.log('🔓 Admin triggered reveal. Decrypting tally...');
    console.log(`   Processing ${voteCount} votes with a single decryption...`);

    const decryptedTally = privateKey.decrypt(encryptedTally);

    console.log(`   Decrypted tally (raw): ${decryptedTally.toString().slice(0, 60)}...`);

    const results = CANDIDATES.map((candidate, index) => {
      const slot = BASE ** BigInt(index);
      const count = Number((decryptedTally / slot) % BASE);
      return { candidate, count };
    });

    const maxVotes = Math.max(...results.map(r => r.count));
    const winners = results
      .filter(r => r.count === maxVotes)
      .map(r => r.candidate);

    finalResults = {
      results,
      winners,
      totalVotes: voteCount,
      individualDecryptions: 0,
      message: winners.length === 1
        ? `${winners[0]} wins with ${maxVotes} vote${maxVotes !== 1 ? 's' : ''}!`
        : `Tie between ${winners.join(' and ')}!`
    };

    electionRevealed = true;

    console.log('✅ Results revealed:');
    results.forEach(r => console.log(`   ${r.candidate}: ${r.count} vote(s)`));
    console.log(`   Winner(s): ${winners.join(', ')}`);

    res.json(finalResults);

  } catch (err) {
    console.error('Decryption error:', err);
    res.status(500).json({ error: 'Decryption failed' });
  }
});

// GET /admin/users
app.get('/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const userList = Object.entries(users).map(([username, data]) => ({
    username,
    role: data.role,
    hasVoted: data.hasVoted
  }));

  res.json({
    users: userList,
    voteCount,
    totalVoters: userList.filter(u => u.role === 'voter').length
  });
});

// POST /admin/reset
app.post('/admin/reset', authenticateToken, requireAdmin, async (req, res) => {
  console.log('🔄 Resetting election...');

  Object.values(users).forEach(u => {
    if (u.role === 'voter') u.hasVoted = false;
  });

  const { publicKey: pk, privateKey: sk } = await paillier.generateRandomKeys(2048);
  publicKey = pk;
  privateKey = sk;

  encryptedTally = publicKey.encrypt(0n);
  voteCount = 0;
  electionRevealed = false;
  finalResults = null;

  console.log('✅ Election reset. New keypair generated.');
  res.json({ message: 'Election reset successfully. New keypair generated.' });
});

// ============================================================
// START SERVER — always last
// ============================================================

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});