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
import {
  createTrustlessWorkService,
  TrustlessWorkEscrowRequest,
} from "../services/trustless-work.service";
import { CROWDFUNDING_STAKEHOLDERS } from "../constants/stakeholders.constants";
import { TeamInvitationService } from "../services/team-invitation.service";
import Vote from "../models/vote.model";
import {
  createProjectFundedActivity,
  createProjectCreatedActivity,
} from "../utils/activity.utils";

// Helper function to populate user data for projects
const populateProjectUserData = (query: any) => {
  return query
    .populate(
      "creator",
      "profile.firstName profile.lastName profile.username profile.avatar email",
    )
    .populate(
      "team.userId",
      "profile.firstName profile.lastName profile.username profile.avatar email",
    )
    .populate(
      "funding.contributors.user",
      "profile.firstName profile.lastName profile.username profile.avatar email",
    )
    .populate(
      "voting.voters.userId",
      "profile.firstName profile.lastName profile.username profile.avatar email",
    );
};

// Helper function to populate voting data with actual votes from Vote collection
const populateVotingData = async (project: any): Promise<any> => {
  if (!project || !project._id) return project;

  try {
    // Get all votes for this project from the Vote collection
    const votes = await Vote.find({ projectId: project._id })
      .populate(
        "userId",
        "profile.firstName profile.lastName profile.username profile.avatar email",
      )
      .sort({ createdAt: -1 })
      .lean();

    // Transform votes to match the expected voters array format
    const voters = votes.map((vote: any) => ({
      userId: vote.userId,
      vote: vote.value === 1 ? "positive" : "negative",
      votedAt: vote.createdAt,
    }));

    // Update the project's voting.voters array with actual vote data
    project.voting.voters = voters;

    return project;
  } catch (error) {
    console.error("Error populating voting data:", error);
    return project;
  }
};

/**
 * @desc    Step 1: Prepare crowdfunding project and create escrow (returns unsigned XDR)
 * @route   POST /api/crowdfunding/projects/prepare
 * @access  Private
 */
