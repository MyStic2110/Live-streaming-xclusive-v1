// backend/src/routes/coldEmailRoutes.js
import express from 'express';
import * as coldEmailController from '../controllers/coldEmailController.js';

const router = express.Router();

// Campaign CRUD
router.post('/campaign', coldEmailController.createCampaign);
router.get('/campaign/:id', coldEmailController.getCampaign);
router.patch('/campaign/:id', coldEmailController.updateCampaign);
router.delete('/campaign/:id', coldEmailController.deleteCampaign);

// Contact upload
router.post('/campaign/:id/contacts', coldEmailController.uploadContacts);

// Generate email templates
router.post('/campaign/:id/generate', coldEmailController.generateTemplates);

// Launch campaign
router.post('/campaign/:id/launch', coldEmailController.launchCampaign);

// Analytics
router.get('/campaign/:id/analytics', coldEmailController.getAnalytics);

export default router;
