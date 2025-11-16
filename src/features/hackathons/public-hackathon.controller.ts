import { Request, Response } from "express";
import Hackathon, { HackathonStatus } from "../../models/hackathon.model.js";
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
        select: "name",
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
          select: "name",
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

    // Execute query
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

    // Transform participants
    const transformedParticipants = participants.map((participant: any) =>
      transformParticipantToFrontend(participant),
    );

    const totalPages = Math.ceil(totalCount / limitNum);

    const response: ParticipantListResponse = {
      participants: transformedParticipants,
      hasMore: pageNum < totalPages,
      total: totalCount,
      currentPage: pageNum,
      totalPages,
    };

    sendSuccess(res, response, "Participants retrieved successfully");
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
