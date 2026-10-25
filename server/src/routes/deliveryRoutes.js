import { Router } from 'express';
import {
  verifyPickup,
  confirmDelivery,
  getAuditHistory,
} from '../controllers/deliveryController.js';

const router = Router();

router.post('/verify-pickup', verifyPickup);
router.post('/confirm-delivery', confirmDelivery);
router.get('/audits', getAuditHistory);

export default router;
