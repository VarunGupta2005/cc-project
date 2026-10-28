import express from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import {
  getAdminOverview,
  getOrganizations,
  verifyOrganization,
  getDispatchMapData,
  getComplianceAudits,
} from '../controllers/adminController.js';

const router = express.Router();

// Strict authorization: Platform Administrator only
router.use(authenticate, requireRole('ADMIN'));

router.get('/overview', getAdminOverview);
router.get('/organizations', getOrganizations);
router.patch('/organizations/:id/verify', verifyOrganization);
router.get('/dispatch-map', getDispatchMapData);
router.get('/audits', getComplianceAudits);

export default router;
