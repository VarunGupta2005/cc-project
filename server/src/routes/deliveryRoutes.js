import { Router } from 'express';
import {
  verifyPickup,
  confirmDelivery,
  getAuditHistory,
} from '../controllers/deliveryController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
};

router.post('/verify-pickup', optionalAuth, verifyPickup);
router.post('/confirm-delivery', optionalAuth, confirmDelivery);
router.get('/audits', optionalAuth, getAuditHistory);

export default router;
