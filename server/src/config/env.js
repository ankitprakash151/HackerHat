import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5001,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/vibeshield',
  JWT_SECRET: process.env.JWT_SECRET || 'vibeshield_dev_jwt_secret_change_in_production_123',
  
  // GitHub OAuth
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',

  // CLI & Docker tool paths
  SEMGREP_PATH: process.env.SEMGREP_PATH || 'semgrep',
  GITLEAKS_PATH: process.env.GITLEAKS_PATH || 'gitleaks',
  DOCKER_PATH: process.env.DOCKER_PATH || 'docker',
  ZAP_DOCKER_IMAGE: process.env.ZAP_DOCKER_IMAGE || 'zaproxy/zap-baseline:stable',

  // Directory paths
  TEMP_UPLOAD_DIR: path.resolve(__dirname, '../../temp_uploads'),
  REPORTS_STORAGE_DIR: path.resolve(__dirname, '../../reports_storage'),
  RULES_DIR: path.resolve(__dirname, '../rules'),

  // Timeouts & Resource Caps
  DAST_TIMEOUT_MS: parseInt(process.env.DAST_TIMEOUT_MS, 10) || 180000, // 3 minutes
  MAX_UPLOAD_SIZE_BYTES: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES, 10) || 50 * 1024 * 1024 // 50MB
};

// Security check in production
if (env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('dev_jwt_secret')) {
    console.warn('[SECURITY WARNING] Insecure default JWT_SECRET detected in production!');
  }
  if (!process.env.MONGODB_URI) {
    console.warn('[CONFIG WARNING] MONGODB_URI not set for production!');
  }
}
