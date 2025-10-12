import mongoose, { Schema, Types, type Document } from "mongoose";

export enum ProjectStatus {
  IDEA = "idea",
  REVIEWING = "reviewing",
  VALIDATED = "validated",
  REJECTED = "rejected",
  CAMPAIGNING = "campaigning",
  LIVE = "live",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum ProjectType {
  CROWDFUND = "crowdfund",
  GRANT = "grant",
}

export interface IProject extends Document {
  creator: Types.ObjectId;
  _id: mongoose.Types.ObjectId;
  title: string;
  tagline?: string;
  description: string;
  category: string;
  status: ProjectStatus;
  owner: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  // Crowdfunding specific fields
  vision?: string;
  githubUrl?: string;
  gitlabUrl?: string;
  bitbucketUrl?: string;
  projectWebsite?: string;
  demoVideo?: string;
  socialLinks?: Array<{
    platform: string;
    url: string;
  }>;
  contact?: {
    primary: string;
    backup?: string;
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
    thumbnail?: string;
  };
  documents: {
    whitepaper: string;
    pitchDeck: string;
  };
  tags?: string[];
  creationTxHash?: string;
  grant?: {
    isGrant: boolean;
    applications: Array<{
      _id?: mongoose.Types.ObjectId;
      applicant: { type: mongoose.Types.ObjectId; ref: "User" };
      status:
        | "SUBMITTED"
        | "REVIEWING"
        | "APPROVED"
        | "REJECTED"
        | "IN_PROGRESS"
        | "LOCKED"
        | "AWAITING_FINAL_APPROVAL"; // ✅ Added this missing status
      submittedAt: Date;
      nextAction?: string;
      escrowedAmount: number;
      milestonesCompleted: number;
      txHash?: string;
      milestones: Array<{
        title: string;
        description: string;
        amount: number;
      }>; // ✅ Added missing milestones inside applications
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
  // Trustless Work integration fields for crowdfunding projects
  stakeholders?: {
    serviceProvider: string;
    approver: string;
    releaseSigner: string;
    disputeResolver: string;
    receiver: string;
    platformAddress?: string;
  };
  trustlessWorkStatus?: "pending" | "deployed" | "funded" | "failed";
  escrowAddress?: string;
  escrowType?: "single" | "multi";
  escrowDetails?: {
    contractId?: string;
    engagementId?: string;
    title?: string;
    description?: string;
    roles?: {
      approver?: string;
      serviceProvider?: string;
      disputeResolver?: string;
      receiver?: string;
      platformAddress?: string;
      releaseSigner?: string;
    };
    platformFee?: number;
    milestones?: Array<{
      description?: string;
      status?: string;
      evidence?: string;
      amount?: number;
      flags?: {
        disputed?: boolean;
        released?: boolean;
        resolved?: boolean;
        approved?: boolean;
      };
    }>;
    trustline?: {
      address?: string;
    };
    receiverMemo?: number;
    transactionStatus?: string;
    transactionMessage?: string;
  };
}

const ProjectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true },
    tagline: { type: String },
    description: { type: String, required: true },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.IDEA,
    },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true }, // ✅ Added creator field
    owner: {
      type: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    // Crowdfunding specific fields
    vision: { type: String },
    githubUrl: { type: String },
    gitlabUrl: { type: String },
    bitbucketUrl: { type: String },
    projectWebsite: { type: String },
    demoVideo: { type: String },
    socialLinks: [
      {
        platform: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    contact: {
      primary: { type: String, required: true },
      backup: { type: String },
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
      thumbnail: { type: String },
    },
    documents: {
      whitepaper: { type: String },
      pitchDeck: { type: String },
    },
    tags: [{ type: String }],
    creationTxHash: { type: String },
    grant: {
      isGrant: { type: Boolean, default: false },
      applications: [
        {
          applicant: { type: Schema.Types.ObjectId, ref: "User" },
          status: {
            type: String,
            enum: [
              "SUBMITTED",
              "REVIEWING",
              "APPROVED",
              "REJECTED",
              "IN_PROGRESS",
              "LOCKED",
              "AWAITING_FINAL_APPROVAL", // ✅ Added missing status here
            ],
            default: "SUBMITTED",
          },
          submittedAt: { type: Date },
          nextAction: { type: String },
          escrowedAmount: { type: Number, default: 0 },
          milestonesCompleted: { type: Number, default: 0 },
          txHash: { type: String },
          milestones: [
            {
              title: { type: String, required: true },
              description: { type: String, required: true },
              amount: { type: Number, required: true },
            },
          ], // ✅ Added missing milestones array inside applications
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
    // adminNote: {
    //   type: String,
    // },
    summary: { type: String },
    type: {
      type: String,
      enum: Object.values(ProjectType),
      required: true,
    },
    whitepaperUrl: { type: String },
    pitchVideoUrl: { type: String },
    votes: { type: Number, default: 0 },
    // Trustless Work integration fields for crowdfunding projects
    stakeholders: {
      serviceProvider: { type: String, required: true },
      approver: { type: String, required: true },
      releaseSigner: { type: String, required: true },
      disputeResolver: { type: String, required: true },
      receiver: { type: String, required: true },
      platformAddress: { type: String },
    },
    trustlessWorkStatus: {
      type: String,
      enum: ["pending", "deployed", "funded", "failed"],
      default: "pending",
    },
    escrowAddress: { type: String },
    escrowType: {
      type: String,
      enum: ["single", "multi"],
      default: "multi",
    },
    escrowDetails: {
      contractId: { type: String },
      engagementId: { type: String },
      title: { type: String },
      description: { type: String },
      roles: {
        approver: { type: String },
        serviceProvider: { type: String },
        disputeResolver: { type: String },
        receiver: { type: String },
        platformAddress: { type: String },
        releaseSigner: { type: String },
      },
      platformFee: { type: Number },
      milestones: [
        {
          description: { type: String },
          status: { type: String },
          evidence: { type: String },
          amount: { type: Number },
          flags: {
            disputed: { type: Boolean },
            released: { type: Boolean },
            resolved: { type: Boolean },
            approved: { type: Boolean },
          },
        },
      ],
      trustline: {
        address: { type: String },
      },
      receiverMemo: { type: Number },
      transactionStatus: { type: String },
      transactionMessage: { type: String },
    },
  },
  { timestamps: true },
);

// Indexes
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ "owner.type": 1 });
ProjectSchema.index({ "funding.endDate": 1 });

export default mongoose.model<IProject>("Project", ProjectSchema);
