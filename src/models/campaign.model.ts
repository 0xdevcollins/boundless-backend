import mongoose, { Schema, type Document } from "mongoose";

export enum CampaignStatus {
  DRAFT = "draft",
  PENDING_APPROVAL = "pending_approval",
  LIVE = "live",
  FUNDED = "funded",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface ICampaign extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  goalAmount: number;
  deadline: Date;
  fundsRaised: number;
  smartContractAddress?: string;
  status: CampaignStatus;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  deployedAt?: Date;
  rejectedReason?: string;
  metadata: {
    currency: string;
    minimumContribution: number;
    maximumContribution?: number;
    refundPolicy: string;
  };
  analytics: {
    totalContributors: number;
    averageContribution: number;
    lastContributionAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    goalAmount: {
      type: Number,
      required: true,
      min: [1, "Goal amount must be greater than 0"],
      validate: {
        validator: (value: number) => value > 0 && Number.isFinite(value),
        message: "Goal amount must be a valid positive number",
      },
    },
    deadline: {
      type: Date,
      required: true,
      validate: {
        validator: (value: Date) => value > new Date(),
        message: "Deadline must be in the future",
      },
    },
    fundsRaised: {
      type: Number,
      default: 0,
      min: [0, "Funds raised cannot be negative"],
    },
    smartContractAddress: {
      type: String,
      sparse: true,
      validate: {
        validator: (value: string) => {
          // Basic validation for Stellar contract address format
          return !value || /^C[A-Z0-9]{55}$/.test(value);
        },
        message: "Invalid smart contract address format",
      },
    },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    deployedAt: {
      type: Date,
    },
    rejectedReason: {
      type: String,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },
    metadata: {
      currency: {
        type: String,
        required: true,
        default: "USD",
        enum: ["USD", "XLM", "USDC"],
      },
      minimumContribution: {
        type: Number,
        required: true,
        default: 1,
        min: [0.01, "Minimum contribution must be at least 0.01"],
      },
      maximumContribution: {
        type: Number,
        validate: {
          validator: function (this: ICampaign, value: number) {
            return !value || value >= this.metadata.minimumContribution;
          },
          message:
            "Maximum contribution must be greater than minimum contribution",
        },
      },
      refundPolicy: {
        type: String,
        required: true,
        enum: ["all_or_nothing", "keep_it_all", "milestone_based"],
        default: "all_or_nothing",
      },
    },
    analytics: {
      totalContributors: {
        type: Number,
        default: 0,
        min: 0,
      },
      averageContribution: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastContributionAt: {
        type: Date,
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
CampaignSchema.index({ projectId: 1, status: 1 });
CampaignSchema.index({ creatorId: 1, status: 1 });
CampaignSchema.index({ status: 1, deadline: 1 });
CampaignSchema.index({ smartContractAddress: 1 }, { sparse: true });

// Virtual for funding progress percentage
CampaignSchema.virtual("fundingProgress").get(function (this: ICampaign) {
  return this.goalAmount > 0 ? (this.fundsRaised / this.goalAmount) * 100 : 0;
});

// Virtual for days remaining
CampaignSchema.virtual("daysRemaining").get(function (this: ICampaign) {
  const now = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware for validation
CampaignSchema.pre("save", function (next) {
  // Ensure deadline is at least 1 day in the future for new campaigns
  if (
    this.isNew &&
    this.deadline <= new Date(Date.now() + 24 * 60 * 60 * 1000)
  ) {
    next(
      new Error("Campaign deadline must be at least 24 hours in the future"),
    );
    return;
  }

  // Validate status transitions
  if (this.isModified("status")) {
    const validTransitions: Record<CampaignStatus, CampaignStatus[]> = {
      [CampaignStatus.DRAFT]: [
        CampaignStatus.PENDING_APPROVAL,
        CampaignStatus.CANCELLED,
      ],
      [CampaignStatus.PENDING_APPROVAL]: [
        CampaignStatus.LIVE,
        CampaignStatus.CANCELLED,
      ],
      [CampaignStatus.LIVE]: [
        CampaignStatus.FUNDED,
        CampaignStatus.FAILED,
        CampaignStatus.CANCELLED,
      ],
      [CampaignStatus.FUNDED]: [],
      [CampaignStatus.FAILED]: [],
      [CampaignStatus.CANCELLED]: [],
    };

    const currentStatus = this.status;
    const previousStatus = this.get("status") as CampaignStatus;

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

  next();
});

// Static methods
CampaignSchema.statics.findByProject = function (projectId: string) {
  return this.findOne({ projectId }).populate("projectId creatorId");
};

CampaignSchema.statics.findPendingApproval = function () {
  return this.find({ status: CampaignStatus.PENDING_APPROVAL })
    .populate("projectId creatorId")
    .sort({ createdAt: 1 });
};

CampaignSchema.statics.findActiveCampaigns = function () {
  return this.find({
    status: CampaignStatus.LIVE,
    deadline: { $gt: new Date() },
  }).populate("projectId");
};

export default mongoose.model<ICampaign>("Campaign", CampaignSchema);
