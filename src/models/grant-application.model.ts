import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGrantApplicationMilestone {
  title: string;
  description: string;
  expectedPayout: number;
  supportingDocuments?: string[];
}

export interface IGrantApplication extends Document {
  grantId: Types.ObjectId;
  title: string;
  summary: string;
  applicantId: Types.ObjectId;
  milestones: IGrantApplicationMilestone[];
  status:
    | "submitted"
    | "reviewing"
    | "approved"
    | "rejected"
    | "paused"
    | "cancelled"
    | "awaiting-final-approval";
  adminNote?: string;
  archived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GrantApplicationMilestoneSchema = new Schema<IGrantApplicationMilestone>({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  expectedPayout: { type: Number, required: true, min: 0 },
  supportingDocuments: [{ type: String }],
});

const GrantApplicationSchema = new Schema<IGrantApplication>(
  {
    grantId: { type: Schema.Types.ObjectId, ref: "Grant", required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    applicantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    milestones: { type: [GrantApplicationMilestoneSchema], required: true },
    status: {
      type: String,
      enum: [
        "submitted",
        "reviewing",
        "approved",
        "rejected",
        "paused",
        "cancelled",
        "awaiting-final-approval",
      ],
      default: "submitted",
    },
    adminNote: { type: String },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

GrantApplicationSchema.index({ grantId: 1, applicantId: 1 }, { unique: true });

export default mongoose.model<IGrantApplication>(
  "GrantApplication",
  GrantApplicationSchema,
);
