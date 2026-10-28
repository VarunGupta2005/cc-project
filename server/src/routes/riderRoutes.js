import express from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import {
  assignRider,
  acceptTask,
  cancelAssignment,
  getMyTasks,
  getShelterRiders,
  registerShelterRider,
  updateRiderAvailability,
} from '../controllers/riderController.js';

const router = express.Router();

// Shelter administrator routes (managing organization's riders)
router.get('/shelter-riders', authenticate, requireRole('SHELTER', 'ADMIN'), getShelterRiders);
router.post('/register', authenticate, requireRole('SHELTER', 'ADMIN'), registerShelterRider);
router.post('/assign', authenticate, requireRole('SHELTER', 'ADMIN'), assignRider);
router.post('/assignments/:id/cancel', authenticate, cancelAssignment);

// Rider portal routes
router.get('/my-tasks', authenticate, requireRole('RIDER', 'COURIER', 'ADMIN'), getMyTasks);
router.post('/tasks/:id/accept', authenticate, requireRole('RIDER', 'COURIER', 'ADMIN'), acceptTask);
router.patch('/availability', authenticate, requireRole('RIDER', 'COURIER', 'ADMIN'), updateRiderAvailability);

export default router;
