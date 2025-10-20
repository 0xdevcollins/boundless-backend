import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string; // Editable
  logo: string; // URL or file path
  tagline: string;
  about: string;
  links: {
    website: string;
    x: string; // Twitter/X handle
    github: string;
    others: string;
  };
  members: string[]; // Array of user emails
  owner: string; // Owner email or userId
  hackathons: mongoose.Types.ObjectId[]; // references Hackathon collection
  grants: mongoose.Types.ObjectId[]; // references Grant collection
  isProfileComplete: boolean; // true when all required profile fields are filled
  pendingInvites: string[]; // array of emails invited but not yet accepted
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
  },
  { timestamps: true },
);

// Indexes for better query performance
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ members: 1 });
OrganizationSchema.index({ owner: 1 });

export default mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);
