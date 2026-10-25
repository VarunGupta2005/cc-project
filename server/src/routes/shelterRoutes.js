import { Router } from 'express';
import {
  getAllShelters,
  getRecommendedShelters,
} from '../controllers/shelterController.js';

const router = Router();

router.get('/', getAllShelters);
router.get('/recommended', getRecommendedShelters);

export default router;
