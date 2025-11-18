import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon, {
  HackathonStatus,
  IHackathon,
} from "../../models/hackathon.model.js";
import Organization from "../../models/organization.model.js";
import User from "../../models/user.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import HackathonJudgingScore from "../../models/hackathon-judging-score.model.js";
import HackathonSubmissionComment from "../../models/hackathon-submission-comment.model.js";
import HackathonSubmissionVote from "../../models/hackathon-submission-vote.model.js";
import Notification from "../../models/notification.model.js";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendCreated,
  sendInternalServerError,
} from "../../utils/apiResponse.js";
import {
  AuthenticatedRequest,
  canManageHackathons,
  transformRequestBody,
  validatePublishRequirements,
} from "./hackathon.helpers.js";
import { generateHackathonSlug } from "../../utils/hackathon.utils.js";
import NotificationService from "../notifications/notification.service.js";
import EmailTemplatesService from "../../services/email/email-templates.service.js";
import { NotificationType } from "../../models/notification.model.js";
import { config } from "../../config/main.config.js";

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons:
 *   post:
 *     summary: Publish a hackathon
 *     description: Publish a hackathon (requires all tabs to be complete). Can publish from draft or create new.
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const publishHackathon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;
    // Check both body and query for draftId (body takes precedence)
    const draftId = (req.body.draftId || req.query.draftId) as
      | string
      | undefined;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can publish hackathons for this organization",
      );
      return;
    }

    let hackathon: IHackathon | null = null;

    // If draftId is provided, update existing draft; otherwise create new
    if (draftId && mongoose.Types.ObjectId.isValid(draftId)) {
      hackathon = await Hackathon.findOne({
        _id: draftId,
        organizationId: orgId,
        status: HackathonStatus.DRAFT,
      });

      if (!hackathon) {
        sendNotFound(res, "Draft not found");
        return;
      }

      // Merge new data with existing draft (exclude draftId from body)
      const { draftId: _, ...bodyWithoutDraftId } = req.body;
      const updateData = transformRequestBody(bodyWithoutDraftId);
      Object.assign(hackathon, updateData);
    } else {
      // Create new hackathon (exclude draftId from body)
      const { draftId: _, ...bodyWithoutDraftId } = req.body;
      const updateData = transformRequestBody(bodyWithoutDraftId);
      hackathon = new Hackathon({
        organizationId: new mongoose.Types.ObjectId(orgId),
        status: HackathonStatus.DRAFT,
        ...updateData,
      });
    }

    // Validate all required fields
    const validation = validatePublishRequirements(hackathon);
    if (!validation.valid) {
      sendValidationError(res, "Validation failed", {
        publish: { msg: validation.errors.join("; ") },
      });
      return;
    }

    // Ensure slug exists before publishing
    if (!hackathon.slug && hackathon.title) {
      hackathon.slug = await generateHackathonSlug(
        hackathon.title,
        hackathon._id?.toString(),
      );
    }

    // Set status to published and set publishedAt
    hackathon.status = HackathonStatus.PUBLISHED;
    hackathon.publishedAt = new Date();
    await hackathon.save();

    // Add hackathon ID to organization.hackathons array if not already present
    // Use Mongoose's id getter which always returns a string, ensuring type safety
    const hackathonIdString = hackathon.id; // Mongoose Document.id is always a string
    const hackathonObjectId = new mongoose.Types.ObjectId(hackathonIdString);

    // Check if hackathon is already in organization's hackathons array
    // Compare string representations for reliable comparison
    const isAlreadyAdded = organization.hackathons.some(
      (id: mongoose.Types.ObjectId) => id.toString() === hackathonIdString,
    );

    if (!isAlreadyAdded) {
      await Organization.findByIdAndUpdate(orgId, {
        $push: { hackathons: hackathonObjectId },
      });
    }

    // Send notifications
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const creatorName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;

      // Notify organization members about hackathon publication
      const allMembers = [organization.owner, ...organization.members].filter(
        (email) => email !== user.email,
      ); // Don't notify the creator

      if (allMembers.length > 0) {
        const memberUsers = await User.find({
          email: { $in: allMembers },
        }).select(
          "email profile.firstName profile.lastName settings.notifications",
        );

        await NotificationService.notifyTeamMembers(
          memberUsers.map((member) => ({
            userId: member._id,
            email: member.email,
            name:
              `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
              member.email,
          })),
          {
            type: NotificationType.HACKATHON_PUBLISHED,
            title: `New hackathon published: ${hackathon.title || "Hackathon"}`,
            message: `${creatorName} has published a new hackathon "${hackathon.title || "Hackathon"}"`,
            data: {
              hackathonId: hackathon._id,
              hackathonName: hackathon.title || "Hackathon",
              hackathonSlug: hackathon.slug,
              organizationId: new mongoose.Types.ObjectId(orgId),
            },
            emailTemplate: EmailTemplatesService.getTemplate(
              "hackathon-published",
              {
                hackathonId: (
                  hackathon._id as mongoose.Types.ObjectId
                ).toString(),
                hackathonName: hackathon.title || "Hackathon",
                hackathonSlug: hackathon.slug,
                organizationId: orgId,
                unsubscribeUrl: undefined, // Will be set per recipient
              },
            ),
          },
        );
      }

      // Notify the creator
      await NotificationService.sendSingleNotification(
        {
          userId: user._id,
          email: user.email,
          name: creatorName,
          preferences: user.settings?.notifications,
        },
        {
          type: NotificationType.HACKATHON_PUBLISHED,
          title: `Hackathon "${hackathon.title || "Hackathon"}" published`,
          message: `Your hackathon "${hackathon.title || "Hackathon"}" has been successfully published.`,
          data: {
            hackathonId: hackathon._id,
            hackathonName: hackathon.title || "Hackathon",
            hackathonSlug: hackathon.slug,
            organizationId: new mongoose.Types.ObjectId(orgId),
          },
          emailTemplate: EmailTemplatesService.getTemplate(
            "hackathon-published",
            {
              hackathonId: (
                hackathon._id as mongoose.Types.ObjectId
              ).toString(),
              hackathonName: hackathon.title || "Hackathon",
              hackathonSlug: hackathon.slug,
              organizationId: orgId,
              unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(user.email)}`,
            },
          ),
        },
      );
    } catch (notificationError) {
      console.error(
        "Error sending hackathon published notifications:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendCreated(res, hackathon, "Hackathon published successfully");
  } catch (error) {
    console.error("Publish hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to publish hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}:
 *   put:
 *     summary: Update a published hackathon
 *     description: Update a published hackathon
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const updateHackathon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can update hackathons for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    });

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    const updateData = transformRequestBody(req.body);
    const oldStatus = hackathon.status;

    Object.assign(hackathon, updateData);
    await hackathon.save();

    // Send notifications
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const updaterName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;
      const statusChanged = oldStatus !== hackathon.status;
      const changes = Object.keys(updateData).join(", ");

      // Determine notification type based on status change
      let notificationType = NotificationType.HACKATHON_UPDATED;
      if (statusChanged) {
        notificationType = NotificationType.HACKATHON_STATUS_CHANGED;
        if (hackathon.status === HackathonStatus.ACTIVE) {
          notificationType = NotificationType.HACKATHON_ACTIVE;
        } else if (hackathon.status === HackathonStatus.COMPLETED) {
          notificationType = NotificationType.HACKATHON_COMPLETED;
        } else if (hackathon.status === HackathonStatus.CANCELLED) {
          notificationType = NotificationType.HACKATHON_CANCELLED;
        }
      }

      // Notify organization members
      const allMembers = [organization.owner, ...organization.members].filter(
        (email) => email !== user.email,
      );

      if (allMembers.length > 0) {
        const memberUsers = await User.find({
          email: { $in: allMembers },
        }).select(
          "email profile.firstName profile.lastName settings.notifications",
        );

        await NotificationService.notifyTeamMembers(
          memberUsers.map((member) => ({
            userId: member._id,
            email: member.email,
            name:
              `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
              member.email,
          })),
          {
            type: notificationType,
            title: statusChanged
              ? `Hackathon status changed: ${hackathon.title || "Hackathon"}`
              : `Hackathon updated: ${hackathon.title || "Hackathon"}`,
            message: statusChanged
              ? `${updaterName} has changed the status of "${hackathon.title || "Hackathon"}" from ${oldStatus} to ${hackathon.status}`
              : `${updaterName} has updated "${hackathon.title || "Hackathon"}"`,
            data: {
              hackathonId: hackathon._id,
              hackathonName: hackathon.title || "Hackathon",
              hackathonSlug: hackathon.slug,
              organizationId: new mongoose.Types.ObjectId(orgId),
              oldStatus: statusChanged ? oldStatus : undefined,
              newStatus: statusChanged ? hackathon.status : undefined,
              changes: statusChanged ? undefined : changes,
            },
            emailTemplate: statusChanged
              ? EmailTemplatesService.getTemplate(
                  hackathon.status === HackathonStatus.ACTIVE
                    ? "hackathon-active"
                    : hackathon.status === HackathonStatus.COMPLETED
                      ? "hackathon-completed"
                      : hackathon.status === HackathonStatus.CANCELLED
                        ? "hackathon-cancelled"
                        : "hackathon-updated",
                  {
                    hackathonId: (
                      hackathon._id as mongoose.Types.ObjectId
                    ).toString(),
                    hackathonName: hackathon.title || "Hackathon",
                    hackathonSlug: hackathon.slug,
                    organizationId: orgId,
                    oldStatus,
                    newStatus: hackathon.status,
                    startDate: hackathon.startDate,
                    reason: (hackathon as any).cancellationReason,
                    unsubscribeUrl: undefined,
                  },
                )
              : EmailTemplatesService.getTemplate("hackathon-updated", {
                  hackathonId: (
                    hackathon._id as mongoose.Types.ObjectId
                  ).toString(),
                  hackathonName: hackathon.title || "Hackathon",
                  hackathonSlug: hackathon.slug,
                  changes,
                  unsubscribeUrl: undefined,
                }),
            sendEmail: statusChanged, // Only send email for status changes
            sendInApp: true,
          },
        );
      }

      // TODO: Notify participants if hackathon is updated (especially for status changes)
      // This would require querying HackathonParticipant model
    } catch (notificationError) {
      console.error(
        "Error sending hackathon update notifications:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(res, hackathon, "Hackathon updated successfully");
  } catch (error) {
    console.error("Update hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to update hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}:
 *   get:
 *     summary: Get a hackathon by ID
 *     description: Retrieve a hackathon by ID
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getHackathon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can view hackathons for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    });

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    sendSuccess(res, hackathon, "Hackathon retrieved successfully");
  } catch (error) {
    console.error("Get hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons:
 *   get:
 *     summary: List all hackathons for an organization
 *     description: Get all hackathons for an organization with optional status filter
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getHackathons = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;
    const { status } = req.query;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can view hackathons for this organization",
      );
      return;
    }

    const query: any = {
      organizationId: orgId,
    };

    if (
      status &&
      Object.values(HackathonStatus).includes(status as HackathonStatus)
    ) {
      query.status = status;
    }

    const hackathons = await Hackathon.find(query).sort({ createdAt: -1 });

    sendSuccess(res, hackathons, "Hackathons retrieved successfully");
  } catch (error) {
    console.error("Get hackathons error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve hackathons",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}:
 *   delete:
 *     summary: Delete a hackathon
 *     description: Delete a hackathon and all related data (participants, submissions, judging scores, etc.). Only owners and admins can delete hackathons.
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const deleteHackathon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can delete hackathons for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    });

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    const hackathonObjectId = new mongoose.Types.ObjectId(hackathonId);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Get all participant IDs for this hackathon (needed for cascade deletion)
      const participants = await HackathonParticipant.find({
        hackathonId: hackathonObjectId,
      })
        .select("_id")
        .lean();
      const participantIds = participants.map((p) => p._id);

      // 2. Delete hackathon participants
      await HackathonParticipant.deleteMany(
        { hackathonId: hackathonObjectId },
        { session },
      );

      // 3. Delete hackathon judging scores
      await HackathonJudgingScore.deleteMany(
        { hackathonId: hackathonObjectId },
        { session },
      );

      // 4. Delete hackathon submission comments (via participant IDs)
      if (participantIds.length > 0) {
        await HackathonSubmissionComment.deleteMany(
          { submissionId: { $in: participantIds } },
          { session },
        );
      }

      // 5. Delete hackathon submission votes (via participant IDs)
      if (participantIds.length > 0) {
        await HackathonSubmissionVote.deleteMany(
          { submissionId: { $in: participantIds } },
          { session },
        );
      }

      // 6. Delete notifications related to this hackathon
      await Notification.deleteMany(
        { "data.hackathonId": hackathonObjectId },
        { session },
      );

      // 7. Remove hackathon from organization's hackathons array
      await Organization.findByIdAndUpdate(
        orgId,
        { $pull: { hackathons: hackathonObjectId } },
        { session },
      );

      // 8. Delete the hackathon itself
      await Hackathon.findByIdAndDelete(hackathonObjectId, { session });

      await session.commitTransaction();

      // 9. Send notifications to organization members
      try {
        const frontendUrl =
          process.env.FRONTEND_URL ||
          config.cors.origin ||
          "https://boundlessfi.xyz";
        const baseUrl = Array.isArray(frontendUrl)
          ? frontendUrl[0]
          : frontendUrl;
        const deleterName =
          `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
          user.email;

        // Notify organization members
        const allMembers = [organization.owner, ...organization.members].filter(
          (email) => email !== user.email,
        );

        if (allMembers.length > 0) {
          const memberUsers = await User.find({
            email: { $in: allMembers },
          }).select(
            "email profile.firstName profile.lastName settings.notifications",
          );

          for (const memberUser of memberUsers) {
            const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(memberUser.email)}&token=${memberUser._id}`;
            const memberName =
              `${memberUser.profile?.firstName || ""} ${memberUser.profile?.lastName || ""}`.trim() ||
              memberUser.email;

            await NotificationService.sendNotification({
              type: NotificationType.HACKATHON_DELETED,
              title: "Hackathon Deleted",
              message: `The hackathon "${hackathon.title || "Untitled Hackathon"}" has been deleted by ${deleterName}.`,
              data: {
                organizationId: organization._id,
                organizationName: organization.name,
                hackathonName: hackathon.title || "Untitled Hackathon",
                deletedBy: deleterName,
              },
              recipients: [
                {
                  userId: memberUser._id,
                  email: memberUser.email,
                  name: memberName,
                  preferences: memberUser.settings?.notifications,
                },
              ],
              emailTemplate: EmailTemplatesService.getTemplate(
                "hackathon-deleted",
                {
                  organizationName: organization.name,
                  hackathonName: hackathon.title || "Untitled Hackathon",
                  deletedBy: deleterName,
                  unsubscribeUrl,
                },
              ),
            });
          }
        }
      } catch (notificationError) {
        // Log but don't fail the deletion if notifications fail
        console.error(
          "Error sending deletion notifications:",
          notificationError,
        );
      }

      sendSuccess(res, null, "Hackathon deleted successfully", 200);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Delete hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to delete hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
