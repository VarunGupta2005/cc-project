import { Router } from 'express';
import {
  createListing,
  getNearbyListings,
  claimListing,
  getAllListings,
  getListingRecommendations,
} from '../controllers/listingController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

// Public / Authenticated read routes
router.get('/', (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, getAllListings);
router.get('/nearby', getNearbyListings);
router.get('/:id/recommendations', getListingRecommendations);

// Protected routes (optional auth middleware so demo scripts can test easily with or without token)
router.post('/', (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, createListing);

router.post('/:id/claim', (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, claimListing);

export default router;
