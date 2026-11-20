import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;
let isInMemoryMode = false;

// In-Memory storage fallback for local development when MongoDB daemon is not running
const inMemoryStore = {
  users: new Map(),
  targets: new Map(),
  scans: new Map(),
  findings: new Map(),
  reports: new Map()
};

export async function connectDB() {
  if (isConnected) return;

  try {
    // Attempt standard Mongoose connection with timeout
    mongoose.set('strictQuery', false);
    
    // Connect with a reasonable serverSelectionTimeout
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      autoIndex: true
    });

    isConnected = true;
    isInMemoryMode = false;
    logger.info(`MongoDB connected successfully to host: ${conn.connection.host}`);
  } catch (err) {
    logger.warn(`Could not connect to MongoDB at "${env.MONGODB_URI}". Falling back to VibeShield Embedded Memory Store for seamless development & testing. Error: ${err.message}`);
    isConnected = true;
    isInMemoryMode = true;
  }
}

export function isUsingMemoryStore() {
  return isInMemoryMode || mongoose.connection.readyState !== 1;
}

export function getMemoryStore() {
  return inMemoryStore;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  isConnected = false;
}
