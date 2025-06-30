import mongoose, { Schema, type Document } from "mongoose";

export enum MilestoneStatus {
  PENDING = "pending",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
}

export interface IMilestone extends Document {
  _id: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  index: number;
  targetAmount: number;
  proofUrl?: string;
  status: MilestoneStatus;
  dueDate: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNotes?: string;
  completedAt?: Date;
  releaseTransactionHash?: string;
  metadata: {
    deliverables: string[];
    acceptanceCriteria: string[];
    estimatedHours?: number;
    priority: "low" | "medium" | "high";
  };
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    index: {
      type: Number,
      required: true,
      min: [0, "Index must be non-negative"],
    },
    targetAmount: {
      type: Number,
      required: true,
      min: [0, "Target amount must be non-negative"],
      validate: {
        validator: (value: number) => Number.isFinite(value) && value >= 0,
        message: "Target amount must be a valid non-negative number",
      },
    },
    proofUrl: {
      type: String,
      validate: {
        validator: (value: string) => {
          if (!value) return true;
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        message: "Proof URL must be a valid URL",
      },
    },
    status: {
      type: String,
      enum: Object.values(MilestoneStatus),
      default: MilestoneStatus.PENDING,
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      validate: {
        validator: (value: Date) => value > new Date(),
        message: "Due date must be in the future",
      },
    },
    submittedAt: {
      type: Date,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNotes: {
      type: String,
      maxlength: [1000, "Review notes cannot exceed 1000 characters"],
    },
    completedAt: {
      type: Date,
    },
    releaseTransactionHash: {
      type: String,
      validate: {
        validator: (value: string) => {
          // Basic validation for transaction hash format
          return !value || /^[a-fA-F0-9]{64}$/.test(value);
        },
        message: "Invalid transaction hash format",
      },
    },
    metadata: {
      deliverables: [
        {
          type: String,
          trim: true,
          maxlength: [
            500,
            "Deliverable description cannot exceed 500 characters",
          ],
        },
      ],
      acceptanceCriteria: [
        {
          type: String,
          trim: true,
          maxlength: [500, "Acceptance criteria cannot exceed 500 characters"],
        },
      ],
      estimatedHours: {
        type: Number,
        min: [0, "Estimated hours must be non-negative"],
      },
      priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound indexes for efficient queries
MilestoneSchema.index({ campaignId: 1, index: 1 }, { unique: true });
MilestoneSchema.index({ campaignId: 1, status: 1 });
MilestoneSchema.index({ status: 1, dueDate: 1 });

// Virtual for days until due
MilestoneSchema.virtual("daysUntilDue").get(function (this: IMilestone) {
  const now = new Date();
  const dueDate = new Date(this.dueDate);
  const diffTime = dueDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for completion percentage (based on status)
MilestoneSchema.virtual("completionPercentage").get(function (
  this: IMilestone,
) {
  switch (this.status) {
    case MilestoneStatus.PENDING:
      return 0;
    case MilestoneStatus.SUBMITTED:
      return 50;
    case MilestoneStatus.APPROVED:
    case MilestoneStatus.COMPLETED:
      return 100;
    case MilestoneStatus.REJECTED:
      return 0;
    default:
      return 0;
  }
});

// Pre-save middleware for validation
MilestoneSchema.pre("save", function (next) {
  // Validate status transitions
  if (this.isModified("status")) {
    const validTransitions: Record<MilestoneStatus, MilestoneStatus[]> = {
      [MilestoneStatus.PENDING]: [MilestoneStatus.SUBMITTED],
      [MilestoneStatus.SUBMITTED]: [
        MilestoneStatus.APPROVED,
        MilestoneStatus.REJECTED,
      ],
      [MilestoneStatus.APPROVED]: [MilestoneStatus.COMPLETED],
      [MilestoneStatus.REJECTED]: [MilestoneStatus.SUBMITTED],
      [MilestoneStatus.COMPLETED]: [],
    };

    const currentStatus = this.status;
    const previousStatus = this.get("status") as MilestoneStatus;

    if (
      previousStatus &&
      !validTransitions[previousStatus].includes(currentStatus)
    ) {
      next(
        new Error(
          `Invalid status transition from ${previousStatus} to ${currentStatus}`,
        ),
      );
      return;
    }
  }

  // Set timestamps based on status changes
  if (this.isModified("status")) {
    switch (this.status) {
      case MilestoneStatus.SUBMITTED:
        if (!this.submittedAt) this.submittedAt = new Date();
        break;
      case MilestoneStatus.APPROVED:
      case MilestoneStatus.REJECTED:
        if (!this.reviewedAt) this.reviewedAt = new Date();
        break;
      case MilestoneStatus.COMPLETED:
        if (!this.completedAt) this.completedAt = new Date();
        break;
    }
  }

  next();
});

// Static methods
MilestoneSchema.statics.findByCampaign = function (campaignId: string) {
  return this.find({ campaignId }).sort({ index: 1 });
};

MilestoneSchema.statics.findPendingReview = function () {
  return this.find({ status: MilestoneStatus.SUBMITTED })
    .populate("campaignId")
    .sort({ submittedAt: 1 });
};

MilestoneSchema.statics.findOverdue = function () {
  return this.find({
    status: { $in: [MilestoneStatus.PENDING, MilestoneStatus.SUBMITTED] },
    dueDate: { $lt: new Date() },
  }).populate("campaignId");
};

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);
