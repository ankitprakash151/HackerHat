/**
 * Typical Vibe-Coded Prototype App
 * Contains real-world insecure patterns that VibeShield detects & patches
 */
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// In-memory demo user store
const users = [
  { id: '1', username: 'admin', password: 'password123', role: 'admin' }
];

// Vulnerability 1: Plaintext password comparison & MD5 hashing
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  // Flaw 1a: Plaintext comparison
  if (user.password === req.body.password) {
    // Flaw 1b: Insecure MD5 hashing for session token
    const tokenHash = crypto.createHash('md5').update(password).digest('hex');

    // Flaw 2: Hardcoded JWT secret & algorithm 'none'
    const token = jwt.sign(
      { userId: user.id, role: user.role, hash: tokenHash },
      'secret', // Hardcoded secret
      { algorithm: 'none' } // Disables signature verification
    );

    return res.json({ token });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
});

// Vulnerability 3: Missing authentication middleware on sensitive administrative routes
app.get('/api/admin/users', (req, res) => {
  // Missing authenticateToken or requireRole('admin') middleware!
  res.json({ users });
});

app.delete('/api/users/:id', (req, res) => {
  // Anyone can delete users without being logged in!
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx !== -1) users.splice(idx, 1);
  res.json({ success: true, message: 'User deleted' });
});

// Vulnerability 4: Exposed environment variables route (leaks all API keys and DB credentials)
app.get('/debug/vars', (req, res) => {
  // Catastrophic secret leak
  res.json(process.env);
});

// Vulnerability 5: Unauthenticated backdoor route
app.all('/test-backdoor', (req, res) => {
  res.json({ debug: true, status: 'backdoor active' });
});

app.listen(8080, () => {
  console.log('Vulnerable test target running on port 8080');
});
