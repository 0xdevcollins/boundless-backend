import express from "express";
import grantRoutes from "./grant.route";
import grantApplicationRoutes from "./grant-application.route";
import projectVotingRoutes from "./project-voting.route";
import milestoneRoutes from "./milestone.route";
import newsletterRoutes from "./newsletter.route";

const router = express.Router();

router.use("/api", grantRoutes);
router.use("/api", grantApplicationRoutes);
router.use("/api", projectVotingRoutes);
router.use("/api/milestones", milestoneRoutes);
router.use("/newsletter", newsletterRoutes);
export default router;
