import mongoose, { Schema, Document } from "mongoose";

export enum TeamInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
}

export interface ITeamInvitation extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: {
    type: mongoose.Types.ObjectId;
    ref: "Project";
  };
  invitedBy: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  email: string;
  role: string;
  status: TeamInvitationStatus;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  invitedUser?: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    invitedAt: Date;
  };
}

const teamInvitationSchema = new Schema<ITeamInvitation>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TeamInvitationStatus),
      default: TeamInvitationStatus.PENDING,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    acceptedAt: {
      type: Date,
    },
    declinedAt: {
      type: Date,
    },
    invitedUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      invitedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
teamInvitationSchema.index({ email: 1, projectId: 1 });
// Note: token index is automatically created by unique: true in field definition
teamInvitationSchema.index({ status: 1 });
teamInvitationSchema.index({ expiresAt: 1 });

// Virtual for checking if invitation is expired
teamInvitationSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// Method to check if invitation is valid
teamInvitationSchema.methods.isValid = function (): boolean {
  return this.status === TeamInvitationStatus.PENDING && !this.isExpired;
};

// Method to accept invitation
teamInvitationSchema.methods.accept = function (
  userId?: mongoose.Types.ObjectId,
) {
  this.status = TeamInvitationStatus.ACCEPTED;
  this.acceptedAt = new Date();
  if (userId) {
    this.invitedUser = userId;
  }
  return this.save();
};

// Method to decline invitation
teamInvitationSchema.methods.decline = function () {
  this.status = TeamInvitationStatus.DECLINED;
  this.declinedAt = new Date();
  return this.save();
};

// Static method to clean up expired invitations
teamInvitationSchema.statics.cleanupExpired = async function () {
  return this.updateMany(
    {
      status: TeamInvitationStatus.PENDING,
      expiresAt: { $lt: new Date() },
    },
    {
      status: TeamInvitationStatus.EXPIRED,
    },
  );
};

export default mongoose.model<ITeamInvitation>(
  "TeamInvitation",
  teamInvitationSchema,
);
