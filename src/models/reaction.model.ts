import mongoose, { Schema, Document } from "mongoose";

export type ReactionType = "LIKE" | "DISLIKE" | "HELPFUL" | "SPAM";

export interface IReaction extends Document {
  userId: mongoose.Types.ObjectId;
  commentId: mongoose.Types.ObjectId;
  type: ReactionType;
  createdAt: Date;
}

const ReactionSchema = new Schema<IReaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
    },
    type: {
      type: String,
      enum: ["LIKE", "DISLIKE", "HELPFUL", "SPAM"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to prevent duplicate reactions from the same user
ReactionSchema.index({ userId: 1, commentId: 1 }, { unique: true });

// Index for querying reactions by comment
ReactionSchema.index({ commentId: 1 });

export default mongoose.model<IReaction>("Reaction", ReactionSchema);
