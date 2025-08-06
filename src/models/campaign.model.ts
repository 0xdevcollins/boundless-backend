import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICampaign extends Document {
  title: string;
  projectId: Types.ObjectId;
  creatorId: Types.ObjectId;
  marker?: Types.ObjectId;
  releaser?: Types.ObjectId;
  resolver?: Types.ObjectId;
  trustlessCampaignId?: string;
  currency: string;
  goalAmount: number;
  deadline: Date;
  fundsRaised: number;
  smartContractAddress?: string;
  status:
    | "draft"
    | "pending_approval"
    | "live"
    | "funded"
    | "failed"
    | "cancelled"
    | "completed";
  createdAt: Date;
  updatedAt: Date;
  documents?: {
    whitepaper?: string;
    pitchDeck?: string;
  };
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  // Trustless Work integration fields
  stakeholders?: {
    marker: string;
    approver: string;
    releaser: string;
    resolver: string;
    receiver: string;
    platformAddress?: string;
  };
  trustlessWorkStatus?: "pending" | "deployed" | "funded" | "failed";
  escrowAddress?: string;
  escrowType?: "single" | "multi";
}

const CampaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true },
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
    marker: { type: Schema.Types.ObjectId, ref: "User", default: null },
    releaser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolver: { type: Schema.Types.ObjectId, ref: "User", default: null },
    trustlessCampaignId: { type: String, index: true, default: null },
    currency: { type: String, required: true, default: "USDC" },
    goalAmount: { type: Number, required: true },
    deadline: { type: Date, required: true },
    fundsRaised: { type: Number, default: 0 },
    smartContractAddress: { type: String },
    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "live",
        "funded",
        "failed",
        "cancelled",
        "completed",
      ],
      default: "draft",
      index: true,
    },
    documents: {
      whitepaper: { type: String },
      pitchDeck: { type: String },
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    // Trustless Work integration fields
    stakeholders: {
      marker: { type: String },
      approver: { type: String },
      releaser: { type: String },
      resolver: { type: String },
      receiver: { type: String },
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
  },
  { timestamps: true }
);

export default mongoose.model<ICampaign>("Campaign", CampaignSchema);
