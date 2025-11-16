import { Request } from "express";
import mongoose from "mongoose";
import {
  IHackathon,
  ParticipantType,
  VenueType,
} from "../../models/hackathon.model";
import Organization from "../../models/organization.model";
import { checkPermission } from "../../utils/getUserRole";
import { isValidStellarAddress } from "../../utils/wallet";

export interface AuthenticatedRequest extends Request {
  user: any;
}

/**
 * Check if user can manage hackathons for an organization
 */
export const canManageHackathons = async (
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

/**
 * Transform request body to hackathon model structure
 */
export const transformRequestBody = (body: any): Partial<IHackathon> => {
  const updateData: any = {};

  // Information tab
  if (body.information) {
    if (body.information.title !== undefined)
      updateData.title = body.information.title;
    if (body.information.banner !== undefined)
      updateData.banner = body.information.banner;
    if (body.information.description !== undefined)
      updateData.description = body.information.description;
    if (body.information.categories !== undefined)
      updateData.categories = Array.isArray(body.information.categories)
        ? body.information.categories
        : [body.information.categories];
    // Support legacy category field
    if (body.information.category !== undefined) {
      updateData.categories = Array.isArray(body.information.category)
        ? body.information.category
        : [body.information.category];
    }
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

  // Contract-related fields (top-level in request body)
  if (body.contractId !== undefined) updateData.contractId = body.contractId;
  if (body.escrowAddress !== undefined)
    updateData.escrowAddress = body.escrowAddress;
  if (body.transactionHash !== undefined)
    updateData.transactionHash = body.transactionHash;
  if (body.escrowDetails !== undefined)
    updateData.escrowDetails = body.escrowDetails;

  return updateData;
};

/**
 * Validate all required fields for publishing
 */
export const validatePublishRequirements = (
  hackathon: Partial<IHackathon>,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Information tab
  if (!hackathon.title || hackathon.title.trim().length < 3)
    errors.push("Title is required and must be at least 3 characters");
  if (!hackathon.banner) errors.push("Banner is required");
  if (!hackathon.description || hackathon.description.trim().length < 10)
    errors.push("Description is required and must be at least 10 characters");
  if (
    (!hackathon.categories || hackathon.categories.length === 0) &&
    !(hackathon as any).category
  )
    errors.push("At least one category is required");
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
 * Validate Stellar wallet address format
 * Uses Stellar SDK's validation function for proper validation
 */
export const validateStellarAddress = (address: string): boolean => {
  if (!address || typeof address !== "string") {
    return false;
  }
  return isValidStellarAddress(address);
};

/**
 * Get rank suffix for ordinal display (1st, 2nd, 3rd, 4th, etc.)
 */
export const getRankSuffix = (rank: number): string => {
  if (rank % 100 >= 11 && rank % 100 <= 13) {
    return "th";
  }
  switch (rank % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

/**
 * Map participant rank to prize amount from hackathon prize tiers
 */
export const mapRankToPrizeAmount = (
  rank: number,
  prizeTiers: IHackathon["prizeTiers"],
): number | null => {
  if (!prizeTiers || prizeTiers.length === 0) {
    return null;
  }

  // Find prize tier that matches the rank
  // Prize tier position can be "1st", "1", "First", "1st Place", "2nd Place", etc.
  const rankStr = rank.toString();
  const rankSuffix = getRankSuffix(rank);
  const rankWithSuffix = `${rank}${rankSuffix}`;

  const matchingTier = prizeTiers.find((tier) => {
    const position = tier.position.toLowerCase().trim();
    // Check for exact matches
    if (
      position === rankStr ||
      position === rankWithSuffix.toLowerCase() ||
      position === `${rankStr}st` ||
      position === `${rankStr}nd` ||
      position === `${rankStr}rd` ||
      position === `${rankStr}th`
    ) {
      return true;
    }
    // Check if position starts with the rank pattern (e.g., "1st Place", "2nd Place")
    if (
      position.startsWith(rankWithSuffix.toLowerCase()) ||
      position.startsWith(`${rankStr}st`) ||
      position.startsWith(`${rankStr}nd`) ||
      position.startsWith(`${rankStr}rd`) ||
      position.startsWith(`${rankStr}th`) ||
      position.startsWith(rankStr + " ")
    ) {
      return true;
    }
    return false;
  });

  return matchingTier ? matchingTier.amount : null;
};
