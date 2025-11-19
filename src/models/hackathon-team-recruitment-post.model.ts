import mongoose, { Schema, Document, Types } from "mongoose";

export enum TeamRecruitmentPostStatus {
  ACTIVE = "active",
  FILLED = "filled",
  CLOSED = "closed",
}

export enum ContactMethod {
  EMAIL = "email",
  TELEGRAM = "telegram",
  DISCORD = "discord",
  GITHUB = "github",
  OTHER = "other",
}

export interface IRoleLookingFor {
  role: string;
  skills?: string[];
}

export interface IHackathonTeamRecruitmentPost extends Document {
  hackathonId: Types.ObjectId;
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  projectName: string;
  projectDescription: string;
  lookingFor: IRoleLookingFor[];
  currentTeamSize: number;
  maxTeamSize: number;
  contactMethod: ContactMethod;
  contactInfo: string;
  status: TeamRecruitmentPostStatus;
  views: number;
  contactCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const RoleLookingForSchema = new Schema<IRoleLookingFor>(
  {
    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Role name cannot exceed 100 characters"],
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: function (skills: string[]) {
          return skills.length <= 20; // Max 20 skills per role
        },
        message: "Each role cannot have more than 20 skills",
      },
    },
  },
  { _id: false },
);

const HackathonTeamRecruitmentPostSchema =
  new Schema<IHackathonTeamRecruitmentPost>(
    {
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
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      projectName: {
        type: String,
        required: true,
        trim: true,
        minlength: [3, "Project name must be at least 3 characters"],
        maxlength: [200, "Project name cannot exceed 200 characters"],
      },
      projectDescription: {
        type: String,
        required: true,
        trim: true,
        minlength: [50, "Project description must be at least 50 characters"],
        maxlength: [5000, "Project description cannot exceed 5000 characters"],
      },
      lookingFor: {
        type: [RoleLookingForSchema],
        required: true,
        validate: {
          validator: function (roles: IRoleLookingFor[]) {
            return roles.length >= 1 && roles.length <= 10;
          },
          message: "Must have between 1 and 10 roles",
        },
      },
      currentTeamSize: {
        type: Number,
        required: true,
        min: [1, "Current team size must be at least 1"],
        max: [50, "Current team size cannot exceed 50"],
      },
      maxTeamSize: {
        type: Number,
        required: true,
        min: [2, "Max team size must be at least 2"],
        max: [50, "Max team size cannot exceed 50"],
      },
      contactMethod: {
        type: String,
        enum: {
          values: Object.values(ContactMethod),
          message: `Contact method must be one of: ${Object.values(ContactMethod).join(", ")}`,
        },
        required: true,
      },
      contactInfo: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, "Contact info cannot exceed 500 characters"],
      },
      status: {
        type: String,
        enum: {
          values: Object.values(TeamRecruitmentPostStatus),
          message: `Status must be one of: ${Object.values(TeamRecruitmentPostStatus).join(", ")}`,
        },
        default: TeamRecruitmentPostStatus.ACTIVE,
        index: true,
      },
      views: {
        type: Number,
        default: 0,
        min: 0,
      },
      contactCount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      timestamps: true,
    },
  );

// Indexes for better query performance
HackathonTeamRecruitmentPostSchema.index({ hackathonId: 1, createdAt: -1 });
HackathonTeamRecruitmentPostSchema.index({ hackathonId: 1, status: 1 });
HackathonTeamRecruitmentPostSchema.index({ createdBy: 1 });
HackathonTeamRecruitmentPostSchema.index({ status: 1 });

// Text index for search
HackathonTeamRecruitmentPostSchema.index({
  projectName: "text",
  projectDescription: "text",
  "lookingFor.role": "text",
});

export default mongoose.model<IHackathonTeamRecruitmentPost>(
  "HackathonTeamRecruitmentPost",
  HackathonTeamRecruitmentPostSchema,
);
