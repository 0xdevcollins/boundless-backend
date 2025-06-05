import mongoose, { Schema, Document } from "mongoose";

export interface IReport extends Document {
  contentId: mongoose.Types.ObjectId;
  contentType: "comment" | "project" | "user";
  reportedBy: mongoose.Types.ObjectId;
  reason: string;
  description?: string;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  actionTaken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    contentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: ["comment", "project", "user"],
      required: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: [true, "Reason is required"],
      enum: ["spam", "harassment", "inappropriate", "copyright", "other"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description must not exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    actionTaken: {
      type: String,
      maxlength: [500, "Action taken must not exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ contentType: 1, status: 1 });
ReportSchema.index({ reportedBy: 1 });

export default mongoose.model<IReport>("Report", ReportSchema);
