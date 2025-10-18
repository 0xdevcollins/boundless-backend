import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import Badge from "./badge.model";

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  BANNED = "BANNED",
}

export enum UserRole {
  CREATOR = "CREATOR",
  BACKER = "BACKER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export interface PrivacySettings {
  profileVisibility: "PUBLIC" | "PRIVATE" | "FRIENDS_ONLY";
  showWalletAddress: boolean;
  showContributions: boolean;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  isVerified: boolean;
  otp?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  invitationToken?: string;
  profile: {
    firstName: string;
    lastName: string;
    username: string;
    avatar: string;
    bio: string;
    location: string;
    website: string;
    socialLinks: {
      twitter?: string;
      linkedin?: string;
      github?: string;
      discord?: string;
    };
  };
  settings: {
    notifications: NotificationSettings;
    privacy: PrivacySettings;
    preferences: UserPreferences;
  };
  stats: {
    projectsCreated: number;
    projectsFunded: number;
    totalContributed: number;
    reputation: number;
    communityScore: number;
    commentsPosted: number;
  };
  status: UserStatus;
  badges: Array<{
    badge: mongoose.Types.ObjectId;
    earnedAt: Date;
    status: "ACTIVE" | "REVOKED";
    metadata: {
      [key: string]: any;
    };
  }>;
  roles: Array<{
    role: UserRole;
    grantedAt: Date;
    grantedBy: {
      type: mongoose.Types.ObjectId;
      ref: "User";
    };
    status: "ACTIVE" | "REVOKED";
  }>;
  contributedProjects: Array<{
    project: {
      type: mongoose.Types.ObjectId;
      ref: "Project";
    };
    amount: number;
    currency: string;
    contributedAt: Date;
  }>;
  lastLogin: Date;
  comparePassword(enteredPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    invitationToken: { type: String },
    profile: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      username: { type: String, required: true },
      avatar: { type: String },
      bio: { type: String },
      location: { type: String },
      website: { type: String },
      socialLinks: {
        twitter: { type: String },
        linkedin: { type: String },
        github: { type: String },
        discord: { type: String },
      },
    },
    settings: {
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      privacy: {
        profileVisibility: {
          type: String,
          enum: ["PUBLIC", "PRIVATE", "FRIENDS_ONLY"],
          default: "PUBLIC",
        },
        showWalletAddress: { type: Boolean, default: false },
        showContributions: { type: Boolean, default: true },
      },
      preferences: {
        language: { type: String, default: "en" },
        timezone: { type: String, default: "UTC" },
        theme: {
          type: String,
          enum: ["LIGHT", "DARK", "SYSTEM"],
          default: "SYSTEM",
        },
      },
    },
    stats: {
      projectsCreated: { type: Number, default: 0 },
      projectsFunded: { type: Number, default: 0 },
      totalContributed: { type: Number, default: 0 },
      reputation: { type: Number, default: 0 },
      communityScore: { type: Number, default: 0 },
      commentsPosted: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    badges: [
      {
        badge: { type: Schema.Types.ObjectId, ref: "Badge" },
        earnedAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["ACTIVE", "REVOKED"],
          default: "ACTIVE",
        },
        metadata: { type: Schema.Types.Mixed },
      },
    ],
    roles: [
      {
        role: {
          type: String,
          enum: Object.values(UserRole),
          required: true,
        },
        grantedAt: { type: Date, default: Date.now },
        grantedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["ACTIVE", "REVOKED"],
          default: "ACTIVE",
        },
      },
    ],
    contributedProjects: [
      {
        project: {
          type: Schema.Types.ObjectId,
          ref: "Project",
          required: true,
        },
        amount: { type: Number, required: true },
        currency: { type: String, required: true, default: "USD" },
        contributedAt: { type: Date, default: Date.now },
      },
    ],
    lastLogin: { type: Date },
  },
  { timestamps: true },
);

// Password comparison method
userSchema.methods.comparePassword = async function (
  enteredPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Add indexes explicitly
userSchema.index({ "profile.username": 1 }, { unique: true });

export default (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", userSchema);
