import { Request, Response } from "express";
import Hackathon, {
  HackathonStatus,
  ParticipantType,
} from "../../models/hackathon.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import {
  sendSuccess,
  sendNotFound,
  sendInternalServerError,
} from "../../utils/apiResponse.js";
import {
  transformHackathonToFrontend,
  transformParticipantToFrontend,
  transformSubmissionToCardProps,
} from "./hackathon-transformers.js";
import {
  HackathonListResponse,
  ParticipantListResponse,
  SubmissionListResponse,
} from "../../types/hackathon.js";
import { hackathonCache } from "../../utils/hackathon-cache.utils.js";

/**
 * Get hackathon by slug (public endpoint)
 * GET /api/hackathons/:slug
 */
export const getHackathonBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { slug } = req.params;

    if (!slug) {
      sendNotFound(res, "Slug is required");
      return;
    }

    // Check cache
    const cached = hackathonCache.getHackathon(slug);
    if (cached) {
      // Check if client has cached version
      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch === cached.etag) {
        res.status(304).end();
        return;
      }

      // Set cache headers
      res.set({
        ETag: cached.etag,
        "Cache-Control": "public, max-age=300", // 5 minutes
      });

      sendSuccess(res, cached.data, "Hackathon retrieved successfully");
      return;
    }

    // Find hackathon by slug - only published/active hackathons
    const hackathon = await Hackathon.findOne({
      slug,
      status: {
        $in: [
          HackathonStatus.PUBLISHED,
          HackathonStatus.ACTIVE,
          HackathonStatus.COMPLETED,
        ],
      },
    })
      .populate({
        path: "organizationId",
        select: "name logo",
      })
      .lean();

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Count participants
    const participantsCount = await HackathonParticipant.countDocuments({
      hackathonId: hackathon._id,
    });

    // Transform to frontend format
    const transformedHackathon = await transformHackathonToFrontend(
      hackathon,
      participantsCount,
    );

    // Cache the result
    hackathonCache.setHackathon(slug, transformedHackathon);

    // Set cache headers
    const cachedResult = hackathonCache.getHackathon(slug);
    if (cachedResult) {
      res.set({
        ETag: cachedResult.etag,
        "Cache-Control": "public, max-age=300", // 5 minutes
      });
    }

    sendSuccess(res, transformedHackathon, "Hackathon retrieved successfully");
  } catch (error) {
    console.error("Get hackathon by slug error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Get list of hackathons (public endpoint)
 * GET /api/hackathons
 */
export const getHackathonsList = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      page = "1",
      limit = "12",
      status,
      category,
      search,
      sort = "latest",
      featured,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Generate cache key from query string
    const queryString = new URLSearchParams(
      Object.entries(req.query).map(([k, v]) => [k, String(v)]),
    ).toString();
    const cacheKey = queryString || "default";

    // Check cache
    const cached = hackathonCache.getList(cacheKey);
    if (cached) {
      // Check if client has cached version
      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch === cached.etag) {
        res.status(304).end();
        return;
      }

      // Set cache headers
      res.set({
        ETag: cached.etag,
        "Cache-Control": "public, max-age=120", // 2 minutes
      });

      sendSuccess(res, cached.data, "Hackathons retrieved successfully");
      return;
    }

    // Build base filter - only published/active/completed hackathons
    const filter: any = {
      status: {
        $in: [
          HackathonStatus.PUBLISHED,
          HackathonStatus.ACTIVE,
          HackathonStatus.COMPLETED,
        ],
      },
    };

    // Filter by category (supports both single category and array)
    if (category) {
      filter.$or = [
        { categories: { $in: [category] } }, // New array field
        { category: category }, // Support legacy single category field
      ];
    }

    // Filter by featured
    if (featured !== undefined) {
      const featuredStr = String(featured).toLowerCase();
      filter.featured = featuredStr === "true";
    }

    // Search filter
    if (search) {
      const searchRegex = { $regex: search as string, $options: "i" };
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    // Status filter using date-based queries (more efficient than post-processing)
    const now = new Date();
    if (status === "upcoming") {
      filter.startDate = { $gt: now };
    } else if (status === "ongoing") {
      filter.$and = [
        { startDate: { $lte: now } },
        {
          $or: [
            { winnerAnnouncementDate: { $gt: now } },
            { winnerAnnouncementDate: { $exists: false } },
            { winnerAnnouncementDate: null },
          ],
        },
      ];
    } else if (status === "ended") {
      filter.$and = [
        { winnerAnnouncementDate: { $exists: true } },
        { winnerAnnouncementDate: { $lte: now } },
      ];
    }

    // Build sort options
    let sortOptions: any = {};
    switch (sort) {
      case "latest":
        sortOptions = { publishedAt: -1, createdAt: -1 };
        break;
      case "oldest":
        sortOptions = { publishedAt: 1, createdAt: 1 };
        break;
      case "deadline":
        sortOptions = { submissionDeadline: 1 };
        break;
      case "participants":
        // Will sort after fetching (requires participant count)
        sortOptions = { publishedAt: -1 };
        break;
      case "prize":
        // Will sort after fetching (requires prize calculation)
        sortOptions = { publishedAt: -1 };
        break;
      default:
        sortOptions = { publishedAt: -1, createdAt: -1 };
    }

    // Execute query
    const [hackathons, totalCount] = await Promise.all([
      Hackathon.find(filter)
        .populate({
          path: "organizationId",
          select: "name logo",
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Hackathon.countDocuments(filter),
    ]);

    // Batch count participants for all hackathons
    const hackathonIds = hackathons.map((h: any) => h._id);
    const participantCounts = await HackathonParticipant.aggregate([
      {
        $match: {
          hackathonId: { $in: hackathonIds },
        },
      },
      {
        $group: {
          _id: "$hackathonId",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create a map of hackathonId -> participant count
    const participantCountMap = new Map(
      participantCounts.map((pc: any) => [pc._id.toString(), pc.count]),
    );

    // Transform hackathons
    const transformedHackathons = await Promise.all(
      hackathons.map(async (hackathon: any) => {
        const participantsCount =
          participantCountMap.get(hackathon._id.toString()) || 0;
        return await transformHackathonToFrontend(hackathon, participantsCount);
      }),
    );

    // Handle sorting by participants or prize (post-processing)
    if (sort === "participants") {
      transformedHackathons.sort((a, b) => b.participants - a.participants);
    } else if (sort === "prize") {
      transformedHackathons.sort((a, b) => {
        const aPrize = parseFloat(a.totalPrizePool.replace(/,/g, ""));
        const bPrize = parseFloat(b.totalPrizePool.replace(/,/g, ""));
        return bPrize - aPrize;
      });
    }

    const totalPages = Math.ceil(totalCount / limitNum);

    const response: HackathonListResponse = {
      hackathons: transformedHackathons,
      hasMore: pageNum < totalPages,
      total: totalCount,
      currentPage: pageNum,
      totalPages,
    };

    // Cache the result
    hackathonCache.setList(cacheKey, response);

    // Set cache headers
    const cachedResult = hackathonCache.getList(cacheKey);
    if (cachedResult) {
      res.set({
        ETag: cachedResult.etag,
        "Cache-Control": "public, max-age=120", // 2 minutes
      });
    }

    sendSuccess(res, response, "Hackathons retrieved successfully");
  } catch (error) {
    console.error("Get hackathons list error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve hackathons",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Get hackathon participants (public endpoint)
 * GET /api/hackathons/:slug/participants
 */
export const getHackathonParticipants = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { slug } = req.params;
    const { page = "1", limit = "10", status } = req.query;

    if (!slug) {
      sendNotFound(res, "Slug is required");
      return;
    }

    // Find hackathon by slug with participantType
    const hackathon = await Hackathon.findOne({
      slug,
      status: {
        $in: [
          HackathonStatus.PUBLISHED,
          HackathonStatus.ACTIVE,
          HackathonStatus.COMPLETED,
        ],
      },
    }).lean();

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {
      hackathonId: hackathon._id,
    };

    // Filter by submission status
    if (status === "submitted") {
      filter["submission.status"] = { $exists: true };
    } else if (status === "not_submitted") {
      filter["submission"] = { $exists: false };
    }

    // Determine grouping based on hackathon participantType
    const shouldGroupByTeam =
      hackathon.participantType === ParticipantType.TEAM ||
      hackathon.participantType === ParticipantType.TEAM_OR_INDIVIDUAL;

    if (shouldGroupByTeam) {
      // Group participants by team
      const teamGroups = await HackathonParticipant.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$teamId",
            teamName: { $first: "$teamName" },
            teamMembers: {
              $push: {
                _id: "$_id",
                userId: "$userId",
                participationType: "$participationType",
                socialLinks: "$socialLinks",
                submission: "$submission",
                rank: "$rank",
                registeredAt: "$registeredAt",
                submittedAt: "$submittedAt",
                createdAt: "$createdAt",
                updatedAt: "$updatedAt",
                // Include the teamMembers array to get role information
                allTeamMembers: "$teamMembers",
              },
            },
            memberCount: { $sum: 1 },
            hasSubmission: {
              $max: {
                $cond: [{ $ifNull: ["$submission", false] }, 1, 0],
              },
            },
            teamCreatedAt: { $min: "$createdAt" },
          },
        },
        {
          $project: {
            _id: 1,
            teamName: 1,
            teamMembers: 1,
            memberCount: 1,
            hasSubmission: 1,
            teamCreatedAt: 1,
            isIndividual: {
              $or: [{ $eq: ["$_id", null] }, { $eq: ["$_id", undefined] }],
            },
          },
        },
        { $sort: { teamCreatedAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
      ]);

      // Get total count of unique teams
      const totalTeams = await HackathonParticipant.aggregate([
        { $match: filter },
        { $group: { _id: "$teamId" } },
        { $count: "total" },
      ]);

      const totalCount = totalTeams[0]?.total || 0;

      // Populate user data for all team members and include role
      const populatedTeamGroups = await Promise.all(
        teamGroups.map(async (team) => {
          const populatedMembers = await Promise.all(
            team.teamMembers.map(async (member: any) => {
              const populatedMember = await HackathonParticipant.populate(
                member,
                {
                  path: "userId",
                  select: "email profile",
                },
              );

              // Get the transformed participant data
              const transformedParticipant =
                transformParticipantToFrontend(populatedMember);

              // Find the team member's role from the teamMembers array
              const teamMemberInfo = member.allTeamMembers?.find(
                (tm: any) =>
                  tm.userId.toString() ===
                  populatedMember.userId._id.toString(),
              );

              return {
                id: transformedParticipant.id,
                name: transformedParticipant.name,
                username: transformedParticipant.username,
                avatar: transformedParticipant.avatar,
                role: teamMemberInfo?.role || "member", // Default to 'member' if role not found
                teamId: team._id,
                verified: transformedParticipant.verified,
                joinedDate: transformedParticipant.joinedDate,
                projects: transformedParticipant.projects,
                followers: transformedParticipant.followers,
                following: transformedParticipant.following,
                hasSubmitted: transformedParticipant.hasSubmitted,
              };
            }),
          );

          return {
            teamId: team._id,
            teamName: team.teamName,
            isIndividual: team.isIndividual || !team._id,
            members: populatedMembers,
            memberCount: team.memberCount,
            hasSubmission: team.hasSubmission === 1,
            teamCreatedAt: team.teamCreatedAt,
          };
        }),
      );

      const totalPages = Math.ceil(totalCount / limitNum);

      const response = {
        groups: populatedTeamGroups,
        grouping: "team",
        participantType: hackathon.participantType,
        hasMore: pageNum < totalPages,
        total: totalCount,
        currentPage: pageNum,
        totalPages,
      };

      sendSuccess(res, response, "Participants retrieved successfully");
    } else {
      // Flat list for individual-only hackathons
      const [participants, totalCount] = await Promise.all([
        HackathonParticipant.find(filter)
          .populate({
            path: "userId",
            select: "email profile",
          })
          .sort({ registeredAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        HackathonParticipant.countDocuments(filter),
      ]);

      // Transform participants for individual hackathons
      const transformedParticipants = participants.map((participant: any) => {
        const transformed = transformParticipantToFrontend(participant);
        return {
          id: transformed.id,
          name: transformed.name,
          username: transformed.username,
          avatar: transformed.avatar,
          role: "individual", // Since it's individual participation
          teamId: null, // No team for individual participants
          verified: transformed.verified,
          joinedDate: transformed.joinedDate,
          projects: transformed.projects,
          followers: transformed.followers,
          following: transformed.following,
          hasSubmitted: transformed.hasSubmitted,
        };
      });

      const totalPages = Math.ceil(totalCount / limitNum);

      const response = {
        participants: transformedParticipants,
        grouping: "flat",
        participantType: hackathon.participantType,
        hasMore: pageNum < totalPages,
        total: totalCount,
        currentPage: pageNum,
        totalPages,
      };

      sendSuccess(res, response, "Participants retrieved successfully");
    }
  } catch (error) {
    console.error("Get hackathon participants error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve participants",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Get hackathon submissions (public endpoint)
 * GET /api/hackathons/:slug/submissions
 */
export const getHackathonSubmissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { slug } = req.params;
    const { page = "1", limit = "10", status, sort = "votes" } = req.query;

    if (!slug) {
      sendNotFound(res, "Slug is required");
      return;
    }

    // Find hackathon by slug
    const hackathon = await Hackathon.findOne({
      slug,
      status: {
        $in: [
          HackathonStatus.PUBLISHED,
          HackathonStatus.ACTIVE,
          HackathonStatus.COMPLETED,
        ],
      },
    }).lean();

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter - only participants with submissions
    const filter: any = {
      hackathonId: hackathon._id,
      submission: { $exists: true },
    };

    // Filter by submission status
    if (status) {
      if (status === "submitted") {
        filter["submission.status"] = "submitted";
      } else if (status === "shortlisted") {
        filter["submission.status"] = "shortlisted";
      } else if (status === "disqualified") {
        filter["submission.status"] = "disqualified";
      }
    }

    // Build sort options
    let sortOptions: any = {};
    switch (sort) {
      case "votes":
        sortOptions = { "submission.votes": -1 };
        break;
      case "date":
        sortOptions = { "submission.submissionDate": -1 };
        break;
      case "score":
        // Note: Score sorting would require joining with judging scores
        sortOptions = { "submission.votes": -1 };
        break;
      default:
        sortOptions = { "submission.votes": -1 };
    }

    // Execute query
    const [participants, totalCount] = await Promise.all([
      HackathonParticipant.find(filter)
        .populate({
          path: "userId",
          select: "email profile",
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      HackathonParticipant.countDocuments(filter),
    ]);

    // Transform submissions
    const transformedSubmissions = participants
      .map((participant: any) => {
        try {
          return transformSubmissionToCardProps(participant, hackathon as any);
        } catch (error) {
          console.error("Error transforming submission:", error);
          return null;
        }
      })
      .filter((submission) => submission !== null) as any[];

    const totalPages = Math.ceil(totalCount / limitNum);

    const response: SubmissionListResponse = {
      submissions: transformedSubmissions,
      hasMore: pageNum < totalPages,
      total: totalCount,
      currentPage: pageNum,
      totalPages,
    };

    sendSuccess(res, response, "Submissions retrieved successfully");
  } catch (error) {
    console.error("Get hackathon submissions error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve submissions",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
