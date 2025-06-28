import { Request, Response } from "express";
import Reaction from "../models/reaction.model";
import Comment from "../models/comment.model";
import mongoose from "mongoose";

// Add a reaction to a comment
export async function addReaction(req: Request, res: Response): Promise<void> {
  try {
    const { commentId } = req.params;
    const { type } = req.body;
    const userId = (req as any).user._id;

    // Validate reaction type
    const validTypes = ["LIKE", "DISLIKE", "HELPFUL", "SPAM"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: "Invalid reaction type" });
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check for existing reaction
      const existingReaction = await Reaction.findOne({ userId, commentId });

      if (existingReaction) {
        // If same reaction type, remove it
        if (existingReaction.type === type) {
          await Reaction.deleteOne({ _id: existingReaction._id }).session(
            session,
          );
          await Comment.findByIdAndUpdate(
            commentId,
            { $inc: { [`reactionCounts.${type}`]: -1 } },
            { session },
          );
        } else {
          // If different reaction type, update it
          await Reaction.updateOne(
            { _id: existingReaction._id },
            { type },
            { session },
          );
          await Comment.findByIdAndUpdate(
            commentId,
            {
              $inc: {
                [`reactionCounts.${existingReaction.type}`]: -1,
                [`reactionCounts.${type}`]: 1,
              },
            },
            { session },
          );
        }
      } else {
        // Create new reaction
        await Reaction.create(
          [
            {
              userId,
              commentId,
              type,
            },
          ],
          { session },
        );

        await Comment.findByIdAndUpdate(
          commentId,
          { $inc: { [`reactionCounts.${type}`]: 1 } },
          { session },
        );
      }

      await session.commitTransaction();
      res.json({ message: "Reaction updated successfully" });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Add reaction error:", error);
    res.status(500).json({ message: "Failed to update reaction" });
  }
}

// Remove a reaction from a comment
export async function removeReaction(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user._id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reaction = await Reaction.findOne({ userId, commentId });

      if (!reaction) {
        res.status(404).json({ message: "Reaction not found" });
        return;
      }

      await Reaction.deleteOne({ _id: reaction._id }).session(session);
      await Comment.findByIdAndUpdate(
        commentId,
        { $inc: { [`reactionCounts.${reaction.type}`]: -1 } },
        { session },
      );

      await session.commitTransaction();
      res.json({ message: "Reaction removed successfully" });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Remove reaction error:", error);
    res.status(500).json({ message: "Failed to remove reaction" });
  }
}

// Get reactions for a comment
export async function getReactions(req: Request, res: Response): Promise<void> {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [reactions, total] = await Promise.all([
      Reaction.find({ commentId })
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit))
        .populate("userId", "name username image"),
      Reaction.countDocuments({ commentId }),
    ]);

    res.json({
      reactions,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get reactions error:", error);
    res.status(500).json({ message: "Failed to retrieve reactions" });
  }
}
