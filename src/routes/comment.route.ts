import express from "express";
import { protect } from "../middleware/auth";
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  reportComment,
} from "../controllers/comment.controller";
import * as reactionController from "../controllers/reaction.controller";

const router = express.Router();

// Comment routes
router.post("/projects/:id/comments", protect, createComment);
router.get("/projects/:id/comments", getComments);
router.put("/projects/:id/comments/:commentId", protect, updateComment);
router.delete("/projects/:id/comments/:commentId", protect, deleteComment);
router.post("/projects/:id/comments/:commentId/report", protect, reportComment);

// Reaction routes
router.post(
  "/projects/:id/comments/:commentId/reactions",
  protect,
  reactionController.addReaction,
);
router.delete(
  "/projects/:id/comments/:commentId/reactions",
  protect,
  reactionController.removeReaction,
);
router.get(
  "/projects/:id/comments/:commentId/reactions",
  reactionController.getReactions,
);

export default router;
