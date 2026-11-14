require('dotenv').config();
const express = require('express');
const cors = require('cors');
const auth = require('./routes/auth');
const api = require('./routes/api');
const { initDb } = require('./Database/database');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'VoltTrack Lite', db: 'PostgreSQL' }));
app.use('/api/auth', auth);
app.use('/api', api);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(port, () => console.log(`VoltTrack API running at http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Failed to initialize PostgreSQL database:', err.message);
    process.exit(1);
  });
