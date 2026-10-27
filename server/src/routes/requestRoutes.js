import { Router } from 'express';
import {
  getAllRequests,
  createRequest,
  cancelRequest,
} from '../controllers/requestController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
};

router.get('/', getAllRequests);
router.post('/', optionalAuth, createRequest);
router.delete('/:id', optionalAuth, cancelRequest);

export default router;
