import express from "express";
import reportsController from "../controllers.archive/report.controller";

const router = express.Router();

router.get("/project/:projectId", reportsController.getProjectReport);
router.get("/activity", reportsController.getActivityReport);
router.get("/funding", reportsController.getFundingReport);

export default router;
