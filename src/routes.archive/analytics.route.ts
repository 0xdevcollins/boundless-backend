import express from "express";
import analyticsController from "../controllers.archive/analytics.controller";

const router = express.Router();

router.get("/overview", analyticsController.getOverview);
router.get("/projects/:projectId", analyticsController.getProjectAnalytics);
router.get("/contributions", analyticsController.getContributionsAnalytics);
router.get("/engagement", analyticsController.getEngagementAnalytics);

export default router;
