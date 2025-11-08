import { Request, Response } from "express";
import Project, {
  IProject,
  ProjectStatus,
  ProjectType,
} from "../../models/project.model";
import Crowdfund, { CrowdfundStatus } from "../../models/crowdfund.model";
import User from "../../models/user.model";
import mongoose from "mongoose";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendInternalServerError,
  sendUnauthorized,
  checkResource,
} from "../../utils/apiResponse";
import { CROWDFUNDING_STAKEHOLDERS } from "../../constants/stakeholders.constants";
import { TeamInvitationService } from "../../features/team-invitations/team-invitation.service";
import {
  createProjectFundedActivity,
  createProjectCreatedActivity,
} from "../../utils/activity.utils";
import {
  VOTING_PERIOD_DAYS,
  FUNDING_PERIOD_DAYS,
  VOTE_THRESHOLD,
  USER_SELECT_FIELDS,
} from "./crowdfunding.constants";
import {
  populateProjectUserData,
  populateVotingData,
} from "./crowdfunding.helpers";
import {
  validateMilestones,
  validateTeamMembers,
  validateSocialLinks,
  validateUrls,
} from "./crowdfunding.validators";
import {
  sendProjectCreatedNotifications,
  sendProjectUpdatedNotifications,
  sendProjectDeletedNotifications,
  sendProjectFundingNotifications,
  sendProjectApprovedNotifications,
  sendProjectRejectedNotifications,
} from "./crowdfunding.notifications";

