import express from "express";
import {
  initializeProject,
  updateProjectDetails,
  getProjects,
  getProjectById,
  deleteProject,
  addMilestone,
  addTeamMember,
  uploadDocument,
} from "../controllers.archive/project.controller";
import { protect } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { body } from "express-validator";
import multer from "multer";
import { Request, Response } from "express";

// Define custom request types
type MulterRequest = Request & {
  files?: {
    [fieldname: string]: Express.Multer.File[];
  };
  file?: Express.Multer.File;
};

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Project initialization validation schema
const projectInitSchema = [
  body("title").notEmpty().withMessage("Title is required"),
  body("description").notEmpty().withMessage("Description is required"),
  body("fundingGoal").isNumeric().withMessage("Funding goal must be a number"),
  body("category").notEmpty().withMessage("Category is required"),
];

// Project update validation schema
const projectUpdateSchema = [
  body("milestones").isArray().withMessage("Milestones must be an array"),
  body("team").isArray().withMessage("Team must be an array"),
];

// Milestone validation schema
const milestoneSchema = [
  body("title").notEmpty().withMessage("Title is required"),
  body("description").notEmpty().withMessage("Description is required"),
  body("amount").isNumeric().withMessage("Amount must be a number"),
  body("dueDate").isISO8601().withMessage("Invalid due date"),
];

// Team member validation schema
const teamMemberSchema = [
  body("userId").notEmpty().withMessage("User ID is required"),
  body("role").notEmpty().withMessage("Role is required"),
];

// Routes
router.post(
  "/init",
  protect,
  upload.fields([
    { name: "banner", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  validateRequest(projectInitSchema),
  (req: Request, res: Response) => {
    initializeProject(req as MulterRequest, res);
  },
);

router.put(
  "/:id",
  protect,
  upload.fields([
    { name: "whitepaper", maxCount: 1 },
    { name: "pitchDeck", maxCount: 1 },
  ]),
  validateRequest(projectUpdateSchema),
  (req: Request, res: Response) => {
    updateProjectDetails(req as MulterRequest, res);
  },
);

router.get("/", (req: Request, res: Response) => {
  getProjects(req, res);
});

router.get("/:id", (req: Request, res: Response) => {
  getProjectById(req, res);
});

router.delete("/:id", protect, (req: Request, res: Response) => {
  deleteProject(req, res);
});

router.post(
  "/:id/milestones",
  protect,
  validateRequest(milestoneSchema),
  (req: Request, res: Response) => {
    addMilestone(req, res);
  },
);

router.post(
  "/:id/team",
  protect,
  upload.single("avatar"),
  validateRequest(teamMemberSchema),
  (req: Request, res: Response) => {
    addTeamMember(req as MulterRequest, res);
  },
);

router.post(
  "/:id/documents",
  protect,
  upload.single("file"),
  body("type")
    .isIn(["whitepaper", "pitchDeck"])
    .withMessage("Invalid document type"),
  (req: Request, res: Response) => {
    uploadDocument(req as MulterRequest, res);
  },
);

export default router;
