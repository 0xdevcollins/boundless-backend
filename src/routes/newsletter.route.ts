import { Router } from "express";
import {
  subscribe,
  validateSubscribe,
} from "../controllers/newsletter.controller";
import { validateRequest } from "../middleware/validateRequest";

const router = Router();

router.post("/subscribe", validateRequest(validateSubscribe), subscribe);

export default router;
