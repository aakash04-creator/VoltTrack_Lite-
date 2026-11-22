const router = require('express').Router();
const db = require('../Database/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

const token = (u) =>
  jwt.sign(
    { id: u.id, name: u.name, email: u.email, role: u.role },
    process.env.JWT_SECRET || 'volttrack-demo-secret',
    { expiresIn: '12h' }
  );

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Name, valid email, and password (6+ characters) are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role',
      [name, email.toLowerCase(), hash]
    );
    const user = rows[0];
    res.status(201).json({ token: token(user), user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [(req.body.email || '').toLowerCase()]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = { id: u.id, name: u.name, email: u.email, role: u.role };
    res.json({ token: token(user), user });
  } catch (e) {
    next(e);
  }
});

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

module.exports = router;
