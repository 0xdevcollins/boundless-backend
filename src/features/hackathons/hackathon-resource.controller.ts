import { Request, Response } from "express";
import HackathonResource from "../../models/hackathon-resource.model.js";
import {
  sendSuccess,
  sendNotFound,
  sendInternalServerError,
} from "../../utils/apiResponse.js";
import { resolveHackathonByIdOrSlug } from "./hackathon.helpers.js";

/**
 * Get hackathon resources
 * GET /organizations/{orgId}/hackathons/{hackathonId}/resources
 * GET /hackathons/{hackathonSlugOrId}/resources
 */
export const getResources = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { hackathonSlugOrId, orgId, hackathonId } = req.params;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Fetch resources
    const resources = await HackathonResource.find({
      hackathonId: hackathon._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Format resources
    const formattedResources = resources.map((resource: any) => ({
      _id: resource._id.toString(),
      title: resource.title,
      type: resource.type,
      url: resource.url,
      size: resource.size,
      description: resource.description,
      uploadDate: resource.uploadDate.toISOString(),
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    }));

    sendSuccess(res, formattedResources, "Resources retrieved successfully");
  } catch (error) {
    console.error("Get resources error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve resources",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
