import { Router } from "express";
import {
  getTeamInvitation,
  acceptTeamInvitation,
  declineTeamInvitation,
  getProjectTeamInvitations,
  getUserTeamInvitations,
  cancelTeamInvitation,
} from "./team-invitation.controller";
import { protect } from "../../middleware/auth";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TeamInvitation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, accepted, declined, expired]
 *         token:
 *           type: string
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         isExpired:
 *           type: boolean
 *         isValid:
 *           type: boolean
 *         project:
 *           type: object
 *         invitedBy:
 *           type: object
 *         invitedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/team-invitations/{token}:
 *   get:
 *     summary: Get team invitation by token
 *     description: Retrieve team invitation details using the invitation token
 *     tags: [Team Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Team invitation token
 *     responses:
 *       200:
 *         description: Team invitation retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation:
 *                       $ref: '#/components/schemas/TeamInvitation'
 *       400:
 *         description: Bad request - Invalid token
 *       404:
 *         description: Invitation not found
 *       500:
 *         description: Internal server error
 */
router.get("/:token", getTeamInvitation);

/**
 * @swagger
 * /api/team-invitations/{token}/accept:
 *   post:
 *     summary: Accept team invitation
 *     description: Accept a team invitation to join a project team
 *     tags: [Team Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Team invitation token
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 description: Optional role specification for the team member
 *                 example: "Developer"
 *     responses:
 *       200:
 *         description: Team invitation accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation:
 *                       $ref: '#/components/schemas/TeamInvitation'
 *                     project:
 *                       type: object
 *       400:
 *         description: Bad request - Invalid token or invitation expired
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post("/:token/accept", protect, acceptTeamInvitation);

/**
 * @swagger
 * /api/team-invitations/{token}/decline:
 *   post:
 *     summary: Decline team invitation
 *     description: Decline a team invitation
 *     tags: [Team Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Team invitation token
 *     responses:
 *       200:
 *         description: Team invitation declined successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation:
 *                       $ref: '#/components/schemas/TeamInvitation'
 *       400:
 *         description: Bad request - Invalid token or invitation expired
 *       500:
 *         description: Internal server error
 */
router.post("/:token/decline", declineTeamInvitation);

/**
 * @swagger
 * /api/team-invitations:
 *   get:
 *     summary: Get user team invitations
 *     description: Get all team invitations for the authenticated user
 *     tags: [Team Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User team invitations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TeamInvitation'
 *                     total:
 *                       type: number
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, getUserTeamInvitations);

/**
 * @swagger
 * /api/projects/{projectId}/team-invitations:
 *   get:
 *     summary: Get project team invitations
 *     description: Get all team invitations for a specific project (project owner only)
 *     tags: [Team Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project team invitations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TeamInvitation'
 *                     total:
 *                       type: number
 *       400:
 *         description: Bad request - Invalid project ID
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Project owner access required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/projects/:projectId/team-invitations",
  protect,
  getProjectTeamInvitations,
);

/**
 * @swagger
 * /api/team-invitations/{invitationId}:
 *   delete:
 *     summary: Cancel team invitation
 *     description: Cancel a team invitation (project owner only)
 *     tags: [Team Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Team invitation ID
 *     responses:
 *       200:
 *         description: Team invitation cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitation:
 *                       $ref: '#/components/schemas/TeamInvitation'
 *       400:
 *         description: Bad request - Invalid invitation ID
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Project owner access required
 *       500:
 *         description: Internal server error
 */
router.delete("/:invitationId", protect, cancelTeamInvitation);

export default router;
