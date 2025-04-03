import mongoose, { Schema, Document } from "mongoose";

export interface ITeamMember extends Document {
  fullName: string;
  role: string;
  bio?: string;
  profileImage?: string;
  github?: string;
  twitter?: string;
  discord?: string;
  linkedin?: string;
  projectId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema: Schema = new Schema(
  {
    fullName: { type: String, required: true },
    role: { type: String, required: true },
    bio: { type: String },
    profileImage: { type: String },
    github: { type: String },
    twitter: { type: String },
    discord: { type: String },
    linkedin: { type: String },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

TeamMemberSchema.index({ projectId: 1 });
TeamMemberSchema.index({ userId: 1 });

export default mongoose.model<ITeamMember>("TeamMember", TeamMemberSchema);
