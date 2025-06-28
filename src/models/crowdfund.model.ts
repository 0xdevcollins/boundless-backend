import mongoose, { Schema, type Document } from "mongoose";

export enum CrowdfundStatus {
  PENDING = "pending",
  UNDER_REVIEW = "under_review",
  VALIDATED = "validated",
  REJECTED = "rejected",
}

export interface ICrowdfund extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  thresholdVotes: number;
  voteDeadline?: Date;
  totalVotes: number;
  status: CrowdfundStatus;
  validatedAt?: Date;
  rejectedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CrowdfundSchema = new Schema<ICrowdfund>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
      unique: true,
      index: true,
    },
    thresholdVotes: {
      type: Number,
      default: 100,
      min: [1, "Threshold votes must be at least 1"],
      max: [10000, "Threshold votes cannot exceed 10,000"],
    },
    voteDeadline: {
      type: Date,
      validate: {
        validator: (value: Date) => !value || value > new Date(),
        message: "Vote deadline must be in the future",
      },
    },
    totalVotes: {
      type: Number,
      default: 0,
      min: [0, "Total votes cannot be negative"],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(CrowdfundStatus),
        message: "Invalid crowdfund status",
      },
      default: CrowdfundStatus.PENDING,
    },
    validatedAt: {
      type: Date,
      validate: {
        validator: function (this: ICrowdfund, value: Date) {
          return !value || this.status === CrowdfundStatus.VALIDATED;
        },
        message: "Validated date can only be set when status is validated",
      },
    },
    rejectedReason: {
      type: String,
      maxlength: [500, "Rejected reason cannot exceed 500 characters"],
      validate: {
        validator: function (this: ICrowdfund, value: string) {
          return !value || this.status === CrowdfundStatus.REJECTED;
        },
        message: "Rejected reason can only be set when status is rejected",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
CrowdfundSchema.index({ projectId: 1 }, { unique: true });
CrowdfundSchema.index({ status: 1, createdAt: -1 });
CrowdfundSchema.index({ voteDeadline: 1 });
CrowdfundSchema.index({ totalVotes: -1 });

// Virtual for checking if voting is still active
CrowdfundSchema.virtual("isVotingActive").get(function () {
  return this.voteDeadline ? new Date() < this.voteDeadline : true;
});

// Virtual for vote progress percentage
CrowdfundSchema.virtual("voteProgress").get(function () {
  return Math.min((this.totalVotes / this.thresholdVotes) * 100, 100);
});

// Pre-save middleware to set validatedAt when status changes to validated
CrowdfundSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === CrowdfundStatus.VALIDATED &&
    !this.validatedAt
  ) {
    this.validatedAt = new Date();
  }
  next();
});

// Pre-save middleware to clear validatedAt when status changes from validated
CrowdfundSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status !== CrowdfundStatus.VALIDATED) {
    this.validatedAt = undefined;
  }
  next();
});

// Static method to find crowdfunds by status
CrowdfundSchema.statics.findByStatus = function (status: CrowdfundStatus) {
  return this.find({ status }).populate("projectId");
};

// Static method to find expired voting deadlines
CrowdfundSchema.statics.findExpiredVoting = function () {
  return this.find({
    voteDeadline: { $lt: new Date() },
    status: { $in: [CrowdfundStatus.PENDING, CrowdfundStatus.UNDER_REVIEW] },
  });
};

export default mongoose.model<ICrowdfund>("Crowdfund", CrowdfundSchema);
