import mongoose, { Schema, Document, Model, Types } from "mongoose";

// IVote interface for a vote document
export interface IVote extends Document {
  userId: Types.ObjectId;
  projectId: Types.ObjectId;
  value: number; // 1 for upvote, -1 for downvote
  createdAt: Date;
  updatedAt: Date;
}

// VoteModel interface for static methods
interface VoteModel extends Model<IVote> {
  getVoteCounts(projectId: Types.ObjectId): Promise<
    {
      upvotes: number;
      downvotes: number;
      totalVotes: number;
      netVotes: number;
    }[]
  >;
  getUserVote(
    userId: Types.ObjectId,
    projectId: Types.ObjectId,
  ): Promise<IVote | null>;
}

// Vote schema
const VoteSchema = new Schema<IVote>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    value: {
      type: Number,
      enum: [1, -1],
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for vote type
VoteSchema.virtual("voteType").get(function (this: IVote) {
  return this.value === 1 ? "upvote" : "downvote";
});

// Compound index to ensure one vote per user per project
VoteSchema.index({ userId: 1, projectId: 1 }, { unique: true });
VoteSchema.index({ projectId: 1, value: 1 });

// Static method to get vote counts for a project
VoteSchema.statics.getVoteCounts = function (projectId: Types.ObjectId) {
  return this.aggregate([
    { $match: { projectId } },
    {
      $group: {
        _id: null,
        upvotes: {
          $sum: { $cond: [{ $eq: ["$value", 1] }, 1, 0] },
        },
        downvotes: {
          $sum: { $cond: [{ $eq: ["$value", -1] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        upvotes: 1,
        downvotes: 1,
        totalVotes: { $add: ["$upvotes", "$downvotes"] },
        netVotes: { $subtract: ["$upvotes", "$downvotes"] },
      },
    },
  ]);
};

// Static method to get user's vote for a project
VoteSchema.statics.getUserVote = function (
  userId: Types.ObjectId,
  projectId: Types.ObjectId,
) {
  return this.findOne({ userId, projectId }).lean();
};

// Pre-save middleware to validate project
VoteSchema.pre<IVote>("save", async function (next) {
  if (this.isNew) {
    const Project = mongoose.model("Project");
    const project = await Project.findById(this.projectId).select("status");

    if (!project) {
      return next(new Error("Project not found"));
    }

    const voteableStatuses = ["idea", "reviewing", "validated"];
    if (!voteableStatuses.includes(project.status)) {
      return next(new Error("Project is not available for voting"));
    }
  }
  next();
});

// Final Vote model
const Vote = mongoose.model<IVote, VoteModel>("Vote", VoteSchema);

export default Vote;
