import mongoose, { Schema, type Document } from "mongoose";

export interface IProjectComment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  content: string;
  parentCommentId?: mongoose.Types.ObjectId;
  status: "active" | "deleted" | "flagged" | "hidden";
  editHistory: Array<{
    content: string;
    editedAt: Date;
  }>;
  reactionCounts: {
    LIKE: number;
    DISLIKE: number;
    HELPFUL: number;
  };
  createdAt: Date;
  updatedAt: Date;
  isSpam: boolean;
  reports: Array<{
    userId: mongoose.Types.ObjectId;
    reason: string;
    description?: string;
    createdAt: Date;
  }>;
}

const ProjectCommentSchema = new Schema<IProjectComment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
      index: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      minlength: [1, "Content must not be empty"],
      maxlength: [2000, "Content must not exceed 2000 characters"],
      trim: true,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectComment",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["active", "deleted", "flagged", "hidden"],
        message: "Invalid comment status",
      },
      default: "active",
      index: true,
    },
    editHistory: [
      {
        content: {
          type: String,
          required: true,
        },
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactionCounts: {
      LIKE: { type: Number, default: 0, min: 0 },
      DISLIKE: { type: Number, default: 0, min: 0 },
      HELPFUL: { type: Number, default: 0, min: 0 },
    },
    isSpam: {
      type: Boolean,
      default: false,
      index: true,
    },
    reports: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reason: {
          type: String,
          required: true,
          enum: [
            "spam",
            "inappropriate",
            "harassment",
            "misinformation",
            "other",
          ],
        },
        description: {
          type: String,
          maxlength: 500,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
ProjectCommentSchema.index({ projectId: 1, createdAt: -1 });
ProjectCommentSchema.index({ userId: 1, createdAt: -1 });
ProjectCommentSchema.index({ parentCommentId: 1, createdAt: 1 });
ProjectCommentSchema.index({ status: 1, createdAt: -1 });

// Virtual for reply count
ProjectCommentSchema.virtual("replyCount", {
  ref: "ProjectComment",
  localField: "_id",
  foreignField: "parentCommentId",
  count: true,
});

// Virtual for total reactions
ProjectCommentSchema.virtual("totalReactions").get(function () {
  return (
    this.reactionCounts.LIKE +
    this.reactionCounts.DISLIKE +
    this.reactionCounts.HELPFUL
  );
});

// Pre-save middleware to validate project exists
ProjectCommentSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Project = mongoose.model("Project");
    const project = await Project.findById(this.projectId).select("status");

    if (!project) {
      return next(new Error("Project not found"));
    }

    // Only allow comments on active projects
    // const commentableStatuses = [
    //   "IDEA",
    //   "REVIEWING",
    //   "VALIDATED",
    //   "CAMPAIGNING",
    //   "LIVE",
    // ];
    // if (!commentableStatuses.includes(project.status)) {
    //   return next(new Error("Project is not available for comments"));
    // }
  }
  next();
});

// Static method to get comments for a project with pagination
ProjectCommentSchema.statics.getProjectComments = function (
  projectId: mongoose.Types.ObjectId,
  page = 1,
  limit = 10,
  parentCommentId: mongoose.Types.ObjectId | null = null,
) {
  const skip = (page - 1) * limit;

  return this.find({
    projectId,
    parentCommentId,
    status: "active",
  })
    .populate(
      "userId",
      "profile.firstName profile.lastName profile.username profile.avatar",
    )
    .populate("replyCount")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export default mongoose.model<IProjectComment>(
  "ProjectComment",
  ProjectCommentSchema,
);
