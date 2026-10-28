require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/db');
const { ensureContainerExists } = require('./config/azureStorage');

// Route Handlers
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const filesRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 5000;

// Security and Utility Middleware
// Configure Helmet with relaxed CSP to allow loading fonts and inline scripts for our UI
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend static UI from public/
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);

// Fallback for unmatched API routes (404)
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found.`
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);

  // Handle Multer file size limit exceeded (10 MB limit)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File size too large. Maximum allowed size is 10 MB.'
    });
  }

  // Handle Multer invalid file type filter
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server after connecting to MongoDB and validating Azure Storage
const startServer = async () => {
  try {
    // 1. Connect to MongoDB Atlas
    await connectDB();

    // 2. Ensure private Azure Blob container exists
    await ensureContainerExists();

    // 3. Start listening
    const server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`Cloud-Native Vault Server running on port: ${PORT}`);
      console.log(`Health Check: http://localhost:${PORT}/api/health`);
      console.log(`Web Dashboard: http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('====================================================');
    });

    // Graceful Shutdown on SIGINT/SIGTERM (Cloud-Native 12-Factor App)
    const handleShutdown = (signal) => {
      console.log(`\nReceived ${signal}. Gracefully shutting down...`);
      server.close(() => {
        console.log('HTTP server closed. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start application:', err.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
