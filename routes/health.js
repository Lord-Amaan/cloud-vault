const express = require('express');
const mongoose = require('mongoose');
const { checkStorageHealth } = require('../config/azureStorage');

const router = express.Router();

const mongoStateMap = {
  0: 'DISCONNECTED',
  1: 'CONNECTED',
  2: 'CONNECTING',
  3: 'DISCONNECTING'
};

/**
 * @route   GET /api/health
 * @desc    Cloud Liveness & Readiness probe
 * @access  Public
 */
router.get('/', async (req, res) => {
  const mongoStatus = mongoStateMap[mongoose.connection.readyState] || 'UNKNOWN';
  const isDbHealthy = mongoose.connection.readyState === 1;

  let storageStatus = { status: 'NOT_CONFIGURED' };
  try {
    storageStatus = await checkStorageHealth();
  } catch (err) {
    storageStatus = { status: 'ERROR', message: err.message };
  }

  const overallStatus = isDbHealthy ? 'UP' : 'DEGRADED';
  const statusCode = overallStatus === 'UP' ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      mongodb: {
        status: mongoStatus,
        database: mongoose.connection.name || 'none'
      },
      azureBlobStorage: storageStatus
    },
    system: {
      nodeVersion: process.version,
      memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
    }
  });
});

module.exports = router;
