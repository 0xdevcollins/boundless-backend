import { IHackathon } from "../../models/hackathon.model.js";
import {
  Participant,
  SubmissionCardProps,
  // Hackathon type is referenced in comments
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  Hackathon,
} from "../../types/hackathon.js";

/**
 * Transform hackathon participant to frontend Participant interface
 */
export const transformParticipantToFrontend = (
  participant: any,
): Participant => {
  const user = participant.userId || participant.user;
  const profile = user?.profile || {};

  return {
    id:
      participant._id?.toString() || participant.userId?._id?.toString() || "",
    name:
      `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
      user?.name ||
      "",
    username: profile.username || user?.username || "",
    avatar: profile.avatar || user?.avatar || "",
    verified: user?.verified || false,
    joinedDate: participant.registeredAt
      ? new Date(participant.registeredAt).toISOString()
      : undefined,
    role:
      participant.teamMembers?.find(
        (m: any) => m.userId?.toString() === user?._id?.toString(),
      )?.role || undefined,
    description: participant.submission?.description || undefined,
    categories: participant.submission?.category
      ? [participant.submission.category]
      : undefined,
    projects: 0, // Could be calculated from user's project count
    followers: 0, // Could be calculated from user's followers
    following: 0, // Could be calculated from user's following
    hasSubmitted: !!participant.submission,
  };
};

/**
 * Transform submission data to SubmissionCardProps interface
 */
export const transformSubmissionToCardProps = (
  participant: any,
  hackathon: IHackathon,
): SubmissionCardProps => {
  const user = participant.userId || participant.user;
  const profile = user?.profile || {};
  const submission = participant.submission;

  if (!submission) {
    throw new Error("Participant has no submission");
  }

  // Calculate days left until deadline
  const daysLeft = hackathon.submissionDeadline
    ? Math.max(
        0,
        Math.ceil(
          (hackathon.submissionDeadline.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : undefined;

  // Map submission status
  let status: "Pending" | "Approved" | "Rejected" = "Pending";
  if (submission.status === "shortlisted") {
    status = "Approved";
  } else if (submission.status === "disqualified") {
    status = "Rejected";
  }

  return {
    title: submission.projectName || "",
    description: submission.description || "",
    submitterName:
      participant.teamName ||
      `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
      user?.name ||
      "",
    submitterAvatar:
      participant.teamMembers?.[0]?.avatar ||
      profile.avatar ||
      user?.avatar ||
      undefined,
    category: submission.category || undefined,
    categories: submission.category ? [submission.category] : undefined,
    status,
    upvotes: submission.votes || 0,
    votes: {
      current: submission.votes || 0,
      total: 0, // Could be total possible votes
    },
    comments: submission.comments || 0,
    submittedDate: submission.submissionDate
      ? new Date(submission.submissionDate).toISOString()
      : undefined,
    daysLeft,
    score: undefined, // Could be calculated from judging scores
    image: submission.logo || undefined,
  };
};

/**
 * Calculate hackathon status based on dates
 */
export const calculateHackathonStatus = (
  hackathon: IHackathon,
): "upcoming" | "ongoing" | "ended" => {
  const now = new Date();

  if (!hackathon.startDate) {
    return "upcoming";
  }

  // If winner announcement date exists and has passed, hackathon is ended
  if (
    hackathon.winnerAnnouncementDate &&
    now > hackathon.winnerAnnouncementDate
  ) {
    return "ended";
  }

  // If start date hasn't been reached, hackathon is upcoming
  if (now < hackathon.startDate) {
    return "upcoming";
  }

  // Otherwise, hackathon is ongoing
  return "ongoing";
};

/**
 * Transform hackathon to frontend Hackathon interface
 */
export const transformHackathonToFrontend = async (
  hackathon: any,
  participantsCount: number,
) => {
  // Calculate total prize pool from prize tiers
  const totalPrizePool =
    hackathon.prizeTiers?.reduce((total: number, tier: any) => {
      return total + (tier.amount || 0);
    }, 0) || 0;

  // Only include team min/max if participant type is team-related
  const teamInfo =
    hackathon.participantType === "team" ||
    hackathon.participantType === "team_or_individual"
      ? {
          teamMin: hackathon.teamMin,
          teamMax: hackathon.teamMax,
        }
      : {};

  // Filter judging criteria to remove weights
  const criteriaWithoutWeights =
    hackathon.criteria?.map((criterion: any) => ({
      title: criterion.title,
      description: criterion.description,
    })) || [];

  const filteredPrizeTiers =
    hackathon.prizeTiers?.map((tier: any) => ({
      position: tier.position,
      amount: tier.amount,
      currency: tier.currency,
    })) || [];

  return {
    id: hackathon._id?.toString(),
    orgId:
      hackathon.organizationId?._id?.toString() ||
      hackathon.organizationId?.toString(),
    slug: hackathon.slug,
    title: hackathon.title,
    tagline: hackathon.tagline,
    description: hackathon.description,
    imageUrl: hackathon.banner,

    // Dates - all required fields
    startDate: hackathon.startDate,
    deadline: hackathon.submissionDeadline,
    judgingDate: hackathon.judgingDate,
    winnerAnnouncementDate: hackathon.winnerAnnouncementDate,
    endDate: hackathon.winnerAnnouncementDate, // For backward compatibility

    // Prize information
    totalPrizePool: totalPrizePool.toFixed(2),
    prizeTiers: filteredPrizeTiers,

    // Categories and basic info
    categories: hackathon.categories || [],
    featured: hackathon.featured || false,
    status: hackathon.status,
    participantType: hackathon.participantType,
    registrationDeadlinePolicy: hackathon.registrationDeadlinePolicy,
    registrationDeadline: hackathon.registrationDeadline,
    participants: participantsCount,

    // Team info (only for team-related participant types)
    ...teamInfo,

    // Venue information
    venue: hackathon.venue
      ? {
          type: hackathon.venue.type,
          country: hackathon.venue.country,
          state: hackathon.venue.state,
          city: hackathon.venue.city,
          venueName: hackathon.venue.venueName,
          venueAddress: hackathon.venue.venueAddress,
        }
      : undefined,

    // Organizer info
    organizer: hackathon.organizationId?.name || "Unknown Organizer",

    // Tab visibility
    tabVisibility: hackathon.tabVisibility || {
      detailsTab: true,
      participantsTab: true,
      resourcesTab: true,
      submissionTab: true,
      announcementsTab: true,
      discussionTab: true,
      winnersTab: true,
      sponsorsTab: true,
      joinATeamTab: true,
      rulesTab: true,
    },

    // Sponsors and partners
    sponsors: hackathon.sponsorsPartners || [],

    // Social links and contact info
    socialLinks: hackathon.socialLinks || [],
    contactEmail: hackathon.contactEmail,
    telegram: hackathon.telegram,
    discord: hackathon.discord,

    // Additional timeline info
    phases: hackathon.phases || [],
    timezone: hackathon.timezone,

    // Judging criteria without weights
    criteria: criteriaWithoutWeights,
  };
};
