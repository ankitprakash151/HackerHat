import express from 'express';
import { TargetController } from '../controllers/targetController.js';

const router = express.Router();

router.get('/', TargetController.listTargets);
router.post('/', TargetController.createTarget);
router.get('/:id', TargetController.getTargetById);
router.delete('/:id', TargetController.deleteTarget);

export default router;