export const prepareCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
      signer,

      githubUrl,
      gitlabUrl,
      bitbucketUrl,
      projectWebsite,
      demoVideo,
      socialLinks,
    } = req.body;

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

    if (!signer?.trim()) {
      sendBadRequest(res, "Signer address is required");
      return;
    }

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

    const creator = await User.findById(req.user._id);
    if (checkResource(res, !creator, "Creator not found", 404)) {
      return;
    }

    for (const milestone of milestones) {
      if (!milestone.name?.trim() || !milestone.description?.trim()) {
        sendBadRequest(res, "Each milestone must have a name and description");
        return;
      }
      if (!milestone.startDate || !milestone.endDate) {
        sendBadRequest(res, "Each milestone must have start and end dates");
        return;
      }
      if (new Date(milestone.startDate) >= new Date(milestone.endDate)) {
        sendBadRequest(res, "Milestone start date must be before end date");
        return;
      }
    }

    for (const member of team) {
      if (!member.email?.trim()) {
        sendBadRequest(res, "Each team member must have an email");
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(member.email.trim())) {
        sendBadRequest(
          res,
          `Invalid email format for team member: ${member.email}`,
        );
        return;
      }
    }

    for (const link of socialLinks) {
      if (!link.platform?.trim() || !link.url?.trim()) {
        sendBadRequest(res, "Each social link must have a platform and URL");
        return;
      }
    }

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
        return;
      }
    }

    for (const link of socialLinks) {
      if (!isValidUrl(link.url)) {
        sendBadRequest(res, `Invalid URL for ${link.platform} social link`);
        return;
      }
    }

    const milestoneAmount = fundingAmount / milestones.length;

    if (milestoneAmount <= 0) {
      sendBadRequest(
        res,
        "Invalid milestone amount calculated. Please check funding amount and milestones.",
      );
      return;
    }

    const mappedMilestones = milestones.map((milestone: any) => ({
      title: milestone.name.trim(),
      description: milestone.description.trim(),
      amount: milestoneAmount,
      dueDate: new Date(milestone.endDate),
      status: "pending",
    }));

    // Store team invitations data for later processing
    const teamInvitations = team.map((member: any) => ({
      email: member.email.trim(),
    }));

    const projectData: Partial<IProject> = {
      title: title.trim(),
      description: details.trim(),
      type: ProjectType.CROWDFUND,
      category: category.trim(),
      status: ProjectStatus.REVIEWING, // Changed to REVIEWING for admin review first
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
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
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
      team: [], // Will be populated after invitations are accepted
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
    };

    // Create escrow and get unsigned XDR
    try {
      const trustlessWorkService = createTrustlessWorkService();
      const escrowRequest: TrustlessWorkEscrowRequest = {
        signer: signer.trim(),
        engagementId: new mongoose.Types.ObjectId().toString(), // Generate temp ID
        title: `Crowdfunding Project: ${title}`,
        description: `Escrow for crowdfunding project ${title}`,
        roles: CROWDFUNDING_STAKEHOLDERS,
        platformFee: Number(process.env.PLATFORM_FEE) || 5, // Default to 5% if not set
        trustline: {
          address:
            process.env.USDC_TOKEN_ADDRESS ||
            "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
        },
        milestones: mappedMilestones.map((milestone) => ({
          description: milestone.description,
          amount: milestoneAmount,
          payoutPercentage: (milestoneAmount / fundingAmount) * 100,
        })),
      };

      const escrowResponse =
        await trustlessWorkService.deployMultiReleaseEscrow(escrowRequest);

      // Return unsigned XDR and project data for frontend to sign
      sendSuccess(
        res,
        {
          unsignedXdr: escrowResponse.unsignedTransaction,
          escrowAddress:
            "GCRU2PL3AI4WW64E7U5SA6BXRP7ULDSLRQVNGSNW4LVSZWQD345NK57F",
          network: "Testnet",
          projectData, // Send back the prepared project data
          milestoneAmount,
          mappedMilestones,
          teamInvitations, // Send back team invitations data
        },
        "Project prepared successfully. Please sign the transaction to complete creation.",
      );
    } catch (error) {
      console.error("Escrow preparation failed:", error);
      sendInternalServerError(
        res,
        "Failed to prepare escrow for project creation",
      );
    }
  } catch (error) {
    console.error("Error preparing crowdfunding project:", error);
    sendInternalServerError(res, "Failed to prepare crowdfunding project");
  }
};
/**
 * @desc    Step 2: Submit signed transaction and create the project
 * @route   POST /api/crowdfunding/projects/confirm
 * @access  Private
 */
