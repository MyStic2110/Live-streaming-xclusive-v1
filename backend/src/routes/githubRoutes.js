import express from "express";
import * as githubController from "../controllers/githubController.js";

const router = express.Router();

router.post("/config", githubController.saveConfig);
router.get("/config", githubController.getConfig);
router.post("/run", githubController.triggerIngestion);
router.get("/status", githubController.getStatus);
router.get("/tree", githubController.getRepoTree);

export default router;
