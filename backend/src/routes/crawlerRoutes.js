import express from "express";
import * as crawlerController from "../controllers/crawlerController.js";

const router = express.Router();

router.post("/config", crawlerController.saveConfig);
router.get("/config", crawlerController.getConfig);
router.post("/run", crawlerController.triggerCrawl);
router.get("/status", crawlerController.getStatus);

export default router;