export const confirmCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

  try {
    const {
      signedXdr,
      escrowAddress = "GCRU2PL3AI4WW64E7U5SA6BXRP7ULDSLRQVNGSNW4LVSZWQD345NK57F",
      projectData,
      teamInvitations = [],
    } = req.body;

    if (!signedXdr?.trim()) {
      sendBadRequest(res, "Signed transaction XDR is required");
      return;
    }

    if (!escrowAddress?.trim()) {
      sendBadRequest(res, "Escrow address is required");
      return;
    }

    if (!projectData) {
      sendBadRequest(res, "Project data is required");
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

    // Submit the signed transaction to Trustless Work
    let tx: any;
    try {
      const trustlessWorkService = createTrustlessWorkService();
      tx = await trustlessWorkService.submitTransaction(signedXdr);

      console.log(`Transaction submitted successfully:`, tx);
    } catch (error) {
      console.error("Transaction submission failed:", error);
      sendBadRequest(res, "Failed to submit signed transaction");
      await session.abortTransaction();
      return;
    }

    // Extract escrow information from transaction response
    const escrowInfo = tx?.escrow || {};
    const contractId = tx?.contractId || escrowAddress.trim();
    const actualEscrowAddress = escrowInfo?.engagementId
      ? `Contract: ${contractId}`
      : escrowAddress.trim();

    // Create the Project with escrow information
    const finalProjectData: Partial<IProject> = {
      ...projectData,
      trustlessWorkStatus: "deployed",
      escrowAddress: actualEscrowAddress,
      escrowType: "multi",
      // Store additional escrow details
      escrowDetails: {
        contractId: contractId,
        engagementId: escrowInfo?.engagementId,
        title: escrowInfo?.title,
        description: escrowInfo?.description,
        roles: escrowInfo?.roles,
        platformFee: escrowInfo?.platformFee,
        milestones: escrowInfo?.milestones,
        trustline: escrowInfo?.trustline,
        receiverMemo: escrowInfo?.receiverMemo,
        transactionStatus: tx?.status,
        transactionMessage: tx?.message,
      },
    };

    const project = new Project(finalProjectData);
    await project.save({ session });

    // Create associated Crowdfund record
    const crowdfundData = {
      projectId: project._id,
      thresholdVotes: 100,
      totalVotes: 0,
      status: CrowdfundStatus.UNDER_REVIEW, // Changed to UNDER_REVIEW for admin review first
      // Set vote deadline to 30 days from now (will be set after admin approval)
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
    transactionCommitted = true;

    // Create activity for project creation (outside transaction)
    await createProjectCreatedActivity(
      req.user._id,
      project._id,
      req.ip,
      req.get("User-Agent"),
    );

    // Populate the project with all user data
    await project.populate([
      {
        path: "creator",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar email",
      },
      {
        path: "team.userId",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar email",
      },
      {
        path: "funding.contributors.user",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar email",
      },
      {
        path: "voting.voters.userId",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar email",
      },
    ]);
    await populateVotingData(project);

    // Send team invitations after successful creation
    const invitationResults = [];
    try {
      for (const member of teamInvitations) {
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
          // Continue with other invitations even if one fails
        }
      }
    } catch (error) {
      console.error("Error processing team invitations:", error);
      // Don't fail the main request if invitations fail
    }

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
        tx,
        project,
        crowdfund,
        invitations: {
          sent: invitationResults.length,
          total: teamInvitations.length,
          results: invitationResults,
        },
      },
      "Crowdfunding project created successfully. Team invitations sent.",
    );
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    console.error("Error confirming crowdfunding project:", error);
    sendInternalServerError(res, "Failed to confirm crowdfunding project");
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

    const filter: any = {
      type: ProjectType.CROWDFUND,
      // Only show projects that are approved by admin (IDEA status and beyond)
      status: {
        $in: [
          ProjectStatus.IDEA,
          ProjectStatus.VALIDATED,
          ProjectStatus.CAMPAIGNING,
          ProjectStatus.LIVE,
          ProjectStatus.COMPLETED,
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

    // Populate voting data for each project
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

    // Populate voting data with actual votes
    const projectWithVotingData = await populateVotingData(project);

    // Get associated crowdfund data
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
    if (project.status !== ProjectStatus.IDEA) {
      sendBadRequest(res, "Project cannot be updated in current status");
      return;
    }

    // Update the project
    const updatedProject = await populateProjectUserData(
      Project.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true },
      ),
    );

    // Populate voting data with actual votes
    const projectWithVotingData = await populateVotingData(updatedProject);

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
        project: projectWithVotingData,
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

    // Check if user is the project owner
    if (project.creator.toString() !== req.user._id.toString()) {
      sendUnauthorized(res, "You can only delete your own projects");
      return;
    }

    // Only allow deletion if project is in draft or idea status
    if (project.status !== ProjectStatus.IDEA) {
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
    transactionCommitted = true;

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
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    console.error("Error deleting crowdfunding project:", error);
    sendInternalServerError(res, "Failed to delete crowdfunding project");
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Fund a crowdfunding project
 * @route   POST /api/crowdfunding/projects/:id/fund
 * @access  Private
 */
export const fundCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { amount, signer } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID");
      return;
    }

    if (!req.user?._id) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      sendBadRequest(res, "Valid funding amount is required");
      return;
    }

    if (!signer?.trim()) {
      sendBadRequest(res, "Signer address is required");
      return;
    }

    // Find the project
    const project = await Project.findOne({
      _id: id,
      type: ProjectType.CROWDFUND,
    }).session(session);

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      await session.abortTransaction();
      return;
    }

    // Check if project is in a fundable state
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

    // Check if funding period has ended
    if (project.funding.endDate && new Date() > project.funding.endDate) {
      sendBadRequest(res, "Funding period has ended");
      await session.abortTransaction();
      return;
    }

    // Check if project has reached its funding goal
    if (project.funding.raised >= project.funding.goal) {
      sendBadRequest(res, "Project has already reached its funding goal");
      await session.abortTransaction();
      return;
    }

    // Validate user exists
    const user = await User.findById(req.user._id).session(session);
    if (checkResource(res, !user, "User not found", 404)) {
      await session.abortTransaction();
      return;
    }

    // Check if user is trying to fund their own project
    // if (project.creator.toString() === req.user._id.toString()) {
    //   sendBadRequest(res, "You cannot fund your own project");
    //   await session.abortTransaction();
    //   return;
    // }

    // Get escrow contract ID from project
    const contractId = project.escrowDetails?.contractId;
    if (!contractId) {
      sendBadRequest(res, "Project escrow contract not found");
      await session.abortTransaction();
      return;
    }

    // Create funding transaction via Trustless Work
    let fundingTx: any;
    try {
      const trustlessWorkService = createTrustlessWorkService();

      // Get milestone information from project
      const projectMilestones =
        project.escrowDetails?.milestones || project.milestones || [];

      const fundRequest = {
        contractId: "CAZDHI27FJYDBCCO73JV4PW2HARRCQ2K3EP2IYV7NXF7N3B2X6DS6MNM",
        signer: signer.trim(),
        amount: amount,
      };

      fundingTx = await trustlessWorkService.fundEscrow("multi", fundRequest);
      console.log(`Funding transaction prepared:`, fundingTx);
    } catch (error) {
      console.error("Funding transaction preparation failed:", error);
      sendBadRequest(res, "Failed to prepare funding transaction");
      await session.abortTransaction();
      return;
    }

    // Return unsigned XDR for frontend to sign
    sendSuccess(
      res,
      {
        unsignedXdr: fundingTx.unsignedTransaction,
        contractId: contractId,
        amount: amount,
        projectId: project._id,
        projectTitle: project.title,
        currentRaised: project.funding.raised,
        fundingGoal: project.funding.goal,
        remainingGoal: project.funding.goal - project.funding.raised,
      },
      "Funding transaction prepared. Please sign to complete funding.",
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Error preparing crowdfunding project funding:", error);
    sendInternalServerError(res, "Failed to prepare project funding");
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Confirm crowdfunding project funding
 * @route   POST /api/crowdfunding/projects/:id/fund/confirm
 * @access  Private
 */
export const confirmCrowdfundingProjectFunding = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

  try {
    const { id } = req.params;
    const { signedXdr, amount, transactionHash } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid project ID");
      return;
    }

    if (!req.user?._id) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    if (!signedXdr?.trim()) {
      sendBadRequest(res, "Signed transaction XDR is required");
      return;
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      sendBadRequest(res, "Valid funding amount is required");
      return;
    }

    if (!transactionHash?.trim()) {
      sendBadRequest(res, "Transaction hash is required");
      return;
    }

    // Find the project
    const project = await Project.findOne({
      _id: id,
      type: ProjectType.CROWDFUND,
    }).session(session);

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      await session.abortTransaction();
      return;
    }

    // Validate user exists
    const user = await User.findById(req.user._id).session(session);
    if (checkResource(res, !user, "User not found", 404)) {
      await session.abortTransaction();
      return;
    }

    // Submit the signed transaction to Trustless Work
    let tx: any;
    try {
      const trustlessWorkService = createTrustlessWorkService();
      tx = await trustlessWorkService.submitTransaction(signedXdr);
      console.log(`Funding transaction submitted successfully:`, tx);
    } catch (error) {
      console.error("Funding transaction submission failed:", error);
      sendBadRequest(res, "Failed to submit funding transaction");
      await session.abortTransaction();
      return;
    }

    // Update project funding
    const newRaisedAmount = project.funding.raised + amount;
    const isFullyFunded = newRaisedAmount >= project.funding.goal;

    // Add contributor to the project
    const contributor = {
      user: req.user._id,
      amount: amount,
      date: new Date(),
      transactionHash: transactionHash.trim(),
    };

    // Update project
    await Project.findByIdAndUpdate(
      id,
      {
        $inc: { "funding.raised": amount },
        $push: { "funding.contributors": contributor },
        ...(isFullyFunded && { status: ProjectStatus.COMPLETED }),
      },
      { session },
    );

    // Update user stats
    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { "stats.totalContributed": amount } },
      { session },
    );

    // Update project creator stats
    await User.findByIdAndUpdate(
      project.creator,
      { $inc: { "stats.totalRaised": amount } },
      { session },
    );

    await session.commitTransaction();
    transactionCommitted = true;

    // Create activity for project funding (outside transaction)
    await createProjectFundedActivity(
      req.user._id,
      new mongoose.Types.ObjectId(id),
      amount,
      transactionHash.trim(),
      req.ip,
      req.get("User-Agent"),
    );

    // Get updated project
    const updatedProject = await populateProjectUserData(Project.findById(id));

    // Populate voting data with actual votes
    const projectWithVotingData = await populateVotingData(updatedProject);

    // Send notifications
    try {
      await sendProjectFundingNotifications(updatedProject, user, amount);
    } catch (notificationError) {
      console.error("Error sending funding notifications:", notificationError);
      // Don't fail the main request if notifications fail
    }

    sendCreated(
      res,
      {
        tx,
        project: projectWithVotingData,
        funding: {
          amount: amount,
          transactionHash: transactionHash,
          newTotalRaised: newRaisedAmount,
          isFullyFunded: isFullyFunded,
          remainingGoal: Math.max(0, project.funding.goal - newRaisedAmount),
        },
      },
      `Successfully funded project with $${amount}. ${isFullyFunded ? "Project is now fully funded!" : ""}`,
    );
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    console.error("Error confirming crowdfunding project funding:", error);
    sendInternalServerError(res, "Failed to confirm project funding");
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

