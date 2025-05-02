import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

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
  };
  status: UserStatus;
  badges: Array<{
    badge: {
      type: mongoose.Types.ObjectId;
      ref: "Badge";
    };
    earnedAt: Date;
    status: "ACTIVE" | "REVOKED";
    metadata: {
      [key: string]: any;
    };
  }>;
  roles: Array<{
    type: UserRole;
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
  }>;
  lastLogin: Date;
  comparePassword(enteredPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      username: { type: String, required: true, unique: true },
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
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    badges: [
      {
        badge: {
          type: { type: Schema.Types.ObjectId, ref: "Badge" },
        },
        earnedAt: { type: Date, required: true },
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
        type: {
          type: String,
          enum: Object.values(UserRole),
          required: true,
        },
        grantedAt: { type: Date, required: true },
        grantedBy: {
          type: { type: Schema.Types.ObjectId, ref: "User" },
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
          type: { type: Schema.Types.ObjectId, ref: "Project" },
        },
      },
    ],
    lastLogin: { type: Date },
  },

  { timestamps: true },
);

// Indexes for faster queries
userSchema.index({ "profile.username": 1 });
userSchema.index({ email: 1 });
userSchema.index({ "wallet.address": 1 });

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

const User = mongoose.model<IUser>("User", userSchema);
export default User;
