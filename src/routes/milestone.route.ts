/**
 * @openapi
 * /milestones/{milestoneId}/proof:
 *   post:
 *     summary: Submit proof for a milestone
 *     tags:
 *       - Milestones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: milestoneId
 *         schema:
 *           type: string
 *         required: true
 *         description: The milestone ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: Description of the milestone deliverables
 *                 example: "Completed the frontend implementation with all required features. The application is now fully functional with user authentication, dashboard, and reporting capabilities."
 *               proofLinks:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 minItems: 1
 *                 maxItems: 10
 *                 description: Array of URLs providing proof of milestone completion
 *                 example: ["https://github.com/user/repo/pull/123", "https://app-demo.example.com", "https://docs.google.com/document/d/abc123"]
 *             required:
 *               - description
 *               - proofLinks
 *     responses:
 *       201:
 *         description: Milestone proof submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     milestone:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         status:
 *                           type: string
 *                           example: "submitted"
 *                         proofDescription:
 *                           type: string
 *                         proofLinks:
 *                           type: array
 *                           items:
 *                             type: string
 *                         submittedAt:
 *                           type: string
 *                           format: date-time
 *                 message:
 *                   type: string
 *                   example: "Milestone proof submitted successfully"
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Not authorized to submit proof for this milestone
 *       404:
 *         description: Milestone not found
 *       409:
 *         description: Milestone not in submittable state
 *       500:
 *         description: Internal server error
 * /milestones/{id}/review:
 *   patch:
 *     summary: Admin review of a milestone (approve or request revision)
 *     tags:
 *       - Milestones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The milestone ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 description: "Set to 'approved' to trigger payout, or 'rejected' to request revision."
 *               adminNote:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional note from the admin
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Milestone review processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input or status
 *       404:
 *         description: Milestone not found
 *       500:
 *         description: Server error
 */
import { Router } from "express";
import {
  reviewMilestone,
  submitMilestoneProof,
} from "../controllers/milestone.controller";
import { protect } from "../middleware/auth";
import { roleMiddleware } from "../utils/jwt.utils";
import { validateRequest } from "../middleware/validateRequest";
import { body, param } from "express-validator";

const router = Router();

router.post(
  "/:milestoneId/proof",
  protect,
  validateRequest([
    param("milestoneId").isMongoId().withMessage("Invalid milestone ID"),
    body("description")
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage("Description must be between 1 and 2000 characters"),
    body("proofLinks")
      .isArray({ min: 1, max: 10 })
      .withMessage("Proof links must be an array with 1-10 items"),
    body("proofLinks.*")
      .isURL()
      .withMessage("Each proof link must be a valid URL"),
  ]),
  submitMilestoneProof,
);

router.patch(
  "/:id/review",
  protect,
  roleMiddleware(["admin"]),
  validateRequest([
    param("id").isMongoId().withMessage("Invalid milestone ID"),
    body("status")
      .isIn(["approved", "rejected"])
      .withMessage("Status must be 'approved' or 'rejected'"),
    body("adminNote").optional().isString().isLength({ max: 1000 }),
  ]),
  reviewMilestone,
);

export default router;
