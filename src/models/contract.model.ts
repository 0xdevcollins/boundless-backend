import mongoose, { Schema, type Document } from "mongoose";

export enum ContractStatus {
  PENDING = "PENDING",
  DEPLOYED = "DEPLOYED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface IContract extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  address: string;
  network: string;
  fundingGoal: number;
  raised: number;
  status: ContractStatus;
  deployedAt: Date;
  lastUpdated: Date;
}

const ContractSchema = new Schema<IContract>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    address: { type: String, required: true },
    network: { type: String, required: true },
    fundingGoal: { type: Number, required: true },
    raised: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(ContractStatus),
      default: ContractStatus.PENDING,
    },
    deployedAt: { type: Date, required: true },
    lastUpdated: { type: Date, required: true },
  },
  { timestamps: true },
);

// Indexes for faster queries
ContractSchema.index({ projectId: 1 });
ContractSchema.index({ address: 1 });
ContractSchema.index({ status: 1 });

export default mongoose.model<IContract>("Contract", ContractSchema);
