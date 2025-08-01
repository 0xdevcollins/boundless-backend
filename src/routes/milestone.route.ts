/**
 * @openapi
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
import { protect } from "../middleware/auth";
import { roleMiddleware } from "../utils/jwt.utils";
import { validateRequest } from "../middleware/validateRequest";
import { body, param } from "express-validator";

const router = Router();

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
);

router.patch(
  "/api/campaigns/:id/milestones/:milestoneId/status",
  protect,
  // roleMiddleware will be handled in controller for flexible role logic
  validateRequest([
    param("id").isMongoId().withMessage("Invalid campaign ID"),
    param("milestoneId").isMongoId().withMessage("Invalid milestone ID"),
    body("status")
      .isIn(["pending", "approved", "rejected", "released", "disputed"])
      .withMessage("Invalid status value"),
    body("disputeReason").optional().isString().isLength({ max: 1000 }),
  ]),
  // controller to be implemented
  require("../controllers/milestone.controller").updateMilestoneStatus,
);

export default router;
