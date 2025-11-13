import { Request, Response } from "express";
import Hackathon, { HackathonStatus } from "../../models/hackathon.model";
import HackathonParticipant from "../../models/hackathon-participant.model";
import {
  sendSuccess,
  sendNotFound,
  sendInternalServerError,
} from "../../utils/apiResponse";
import { transformHackathonToFrontend } from "./hackathon-transformers";
import { HackathonListResponse } from "../../types/hackathon";

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

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Filter by featured (if featured field exists in model)
    if (featured !== undefined) {
      // Note: featured field doesn't exist yet, but we'll add it for future use
      // filter.featured = featured === "true" || featured === true;
    }

    // Search filter
    if (search) {
      const searchRegex = { $regex: search as string, $options: "i" };
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { about: searchRegex },
      ];
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
