import mongoose, { Document, Schema } from "mongoose";

export enum AdminStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING = "PENDING",
}

export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
}

export interface IAdmin extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
  role: AdminRole;
  status: AdminStatus;
  permissions: string[];
  needsInitialSetup: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: Object.values(AdminRole),
      default: AdminRole.ADMIN,
    },
    status: {
      type: String,
      enum: Object.values(AdminStatus),
      default: AdminStatus.PENDING,
    },
    permissions: [
      {
        type: String,
      },
    ],
    needsInitialSetup: {
      type: Boolean,
      default: true, // New admins need initial setup
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
adminSchema.index({ email: 1 }, { unique: true });
adminSchema.index({ status: 1 });
adminSchema.index({ role: 1 });

export default (mongoose.models.Admin as mongoose.Model<IAdmin>) ||
  mongoose.model<IAdmin>("Admin", adminSchema);
