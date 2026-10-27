import { Router } from 'express';
import { getSystemMetrics } from '../controllers/analyticsController.js';

const router = Router();

router.get('/metrics', getSystemMetrics);

export default router;
