import express from 'express';
import { getLikes, toggleLike } from '../controllers/changelogController.js';

const router = express.Router();

router.get('/likes', getLikes);
router.post('/likes/:sha/toggle', toggleLike);

export default router;
