import mongoose, { Schema, Document } from "mongoose";

export enum ValidationStatus {
  PENDING = "PENDING",
  REJECTED = "REJECTED",
  VALIDATED = "VALIDATED",
}

export interface IProject extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  fundingGoal: number;
  category: string;
  bannerUrl?: string;
  profileUrl?: string;
  blockchainTx?: string;
  ideaValidation: ValidationStatus;
  createdAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    fundingGoal: { type: Number, required: true },
    category: { type: String, required: true },
    bannerUrl: { type: String },
    profileUrl: { type: String },
    blockchainTx: { type: String },
    ideaValidation: {
      type: String,
      enum: Object.values(ValidationStatus),
      default: ValidationStatus.PENDING,
    },
  },
  { timestamps: true },
);

export default mongoose.model<IProject>("Project", ProjectSchema);