export const createCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

  try {
    const {
      title,
      logo,
      vision,
      category,
      details,
      fundingAmount,
      milestones,
      team,
      contact,
      githubUrl,
      gitlabUrl,
      bitbucketUrl,
      projectWebsite,
      demoVideo,
      socialLinks,
      contractId,
      escrowAddress,
      transactionHash,
      escrowDetails,
    } = req.body;

    if (!title?.trim()) {
      sendBadRequest(res, "Project name is required");
      await session.abortTransaction();
      return;
    }

    if (!logo?.trim()) {
      sendBadRequest(res, "Logo/Image is required");
      await session.abortTransaction();
      return;
    }

    if (!vision?.trim()) {
      sendBadRequest(res, "Vision is required");
      await session.abortTransaction();
      return;
    }

    if (!category?.trim()) {
      sendBadRequest(res, "Category is required");
      await session.abortTransaction();
      return;
    }

    if (!details?.trim()) {
      sendBadRequest(res, "Details (markdown) is required");
      await session.abortTransaction();
      return;
    }

    if (!fundingAmount || isNaN(fundingAmount) || fundingAmount <= 0) {
      sendBadRequest(res, "Funding amount must be a positive number");
      await session.abortTransaction();
      return;
    }

    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      sendBadRequest(res, "At least one milestone is required");
      await session.abortTransaction();
      return;
    }

    if (!team || !Array.isArray(team) || team.length === 0) {
      sendBadRequest(res, "At least one team member is required");
      await session.abortTransaction();
      return;
    }

    if (!contact?.primary?.trim()) {
      sendBadRequest(res, "Primary contact is required");
      await session.abortTransaction();
      return;
    }

    if (
      !socialLinks ||
      !Array.isArray(socialLinks) ||
      socialLinks.length === 0
    ) {
      sendBadRequest(res, "At least one social link is required");
      await session.abortTransaction();
      return;
    }

    if (!contractId?.trim()) {
      sendBadRequest(res, "Contract ID is required");
      await session.abortTransaction();
      return;
    }

    if (!escrowAddress?.trim()) {
      sendBadRequest(res, "Escrow address is required");
      await session.abortTransaction();
      return;
    }

    if (!transactionHash?.trim()) {
      sendBadRequest(res, "Transaction hash is required");
      await session.abortTransaction();
      return;
    }

    if (!req.user?._id) {
      sendUnauthorized(res, "Authentication required");
      await session.abortTransaction();
      return;
    }

    const creator = await User.findById(req.user._id).session(session);
    if (checkResource(res, !creator, "Creator not found", 404)) {
      await session.abortTransaction();
      return;
    }

    if (!validateMilestones(milestones, res)) {
      await session.abortTransaction();
      return;
    }

    const teamValidation = validateTeamMembers(team, res);
    if (!teamValidation.valid) {
      await session.abortTransaction();
      return;
    }

    if (!validateSocialLinks(socialLinks, res)) {
      await session.abortTransaction();
      return;
    }

    const urlFields = [
      { field: githubUrl, name: "GitHub URL" },
      { field: gitlabUrl, name: "GitLab URL" },
      { field: bitbucketUrl, name: "Bitbucket URL" },
      { field: projectWebsite, name: "Project Website" },
      { field: demoVideo, name: "Demo Video" },
    ];

    if (!validateUrls(urlFields, res)) {
      await session.abortTransaction();
      return;
    }

    const milestoneAmount = fundingAmount / milestones.length;

    if (milestoneAmount <= 0) {
      sendBadRequest(
        res,
        "Invalid milestone amount calculated. Please check funding amount and milestones.",
      );
      await session.abortTransaction();
      return;
    }

    const mappedMilestones = milestones.map((milestone: any) => ({
      title: milestone.name.trim(),
      description: milestone.description.trim(),
      amount: milestoneAmount,
      dueDate: new Date(milestone.endDate),
      status: "pending",
    }));

    const projectData: Partial<IProject> = {
      title: title.trim(),
      description: details.trim(),
      type: ProjectType.CROWDFUND,
      category: category.trim(),
      status: ProjectStatus.REVIEWING,
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
      summary: vision.trim(),
      funding: {
        goal: fundingAmount,
        raised: 0,
        currency: "USD",
        endDate: new Date(
          Date.now() + FUNDING_PERIOD_DAYS * 24 * 60 * 60 * 1000,
        ),
        contributors: [],
      },
      voting: {
        startDate: new Date(),
        endDate: new Date(
          Date.now() + VOTING_PERIOD_DAYS * 24 * 60 * 60 * 1000,
        ),
        totalVotes: 0,
        positiveVotes: 0,
        negativeVotes: 0,
        voters: [],
      },
      milestones: mappedMilestones,
      team: [],
      media: {
        banner: "",
        logo: logo.trim(),
        thumbnail: logo.trim(),
      },
      documents: {
        whitepaper: "",
        pitchDeck: "",
      },
      stakeholders: CROWDFUNDING_STAKEHOLDERS,
      escrowAddress: escrowAddress.trim(),
      escrowType: "multi",
      creationTxHash: transactionHash.trim(),
      escrowDetails: escrowDetails || {
        contractId: contractId.trim(),
        transactionHash: transactionHash.trim(),
      },
    };

    const project = new Project(projectData);
    await project.save({ session });

    const crowdfundData = {
      projectId: project._id,
      thresholdVotes: VOTE_THRESHOLD,
      totalVotes: 0,
      status: CrowdfundStatus.UNDER_REVIEW,
      voteDeadline: new Date(
        Date.now() + VOTING_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      ),
    };

    const crowdfund = new Crowdfund(crowdfundData);
    await crowdfund.save({ session });

    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { "stats.projectsCreated": 1 } },
      { session },
    );

    await session.commitTransaction();
    transactionCommitted = true;

    await createProjectCreatedActivity(
      req.user._id,
      project._id,
      req.ip,
      req.get("User-Agent"),
    );

    await project.populate([
      { path: "creator", select: USER_SELECT_FIELDS },
      { path: "team.userId", select: USER_SELECT_FIELDS },
      { path: "funding.contributors.user", select: USER_SELECT_FIELDS },
      { path: "voting.voters.userId", select: USER_SELECT_FIELDS },
    ]);
    await populateVotingData(project);

    const invitationResults = [];
    try {
      for (const member of teamValidation.invitations) {
        try {
          const result = await TeamInvitationService.createInvitation({
            projectId: project._id.toString(),
            invitedBy: req.user._id.toString(),
            email: member.email,
            metadata: {
              ipAddress: req.ip,
              userAgent: req.get("User-Agent"),
            },
          });
          invitationResults.push(result);
        } catch (invitationError) {
          console.error(
            `Error sending invitation to ${member.email}:`,
            invitationError,
          );
        }
      }
    } catch (error) {
      console.error("Error processing team invitations:", error);
    }

    try {
      await sendProjectCreatedNotifications(project, creator);
    } catch (notificationError) {
      console.error(
        "Error sending project creation notifications:",
        notificationError,
      );
    }

    sendCreated(
      res,
      {
        project,
        crowdfund,
        invitations: {
          sent: invitationResults.length,
          total: teamValidation.invitations.length,
          results: invitationResults,
        },
      },
      "Crowdfunding project created successfully. Team invitations sent.",
    );
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    console.error("Error creating crowdfunding project:", error);
    sendInternalServerError(res, "Failed to create crowdfunding project");
  } finally {
    session.endSession();
  }
};