/**
 * @desc    Admin approve/reject crowdfunding project
 * @route   PATCH /api/crowdfunding/projects/:id/admin-review
 * @access  Private/Admin
 */
export const adminReviewCrowdfundingProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

  try {
    const { id } = req.params;
    const { action, adminNote } = req.body; // action: 'approve' | 'reject'
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

    // Find the project
    const project = await Project.findOne({
      _id: id,
      type: ProjectType.CROWDFUND,
    }).session(session);

    if (!project) {
      sendBadRequest(res, "Crowdfunding project not found");
      await session.abortTransaction();
      return;
    }

    // Check if project is in reviewing status
    if (project.status !== ProjectStatus.REVIEWING) {
      sendBadRequest(res, "Project is not in reviewing status");
      await session.abortTransaction();
      return;
    }

    // Find associated crowdfund
    const crowdfund = await Crowdfund.findOne({ projectId: id }).session(
      session,
    );
    if (!crowdfund) {
      sendBadRequest(res, "Associated crowdfund not found");
      await session.abortTransaction();
      return;
    }

    if (action === "approve") {
      // Approve the project - move to VALIDATED status for community voting
      project.status = ProjectStatus.VALIDATED;
      project.approvedBy = adminId as any;
      project.approvedAt = new Date();
      if (adminNote) {
        (project as any).adminNote = adminNote;
      }

      crowdfund.status = CrowdfundStatus.VALIDATED;
      crowdfund.voteDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from approval

      await project.save({ session });
      await crowdfund.save({ session });

      // Populate project data before sending response
      await project.populate([
        {
          path: "creator",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar email",
        },
        {
          path: "team.userId",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar email",
        },
        {
          path: "funding.contributors.user",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar email",
        },
        {
          path: "voting.voters.userId",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar email",
        },
      ]);
      await populateVotingData(project);

      // Send approval notifications
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
      // Reject the project
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

      // Populate project data before sending response
      await project.populate([
        {
          path: "creator",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar email",
        },
        {
          path: "team.userId",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar email",
        },
        {
          path: "funding.contributors.user",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar email",
        },
        {
          path: "voting.voters.userId",
          select:
            "profile.firstName profile.lastName profile.username profile.avatar email",
        },
      ]);
      await populateVotingData(project);

      // Send rejection notifications
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

/**
 * Send notifications when a project receives funding
 */
async function sendProjectFundingNotifications(
  project: any,
  contributor: any,
  amount: number,
): Promise<void> {
  try {
    // 1. Notify the project creator
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_FUNDED,
        title: "💰 Your project received funding!",
        message: `Your project "${project.title}" received $${amount} in funding.`,
        data: {
          projectId: project._id,
          amount: amount,
          contributorName:
            `${contributor.profile?.firstName || ""} ${contributor.profile?.lastName || ""}`.trim() ||
            "Anonymous",
          totalRaised: project.funding.raised,
          fundingGoal: project.funding.goal,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-funded", {
          projectTitle: project.title,
          projectId: project._id,
          amount: amount,
          contributorName:
            `${contributor.profile?.firstName || ""} ${contributor.profile?.lastName || ""}`.trim() ||
            "Anonymous",
          totalRaised: project.funding.raised,
          fundingGoal: project.funding.goal,
        }),
      },
    );

    // 2. Notify the contributor
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      contributor._id,
      {
        type: NotificationType.PROJECT_FUNDED,
        title: "🎉 Funding successful!",
        message: `Your $${amount} contribution to "${project.title}" was successful.`,
        data: {
          projectId: project._id,
          projectTitle: project.title,
          amount: amount,
          totalRaised: project.funding.raised,
          fundingGoal: project.funding.goal,
        },
        emailTemplate: EmailTemplatesService.getTemplate(
          "contribution-successful",
          {
            projectTitle: project.title,
            projectId: project._id,
            amount: amount,
            totalRaised: project.funding.raised,
            fundingGoal: project.funding.goal,
          },
        ),
      },
    );

    // 3. If project is fully funded, send special notification
    if (project.funding.raised >= project.funding.goal) {
      await NotificationService.notifyProjectCreator(
        project._id,
        project.title,
        project.creator,
        {
          type: NotificationType.PROJECT_FUNDED,
          title: "🎊 Project fully funded!",
          message: `Congratulations! Your project "${project.title}" has reached its funding goal of $${project.funding.goal}!`,
          data: {
            projectId: project._id,
            totalRaised: project.funding.raised,
            fundingGoal: project.funding.goal,
          },
          emailTemplate: EmailTemplatesService.getTemplate(
            "project-fully-funded",
            {
              projectTitle: project.title,
              projectId: project._id,
              totalRaised: project.funding.raised,
              fundingGoal: project.funding.goal,
            },
          ),
        },
      );
    }

    console.log(
      `✅ All funding notifications sent for project: ${project.title}`,
    );
  } catch (error) {
    console.error("Error sending project funding notifications:", error);
    throw error;
  }
}

