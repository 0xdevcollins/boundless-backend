import mongoose, { Schema, Document, Types } from "mongoose";

export type ResourceType = "pdf" | "doc" | "sheet" | "slide" | "link" | "video";

export interface IHackathonResource extends Document {
  hackathonId: Types.ObjectId;
  organizationId: Types.ObjectId;
  title: string;
  type: ResourceType;
  url: string;
  size?: string;
  description?: string;
  uploadDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HackathonResourceSchema = new Schema<IHackathonResource>(
  {
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: [true, "Hackathon ID is required"],
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    type: {
      type: String,
      enum: {
        values: ["pdf", "doc", "sheet", "slide", "link", "video"],
        message:
          "Resource type must be one of: pdf, doc, sheet, slide, link, video",
      },
      required: [true, "Resource type is required"],
    },
    url: {
      type: String,
      required: [true, "URL is required"],
      trim: true,
    },
    size: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
HackathonResourceSchema.index({ hackathonId: 1, createdAt: -1 });
HackathonResourceSchema.index({ organizationId: 1 });

export default mongoose.model<IHackathonResource>(
  "HackathonResource",
  HackathonResourceSchema,
);
