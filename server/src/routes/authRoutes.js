import { Router } from 'express';
import { register, login, getProfile, updateOrganization } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getProfile);
router.patch('/organizations/:id', authenticate, updateOrganization);

export default router;
