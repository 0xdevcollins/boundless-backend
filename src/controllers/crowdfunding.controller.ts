import { Request, Response } from "express";
import Project, {
  IProject,
  ProjectStatus,
  ProjectType,
} from "../models/project.model";
import Crowdfund, { CrowdfundStatus } from "../models/crowdfund.model";
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
import NotificationService from "../services/notification.service";
import EmailTemplatesService from "../services/email-templates.service";
import { NotificationType } from "../models/notification.model";

/**
 * @desc    Create a new Crowdfunding Project
 * @route   POST /api/crowdfunding/projects
 * @access  Private
 */
export const createCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      // Required fields
      title,
      logo,
      vision,
      category,
      details,
      fundingAmount,
      milestones,
      team,
      contact,

      // Optional fields
      githubUrl,
      gitlabUrl,
      bitbucketUrl,
      projectWebsite,
      demoVideo,
      socialLinks,
    } = req.body;

    // Validate required fields
    if (!title?.trim()) {
      sendBadRequest(res, "Project name is required");
      return;
    }

    if (!logo?.trim()) {
      sendBadRequest(res, "Logo/Image is required");
      return;
    }

    if (!vision?.trim()) {
      sendBadRequest(res, "Vision is required");
      return;
    }

    if (!category?.trim()) {
      sendBadRequest(res, "Category is required");
      return;
    }

    if (!details?.trim()) {
      sendBadRequest(res, "Details (markdown) is required");
      return;
    }

    if (!fundingAmount || isNaN(fundingAmount) || fundingAmount <= 0) {
      sendBadRequest(res, "Funding amount must be a positive number");
      return;
    }

    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      sendBadRequest(res, "At least one milestone is required");
      return;
    }

    if (!team || !Array.isArray(team) || team.length === 0) {
      sendBadRequest(res, "At least one team member is required");
      return;
    }

    if (!contact?.primary?.trim()) {
      sendBadRequest(res, "Primary contact is required");
      return;
    }

    // Validate social links - at least one is required
    if (
      !socialLinks ||
      !Array.isArray(socialLinks) ||
      socialLinks.length === 0
    ) {
      sendBadRequest(res, "At least one social link is required");
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

    // Validate milestones structure
    for (const milestone of milestones) {
      if (!milestone.name?.trim() || !milestone.description?.trim()) {
        sendBadRequest(res, "Each milestone must have a name and description");
        await session.abortTransaction();
        return;
      }
      if (!milestone.startDate || !milestone.endDate) {
        sendBadRequest(res, "Each milestone must have start and end dates");
        await session.abortTransaction();
        return;
      }
      if (new Date(milestone.startDate) >= new Date(milestone.endDate)) {
        sendBadRequest(res, "Milestone start date must be before end date");
        await session.abortTransaction();
        return;
      }
    }

    // Validate team structure
    for (const member of team) {
      if (!member.name?.trim() || !member.role?.trim()) {
        sendBadRequest(res, "Each team member must have a name and role");
        await session.abortTransaction();
        return;
      }
    }

    // Validate social links structure
    for (const link of socialLinks) {
      if (!link.platform?.trim() || !link.url?.trim()) {
        sendBadRequest(res, "Each social link must have a platform and URL");
        await session.abortTransaction();
        return;
      }
    }

    // Validate URLs if provided
    const urlFields = [
      { field: githubUrl, name: "GitHub URL" },
      { field: gitlabUrl, name: "GitLab URL" },
      { field: bitbucketUrl, name: "Bitbucket URL" },
      { field: projectWebsite, name: "Project Website" },
      { field: demoVideo, name: "Demo Video" },
    ];

    for (const { field, name } of urlFields) {
      if (field && !isValidUrl(field)) {
        sendBadRequest(res, `Invalid ${name}`);
        await session.abortTransaction();
        return;
      }
    }

    // Validate social links URLs
    for (const link of socialLinks) {
      if (!isValidUrl(link.url)) {
        sendBadRequest(res, `Invalid URL for ${link.platform} social link`);
        await session.abortTransaction();
        return;
      }
    }

    // Map milestones to the expected format
    const mappedMilestones = milestones.map((milestone: any) => ({
      title: milestone.name.trim(),
      description: milestone.description.trim(),
      amount: milestone.amount || 0,
      dueDate: new Date(milestone.endDate),
      status: "pending",
    }));

    // Map team to the expected format
    const mappedTeam = team.map((member: any) => ({
      userId: member.userId || new mongoose.Types.ObjectId(), // Create a placeholder if no userId
      role: member.role.trim(),
      joinedAt: new Date(),
    }));

    // Create the Project
    const projectData: Partial<IProject> = {
      title: title.trim(),
      description: details.trim(), // Using details as description
      type: ProjectType.CROWDFUND,
      category: category.trim(),
      status: ProjectStatus.IDEA,
      creator: req.user._id,
      vision: vision.trim(),
      githubUrl: githubUrl?.trim(),
      gitlabUrl: gitlabUrl?.trim(),
      bitbucketUrl: bitbucketUrl?.trim(),
      projectWebsite: projectWebsite?.trim(),
      demoVideo: demoVideo?.trim(),
      socialLinks: socialLinks.map((link: any) => ({
        platform: link.platform.trim(),
        url: link.url.trim(),
      })),
      contact: {
        primary: contact.primary.trim(),
        backup: contact.backup?.trim(),
      },
      votes: 0,
      owner: {
        type: req.user._id,
        ref: "User",
      },
      // Initialize other required fields with defaults
      summary: vision.trim(),
      funding: {
        goal: fundingAmount,
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
      team: mappedTeam,
      media: {
        banner: "",
        logo: logo.trim(),
        thumbnail: logo.trim(),
      },
      documents: {
        whitepaper: "",
        pitchDeck: "",
      },
    };

    const project = new Project(projectData);
    await project.save({ session });

    // Create associated Crowdfund record
    const crowdfundData = {
      projectId: project._id,
      thresholdVotes: 100,
      totalVotes: 0,
      status: CrowdfundStatus.PENDING,
      // Set vote deadline to 30 days from now
      voteDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    const crowdfund = new Crowdfund(crowdfundData);
    await crowdfund.save({ session });

    // Update user stats
    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { "stats.projectsCreated": 1 } },
      { session },
    );

    await session.commitTransaction();

    // Populate the project with creator info
    await project.populate(
      "creator",
      "profile.firstName profile.lastName profile.username",
    );

    // Send notifications after successful creation
    try {
      await sendProjectCreatedNotifications(project, creator);
    } catch (notificationError) {
      console.error(
        "Error sending project creation notifications:",
        notificationError,
      );
      // Don't fail the main request if notifications fail
    }

    sendCreated(
      res,
      {
        project,
        crowdfund,
      },
      "Crowdfunding project created successfully",
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating crowdfunding project:", error);
    sendInternalServerError(res, "Failed to create crowdfunding project");
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get all crowdfunding projects
 * @route   GET /api/crowdfunding/projects
 * @access  Public
 */
export const getCrowdfundingProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = 1, limit = 10, category, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = { type: ProjectType.CROWDFUND };

    if (category) {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    }

    const projects = await Project.find(filter)
      .populate(
        "creator",
        "profile.firstName profile.lastName profile.username",
      )
      .populate(
        "team.userId",
        "profile.firstName profile.lastName profile.username",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Project.countDocuments(filter);

    sendSuccess(
      res,
      {
        projects,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total,
        },
      },
      "Crowdfunding projects retrieved successfully",
    );
  } catch (error) {
    console.error("Error fetching crowdfunding projects:", error);
    sendInternalServerError(res, "Failed to fetch crowdfunding projects");
  }
};

