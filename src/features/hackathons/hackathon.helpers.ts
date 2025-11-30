import { Request } from "express";
import mongoose from "mongoose";
import {
  IHackathon,
  ParticipantType,
  VenueType,
  HackathonStatus,
  RegistrationDeadlinePolicy,
} from "../../models/hackathon.model.js";
import Hackathon from "../../models/hackathon.model.js";
import Organization from "../../models/organization.model.js";
import { checkPermission } from "../../utils/getUserRole.js";
import { isValidStellarAddress } from "../../utils/wallet.js";
import { auth } from "../../lib/auth.js";
import User from "../../models/user.model.js";
import { HackathonTeamInvitationStatus } from "../../models/hackathon-team-invitation.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";

import { sendEmail } from "../../utils/email.utils.js";
import { config } from "../../config/main.config.js";
import EmailTemplatesService from "../../services/email/email-templates.service.js";
import crypto from "crypto";
import HackathonTeamInvitation from "../../models/hackathon-team-invitation.model.js";

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

  // If Better Auth org ID exists, check via Better Auth
  if (organization.betterAuthOrgId) {
    try {
      const user = await User.findOne({ email: userEmail.toLowerCase() });
      if (!user) {
        return { canManage: false, organization };
      }

      // Get Better Auth session for user (we need to check membership)
      // Since we don't have request headers here, we'll check via listMembers
      const membersResponse = await auth.api.listMembers({
        query: {
          organizationId: organization.betterAuthOrgId,
        },
      });

      const membersList = (membersResponse as any).members || [];
      const userMember = membersList.find(
        (m: any) => m.user.email.toLowerCase() === userEmail.toLowerCase(),
      );

      if (!userMember) {
        return { canManage: false, organization };
      }

      const canManage =
        userMember.role === "owner" || userMember.role === "admin";
      return { canManage, organization };
    } catch (error) {
      console.error("Error checking Better Auth membership:", error);
      // Fallback to custom org check
    }
  }

  // Fallback to custom org check
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
    if (body.information.tagline !== undefined)
      updateData.tagline = body.information.tagline;
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
    if (body.participation.registrationDeadlinePolicy !== undefined)
      updateData.registrationDeadlinePolicy =
        body.participation.registrationDeadlinePolicy;
    if (body.participation.registrationDeadline !== undefined)
      updateData.registrationDeadline = new Date(
        body.participation.registrationDeadline,
      );
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

  // Resources tab
  if (body.resources !== undefined) {
    updateData.resources = body.resources;
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
  if (!hackathon.tagline || hackathon.tagline.trim().length < 1)
    errors.push("Tagline is required");
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
  // if (!hackathon.sponsorsPartners || hackathon.sponsorsPartners.length === 0) {
  //   errors.push("At least one sponsor/partner is required");
  // }

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

/**
 * Resolve hackathon by ID or slug
 * Accepts either MongoDB ObjectId or slug string
 * Returns hackathon document or null
 */
export const resolveHackathonByIdOrSlug = async (
  hackathonIdOrSlug: string,
  options?: {
    includePublishedOnly?: boolean;
    populate?: string | string[];
  },
): Promise<IHackathon | null> => {
  if (!hackathonIdOrSlug) {
    return null;
  }

  // Check if it's a valid MongoDB ObjectId
  const isObjectId = mongoose.Types.ObjectId.isValid(hackathonIdOrSlug);

  let query: any = {};

  if (isObjectId) {
    query._id = hackathonIdOrSlug;
  } else {
    query.slug = hackathonIdOrSlug;
  }

  // Optionally filter by published status
  if (options?.includePublishedOnly) {
    query.status = {
      $in: [
        HackathonStatus.PUBLISHED,
        HackathonStatus.ACTIVE,
        HackathonStatus.COMPLETED,
      ],
    };
  }

  let hackathonQuery = Hackathon.findOne(query);

  // Handle population
  if (options?.populate) {
    if (Array.isArray(options.populate)) {
      options.populate.forEach((path) => {
        hackathonQuery = hackathonQuery.populate(path);
      });
    } else {
      hackathonQuery = hackathonQuery.populate(options.populate);
    }
  }

  const hackathon = await hackathonQuery.lean();

  return hackathon as IHackathon | null;
};

/**
 * Check if hackathon registration is open based on registration deadline policy
 * Returns { isOpen: boolean, errorMessage?: string }
 */
export const isRegistrationOpen = (
  hackathon: IHackathon,
): { isOpen: boolean; errorMessage?: string } => {
  const now = new Date();
  const policy =
    hackathon.registrationDeadlinePolicy ||
    RegistrationDeadlinePolicy.BEFORE_SUBMISSION_DEADLINE; // Default

  switch (policy) {
    case RegistrationDeadlinePolicy.BEFORE_START:
      if (hackathon.startDate && now > hackathon.startDate) {
        return {
          isOpen: false,
          errorMessage: "Registration closed: Hackathon has already started",
        };
      }
      break;
    case RegistrationDeadlinePolicy.BEFORE_SUBMISSION_DEADLINE:
      if (hackathon.submissionDeadline && now > hackathon.submissionDeadline) {
        return {
          isOpen: false,
          errorMessage: "Registration closed: Submission deadline has passed",
        };
      }
      break;
    case RegistrationDeadlinePolicy.CUSTOM:
      if (
        hackathon.registrationDeadline &&
        now > hackathon.registrationDeadline
      ) {
        return {
          isOpen: false,
          errorMessage: "Registration closed: Registration deadline has passed",
        };
      } else if (!hackathon.registrationDeadline) {
        return {
          isOpen: false,
          errorMessage:
            "Registration closed: Registration deadline not configured",
        };
      }
      break;
  }

  return { isOpen: true };
};

// Helper function that uses the real participant model
export async function sendTeamInvitationsDuringRegistration({
  teamMembers,
  hackathon,
  teamId,
  teamName,
  user,
  req,
}: {
  teamMembers: string[];
  hackathon: any;
  teamId: string;
  teamName: string;
  user: any;
  req: Request;
}) {
  const results = {
    invitationsSent: 0,
    successful: [] as string[],
    failed: [] as { email: string; error: string }[],
  };

  for (const email of teamMembers) {
    try {
      // Skip self (leader)
      if (email.toLowerCase() === user.email.toLowerCase()) continue;

      // Check if user is registered
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
      });

      // Check for existing invitation
      const existingInvitation = await HackathonTeamInvitation.findOne({
        hackathonId: hackathon._id,
        teamId: teamId,
        email: email.toLowerCase(),
        status: HackathonTeamInvitationStatus.PENDING,
      });

      if (existingInvitation && (existingInvitation as any).isValid()) {
        results.invitationsSent++;
        results.successful.push(email);
        continue;
      }

      // Check team size limits
      const teamParticipants = await HackathonParticipant.find({
        hackathonId: hackathon._id,
        teamId: teamId,
      });
      const currentMemberCount = teamParticipants.length;

      if (hackathon.teamMax && currentMemberCount >= hackathon.teamMax) {
        results.failed.push({
          email,
          error: `Team has reached maximum size of ${hackathon.teamMax}`,
        });
        continue;
      }

      const token = crypto.randomBytes(32).toString("hex");

      const invitation = await HackathonTeamInvitation.create({
        hackathonId: hackathon._id,
        teamId: teamId,
        invitedBy: user._id,
        email: email.toLowerCase(),
        role: "member",
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          invitedAt: new Date(),
        },
        ...(existingUser && { invitedUser: existingUser._id }),
      });

      try {
        // Create the proper invite URL with hackathon slug
        const inviteLink = `${config.frontendUrl}/hackathons/${hackathon.slug || hackathon._id}/team-invitations/${token}/accept`;
        const hackathonLink = `${config.frontendUrl}/hackathons/${hackathon.slug || hackathon._id}`;
        const inviterName =
          `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
          user.email;
        const hackathonName = hackathon.title || "Hackathon";

        if (existingUser) {
          // Registered user - send invitation with accept link
          const template = EmailTemplatesService.getTemplate(
            "hackathon-team-invitation-existing-user",
            {
              recipientName: existingUser.profile?.firstName || email,
              teamName: teamName,
              hackathonName: hackathonName,
              inviterName: inviterName,
              invitationUrl: inviteLink,
              hackathonUrl: hackathonLink,
              expiresAt: invitation.expiresAt,
              frontendUrl: config.frontendUrl,
            },
          );

          await sendEmail({
            to: email,
            subject: template.subject,
            text: template.text || "",
            html: template.html,
            priority: template.priority as any,
          });
        } else {
          // Non-registered user - send invitation with auth link and instructions
          const registrationUrl = `${config.frontendUrl}/auth?invitation=${token}&redirect=/hackathons/${hackathon.slug || hackathon._id}/team-invitations/${token}/accept`;

          const template = EmailTemplatesService.getTemplate(
            "hackathon-team-invitation-new-user",
            {
              recipientName: email,
              teamName: teamName,
              hackathonName: hackathonName,
              inviterName: inviterName,
              registrationUrl: registrationUrl,
              invitationUrl: inviteLink,
              hackathonUrl: hackathonLink,
              expiresAt: invitation.expiresAt,
              frontendUrl: config.frontendUrl,
            },
          );

          await sendEmail({
            to: email,
            subject: template.subject,
            text: template.text || "",
            html: template.html,
            priority: template.priority as any,
          });
        }

        results.invitationsSent++;
        results.successful.push(email);
      } catch (emailError) {
        console.error(
          `Failed to send invitation email to ${email}:`,
          emailError,
        );
        results.failed.push({
          email,
          error:
            emailError instanceof Error
              ? emailError.message
              : "Email sending failed",
        });
      }
    } catch (error) {
      console.error(`Failed to create invitation for ${email}:`, error);
      results.failed.push({
        email,
        error:
          error instanceof Error ? error.message : "Invitation creation failed",
      });
    }
  }

  return results;
}
