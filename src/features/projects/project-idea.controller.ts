import { Request, Response } from "express";
import Project, {
  IProject,
  ProjectStatus,
  ProjectType,
} from "../../models/project.model.js";
import Crowdfund, {
  ICrowdfund,
  CrowdfundStatus,
} from "../../models/crowdfund.model.js";
import User from "../../models/user.model.js";
import mongoose from "mongoose";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendInternalServerError,
  sendUnauthorized,
  checkResource,
} from "../../utils/apiResponse.js";
import { CROWDFUNDING_STAKEHOLDERS } from "../../constants/stakeholders.constants.js";

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
      tagline,
      description,
      type = ProjectType.CROWDFUND,
      category,
      fundAmount,
      whitepaperUrl,
      thumbnail,
      tags,
      milestones,
    } = req.body;

    // Validate required fields
    if (!title?.trim()) {
      sendBadRequest(res, "Title is required");
      return;
    }

    if (!description?.trim()) {
      sendBadRequest(res, "Description is required");
      return;
    }

    if (!category?.trim()) {
      sendBadRequest(res, "Category is required");
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

    // Validate fund amount if provided
    if (fundAmount !== undefined && (isNaN(fundAmount) || fundAmount < 0)) {
      sendBadRequest(res, "Fund amount must be a positive number");
      await session.abortTransaction();
      return;
    }

    // Validate URLs if provided
    if (whitepaperUrl && !isValidUrl(whitepaperUrl)) {
      sendBadRequest(res, "Invalid whitepaper URL format");
      await session.abortTransaction();
      return;
    }

    if (thumbnail && !isValidUrl(thumbnail)) {
      sendBadRequest(res, "Invalid thumbnail URL format");
      await session.abortTransaction();
      return;
    }

    // Validate tags if provided
    if (tags && !Array.isArray(tags)) {
      sendBadRequest(res, "Tags must be an array");
      await session.abortTransaction();
      return;
    }

    // Validate milestones if provided
    let mappedMilestones: IProject["milestones"] = [];
    if (milestones !== undefined) {
      if (!Array.isArray(milestones)) {
        sendBadRequest(res, "Milestones must be an array");
        await session.abortTransaction();
        return;
      }

      // Basic validation and mapping
      mappedMilestones = milestones.map((m: any, index: number) => {
        const errors: string[] = [];
        if (!m?.title || typeof m.title !== "string" || !m.title.trim()) {
          errors.push(`milestones[${index}].title is required`);
        }
        if (
          m?.description === undefined ||
          typeof m.description !== "string" ||
          !m.description.trim()
        ) {
          errors.push(`milestones[${index}].description is required`);
        }
        if (!m?.deliveryDate || isNaN(Date.parse(m.deliveryDate))) {
          errors.push(
            `milestones[${index}].deliveryDate must be a valid date (YYYY-MM-DD)`,
          );
        }
        if (
          m?.fundPercentage !== undefined &&
          (isNaN(Number(m.fundPercentage)) ||
            Number(m.fundPercentage) < 0 ||
            Number(m.fundPercentage) > 100)
        ) {
          errors.push(
            `milestones[${index}].fundPercentage must be between 0 and 100`,
          );
        }
        if (
          m?.fundAmount !== undefined &&
          (isNaN(Number(m.fundAmount)) || Number(m.fundAmount) < 0)
        ) {
          errors.push(
            `milestones[${index}].fundAmount must be a non-negative number`,
          );
        }

        if (errors.length > 0) {
          sendBadRequest(res, "Invalid milestones payload", errors.join(", "));
          return null as unknown as IProject["milestones"][number];
        }

        // Map to project milestone schema
        const amount =
          m?.fundAmount !== undefined ? Number(m.fundAmount) : undefined;

        return {
          title: String(m.title).trim(),
          description: String(m.description).trim(),
          amount: amount ?? 0,
          dueDate: new Date(m.deliveryDate),
          status: "pending",
        };
      });

      // If any mapping failed (due to earlier error response), abort
      if (mappedMilestones.some((m) => m == null)) {
        await session.abortTransaction();
        return;
      }

      // If project fundAmount is provided, ensure milestones sum matches (tolerance 1 unit)
      if (
        fundAmount !== undefined &&
        mappedMilestones.length > 0 &&
        mappedMilestones.every((m) => typeof m.amount === "number")
      ) {
        const sum = mappedMilestones.reduce(
          (acc, m) => acc + (m.amount || 0),
          0,
        );
        const goal = Number(fundAmount);
        if (goal >= 0 && Math.abs(sum - goal) > 0.5) {
          sendBadRequest(
            res,
            "Sum of milestone amounts must equal project fundAmount",
            `sum=${sum}, fundAmount=${goal}`,
          );
          await session.abortTransaction();
          return;
        }
      }
    }

    // Determine funding goal
    const computedFundingGoal =
      fundAmount !== undefined
        ? Number(fundAmount)
        : mappedMilestones.length > 0
          ? mappedMilestones.reduce((acc, m) => acc + (m.amount || 0), 0)
          : 0;

    // Create the Project
    const projectData: Partial<IProject> = {
      title: title.trim(),
      tagline: tagline?.trim(),
      description: description.trim(),
      type,
      category: category.trim(),
      status: ProjectStatus.IDEA,
      creator: req.user._id,
      whitepaperUrl: whitepaperUrl?.trim(),
      tags: tags?.filter((tag: string) => tag?.trim()) || [],
      votes: 0,
      owner: {
        type: req.user._id,
        ref: "User",
      },
      // Initialize other required fields with defaults
      summary: tagline?.trim() || description.trim(),
      funding: {
        goal: computedFundingGoal,
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
      milestones: mappedMilestones,
      team: [],
      media: {
        banner: "",
        logo: "",
        thumbnail: thumbnail?.trim() || "",
      },
      documents: {
        whitepaper: whitepaperUrl?.trim() || "",
        pitchDeck: "",
      },
      // Include stakeholders in initial project data to avoid validation errors
      stakeholders: CROWDFUNDING_STAKEHOLDERS,
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
        tagline: project.tagline,
        description: project.description,
        type: project.type,
        category: project.category,
        status: project.status,
        whitepaperUrl: project.whitepaperUrl,
        thumbnail: project.media?.thumbnail,
        tags: project.tags,
        votes: project.votes,
        owner: project.owner,
        funding: project.funding,
        milestones: project.milestones,
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
      const searchString = Array.isArray(search) ? search[0] : search;
      filter.$or = [
        { title: { $regex: searchString, $options: "i" } },
        { tagline: { $regex: searchString, $options: "i" } },
        { description: { $regex: searchString, $options: "i" } },
        { tags: { $in: [new RegExp(searchString as string, "i")] } },
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
          "title tagline description type category status whitepaperUrl thumbnail tags votes owner createdAt updatedAt",
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
    const {
      title,
      tagline,
      description,
      category,
      fundAmount,
      whitepaperUrl,
      thumbnail,
      tags,
    } = req.body;

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

    // Validate fund amount if provided
    if (fundAmount !== undefined && (isNaN(fundAmount) || fundAmount < 0)) {
      sendBadRequest(res, "Fund amount must be a positive number");
      return;
    }

    // Validate URLs if provided
    if (whitepaperUrl && !isValidUrl(whitepaperUrl)) {
      sendBadRequest(res, "Invalid whitepaper URL format");
      return;
    }

    if (thumbnail && !isValidUrl(thumbnail)) {
      sendBadRequest(res, "Invalid thumbnail URL format");
      return;
    }

    // Validate tags if provided
    if (tags && !Array.isArray(tags)) {
      sendBadRequest(res, "Tags must be an array");
      return;
    }

    // Update fields
    const updateData: any = {};
    if (title?.trim()) updateData.title = title.trim();
    if (tagline !== undefined) updateData.tagline = tagline?.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (category !== undefined) updateData.category = category?.trim();
    if (fundAmount !== undefined) updateData["funding.goal"] = fundAmount;
    if (whitepaperUrl !== undefined) {
      updateData.whitepaperUrl = whitepaperUrl?.trim();
      updateData["documents.whitepaper"] = whitepaperUrl?.trim() || "";
    }
    if (thumbnail !== undefined) {
      updateData["media.thumbnail"] = thumbnail?.trim();
    }
    if (tags !== undefined) {
      updateData.tags = tags?.filter((tag: string) => tag?.trim()) || [];
    }

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
