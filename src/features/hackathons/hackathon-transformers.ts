import { IHackathon } from "../../models/hackathon.model";
import { IHackathonParticipant } from "../../models/hackathon-participant.model";
import {
  Participant,
  SubmissionCardProps,
  Hackathon,
} from "../../types/hackathon";

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
): Promise<Hackathon> => {
  // Calculate total prize pool
  const totalPrizePool = hackathon.prizeTiers
    ? hackathon.prizeTiers.reduce(
        (sum: number, tier: any) => sum + (tier.amount || 0),
        0,
      )
    : 0;

  // Handle categories (support both old single category and new array)
  const categories = hackathon.categories
    ? Array.isArray(hackathon.categories)
      ? hackathon.categories
      : [hackathon.categories]
    : hackathon.category
      ? [hackathon.category]
      : [];

  // Convert social links to resources array
  const resources: string[] = [];
  if (hackathon.telegram) resources.push(hackathon.telegram);
  if (hackathon.discord) resources.push(hackathon.discord);
  if (hackathon.socialLinks && Array.isArray(hackathon.socialLinks)) {
    resources.push(...hackathon.socialLinks);
  }

  // Extract subtitle from description
  const subtitle = hackathon.description?.split(".")[0]?.trim() || "";

  // Get organizer name
  const organization =
    hackathon.organizationId && typeof hackathon.organizationId === "object"
      ? hackathon.organizationId
      : null;
  const organizer = organization?.name || "";

  // Calculate status
  const status = calculateHackathonStatus(hackathon);

  // Transform venue
  const venue = hackathon.venue
    ? {
        type: hackathon.venue.type,
        country: hackathon.venue.country || undefined,
        state: hackathon.venue.state || undefined,
        city: hackathon.venue.city || undefined,
        venueName: hackathon.venue.venueName || undefined,
        venueAddress: hackathon.venue.venueAddress || undefined,
      }
    : undefined;

  return {
    id: hackathon._id?.toString() || hackathon.id?.toString() || "",
    slug: hackathon.slug || "",
    title: hackathon.title || "",
    subtitle,
    description: hackathon.description || "",
    imageUrl: hackathon.banner || "",
    status,
    participants: participantsCount,
    totalPrizePool: totalPrizePool.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    deadline: hackathon.submissionDeadline
      ? new Date(hackathon.submissionDeadline).toISOString()
      : "",
    categories,
    startDate: hackathon.startDate
      ? new Date(hackathon.startDate).toISOString()
      : "",
    endDate: hackathon.winnerAnnouncementDate
      ? new Date(hackathon.winnerAnnouncementDate).toISOString()
      : hackathon.submissionDeadline
        ? new Date(hackathon.submissionDeadline).toISOString()
        : "",
    organizer,
    featured: hackathon.featured || false,
    resources: resources.length > 0 ? resources : undefined,
    venue,
    participantType: hackathon.participantType || undefined,
  };
};
