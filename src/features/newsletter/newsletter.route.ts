import { Router } from "express";
import { subscribe, validateSubscribe } from "./newsletter.controller.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

router.post("/subscribe", validateRequest(validateSubscribe), subscribe);

export default router;
