import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon, {
  HackathonStatus,
  IHackathon,
  ParticipantType,
  VenueType,
} from "../../models/hackathon.model";
import Organization from "../../models/organization.model";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendCreated,
  sendInternalServerError,
} from "../../utils/apiResponse";
import { validationResult } from "express-validator";
import getUserRole, { checkPermission } from "../../utils/getUserRole";

interface AuthenticatedRequest extends Request {
  user: any;
}

// Helper function to check if user can manage hackathons for an organization
const canManageHackathons = async (
  organizationId: string,
  userEmail: string,
): Promise<{ canManage: boolean; organization: any }> => {
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    return { canManage: false, organization: null };
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    return { canManage: false, organization: null };
  }

  // Check if user is owner or admin
  const canManage = checkPermission(organization, userEmail, [
    "owner",
    "admin",
  ]);

  return { canManage, organization };
};

// Helper function to transform request body to hackathon model structure
const transformRequestBody = (body: any): Partial<IHackathon> => {
  const updateData: any = {};

  // Information tab
  if (body.information) {
    if (body.information.title !== undefined)
      updateData.title = body.information.title;
    if (body.information.banner !== undefined)
      updateData.banner = body.information.banner;
    if (body.information.description !== undefined)
      updateData.description = body.information.description;
    if (body.information.category !== undefined)
      updateData.category = body.information.category;
    if (body.information.venue !== undefined) {
      updateData.venue = {
        type: body.information.venue.type,
        country: body.information.venue.country,
        state: body.information.venue.state,
        city: body.information.venue.city,
        venueName: body.information.venue.venueName,
        venueAddress: body.information.venue.venueAddress,
      };
    }
  }

  // Timeline tab
  if (body.timeline) {
    if (body.timeline.startDate !== undefined)
      updateData.startDate = new Date(body.timeline.startDate);
    if (body.timeline.submissionDeadline !== undefined)
      updateData.submissionDeadline = new Date(
        body.timeline.submissionDeadline,
      );
    if (body.timeline.judgingDate !== undefined)
      updateData.judgingDate = new Date(body.timeline.judgingDate);
    if (body.timeline.winnerAnnouncementDate !== undefined)
      updateData.winnerAnnouncementDate = new Date(
        body.timeline.winnerAnnouncementDate,
      );
    if (body.timeline.timezone !== undefined)
      updateData.timezone = body.timeline.timezone;
    if (body.timeline.phases !== undefined) {
      updateData.phases = body.timeline.phases.map((phase: any) => ({
        name: phase.name,
        startDate: new Date(phase.startDate),
        endDate: new Date(phase.endDate),
        description: phase.description,
      }));
    }
  }

  // Participation tab
  if (body.participation) {
    if (body.participation.participantType !== undefined)
      updateData.participantType = body.participation.participantType;
    if (body.participation.teamMin !== undefined)
      updateData.teamMin = body.participation.teamMin;
    if (body.participation.teamMax !== undefined)
      updateData.teamMax = body.participation.teamMax;
    if (body.participation.about !== undefined)
      updateData.about = body.participation.about;
    if (body.participation.submissionRequirements !== undefined)
      updateData.submissionRequirements =
        body.participation.submissionRequirements;
    if (body.participation.tabVisibility !== undefined)
      updateData.tabVisibility = body.participation.tabVisibility;
  }

  // Rewards tab
  if (body.rewards) {
    if (body.rewards.prizeTiers !== undefined)
      updateData.prizeTiers = body.rewards.prizeTiers;
  }

  // Judging tab
  if (body.judging) {
    if (body.judging.criteria !== undefined)
      updateData.criteria = body.judging.criteria;
  }

  // Collaboration tab
  if (body.collaboration) {
    if (body.collaboration.contactEmail !== undefined)
      updateData.contactEmail = body.collaboration.contactEmail;
    if (body.collaboration.telegram !== undefined)
      updateData.telegram = body.collaboration.telegram;
    if (body.collaboration.discord !== undefined)
      updateData.discord = body.collaboration.discord;
    if (body.collaboration.socialLinks !== undefined)
      updateData.socialLinks = body.collaboration.socialLinks;
    if (body.collaboration.sponsorsPartners !== undefined)
      updateData.sponsorsPartners = body.collaboration.sponsorsPartners;
  }

  return updateData;
};

