import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { VerifyController } from '../controllers/verifyController.js';
import { env } from '../config/env.js';

const router = express.Router();

// Ensure upload directory exists
fs.mkdirSync(env.TEMP_UPLOAD_DIR, { recursive: true });

// Safe Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `upload-${uniqueSuffix}.zip`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_BYTES
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      return cb(new Error('Only .zip archive files are permitted for security.'));
    }
    cb(null, true);
  }
});

// Verification endpoints
router.post('/token', VerifyController.getVerificationToken);
router.post('/github', VerifyController.verifyGitHub);
router.post('/zip', upload.single('archive'), VerifyController.verifyZip);
router.post('/dns-file', VerifyController.verifyLiveUrl);
router.post('/demo-bypass', VerifyController.demoBypass);

export default router;
