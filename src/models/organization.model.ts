import mongoose, { Schema, Document } from "mongoose";

// Type definitions for permissions
export type PermissionValue = boolean | { value: boolean; note?: string };

export interface RolePermissions {
  owner: boolean; // Owner always has full permissions
  admin: PermissionValue;
  member: PermissionValue;
}

export interface CustomPermissions {
  create_edit_profile: RolePermissions;
  manage_hackathons_grants: RolePermissions;
  publish_hackathons: RolePermissions;
  view_analytics: RolePermissions;
  invite_remove_members: RolePermissions;
  assign_roles: RolePermissions;
  post_announcements: RolePermissions;
  comment_discussions: RolePermissions;
  access_submissions: RolePermissions;
  delete_organization: RolePermissions;
  archive_organization: RolePermissions;
}

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  logo: string;
  tagline: string;
  about: string;
  links: {
    website: string;
    x: string;
    github: string;
    others: string;
  };
  members: string[];
  admins: string[];
  owner: string;
  hackathons: mongoose.Types.ObjectId[];
  grants: mongoose.Types.ObjectId[];
  isProfileComplete: boolean;
  pendingInvites: string[];
  customPermissions?: CustomPermissions;
  archived: boolean;
  archivedAt?: Date;
  archivedBy?: string;
  betterAuthOrgId?: string; // Link to Better Auth organization
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logo: {
      type: String,
      default: "",
    },
    tagline: {
      type: String,
      default: "",
    },
    about: {
      type: String,
      default: "",
    },
    links: {
      website: {
        type: String,
        default: "",
      },
      x: {
        type: String,
        default: "",
      },
      github: {
        type: String,
        default: "",
      },
      others: {
        type: String,
        default: "",
      },
    },
    members: [
      {
        type: String,
        validate: {
          validator: function (email: string) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          },
          message: "Invalid email format",
        },
      },
    ],
    admins: [
      {
        type: String,
        validate: {
          validator: function (email: string) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          },
          message: "Invalid email format",
        },
      },
    ],
    owner: {
      type: String,
      required: true,
      validate: {
        validator: function (email: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Invalid email format",
      },
    },
    hackathons: [
      {
        type: Schema.Types.ObjectId,
        ref: "Hackathon",
      },
    ],
    grants: [
      {
        type: Schema.Types.ObjectId,
        ref: "Grant",
      },
    ],
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    pendingInvites: [
      {
        type: String,
        validate: {
          validator: function (email: string) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          },
          message: "Invalid email format",
        },
      },
    ],
    customPermissions: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
    },
    archivedBy: {
      type: String,
      validate: {
        validator: function (email: string) {
          if (!email) return true; // Optional field
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Invalid email format",
      },
    },
    betterAuthOrgId: {
      type: String,
      index: true,
      sparse: true, // Allow null values but index non-null ones
    },
  },
  { timestamps: true },
);

// Indexes for better query performance
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ members: 1 });
OrganizationSchema.index({ owner: 1 });
OrganizationSchema.index({ admins: 1 });
OrganizationSchema.index({ archived: 1 });
OrganizationSchema.index({ betterAuthOrgId: 1 });

// Pre-save middleware to ensure admins are also in members array
OrganizationSchema.pre("save", function (next) {
  // Ensure owner is in members
  if (!this.members.includes(this.owner)) {
    this.members.push(this.owner);
  }

  // Ensure all admins are in members
  if (this.admins) {
    this.admins.forEach((admin) => {
      if (!this.members.includes(admin)) {
        this.members.push(admin);
      }
    });
  }

  next();
});

export default mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);