/**
 * @desc    Get a single crowdfunding project
 * @route   GET /api/crowdfunding/projects/:id
 * @access  Public
 */
export const getCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID");
      return;
    }

    const project = await Project.findOne({
      _id: id,
      type: ProjectType.CROWDFUND,
    })
      .populate(
        "creator",
        "profile.firstName profile.lastName profile.username",
      )
      .populate(
        "team.userId",
        "profile.firstName profile.lastName profile.username",
      );

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      return;
    }

    // Get associated crowdfund data
    const crowdfund = await Crowdfund.findOne({ projectId: id });

    sendSuccess(
      res,
      {
        project,
        crowdfund,
      },
      "Crowdfunding project retrieved successfully",
    );
  } catch (error) {
    console.error("Error fetching crowdfunding project:", error);
    sendInternalServerError(res, "Failed to fetch crowdfunding project");
  }
};

/**
 * @desc    Update a crowdfunding project
 * @route   PUT /api/crowdfunding/projects/:id
 * @access  Private (Project Owner)
 */
export const updateCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID");
      return;
    }

    if (!req.user?._id) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    const project = await Project.findOne({
      _id: id,
      type: ProjectType.CROWDFUND,
    });

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      return;
    }

    // Check if user is the project owner
    if (project.creator.toString() !== req.user._id.toString()) {
      sendUnauthorized(res, "You can only update your own projects");
      return;
    }

    // Only allow updates if project is in draft or idea status
    if (![ProjectStatus.DRAFT, ProjectStatus.IDEA].includes(project.status)) {
      sendBadRequest(res, "Project cannot be updated in current status");
      return;
    }

    // Update the project
    const updatedProject = await Project.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    ).populate(
      "creator",
      "profile.firstName profile.lastName profile.username",
    );

    // Send notifications after successful update
    try {
      const changes = Object.keys(updateData).filter(
        (key) => key !== "updatedAt",
      );
      await sendProjectUpdatedNotifications(updatedProject, changes);
    } catch (notificationError) {
      console.error(
        "Error sending project update notifications:",
        notificationError,
      );
      // Don't fail the main request if notifications fail
    }

    sendSuccess(
      res,
      {
        project: updatedProject,
      },
      "Crowdfunding project updated successfully",
    );
  } catch (error) {
    console.error("Error updating crowdfunding project:", error);
    sendInternalServerError(res, "Failed to update crowdfunding project");
  }
};

