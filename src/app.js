const express = require('express');
const cors = require('cors');
const meterRoutes = require('./routes/meterRoutes');
const readingRoutes = require('./routes/readingRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/meters', meterRoutes);
app.use('/api/readings', readingRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
