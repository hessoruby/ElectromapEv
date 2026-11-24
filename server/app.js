const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const stationRoutes = require('./routes/stations');
const chargerRoutes = require('./routes/chargers');
const reviewRoutes = require('./routes/reviews');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const { protect, adminOnly } = require('./middleware/auth');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { corsOriginCallback } = require('./config/cors');

const app = express();

app.use(helmet());
app.use(cors({ origin: corsOriginCallback('CORS'), credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/chargers', chargerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', protect, adminOnly, adminRoutes);

app.use(errorHandler);

module.exports = app;
