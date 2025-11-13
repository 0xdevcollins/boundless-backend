import { Router } from "express";
import {
  getHackathonBySlug,
  getHackathonsList,
  getHackathonParticipants,
  getHackathonSubmissions,
} from "./public-hackathon.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { slugValidation } from "../../utils/blog.validation.util";
import {
  publicHackathonListValidation,
  publicHackathonParticipantsValidation,
  publicHackathonSubmissionsValidation,
} from "../../utils/hackathon.validation.util";

const router = Router();

// GET /api/hackathons - Public endpoint to get list of hackathons
router.get(
  "/",
  validateRequest(publicHackathonListValidation),
  getHackathonsList,
);

// GET /api/hackathons/:slug/participants - Public endpoint to get hackathon participants
router.get(
  "/:slug/participants",
  validateRequest(publicHackathonParticipantsValidation),
  getHackathonParticipants,
);

// GET /api/hackathons/:slug/submissions - Public endpoint to get hackathon submissions
router.get(
  "/:slug/submissions",
  validateRequest(publicHackathonSubmissionsValidation),
  getHackathonSubmissions,
);

// GET /api/hackathons/:slug - Public endpoint to get hackathon by slug
router.get("/:slug", validateRequest(slugValidation), getHackathonBySlug);

export default router;
