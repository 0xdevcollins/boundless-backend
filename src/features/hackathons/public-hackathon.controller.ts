import { Request, Response } from "express";
import Hackathon, { HackathonStatus } from "../../models/hackathon.model";
import HackathonParticipant from "../../models/hackathon-participant.model";
import {
  sendSuccess,
  sendNotFound,
  sendInternalServerError,
} from "../../utils/apiResponse";
import { transformHackathonToFrontend } from "./hackathon-transformers";

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
