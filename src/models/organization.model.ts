import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  avatar: string;
  website?: string;
  location?: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
    discord?: string;
  };
  members: Array<{
    user: {
      type: mongoose.Types.ObjectId;
      ref: "User";
    };
    role: "ADMIN" | "MEMBER" | "MODERATOR";
    joinedAt: Date;
    status: "ACTIVE" | "INACTIVE" | "PENDING";
  }>;
  createdBy: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  isPublic: boolean;
  tags?: string[];
  stats: {
    totalMembers: number;
    totalProjects: number;
    totalFunding: number;
  };
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
    },
    website: {
      type: String,
    },
    location: {
      type: String,
    },
    socialLinks: {
      twitter: { type: String },
      linkedin: { type: String },
      github: { type: String },
      discord: { type: String },
    },
    members: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["ADMIN", "MEMBER", "MODERATOR"],
          default: "MEMBER",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["ACTIVE", "INACTIVE", "PENDING"],
          default: "ACTIVE",
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    tags: [{ type: String }],
    stats: {
      totalMembers: {
        type: Number,
        default: 0,
      },
      totalProjects: {
        type: Number,
        default: 0,
      },
      totalFunding: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true },
);

// Indexes for better query performance
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ "members.user": 1 });
OrganizationSchema.index({ createdBy: 1 });

export default mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);
