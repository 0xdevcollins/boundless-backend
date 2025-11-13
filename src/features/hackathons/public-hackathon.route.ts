import { Router } from "express";
import { getHackathonBySlug } from "./public-hackathon.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { slugValidation } from "../../utils/blog.validation.util";

const router = Router();

// GET /api/hackathons/:slug - Public endpoint to get hackathon by slug
router.get("/:slug", validateRequest(slugValidation), getHackathonBySlug);

export default router;
