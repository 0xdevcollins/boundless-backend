import express from "express";
import {
  deployProject,
  fundProject,
  releaseMilestone,
  getContractState,
  getMilestoneStatus,
  verifyTransaction,
  getTransactionHistory,
} from "../controllers/blockchain.controller";
import { protect } from "../middleware/auth";

const router = express.Router();

// Project contract routes
router.post("/projects/deploy", protect, deployProject);
router.post("/projects/:projectId/fund", protect, fundProject);
router.post("/projects/:projectId/milestones/:milestoneId/release", protect, releaseMilestone);
router.get("/projects/:projectId/state", getContractState);
router.get("/projects/:projectId/milestones/:milestoneId", getMilestoneStatus);

// Transaction routes
router.get("/transactions/:transactionHash", verifyTransaction);
router.get("/projects/:projectId/transactions", getTransactionHistory);

export default router; 