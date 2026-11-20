import express from 'express';
import { ScanController } from '../controllers/scanController.js';

const router = express.Router();

router.post('/', ScanController.createScan);
router.get('/:id', ScanController.getScanStatus);
router.get('/:id/findings', ScanController.getScanFindings);
router.get('/:id/comparison', ScanController.getBeforeAfterComparison);

export default router;
