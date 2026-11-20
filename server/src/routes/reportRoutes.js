import express from 'express';
import { ReportController } from '../controllers/reportController.js';

const router = express.Router();

router.get('/:scanId', ReportController.getReport);
router.get('/:scanId/download', ReportController.downloadReport);
router.get('/:scanId/prompt-bundle', ReportController.getPromptBundle);

export default router;