export const getCrowdfundingProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = 1, limit = 10, category, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = {
      type: ProjectType.CROWDFUND,
      status: {
        $in: [
          ProjectStatus.IDEA,
          ProjectStatus.VALIDATED,
          ProjectStatus.CAMPAIGNING,
          ProjectStatus.LIVE,
          ProjectStatus.COMPLETED,
        ],
      },
    };

    if (category) {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    }

    const projects = await populateProjectUserData(Project.find(filter))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const projectsWithVotingData = [];
    for (const project of projects) {
      const projectWithVotingData = await populateVotingData(project);
      projectsWithVotingData.push(projectWithVotingData);
    }

    const total = await Project.countDocuments(filter);

    sendSuccess(
      res,
      {
        projects: projectsWithVotingData,
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

    const project = await populateProjectUserData(
      Project.findOne({
        _id: id,
        type: ProjectType.CROWDFUND,
      }),
    );

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      return;
    }

    const projectWithVotingData = await populateVotingData(project);
    const crowdfund = await Crowdfund.findOne({ projectId: id });

    sendSuccess(
      res,
      {
        project: projectWithVotingData,
        crowdfund,
      },
      "Crowdfunding project retrieved successfully",
    );
  } catch (error) {
    console.error("Error fetching crowdfunding project:", error);
    sendInternalServerError(res, "Failed to fetch crowdfunding project");
  }
};

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

    if (project.creator.toString() !== req.user._id.toString()) {
      sendUnauthorized(res, "You can only update your own projects");
      return;
    }

    if (project.status !== ProjectStatus.IDEA) {
      sendBadRequest(res, "Project cannot be updated in current status");
      return;
    }

    const updatedProject = await populateProjectUserData(
      Project.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true },
      ),
    );

    const projectWithVotingData = await populateVotingData(updatedProject);

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
    }

    sendSuccess(
      res,
      {
        project: projectWithVotingData,
      },
      "Crowdfunding project updated successfully",
    );
  } catch (error) {
    console.error("Error updating crowdfunding project:", error);
    sendInternalServerError(res, "Failed to update crowdfunding project");
  }
};

export const deleteCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

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

    if (project.creator.toString() !== req.user._id.toString()) {
      sendUnauthorized(res, "You can only delete your own projects");
      return;
    }

    if (project.status !== ProjectStatus.IDEA) {
      sendBadRequest(res, "Project cannot be deleted in current status");
      return;
    }

    await Crowdfund.deleteOne({ projectId: id }, { session });
    await Project.findByIdAndDelete(id, { session });

    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { "stats.projectsCreated": -1 } },
      { session },
    );

    await session.commitTransaction();
    transactionCommitted = true;

    try {
      await sendProjectDeletedNotifications(project);
    } catch (notificationError) {
      console.error(
        "Error sending project deletion notifications:",
        notificationError,
      );
    }

    sendSuccess(res, null, "Crowdfunding project deleted successfully");
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    console.error("Error deleting crowdfunding project:", error);
    sendInternalServerError(res, "Failed to delete crowdfunding project");
  } finally {
    session.endSession();
  }
};

export const fundCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

  try {
    const { id } = req.params;
    const { amount, transactionHash } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID");
      await session.abortTransaction();
      return;
    }

    if (!req.user?._id) {
      sendUnauthorized(res, "Authentication required");
      await session.abortTransaction();
      return;
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      sendBadRequest(res, "Valid funding amount is required");
      await session.abortTransaction();
      return;
    }

    if (!transactionHash?.trim()) {
      sendBadRequest(res, "Transaction hash is required");
      await session.abortTransaction();
      return;
    }

    const project = await Project.findOne({
      _id: id,
      type: ProjectType.CROWDFUND,
    }).session(session);

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      await session.abortTransaction();
      return;
    }

    if (
      ![
        ProjectStatus.VALIDATED,
        ProjectStatus.CAMPAIGNING,
        ProjectStatus.LIVE,
      ].includes(project.status)
    ) {
      sendBadRequest(res, "Project is not currently accepting funding");
      await session.abortTransaction();
      return;
    }

    if (project.funding.endDate && new Date() > project.funding.endDate) {
      sendBadRequest(res, "Funding period has ended");
      await session.abortTransaction();
      return;
    }

    if (project.funding.raised >= project.funding.goal) {
      sendBadRequest(res, "Project has already reached its funding goal");
      await session.abortTransaction();
      return;
    }

    const user = await User.findById(req.user._id).session(session);
    if (checkResource(res, !user, "User not found", 404)) {
      await session.abortTransaction();
      return;
    }

    const newRaisedAmount = project.funding.raised + amount;
    const isFullyFunded = newRaisedAmount >= project.funding.goal;

    const contributor = {
      user: req.user._id,
      amount: amount,
      date: new Date(),
      transactionHash: transactionHash.trim(),
    };

    await Project.findByIdAndUpdate(
      id,
      {
        $inc: { "funding.raised": amount },
        $push: { "funding.contributors": contributor },
        ...(isFullyFunded && { status: ProjectStatus.COMPLETED }),
      },
      { session },
    );

    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { "stats.totalContributed": amount } },
      { session },
    );

    await User.findByIdAndUpdate(
      project.creator,
      { $inc: { "stats.totalRaised": amount } },
      { session },
    );

    await session.commitTransaction();
    transactionCommitted = true;

    await createProjectFundedActivity(
      req.user._id,
      new mongoose.Types.ObjectId(id),
      amount,
      transactionHash.trim(),
      req.ip,
      req.get("User-Agent"),
    );

    const updatedProject = await populateProjectUserData(Project.findById(id));
    const projectWithVotingData = await populateVotingData(updatedProject);

    try {
      await sendProjectFundingNotifications(updatedProject, user, amount);
    } catch (notificationError) {
      console.error("Error sending funding notifications:", notificationError);
    }

    sendCreated(
      res,
      {
        project: projectWithVotingData,
        funding: {
          amount: amount,
          transactionHash: transactionHash,
          newTotalRaised: newRaisedAmount,
          isFullyFunded: isFullyFunded,
          remainingGoal: Math.max(0, project.funding.goal - newRaisedAmount),
        },
      },
      `Successfully recorded funding of $${amount}. ${isFullyFunded ? "Project is now fully funded!" : ""}`,
    );
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    console.error("Error funding crowdfunding project:", error);
    sendInternalServerError(res, "Failed to fund project");
  } finally {
    session.endSession();
  }
};

