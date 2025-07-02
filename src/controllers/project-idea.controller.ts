import { Request, Response } from "express";
import Project, {
  IProject,
  ProjectStatus,
  ProjectType,
} from "../models/project.model";
import Crowdfund, {
  ICrowdfund,
  CrowdfundStatus,
} from "../models/crowdfund.model";
import User from "../models/user.model";
import mongoose from "mongoose";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendInternalServerError,
  sendUnauthorized,
  checkResource,
} from "../utils/apiResponse";

/**
 * @desc    Create a new Project Idea
 * @route   POST /api/projects
 * @access  Private
 */
export const createProjectIdea = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      title,
      summary,
      type = ProjectType.CROWDFUND,
      category,
      whitepaperUrl,
      pitchVideoUrl,
    } = req.body;

    // Validate required fields
    if (!title?.trim()) {
      sendBadRequest(res, "Title is required");
      return;
    }

    if (!req.user?._id) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // Validate creator exists
    const creator = await User.findById(req.user._id).session(session);
    if (checkResource(res, !creator, "Creator not found", 404)) {
      await session.abortTransaction();
      return;
    }

    // Validate URLs if provided
    if (whitepaperUrl && !isValidUrl(whitepaperUrl)) {
      sendBadRequest(res, "Invalid whitepaper URL format");
      await session.abortTransaction();
      return;
    }

    if (pitchVideoUrl && !isValidUrl(pitchVideoUrl)) {
      sendBadRequest(res, "Invalid pitch video URL format");
      await session.abortTransaction();
      return;
    }

    // Create the Project
    const projectData: Partial<IProject> = {
      title: title.trim(),
      summary: summary?.trim(),
      type,
      category: category?.trim(),
      status: ProjectStatus.IDEA,
      whitepaperUrl: whitepaperUrl?.trim(),
      pitchVideoUrl: pitchVideoUrl?.trim(),
      votes: 0,
      owner: {
        type: req.user._id,
        ref: "User",
      },
      // Initialize other required fields with defaults
      description: summary?.trim() || "",
      funding: {
        goal: 0,
        raised: 0,
        currency: "USD",
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days default
        contributors: [],
      },
      voting: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        totalVotes: 0,
        positiveVotes: 0,
        negativeVotes: 0,
        voters: [],
      },
      milestones: [],
      team: [],
      media: {
        banner: "",
        logo: "",
      },
      documents: {
        whitepaper: whitepaperUrl?.trim() || "",
        pitchDeck: "",
      },
    };

    const project = new Project(projectData);
    await project.save({ session });

    // Create associated Crowdfund record if type is crowdfund
    let crowdfund: ICrowdfund | null = null;
    if (type === ProjectType.CROWDFUND) {
      const crowdfundData = {
        projectId: project._id,
        thresholdVotes: 100,
        totalVotes: 0,
        status: CrowdfundStatus.PENDING,
        // Set vote deadline to 30 days from now
        voteDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      crowdfund = new Crowdfund(crowdfundData);
      await crowdfund.save({ session });
    }

    // Update user stats
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: { "stats.projectsCreated": 1 },
      },
      { session },
    );

    await session.commitTransaction();

    // Populate the response data
    await project.populate([
      {
        path: "owner.type",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar",
      },
    ]);

    const responseData = {
      project: {
        _id: project._id,
        title: project.title,
        summary: project.summary,
        type: project.type,
        category: project.category,
        status: project.status,
        whitepaperUrl: project.whitepaperUrl,
        pitchVideoUrl: project.pitchVideoUrl,
        votes: project.votes,
        owner: project.owner,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      ...(crowdfund && {
        crowdfund: {
          _id: crowdfund._id,
          thresholdVotes: crowdfund.thresholdVotes,
          voteDeadline: crowdfund.voteDeadline,
          totalVotes: crowdfund.totalVotes,
          status: crowdfund.status,
        },
      }),
    };

    sendCreated(res, responseData, "Project idea created successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("Create project idea error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      sendBadRequest(res, "Validation failed", validationErrors.join(", "));
      return;
    }

    if (error instanceof mongoose.Error.CastError) {
      sendBadRequest(res, "Invalid data format");
      return;
    }

    sendInternalServerError(
      res,
      "Failed to create project idea",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get all project ideas with filtering and pagination
 * @route   GET /api/projects
 * @access  Public
 */
export const getProjectIdeas = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      category,
      creatorId,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    // Build filter object
    const filter: any = {};

    if (status) {
      if (Array.isArray(status)) {
        filter.status = { $in: status };
      } else {
        filter.status = status;
      }
    }

    if (type) {
      filter.type = type;
    }

    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }

    if (creatorId) {
      filter["owner.type"] = creatorId;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { summary: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOptions: any = {};
    const validSortFields = ["createdAt", "updatedAt", "votes", "title"];
    const sortField = validSortFields.includes(sortBy as string)
      ? sortBy
      : "createdAt";
    sortOptions[sortField as string] = sortOrder === "asc" ? 1 : -1;

    // Execute queries
    const [projects, totalCount] = await Promise.all([
      Project.find(filter)
        .populate([
          {
            path: "owner.type",
            select:
              "profile.firstName profile.lastName profile.username profile.avatar",
          },
        ])
        .select(
          "title summary type category status whitepaperUrl pitchVideoUrl votes owner createdAt updatedAt",
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Project.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    const response = {
      projects,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      filters: {
        status,
        type,
        category,
        creatorId,
        search,
      },
    };

    sendSuccess(res, response, "Project ideas retrieved successfully");
  } catch (error) {
    console.error("Get project ideas error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve project ideas",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @desc    Get a single project idea by ID
 * @route   GET /api/projects/:id
 * @access  Public
 */
export const getProjectIdeaById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    const project = await Project.findById(id)
      .populate([
        {
          path: "owner.type",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar profile.bio",
        },
        {
          path: "team.userId",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar",
        },
      ])
      .lean();

    if (checkResource(res, !project, "Project not found", 404)) {
      return;
    }

    // Get associated crowdfund data if it's a crowdfund project
    let crowdfund = null;
    if (project?.type === ProjectType.CROWDFUND) {
      crowdfund = await Crowdfund.findOne({ projectId: project._id }).lean();
    }

    const responseData = {
      project,
      ...(crowdfund && { crowdfund }),
    };

    sendSuccess(res, responseData, "Project idea retrieved successfully");
  } catch (error) {
    console.error("Get project idea error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve project idea",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @desc    Update a project idea
 * @route   PUT /api/projects/:id
 * @access  Private (Owner only)
 */
export const updateProjectIdea = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, summary, category, whitepaperUrl, pitchVideoUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    const project = await Project.findById(id);
    if (checkResource(res, !project, "Project not found", 404)) {
      return;
    }

    // Check ownership
    if (project?.owner.type.toString() !== req.user?._id.toString()) {
      sendUnauthorized(res, "Not authorized to update this project");
      return;
    }

    // Only allow updates for projects in idea or rejected status
    if (
      !project ||
      ![ProjectStatus.IDEA, ProjectStatus.REJECTED].includes(project.status)
    ) {
      sendBadRequest(
        res,
        "Project can only be updated when in 'idea' or 'rejected' status",
      );
      return;
    }

    // Validate URLs if provided
    if (whitepaperUrl && !isValidUrl(whitepaperUrl)) {
      sendBadRequest(res, "Invalid whitepaper URL format");
      return;
    }

    if (pitchVideoUrl && !isValidUrl(pitchVideoUrl)) {
      sendBadRequest(res, "Invalid pitch video URL format");
      return;
    }

    // Update fields
    const updateData: any = {};
    if (title?.trim()) updateData.title = title.trim();
    if (summary !== undefined) updateData.summary = summary?.trim();
    if (category !== undefined) updateData.category = category?.trim();
    if (whitepaperUrl !== undefined) {
      updateData.whitepaperUrl = whitepaperUrl?.trim();
      updateData["documents.whitepaper"] = whitepaperUrl?.trim() || "";
    }
    if (pitchVideoUrl !== undefined)
      updateData.pitchVideoUrl = pitchVideoUrl?.trim();

    // If project was rejected and is being updated, reset status to idea
    if (project.status === ProjectStatus.REJECTED) {
      updateData.status = ProjectStatus.IDEA;
    }

    const updatedProject = await Project.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate([
      {
        path: "owner.type",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar",
      },
    ]);

    sendSuccess(
      res,
      { project: updatedProject },
      "Project idea updated successfully",
    );
  } catch (error) {
    console.error("Update project idea error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      sendBadRequest(res, "Validation failed", validationErrors.join(", "));
      return;
    }

    sendInternalServerError(
      res,
      "Failed to update project idea",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @desc    Delete a project idea
 * @route   DELETE /api/projects/:id
 * @access  Private (Owner only)
 */
export const deleteProjectIdea = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    const project = await Project.findById(id).session(session);
    if (checkResource(res, !project, "Project not found", 404)) {
      await session.abortTransaction();
      return;
    }

    // Check ownership
    if (project?.owner.type.toString() !== req.user?._id.toString()) {
      sendUnauthorized(res, "Not authorized to delete this project");
      await session.abortTransaction();
      return;
    }

    // Only allow deletion for projects in idea or rejected status
    if (
      !project ||
      ![ProjectStatus.IDEA, ProjectStatus.REJECTED].includes(project.status)
    ) {
      sendBadRequest(
        res,
        "Project can only be deleted when in 'idea' or 'rejected' status",
      );
      await session.abortTransaction();
      return;
    }

    // Delete associated crowdfund record if exists
    if (project) {
      await Crowdfund.deleteOne({ projectId: project._id }).session(session);
    }

    // Delete the project
    await Project.findByIdAndDelete(id).session(session);

    // Update user stats
    if (req.user && req.user._id) {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $inc: { "stats.projectsCreated": -1 },
        },
        { session },
      );
    }

    await session.commitTransaction();

    sendSuccess(res, null, "Project idea deleted successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete project idea error:", error);
    sendInternalServerError(
      res,
      "Failed to delete project idea",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    session.endSession();
  }
};

// Helper function to validate URLs
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * @desc    Approve a project (Admin only)
 * @route   PATCH /api/projects/:id/approve
 * @access  Private/Admin
 */
export const approveProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user?._id;

    if (!adminId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // Validate project ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    // Find the project
    const project = await Project.findById(id);
    if (checkResource(res, !project, "Project not found", 404)) {
      return;
    }

    // Check if project is in a state that can be approved
    if (project!.status !== ProjectStatus.IDEA) {
      sendBadRequest(res, "Project can only be approved from 'idea' status");
      return;
    }

    // Update project status and approval fields
    const updatedProject = await Project.findByIdAndUpdate(
      id,
      {
        status: ProjectStatus.REVIEWING, // or ProjectStatus.VALIDATED if skipping voting
        approvedBy: adminId,
        approvedAt: new Date(),
      },
      { new: true, runValidators: true },
    ).populate([
      {
        path: "owner.type",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar",
      },
      {
        path: "approvedBy",
        select: "profile.firstName profile.lastName profile.username",
      },
    ]);

    if (checkResource(res, !updatedProject, "Failed to update project", 500)) {
      return;
    }

    const responseData = {
      project: {
        _id: updatedProject!._id,
        title: updatedProject!.title,
        summary: updatedProject!.summary,
        type: updatedProject!.type,
        category: updatedProject!.category,
        status: updatedProject!.status,
        approvedBy: updatedProject!.approvedBy,
        approvedAt: updatedProject!.approvedAt,
        owner: updatedProject!.owner,
        createdAt: updatedProject!.createdAt,
        updatedAt: updatedProject!.updatedAt,
      },
    };

    sendSuccess(res, responseData, "Project approved successfully");
  } catch (error) {
    console.error("Approve project error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      sendBadRequest(res, "Validation failed", validationErrors.join(", "));
      return;
    }

    if (error instanceof mongoose.Error.CastError) {
      sendBadRequest(res, "Invalid data format");
      return;
    }

    sendInternalServerError(res, "Failed to approve project");
  }
};
