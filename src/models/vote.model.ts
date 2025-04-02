import mongoose, { Schema, Document } from "mongoose";

export interface IVote extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const VoteSchema: Schema = new Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Compound unique index
VoteSchema.index({ projectId: 1, userId: 1 }, { unique: true });

// Individual indexes
VoteSchema.index({ projectId: 1 });
VoteSchema.index({ userId: 1 });

export default mongoose.model<IVote>("Vote", VoteSchema);
