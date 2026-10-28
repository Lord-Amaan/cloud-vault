const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas cluster using Mongoose.
 * Uses environment variable MONGODB_URI.
 * Configured with connection pooling suitable for cloud deployments.
 */
const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI;
    if (!connStr) {
      console.error('FATAL: MONGODB_URI environment variable is not defined.');
      process.exit(1);
    }

    const conn = await mongoose.connect(connStr, {
      maxPoolSize: 10, // Maintain up to 10 socket connections (ideal for M0 free tier limits)
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`[MongoDB Atlas] Connected successfully to host: ${conn.connection.host}`);
    console.log(`[MongoDB Atlas] Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB Atlas] Connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
