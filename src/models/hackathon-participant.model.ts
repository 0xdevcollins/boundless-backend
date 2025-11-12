import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITeamMember {
  userId: Types.ObjectId;
  name: string;
  username: string;
  role: string;
  avatar?: string;
}

export interface ISubmissionLink {
  type: string;
  url: string;
}

export interface IParticipantSubmission {
  projectName: string;
  category: string;
  description: string;
  logo?: string;
  videoUrl?: string;
  introduction?: string;
  links?: ISubmissionLink[];
  votes: number;
  comments: number;
  submissionDate: Date;
  status: "submitted" | "shortlisted" | "disqualified";
  disqualificationReason?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
}

export interface IParticipantSocialLinks {
  github?: string;
  telegram?: string;
  twitter?: string;
  email?: string;
}

export interface IHackathonParticipant extends Document {
  userId: Types.ObjectId;
  hackathonId: Types.ObjectId;
  organizationId: Types.ObjectId;
  participationType: "individual" | "team";
  teamId?: string;
  teamName?: string;
  teamMembers?: ITeamMember[];
  socialLinks?: IParticipantSocialLinks;
  submission?: IParticipantSubmission;
  registeredAt: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const SubmissionLinkSchema = new Schema<ISubmissionLink>(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const ParticipantSubmissionSchema = new Schema<IParticipantSubmission>(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    logo: {
      type: String,
      trim: true,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    introduction: {
      type: String,
      trim: true,
    },
    links: {
      type: [SubmissionLinkSchema],
      default: [],
    },
    votes: {
      type: Number,
      default: 0,
      min: 0,
    },
    comments: {
      type: Number,
      default: 0,
      min: 0,
    },
    submissionDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["submitted", "shortlisted", "disqualified"],
      default: "submitted",
    },
    disqualificationReason: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  { _id: false },
);

const ParticipantSocialLinksSchema = new Schema<IParticipantSocialLinks>(
  {
    github: {
      type: String,
      trim: true,
    },
    telegram: {
      type: String,
      trim: true,
    },
    twitter: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const HackathonParticipantSchema = new Schema<IHackathonParticipant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    participationType: {
      type: String,
      enum: ["individual", "team"],
      required: true,
      default: "individual",
    },
    teamId: {
      type: String,
      trim: true,
      index: true,
    },
    teamName: {
      type: String,
      trim: true,
    },
    teamMembers: {
      type: [TeamMemberSchema],
      default: [],
    },
    socialLinks: {
      type: ParticipantSocialLinksSchema,
    },
    submission: {
      type: ParticipantSubmissionSchema,
    },
    registeredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
HackathonParticipantSchema.index(
  { hackathonId: 1, userId: 1 },
  { unique: true },
);
HackathonParticipantSchema.index({ hackathonId: 1, organizationId: 1 });
HackathonParticipantSchema.index({ hackathonId: 1, participationType: 1 });
HackathonParticipantSchema.index({ hackathonId: 1, teamId: 1 });
HackathonParticipantSchema.index({ "submission.status": 1 });

export default mongoose.model<IHackathonParticipant>(
  "HackathonParticipant",
  HackathonParticipantSchema,
);
