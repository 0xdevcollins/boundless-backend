import mongoose, { Schema, type Document } from "mongoose";

export enum ProjectStatus {
  IDEA = "idea",
  REVIEWING = "reviewing",
  REJECTED = "rejected",
  VALIDATED = "validated",
  CAMPAIGNING = "campaigning",
  LIVE = "live",
  COMPLETED = "completed",
  // Keep existing statuses for backward compatibility
  DRAFT = "DRAFT",
  AWAITING_BOUNDLESS_VERIFICATION = "AWAITING_BOUNDLESS_VERIFICATION",
  PENDING_DEPLOYMENT = "PENDING_DEPLOYMENT",
  VOTING = "VOTING",
  FUNDING = "FUNDING",
  FUNDED = "FUNDED",
  CANCELLED = "CANCELLED",
  PAUSED = "PAUSED",
  REFUND_PENDING = "REFUND_PENDING",
}

export enum ProjectType {
  CROWDFUND = "crowdfund",
  GRANT = "grant",
}

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  status: ProjectStatus;
  owner: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  funding: {
    goal: number;
    raised: number;
    currency: string;
    endDate: Date;
    contributors: Array<{
      user: {
        type: mongoose.Types.ObjectId;
        ref: "User";
      };
      amount: number;
      date: Date;
      transactionHash: string;
    }>;
  };
  voting: {
    startDate: Date;
    endDate: Date;
    totalVotes: number;
    positiveVotes: number;
    negativeVotes: number;
    voters: Array<{
      userId: {
        type: mongoose.Types.ObjectId;
        ref: "User";
      };
      vote: string;
      votedAt: Date;
    }>;
  };
  milestones: Array<{
    title: string;
    description: string;
    amount: number;
    dueDate: Date;
    status: string;
    completedAt?: Date;
    releaseTransactionHash?: string;
  }>;
  team: Array<{
    userId: {
      type: mongoose.Types.ObjectId;
      ref: "User";
    };
    role: string;
    joinedAt: Date;
  }>;
  media: {
    banner: string;
    logo: string;
  };
  documents: {
    whitepaper: string;
    pitchDeck: string;
  };
  creationTxHash?: string;
  grant?: {
    isGrant: boolean;
    applications: Array<{
      applicant: { type: mongoose.Types.ObjectId; ref: "User" };
      status: "SUBMITTED" | "REVIEWING" | "APPROVED" | "REJECTED";
      submittedAt: Date;
      nextAction?: string;
      escrowedAmount: number;
      milestonesCompleted: number;
    }>;
    totalBudget: number;
    totalDisbursed: number;
    proposalsReceived: number;
    proposalsApproved: number;
    status: "OPEN" | "CLOSED" | "IN_PROGRESS";
  };
  approvedBy?: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  summary?: string;
  type: ProjectType;
  whitepaperUrl?: string;
  pitchVideoUrl?: string;
  votes: number;
}

const ProjectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.DRAFT,
    },
    owner: {
      type: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    funding: {
      goal: { type: Number, required: true },
      raised: { type: Number, default: 0 },
      currency: { type: String, required: true },
      endDate: { type: Date, required: true },
      contributors: [
        {
          user: { type: Schema.Types.ObjectId, ref: "User" },
          amount: { type: Number, required: true },
          date: { type: Date, required: true },
          transactionHash: { type: String, required: true },
        },
      ],
    },
    voting: {
      startDate: { type: Date },
      endDate: { type: Date },
      totalVotes: { type: Number, default: 0 },
      positiveVotes: { type: Number, default: 0 },
      negativeVotes: { type: Number, default: 0 },
      voters: [
        {
          userId: { type: Schema.Types.ObjectId, ref: "User" },
          vote: { type: String, required: true },
          votedAt: { type: Date, required: true },
        },
      ],
    },
    milestones: [
      {
        title: { type: String, required: true },
        description: { type: String, required: true },
        amount: { type: Number, required: true },
        dueDate: { type: Date, required: true },
        status: { type: String, required: true },
        completedAt: { type: Date },
        releaseTransactionHash: { type: String },
      },
    ],
    team: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        role: { type: String, required: true },
        joinedAt: { type: Date, required: true },
      },
    ],
    media: {
      banner: { type: String },
      logo: { type: String },
    },
    documents: {
      whitepaper: { type: String },
      pitchDeck: { type: String },
    },
    creationTxHash: { type: String },
    grant: {
      isGrant: { type: Boolean, default: false },
      applications: [
        {
          applicant: { type: Schema.Types.ObjectId, ref: "User" },
          status: {
            type: String,
            enum: ["SUBMITTED", "REVIEWING", "APPROVED", "REJECTED"],
            default: "SUBMITTED",
          },
          submittedAt: { type: Date },
          nextAction: { type: String },
          escrowedAmount: { type: Number, default: 0 },
          milestonesCompleted: { type: Number, default: 0 },
        },
      ],
      totalBudget: { type: Number, default: 0 },
      totalDisbursed: { type: Number, default: 0 },
      proposalsReceived: { type: Number, default: 0 },
      proposalsApproved: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["OPEN", "CLOSED", "IN_PROGRESS"],
        default: "OPEN",
      },
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    summary: { type: String },
    type: {
      type: String,
      enum: Object.values(ProjectType),
      required: true,
    },
    whitepaperUrl: { type: String },
    pitchVideoUrl: { type: String },
    votes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Indexes for faster queries
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ "owner.type": 1 });
ProjectSchema.index({ "funding.endDate": 1 });

export default mongoose.model<IProject>("Project", ProjectSchema);
