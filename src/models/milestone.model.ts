import mongoose, { Schema, type Document } from "mongoose";

export enum MilestoneStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  RELEASED = "RELEASED",
  OVERDUE = "OVERDUE",
  CANCELLED = "CANCELLED",
}

export interface IMilestone extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  contractId: mongoose.Types.ObjectId;
  title: string;
  amount: number;
  dueDate: Date;
  status: MilestoneStatus;
  releaseTransaction?: mongoose.Types.ObjectId;
  releasedAt?: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
    },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(MilestoneStatus),
      default: MilestoneStatus.PENDING,
    },
    releaseTransaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
    },
    releasedAt: { type: Date },
  },
  { timestamps: true },
);

// Indexes for faster queries
MilestoneSchema.index({ projectId: 1 });
MilestoneSchema.index({ contractId: 1 });
MilestoneSchema.index({ status: 1 });

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);