/**
 * @desc    Delete a crowdfunding project
 * @route   DELETE /api/crowdfunding/projects/:id
 * @access  Private (Project Owner)
 */
export const deleteCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID");
      return;
    }

    if (!req.user?._id) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    const project = await Project.findOne({
      _id: id,
      type: ProjectType.CROWDFUND,
    });

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      return;
    }

    // Check if user is the project owner
    if (project.creator.toString() !== req.user._id.toString()) {
      sendUnauthorized(res, "You can only delete your own projects");
      return;
    }

    // Only allow deletion if project is in draft or idea status
    if (![ProjectStatus.DRAFT, ProjectStatus.IDEA].includes(project.status)) {
      sendBadRequest(res, "Project cannot be deleted in current status");
      return;
    }

    // Delete associated crowdfund record
    await Crowdfund.deleteOne({ projectId: id }, { session });

    // Delete the project
    await Project.findByIdAndDelete(id, { session });

    // Update user stats
    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { "stats.projectsCreated": -1 } },
      { session },
    );

    await session.commitTransaction();

    // Send notifications after successful deletion
    try {
      await sendProjectDeletedNotifications(project);
    } catch (notificationError) {
      console.error(
        "Error sending project deletion notifications:",
        notificationError,
      );
      // Don't fail the main request if notifications fail
    }

    sendSuccess(res, null, "Crowdfunding project deleted successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("Error deleting crowdfunding project:", error);
    sendInternalServerError(res, "Failed to delete crowdfunding project");
  } finally {
    session.endSession();
  }
};

// Helper function to validate URLs
function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Send notifications when a project is created
 */
async function sendProjectCreatedNotifications(
  project: any,
  creator: any,
): Promise<void> {
  try {
    // 1. Notify the project creator
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_CREATED,
        title: "🎉 Your crowdfunding project has been created!",
        message: `Your project "${project.title}" has been successfully created and is now in the idea stage.`,
        emailTemplate: EmailTemplatesService.getTemplate("project-created", {
          projectTitle: project.title,
          projectId: project._id,
          amount: project.funding.goal,
        }),
      },
    );

    // 2. Notify admin team
    await NotificationService.notifyAdminTeam({
      type: NotificationType.PROJECT_CREATED,
      title: "🆕 New crowdfunding project created",
      message: `A new crowdfunding project "${project.title}" has been created and requires review.`,
      data: {
        projectId: project._id,
        projectTitle: project.title,
        creatorName:
          `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim() ||
          "Creator",
        creatorEmail: creator.email,
        amount: project.funding.goal,
      },
      emailTemplate: EmailTemplatesService.getTemplate("admin-new-project", {
        projectTitle: project.title,
        projectId: project._id,
        creatorName:
          `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim() ||
          "Creator",
        creatorEmail: creator.email,
        amount: project.funding.goal,
      }),
    });

    // 3. Notify team members if they have user accounts
    if (project.team && project.team.length > 0) {
      const teamMembers = project.team.map((member: any) => ({
        userId: member.userId,
        name: member.name || "Team Member",
        email: member.email,
      }));

      await NotificationService.notifyTeamMembers(teamMembers, {
        type: NotificationType.PROJECT_CREATED,
        title: "🎉 You've been added to a new project!",
        message: `You've been added as a team member to the project "${project.title}".`,
        data: {
          projectId: project._id,
          projectTitle: project.title,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-created", {
          projectTitle: project.title,
          projectId: project._id,
          amount: project.funding.goal,
        }),
      });
    }

    console.log(
      `✅ All notifications sent for project creation: ${project.title}`,
    );
  } catch (error) {
    console.error("Error sending project creation notifications:", error);
    throw error;
  }
}

/**
 * Send notifications when a project is updated
 */
async function sendProjectUpdatedNotifications(
  project: any,
  changes: string[],
): Promise<void> {
  try {
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_UPDATED,
        title: "📝 Your project has been updated",
        message: `Your project "${project.title}" has been updated. Changes: ${changes.join(", ")}`,
        data: {
          projectId: project._id,
          changes: changes.join(", "),
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-updated", {
          projectTitle: project.title,
          projectId: project._id,
          changes: changes.join(", "),
        }),
      },
    );

    console.log(`✅ Notifications sent for project update: ${project.title}`);
  } catch (error) {
    console.error("Error sending project update notifications:", error);
    throw error;
  }
}

/**
 * Send notifications when a project is deleted
 */
async function sendProjectDeletedNotifications(project: any): Promise<void> {
  try {
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_CANCELLED,
        title: "🗑️ Your project has been deleted",
        message: `Your project "${project.title}" has been deleted.`,
        data: {
          projectId: project._id,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-deleted", {
          projectTitle: project.title,
          projectId: project._id,
        }),
      },
    );

    console.log(`✅ Notifications sent for project deletion: ${project.title}`);
  } catch (error) {
    console.error("Error sending project deletion notifications:", error);
    throw error;
  }
}
