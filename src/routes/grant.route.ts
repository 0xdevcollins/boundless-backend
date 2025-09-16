import { Router } from "express";
import { body } from "express-validator";
import {
  createGrant,
  updateGrantStatus,
  submitGrantApplication,
  getAllGrants,
  getMyGrants,
  getGrantById,
  getGrantApplicationWithFeedback,
  reviewGrantApplication,
} from "../controllers/grant.controller";
import { admin, protect } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";

const router = Router();


const createGrantSchema = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 5000 })
    .withMessage("Description cannot exceed 5000 characters"),
  body("totalBudget")
    .isFloat({ min: 1 })
    .withMessage("Total budget must be a positive number"),
  body("rules")
    .trim()
    .notEmpty()
    .withMessage("Rules are required")
    .isLength({ max: 2000 })
    .withMessage("Rules cannot exceed 2000 characters"),
  body("milestones")
    .isArray({ min: 1 })
    .withMessage("At least one milestone is required"),
  body("milestones.*.title")
    .trim()
    .notEmpty()
    .withMessage("Milestone title is required")
    .isLength({ max: 100 })
    .withMessage("Milestone title cannot exceed 100 characters"),
  body("milestones.*.description")
    .trim()
    .notEmpty()
    .withMessage("Milestone description is required")
    .isLength({ max: 500 })
    .withMessage("Milestone description cannot exceed 500 characters"),
  body("milestones.*.expectedPayout")
    .isFloat({ min: 0 })
    .withMessage("Expected payout must be a non-negative number"),
];


router.post("/", protect, validateRequest(createGrantSchema), createGrant);


const updateGrantStatusSchema = [
  body("status")
    .isIn(["open", "closed"])
    .withMessage("Status must be either 'open' or 'closed'"),
];


router.patch(
  "/:id/status",
  protect,
  validateRequest(updateGrantStatusSchema),
  updateGrantStatus,
);


router.post("/grant-applications", protect, submitGrantApplication);


router.get("/", getAllGrants);


router.get("/my", protect, getMyGrants);


router.get("/:id", getGrantById);


router.get("/grant-applications/:id", getGrantApplicationWithFeedback);


router.patch("/grant-applications/:id/review", protect, reviewGrantApplication);

export default router;