// Helper function to validate all required fields for publishing
const validatePublishRequirements = (
  hackathon: Partial<IHackathon>,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Information tab
  if (!hackathon.title || hackathon.title.trim().length < 3)
    errors.push("Title is required and must be at least 3 characters");
  if (!hackathon.banner) errors.push("Banner is required");
  if (!hackathon.description || hackathon.description.trim().length < 10)
    errors.push("Description is required and must be at least 10 characters");
  if (!hackathon.category) errors.push("Category is required");
  if (!hackathon.venue || !hackathon.venue.type)
    errors.push("Venue type is required");
  if (
    hackathon.venue?.type === VenueType.PHYSICAL &&
    (!hackathon.venue.country ||
      !hackathon.venue.state ||
      !hackathon.venue.city ||
      !hackathon.venue.venueName ||
      !hackathon.venue.venueAddress)
  ) {
    errors.push(
      "All physical venue fields (country, state, city, venue name, venue address) are required",
    );
  }

  // Timeline tab
  if (!hackathon.startDate) errors.push("Start date is required");
  if (!hackathon.submissionDeadline)
    errors.push("Submission deadline is required");
  if (!hackathon.judgingDate) errors.push("Judging date is required");
  if (!hackathon.winnerAnnouncementDate)
    errors.push("Winner announcement date is required");
  if (!hackathon.timezone) errors.push("Timezone is required");

  // Validate date sequence
  if (
    hackathon.startDate &&
    hackathon.submissionDeadline &&
    hackathon.startDate >= hackathon.submissionDeadline
  ) {
    errors.push("Submission deadline must be after start date");
  }
  if (
    hackathon.submissionDeadline &&
    hackathon.judgingDate &&
    hackathon.submissionDeadline >= hackathon.judgingDate
  ) {
    errors.push("Judging date must be after submission deadline");
  }
  if (
    hackathon.judgingDate &&
    hackathon.winnerAnnouncementDate &&
    hackathon.judgingDate >= hackathon.winnerAnnouncementDate
  ) {
    errors.push("Winner announcement date must be after judging date");
  }

  // Participation tab
  if (!hackathon.participantType) errors.push("Participant type is required");
  if (
    (hackathon.participantType === ParticipantType.TEAM ||
      hackathon.participantType === ParticipantType.TEAM_OR_INDIVIDUAL) &&
    (!hackathon.teamMin || !hackathon.teamMax)
  ) {
    errors.push(
      "Team min and max are required when team participation is allowed",
    );
  }
  if (
    hackathon.teamMin &&
    hackathon.teamMax &&
    hackathon.teamMin > hackathon.teamMax
  ) {
    errors.push("Team min must be less than or equal to team max");
  }

  // Rewards tab
  if (!hackathon.prizeTiers || hackathon.prizeTiers.length === 0) {
    errors.push("At least one prize tier is required");
  }

  // Judging tab
  if (!hackathon.criteria || hackathon.criteria.length === 0) {
    errors.push("At least one judging criterion is required");
  } else {
    const totalWeight = hackathon.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    );
    if (Math.abs(totalWeight - 100) > 0.01) {
      errors.push(
        `Judging criteria weights must sum to 100% (current: ${totalWeight}%)`,
      );
    }
  }

  // Collaboration tab
  if (!hackathon.contactEmail) {
    errors.push("Contact email is required");
  }
  if (!hackathon.sponsorsPartners || hackathon.sponsorsPartners.length === 0) {
    errors.push("At least one sponsor/partner is required");
  }

  return { valid: errors.length === 0, errors };
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/drafts:
 *   post:
 *     summary: Create a new hackathon draft
 *     description: Create a new draft hackathon with partial data
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const createDraft = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;

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
        "Only owners and admins can create hackathons for this organization",
      );
      return;
    }

    const updateData = transformRequestBody(req.body);

    const hackathon = await Hackathon.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      status: HackathonStatus.DRAFT,
      ...updateData,
    });

    sendCreated(res, hackathon, "Draft created successfully");
  } catch (error) {
    console.error("Create draft error:", error);
    sendInternalServerError(
      res,
      "Failed to create draft",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/drafts/{draftId}:
 *   put:
 *     summary: Update a hackathon draft
 *     description: Update a draft hackathon with partial data
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const updateDraft = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, draftId } = req.params;

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

    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      sendBadRequest(res, "Invalid draft ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: draftId,
      organizationId: orgId,
      status: HackathonStatus.DRAFT,
    });

    if (!hackathon) {
      sendNotFound(res, "Draft not found");
      return;
    }

    const updateData = transformRequestBody(req.body);

    Object.assign(hackathon, updateData);
    await hackathon.save();

    sendSuccess(res, hackathon, "Draft updated successfully");
  } catch (error) {
    console.error("Update draft error:", error);
    sendInternalServerError(
      res,
      "Failed to update draft",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/drafts/{draftId}:
 *   get:
 *     summary: Get a hackathon draft by ID
 *     description: Retrieve a draft hackathon by ID
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, draftId } = req.params;

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

    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      sendBadRequest(res, "Invalid draft ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: draftId,
      organizationId: orgId,
      status: HackathonStatus.DRAFT,
    });

    if (!hackathon) {
      sendNotFound(res, "Draft not found");
      return;
    }

    sendSuccess(res, hackathon, "Draft retrieved successfully");
  } catch (error) {
    console.error("Get draft error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve draft",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/drafts:
 *   get:
 *     summary: List all hackathon drafts for an organization
 *     description: Get all draft hackathons for an organization
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getDrafts = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;

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

    const drafts = await Hackathon.find({
      organizationId: orgId,
      status: HackathonStatus.DRAFT,
    }).sort({ createdAt: -1 });

    sendSuccess(res, drafts, "Drafts retrieved successfully");
  } catch (error) {
    console.error("Get drafts error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve drafts",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

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
    const { draftId } = req.query; // Optional: if publishing from existing draft

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
    if (draftId && mongoose.Types.ObjectId.isValid(draftId as string)) {
      hackathon = await Hackathon.findOne({
        _id: draftId,
        organizationId: orgId,
        status: HackathonStatus.DRAFT,
      });

      if (!hackathon) {
        sendNotFound(res, "Draft not found");
        return;
      }

      // Merge new data with existing draft
      const updateData = transformRequestBody(req.body);
      Object.assign(hackathon, updateData);
    } else {
      // Create new hackathon
      const updateData = transformRequestBody(req.body);
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

    Object.assign(hackathon, updateData);
    await hackathon.save();

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
