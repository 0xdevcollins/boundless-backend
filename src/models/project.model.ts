import mongoose, { Schema, Document } from "mongoose";

export enum ProjectStatus {
  DRAFT = "DRAFT",
  AWAITING_BOUNDLESS_VERIFICATION = "AWAITING_BOUNDLESS_VERIFICATION",
  PENDING_DEPLOYMENT = "PENDING_DEPLOYMENT",
  VOTING = "VOTING",
  FUNDING = "FUNDING",
  FUNDED = "FUNDED",
  REJECTED = "REJECTED",
  REFUND_PENDING = "REFUND_PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  PAUSED = "PAUSED",
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
  createdAt: Date;
  updatedAt: Date;
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
  },
  { timestamps: true },
);

// Indexes for faster queries
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ "owner.type": 1 });
ProjectSchema.index({ "funding.endDate": 1 });

export default mongoose.model<IProject>("Project", ProjectSchema);