export const adminReviewCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

  try {
    const { id } = req.params;
    const { action, adminNote } = req.body;
    const adminId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID");
      return;
    }

    if (!adminId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    if (!action || !["approve", "reject"].includes(action)) {
      sendBadRequest(res, "Action must be 'approve' or 'reject'");
      return;
    }

    const project = await Project.findOne({
      _id: id,
      type: ProjectType.CROWDFUND,
    }).session(session);

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      await session.abortTransaction();
      return;
    }

    if (project.status !== ProjectStatus.REVIEWING) {
      sendBadRequest(res, "Project is not in reviewing status");
      await session.abortTransaction();
      return;
    }

    const crowdfund = await Crowdfund.findOne({ projectId: id }).session(
      session,
    );
    if (!crowdfund) {
      sendBadRequest(res, "Associated crowdfund not found");
      await session.abortTransaction();
      return;
    }

    if (action === "approve") {
      project.status = ProjectStatus.VALIDATED;
      project.approvedBy = adminId as any;
      project.approvedAt = new Date();
      if (adminNote) {
        (project as any).adminNote = adminNote;
      }

      crowdfund.status = CrowdfundStatus.VALIDATED;
      crowdfund.voteDeadline = new Date(
        Date.now() + VOTING_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      );

      await project.save({ session });
      await crowdfund.save({ session });

      await project.populate([
        { path: "creator", select: USER_SELECT_FIELDS },
        { path: "team.userId", select: USER_SELECT_FIELDS },
        { path: "funding.contributors.user", select: USER_SELECT_FIELDS },
        { path: "voting.voters.userId", select: USER_SELECT_FIELDS },
      ]);
      await populateVotingData(project);

      try {
        await sendProjectApprovedNotifications(project);
      } catch (notificationError) {
        console.error(
          "Error sending approval notifications:",
          notificationError,
        );
      }

      sendSuccess(
        res,
        {
          project,
          crowdfund,
          action: "approved",
        },
        "Project approved successfully. It is now available for community voting.",
      );
    } else {
      project.status = ProjectStatus.REJECTED;
      project.approvedBy = adminId as any;
      project.approvedAt = new Date();
      if (adminNote) {
        (project as any).adminNote = adminNote;
      }

      crowdfund.status = CrowdfundStatus.REJECTED;
      crowdfund.rejectedReason = adminNote || "Rejected by admin review";

      await project.save({ session });
      await crowdfund.save({ session });

      await project.populate([
        { path: "creator", select: USER_SELECT_FIELDS },
        { path: "team.userId", select: USER_SELECT_FIELDS },
        { path: "funding.contributors.user", select: USER_SELECT_FIELDS },
        { path: "voting.voters.userId", select: USER_SELECT_FIELDS },
      ]);
      await populateVotingData(project);

      try {
        await sendProjectRejectedNotifications(project, adminNote);
      } catch (notificationError) {
        console.error(
          "Error sending rejection notifications:",
          notificationError,
        );
      }

      sendSuccess(
        res,
        {
          project,
          crowdfund,
          action: "rejected",
        },
        "Project rejected successfully.",
      );
    }

    await session.commitTransaction();
    transactionCommitted = true;
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    console.error("Error in admin review:", error);
    sendInternalServerError(res, "Failed to process admin review");
  } finally {
    session.endSession();
  }
};