/**
 * Send notifications when a project is approved by admin
 */
async function sendProjectApprovedNotifications(project: any): Promise<void> {
  try {
    // 1. Notify the project creator
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_VERIFIED,
        title: "✅ Your project has been approved!",
        message: `Your project "${project.title}" has been approved by admin and is now available for community voting.`,
        data: {
          projectId: project._id,
          projectTitle: project.title,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-approved", {
          projectTitle: project.title,
          projectId: project._id,
        }),
      },
    );

    console.log(`✅ Approval notifications sent for project: ${project.title}`);
  } catch (error) {
    console.error("Error sending project approval notifications:", error);
    throw error;
  }
}

/**
 * Send notifications when a project is rejected by admin
 */
async function sendProjectRejectedNotifications(
  project: any,
  adminNote?: string,
): Promise<void> {
  try {
    // 1. Notify the project creator
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_REJECTED,
        title: "❌ Your project has been rejected",
        message: `Your project "${project.title}" has been rejected by admin review.${adminNote ? ` Reason: ${adminNote}` : ""}`,
        data: {
          projectId: project._id,
          projectTitle: project.title,
          adminNote: adminNote,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-rejected", {
          projectTitle: project.title,
          projectId: project._id,
          adminNote: adminNote,
        }),
      },
    );

    console.log(
      `✅ Rejection notifications sent for project: ${project.title}`,
    );
  } catch (error) {
    console.error("Error sending project rejection notifications:", error);
    throw error;
  }
}
