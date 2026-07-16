require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const checklistRoutes = require('./routes/checklists');
const rosterRoutes = require('./routes/rosters');
const executiveRoutes = require('./routes/executive');
const managerRoutes = require('./routes/manager');
const mastersRoutes = require('./routes/masters');
const complaintRoutes = require('./routes/complaints');
const ticketRoutes = require('./routes/tickets');
const complianceRoutes = require('./routes/compliance');
const licamRoutes = require('./routes/licam');


const app = express();
const PORT = process.env.PORT || 8240;

// Security middleware
app.use(helmet(
  { crossOriginResourcePolicy: false }
));
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
// Disable rate limiting in development
// if (process.env.NODE_ENV === 'production') {
//   app.use(limiter);
// }

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/rosters', rosterRoutes);
app.use('/api/executive', executiveRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/reports', require('./routes/reports'));
app.use('/api/masters', mastersRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/licam', licamRoutes);
app.use('/api/qc', require('./routes/qc'));
app.use('/api/rotation', require('./routes/rotation'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  const { stopWorker } = require('./services/emailQueueService');
  stopWorker();
  process.exit(0);
});

process.on('SIGINT', () => {
  const { stopWorker } = require('./services/emailQueueService');
  stopWorker();
  process.exit(0);
});

app.listen(PORT, () => {
  const { startWorker } = require('./services/emailQueueService');
  startWorker();
});