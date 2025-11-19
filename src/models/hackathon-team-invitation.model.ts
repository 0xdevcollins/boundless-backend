import mongoose, { Schema, Document, Types } from "mongoose";

export enum HackathonTeamInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
}

export interface IHackathonTeamInvitation extends Document {
  hackathonId: Types.ObjectId;
  teamId: string;
  invitedBy: Types.ObjectId;
  email: string;
  role: string;
  status: HackathonTeamInvitationStatus;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  invitedUser?: Types.ObjectId;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    invitedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const HackathonTeamInvitationSchema = new Schema<IHackathonTeamInvitation>(
  {
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: true,
      index: true,
    },
    teamId: {
      type: String,
      required: true,
      index: true,
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
      trim: true,
    },
    role: {
      type: String,
      required: true,
      default: "member",
    },
    status: {
      type: String,
      enum: Object.values(HackathonTeamInvitationStatus),
      default: HackathonTeamInvitationStatus.PENDING,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
HackathonTeamInvitationSchema.index({ email: 1, hackathonId: 1, teamId: 1 });
HackathonTeamInvitationSchema.index({ teamId: 1, status: 1 });

// Virtual for checking if invitation is expired
HackathonTeamInvitationSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// Method to check if invitation is valid
HackathonTeamInvitationSchema.methods.isValid = function (): boolean {
  return (
    this.status === HackathonTeamInvitationStatus.PENDING && !this.isExpired
  );
};

// Method to accept invitation
HackathonTeamInvitationSchema.methods.accept = function (
  userId?: Types.ObjectId,
) {
  this.status = HackathonTeamInvitationStatus.ACCEPTED;
  this.acceptedAt = new Date();
  if (userId) {
    this.invitedUser = userId;
  }
  return this.save();
};

// Method to decline invitation
HackathonTeamInvitationSchema.methods.decline = function () {
  this.status = HackathonTeamInvitationStatus.DECLINED;
  this.declinedAt = new Date();
  return this.save();
};

export default mongoose.model<IHackathonTeamInvitation>(
  "HackathonTeamInvitation",
  HackathonTeamInvitationSchema,
);
