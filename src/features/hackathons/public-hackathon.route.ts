import { Router } from "express";
import {
  getHackathonBySlug,
  getHackathonsList,
} from "./public-hackathon.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { slugValidation } from "../../utils/blog.validation.util";
import { publicHackathonListValidation } from "../../utils/hackathon.validation.util";

const router = Router();

// GET /api/hackathons - Public endpoint to get list of hackathons
router.get(
  "/",
  validateRequest(publicHackathonListValidation),
  getHackathonsList,
);

// GET /api/hackathons/:slug - Public endpoint to get hackathon by slug
router.get("/:slug", validateRequest(slugValidation), getHackathonBySlug);

export default router;
