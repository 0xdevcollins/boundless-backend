import { Request, Response } from "express";
import mongoose from "mongoose";
import HackathonTeamRecruitmentPost, {
  TeamRecruitmentPostStatus,
} from "../../models/hackathon-team-recruitment-post.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendInternalServerError,
  sendPaginatedResponse,
} from "../../utils/apiResponse.js";
import {
  AuthenticatedRequest,
  resolveHackathonByIdOrSlug,
} from "./hackathon.helpers.js";
import { validateContactInfo } from "./hackathon-team-post.helpers.js";

/**
 * Create team post
 * POST /organizations/{orgId}/hackathons/{hackathonId}/team-posts
 * POST /hackathons/{hackathonSlugOrId}/team-posts
 */
export const createTeamPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, orgId, hackathonId } = req.params;
    const {
      projectName,
      projectDescription,
      lookingFor,
      currentTeamSize,
      maxTeamSize,
      contactMethod,
      contactInfo,
    } = req.body;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Verify user is registered for hackathon
    const participant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: user._id,
    });

    if (!participant) {
      sendBadRequest(
        res,
        "You must be registered for this hackathon to create a team post",
      );
      return;
    }

    // Validate contact info
    const contactValidation = validateContactInfo(contactMethod, contactInfo);
    if (!contactValidation.valid) {
      sendBadRequest(res, contactValidation.message || "Invalid contact info");
      return;
    }

    // Create post
    const post = await HackathonTeamRecruitmentPost.create({
      hackathonId: hackathon._id,
      organizationId: hackathon.organizationId,
      createdBy: user._id,
      projectName,
      projectDescription,
      lookingFor,
      currentTeamSize,
      maxTeamSize,
      contactMethod,
      contactInfo: contactInfo.trim(),
      status: TeamRecruitmentPostStatus.ACTIVE,
      views: 0,
      contactCount: 0,
    });

    // Populate createdBy
    await post.populate({
      path: "createdBy",
      select: "email profile",
    });

    // Format response
    const creator = post.createdBy as any;
    const profile = creator?.profile || {};

    const responseData = {
      _id: String(post._id),
      hackathonId: String(post.hackathonId),
      organizationId: String(post.organizationId),
      createdBy: {
        userId: String(creator._id),
        name:
          `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
          creator.email,
        avatar: profile.avatar,
        username: profile.username || creator.email.split("@")[0],
      },
      projectName: post.projectName,
      projectDescription: post.projectDescription,
      lookingFor: post.lookingFor,
      currentTeamSize: post.currentTeamSize,
      maxTeamSize: post.maxTeamSize,
      contactMethod: post.contactMethod,
      contactInfo: post.contactInfo,
      status: post.status,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      views: post.views,
      contactCount: post.contactCount,
    };

    sendCreated(res, responseData, "Team post created successfully");
  } catch (error) {
    console.error("Create team post error:", error);
    sendInternalServerError(
      res,
      "Failed to create team post",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Get team posts
 * GET /organizations/{orgId}/hackathons/{hackathonId}/team-posts
 * GET /hackathons/{hackathonSlugOrId}/team-posts
 */
export const getTeamPosts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { hackathonSlugOrId, orgId, hackathonId } = req.params;
    const {
      page = "1",
      limit = "20",
      role,
      skill,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {
      hackathonId: hackathon._id,
    };

    // Filter by status
    if (status && status !== "all") {
      filter.status = status;
    }

    // Filter by role (exact match)
    if (role) {
      filter["lookingFor.role"] = role;
    }

    // Filter by skill (search in skills arrays)
    if (skill) {
      filter["lookingFor.skills"] = { $in: [skill] };
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { projectName: searchRegex },
        { projectDescription: searchRegex },
        { "lookingFor.role": searchRegex },
      ];
    }

    // Build sort options
    let sortOptions: any = {};
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    switch (sortBy) {
      case "createdAt":
        sortOptions = { createdAt: sortDirection };
        break;
      case "updatedAt":
        sortOptions = { updatedAt: sortDirection };
        break;
      default:
        sortOptions = { createdAt: sortDirection };
    }

    // Execute query
    const [posts, totalCount] = await Promise.all([
      HackathonTeamRecruitmentPost.find(filter)
        .populate({
          path: "createdBy",
          select: "email profile",
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      HackathonTeamRecruitmentPost.countDocuments(filter),
    ]);

    // Format responses
    const formattedPosts = posts.map((post: any) => {
      const creator = post.createdBy;
      const profile = creator?.profile || {};

      return {
        _id: String(post._id),
        hackathonId: String(post.hackathonId),
        organizationId: String(post.organizationId),
        createdBy: {
          userId: String(creator._id),
          name:
            `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
            creator.email,
          avatar: profile.avatar,
          username: profile.username || creator.email.split("@")[0],
        },
        projectName: post.projectName,
        projectDescription: post.projectDescription,
        lookingFor: post.lookingFor,
        currentTeamSize: post.currentTeamSize,
        maxTeamSize: post.maxTeamSize,
        contactMethod: post.contactMethod,
        contactInfo: post.contactInfo,
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        views: post.views || 0,
        contactCount: post.contactCount || 0,
      };
    });

    const totalPages = Math.ceil(totalCount / limitNum);

    sendPaginatedResponse(
      res,
      formattedPosts,
      {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      "Team posts retrieved successfully",
    );
  } catch (error) {
    console.error("Get team posts error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve team posts",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Get team post details
 * GET /organizations/{orgId}/hackathons/{hackathonId}/team-posts/{postId}
 * GET /hackathons/{hackathonSlugOrId}/team-posts/{postId}
 */
export const getTeamPostDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { hackathonSlugOrId, postId, orgId, hackathonId } = req.params;
    const user = (req as AuthenticatedRequest).user;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find post
    const post = await HackathonTeamRecruitmentPost.findOne({
      _id: postId,
      hackathonId: hackathon._id,
    })
      .populate({
        path: "createdBy",
        select: "email profile",
      })
      .lean();

    if (!post) {
      sendNotFound(res, "Team post not found");
      return;
    }

    // Increment views if authenticated (optional tracking)
    if (user) {
      await HackathonTeamRecruitmentPost.findByIdAndUpdate(postId, {
        $inc: { views: 1 },
      });
      // Update views in response
      (post as any).views = ((post as any).views || 0) + 1;
    }

    const creator = post.createdBy as any;
    const profile = creator?.profile || {};

    const responseData = {
      _id: String(post._id),
      hackathonId: String(post.hackathonId),
      organizationId: String(post.organizationId),
      createdBy: {
        userId: String(creator._id),
        name:
          `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
          creator.email,
        avatar: profile.avatar,
        username: profile.username || creator.email.split("@")[0],
      },
      projectName: post.projectName,
      projectDescription: post.projectDescription,
      lookingFor: post.lookingFor,
      currentTeamSize: post.currentTeamSize,
      maxTeamSize: post.maxTeamSize,
      contactMethod: post.contactMethod,
      contactInfo: post.contactInfo,
      status: post.status,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      views: (post as any).views || 0,
      contactCount: (post as any).contactCount || 0,
    };

    sendSuccess(res, responseData, "Team post retrieved successfully");
  } catch (error) {
    console.error("Get team post details error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve team post",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Update team post
 * PUT /organizations/{orgId}/hackathons/{hackathonId}/team-posts/{postId}
 * PUT /hackathons/{hackathonSlugOrId}/team-posts/{postId}
 */
export const updateTeamPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, postId, orgId, hackathonId } = req.params;
    const updateData = req.body;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find post
    const post = await HackathonTeamRecruitmentPost.findOne({
      _id: postId,
      hackathonId: hackathon._id,
    });

    if (!post) {
      sendNotFound(res, "Team post not found");
      return;
    }

    // Check if user is creator
    if (post.createdBy.toString() !== user._id.toString()) {
      sendForbidden(res, "You can only edit your own posts");
      return;
    }

    // Validate contact info if contactMethod or contactInfo is being updated
    if (updateData.contactMethod || updateData.contactInfo) {
      const method = updateData.contactMethod || post.contactMethod;
      const info = updateData.contactInfo || post.contactInfo;
      const contactValidation = validateContactInfo(method, info);
      if (!contactValidation.valid) {
        sendBadRequest(
          res,
          contactValidation.message || "Invalid contact info",
        );
        return;
      }
    }

    // Validate maxTeamSize > currentTeamSize if both are being updated
    if (
      updateData.maxTeamSize !== undefined &&
      updateData.currentTeamSize !== undefined
    ) {
      if (updateData.maxTeamSize <= updateData.currentTeamSize) {
        sendBadRequest(
          res,
          "Max team size must be greater than current team size",
        );
        return;
      }
    } else if (updateData.maxTeamSize !== undefined) {
      if (updateData.maxTeamSize <= post.currentTeamSize) {
        sendBadRequest(
          res,
          "Max team size must be greater than current team size",
        );
        return;
      }
    } else if (updateData.currentTeamSize !== undefined) {
      if (post.maxTeamSize <= updateData.currentTeamSize) {
        sendBadRequest(
          res,
          "Max team size must be greater than current team size",
        );
        return;
      }
    }

    // Update fields
    if (updateData.projectName !== undefined)
      post.projectName = updateData.projectName;
    if (updateData.projectDescription !== undefined)
      post.projectDescription = updateData.projectDescription;
    if (updateData.lookingFor !== undefined)
      post.lookingFor = updateData.lookingFor;
    if (updateData.currentTeamSize !== undefined)
      post.currentTeamSize = updateData.currentTeamSize;
    if (updateData.maxTeamSize !== undefined)
      post.maxTeamSize = updateData.maxTeamSize;
    if (updateData.contactMethod !== undefined)
      post.contactMethod = updateData.contactMethod;
    if (updateData.contactInfo !== undefined)
      post.contactInfo = updateData.contactInfo.trim();
    if (updateData.status !== undefined) post.status = updateData.status;

    await post.save();

    // Populate createdBy
    await post.populate({
      path: "createdBy",
      select: "email profile",
    });

    // Format response
    const creator = post.createdBy as any;
    const profile = creator?.profile || {};

    const responseData = {
      _id: String(post._id),
      hackathonId: String(post.hackathonId),
      organizationId: String(post.organizationId),
      createdBy: {
        userId: String(creator._id),
        name:
          `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
          creator.email,
        avatar: profile.avatar,
        username: profile.username || creator.email.split("@")[0],
      },
      projectName: post.projectName,
      projectDescription: post.projectDescription,
      lookingFor: post.lookingFor,
      currentTeamSize: post.currentTeamSize,
      maxTeamSize: post.maxTeamSize,
      contactMethod: post.contactMethod,
      contactInfo: post.contactInfo,
      status: post.status,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      views: post.views,
      contactCount: post.contactCount,
    };

    sendSuccess(res, responseData, "Team post updated successfully");
  } catch (error) {
    console.error("Update team post error:", error);
    sendInternalServerError(
      res,
      "Failed to update team post",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Delete/Close team post
 * DELETE /organizations/{orgId}/hackathons/{hackathonId}/team-posts/{postId}
 * DELETE /hackathons/{hackathonSlugOrId}/team-posts/{postId}
 */
export const deleteTeamPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, postId, orgId, hackathonId } = req.params;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find post
    const post = await HackathonTeamRecruitmentPost.findOne({
      _id: postId,
      hackathonId: hackathon._id,
    });

    if (!post) {
      sendNotFound(res, "Team post not found");
      return;
    }

    // Check if user is creator
    if (post.createdBy.toString() !== user._id.toString()) {
      sendForbidden(res, "You can only delete your own posts");
      return;
    }

    // Soft delete: set status to closed
    post.status = TeamRecruitmentPostStatus.CLOSED;
    await post.save();

    sendSuccess(res, null, "Team post closed successfully");
  } catch (error) {
    console.error("Delete team post error:", error);
    sendInternalServerError(
      res,
      "Failed to delete team post",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Track contact click
 * POST /organizations/{orgId}/hackathons/{hackathonId}/team-posts/{postId}/contact
 * POST /hackathons/{hackathonSlugOrId}/team-posts/{postId}/contact
 */
export const trackContactClick = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { hackathonSlugOrId, postId, orgId, hackathonId } = req.params;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find post
    const post = await HackathonTeamRecruitmentPost.findOne({
      _id: postId,
      hackathonId: hackathon._id,
    });

    if (!post) {
      sendNotFound(res, "Team post not found");
      return;
    }

    // Increment contact count
    await HackathonTeamRecruitmentPost.findByIdAndUpdate(postId, {
      $inc: { contactCount: 1 },
    });

    sendSuccess(res, null, "Contact click tracked successfully");
  } catch (error) {
    console.error("Track contact click error:", error);
    sendInternalServerError(
      res,
      "Failed to track contact click",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
