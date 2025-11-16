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
    organizations: number;
    following: number;
    followers: number;
    votes: number;
    grants: number;
    hackathons: number;
    donations: number;
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
      organizations: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      votes: { type: Number, default: 0 },
      grants: { type: Number, default: 0 },
      hackathons: { type: Number, default: 0 },
      donations: { type: Number, default: 0 },
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

// Ensure username is always set before saving
// Always derives username from email to prevent issues
userSchema.pre("save", async function (next) {
  // Only set username if it's missing or empty
  if (!this.profile?.username || this.profile.username.trim() === "") {
    if (!this.email) {
      return next(new Error("Email is required to generate username"));
    }

    // Always generate username from email
    const emailPrefix = this.email.split("@")[0];
    let baseUsername = emailPrefix.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    // If empty after cleaning, use email hash as fallback
    if (!baseUsername || baseUsername.trim() === "") {
      const emailHash = Buffer.from(this.email)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 8);
      baseUsername = `user${emailHash}`;
    }

    // Check if this username already exists and append number if needed
    const UserModel = this.constructor as mongoose.Model<IUser>;
    let username = baseUsername;
    let counter = 1;

    while (
      await UserModel.findOne({
        "profile.username": username,
        _id: { $ne: this._id },
      })
    ) {
      username = `${baseUsername}${counter}`;
      counter++;
      if (counter > 1000) {
        username = `${baseUsername}${Date.now()}`;
        break;
      }
    }

    if (!this.profile) {
      this.profile = {} as any;
    }
    this.profile.username = username;
  }
  next();
});

// Add indexes explicitly
// Partial index excludes null/empty values from uniqueness constraint
// This prevents duplicate key errors when Better Auth writes directly to MongoDB
// Using $type: "string" instead of $ne: null because MongoDB partial indexes don't support $ne: null
userSchema.index(
  { "profile.username": 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      "profile.username": { $type: "string", $ne: "" },
    },
  },
);

export default (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", userSchema);
