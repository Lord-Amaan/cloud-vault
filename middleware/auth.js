const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware:
 * Extracts Bearer token from the HTTP Authorization header, verifies signature
 * and expiry using JWT_SECRET, and attaches the authenticated user to req.user.
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Missing or malformed Authorization header (Expected: "Bearer <token>").'
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('FATAL: JWT_SECRET environment variable is missing.');
      return res.status(500).json({
        success: false,
        message: 'Server security configuration error.'
      });
    }

    const decoded = jwt.verify(token, secret);

    // Attach user payload to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token.'
    });
  }
};

module.exports = authenticateToken;
