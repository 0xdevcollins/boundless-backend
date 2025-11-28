import mongoose, { Schema, Document, Types } from "mongoose";
import { generateSlug } from "../utils/blog.utils.js";
import { ensureUniqueHackathonSlug } from "../utils/hackathon.utils.js";

export enum HackathonStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum HackathonCategory {
  DEFI = "DeFi",
  NFTS = "NFTs",
  DAOS = "DAOs",
  LAYER_2 = "Layer 2",
  CROSS_CHAIN = "Cross-chain",
  WEB3_GAMING = "Web3 Gaming",
  SOCIAL_TOKENS = "Social Tokens",
  INFRASTRUCTURE = "Infrastructure",
  PRIVACY = "Privacy",
  SUSTAINABILITY = "Sustainability",
  REAL_WORLD_ASSETS = "Real World Assets",
  OTHER = "Other",
}

export enum ParticipantType {
  INDIVIDUAL = "individual",
  TEAM = "team",
  TEAM_OR_INDIVIDUAL = "team_or_individual",
}

export enum VenueType {
  VIRTUAL = "virtual",
  PHYSICAL = "physical",
}

export enum RegistrationDeadlinePolicy {
  BEFORE_START = "before_start",
  BEFORE_SUBMISSION_DEADLINE = "before_submission_deadline",
  CUSTOM = "custom",
}

export interface IPhase {
  name: string;
  startDate: Date;
  endDate: Date;
  description?: string;
}

export interface IPrizeTier {
  position: string;
  amount: number;
  currency?: string;
  description?: string;
  passMark: number;
}

export interface IJudgingCriterion {
  title: string;
  weight: number;
  description?: string;
}

export interface ISponsorPartner {
  sponsorName?: string;
  sponsorLogo?: string;
  partnerLink?: string;
}

export interface IHackathon extends Document {
  organizationId: Types.ObjectId;
  status: HackathonStatus;
  publishedAt?: Date;
  slug?: string;
  featured?: boolean;

  // Information Tab
  title?: string;
  tagline?: string;
  banner?: string;
  description?: string;
  categories?: HackathonCategory[];
  venue?: {
    type: VenueType;
    country?: string;
    state?: string;
    city?: string;
    venueName?: string;
    venueAddress?: string;
  };

  // Timeline Tab
  startDate?: Date;
  submissionDeadline?: Date;
  judgingDate?: Date;
  winnerAnnouncementDate?: Date;
  timezone?: string;
  phases?: IPhase[];

  // Participation Tab
  participantType?: ParticipantType;
  teamMin?: number;
  teamMax?: number;
  registrationDeadlinePolicy?: RegistrationDeadlinePolicy;
  registrationDeadline?: Date;
  submissionRequirements?: {
    requireGithub?: boolean;
    requireDemoVideo?: boolean;
    requireOtherLinks?: boolean;
  };
  tabVisibility?: {
    detailsTab?: boolean;
    participantsTab?: boolean;
    resourcesTab?: boolean;
    submissionTab?: boolean;
    announcementsTab?: boolean;
    discussionTab?: boolean;
    winnersTab?: boolean;
    sponsorsTab?: boolean;
    joinATeamTab?: boolean;
    rulesTab?: boolean;
  };

  // Rewards Tab
  prizeTiers?: IPrizeTier[];

  // Judging Tab
  criteria?: IJudgingCriterion[];

  // Collaboration Tab
  contactEmail?: string;
  telegram?: string;
  discord?: string;
  socialLinks?: string[];
  sponsorsPartners?: ISponsorPartner[];
  contractId?: string;
  escrowAddress?: string;
  transactionHash?: string;
  escrowDetails?: object;
  winnersAnnounced?: boolean;
  winnersAnnouncedAt?: Date;
  winnersAnnouncement?: string;

  createdAt: Date;
  updatedAt: Date;
}

const PhaseSchema = new Schema<IPhase>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const PrizeTierSchema = new Schema<IPrizeTier>(
  {
    position: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount must be non-negative"],
    },
    currency: {
      type: String,
      default: "USDC",
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    passMark: {
      type: Number,
      required: true,
      min: [0, "Pass mark must be between 0 and 100"],
      max: [100, "Pass mark must be between 0 and 100"],
    },
  },
  { _id: false },
);

const JudgingCriterionSchema = new Schema<IJudgingCriterion>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    weight: {
      type: Number,
      required: true,
      min: [0, "Weight must be between 0 and 100"],
      max: [100, "Weight must be between 0 and 100"],
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const SponsorPartnerSchema = new Schema<ISponsorPartner>(
  {
    sponsorName: {
      type: String,
      trim: true,
    },
    sponsorLogo: {
      type: String,
      trim: true,
    },
    partnerLink: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const HackathonSchema = new Schema<IHackathon>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(HackathonStatus),
        message: `Status must be one of: ${Object.values(HackathonStatus).join(", ")}`,
      },
      default: HackathonStatus.DRAFT,
    },
    publishedAt: {
      type: Date,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    tagline: {
      // Add this field
      type: String,
      trim: true,
      minlength: [1, "Tagline is required"],
      maxlength: [200, "Tagline cannot exceed 200 characters"],
    },
    // Information Tab
    title: {
      type: String,
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    banner: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    categories: {
      type: [String],
      enum: {
        values: Object.values(HackathonCategory),
        message: `Category must be one of: ${Object.values(HackathonCategory).join(", ")}`,
      },
      default: [],
    },
    venue: {
      type: {
        type: String,
        enum: {
          values: Object.values(VenueType),
          message: `Venue type must be one of: ${Object.values(VenueType).join(", ")}`,
        },
      },
      country: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      venueName: {
        type: String,
        trim: true,
      },
      venueAddress: {
        type: String,
        trim: true,
      },
    },

    // Timeline Tab
    startDate: {
      type: Date,
    },
    submissionDeadline: {
      type: Date,
    },
    judgingDate: {
      type: Date,
    },
    winnerAnnouncementDate: {
      type: Date,
    },
    timezone: {
      type: String,
      trim: true,
    },
    phases: {
      type: [PhaseSchema],
      default: [],
    },

    // Participation Tab
    participantType: {
      type: String,
      enum: {
        values: Object.values(ParticipantType),
        message: `Participant type must be one of: ${Object.values(ParticipantType).join(", ")}`,
      },
      default: ParticipantType.INDIVIDUAL,
    },
    teamMin: {
      type: Number,
      min: [1, "Team min must be at least 1"],
      max: [20, "Team min cannot exceed 20"],
    },
    teamMax: {
      type: Number,
      min: [1, "Team max must be at least 1"],
      max: [20, "Team max cannot exceed 20"],
    },
    registrationDeadlinePolicy: {
      type: String,
      enum: {
        values: Object.values(RegistrationDeadlinePolicy),
        message: `Registration deadline policy must be one of: ${Object.values(RegistrationDeadlinePolicy).join(", ")}`,
      },
      default: RegistrationDeadlinePolicy.BEFORE_SUBMISSION_DEADLINE,
    },
    registrationDeadline: {
      type: Date,
    },
    submissionRequirements: {
      requireGithub: {
        type: Boolean,
        default: true,
      },
      requireDemoVideo: {
        type: Boolean,
        default: true,
      },
      requireOtherLinks: {
        type: Boolean,
        default: true,
      },
    },
    tabVisibility: {
      detailsTab: {
        type: Boolean,
        default: true,
      },
      participantsTab: {
        type: Boolean,
        default: true,
      },
      resourcesTab: {
        type: Boolean,
        default: true,
      },
      submissionTab: {
        type: Boolean,
        default: true,
      },
      announcementsTab: {
        type: Boolean,
        default: true,
      },
      discussionTab: {
        type: Boolean,
        default: true,
      },
      winnersTab: {
        type: Boolean,
        default: true,
      },
      sponsorsTab: {
        type: Boolean,
        default: true,
      },
      joinATeamTab: {
        type: Boolean,
        default: true,
      },
      rulesTab: {
        type: Boolean,
        default: true,
      },
    },

    // Rewards Tab
    prizeTiers: {
      type: [PrizeTierSchema],
      default: [],
    },

    // Judging Tab
    criteria: {
      type: [JudgingCriterionSchema],
      default: [],
    },

    // Collaboration Tab
    contactEmail: {
      type: String,
      trim: true,
    },
    telegram: {
      type: String,
      trim: true,
    },
    discord: {
      type: String,
      trim: true,
    },
    socialLinks: {
      type: [String],
      default: [],
    },
    sponsorsPartners: {
      type: [SponsorPartnerSchema],
      default: [],
    },
    contractId: {
      type: String,
      trim: true,
    },
    escrowAddress: {
      type: String,
      trim: true,
    },
    transactionHash: {
      type: String,
      trim: true,
    },
    escrowDetails: {
      type: Schema.Types.Mixed,
    },
    winnersAnnounced: {
      type: Boolean,
      default: false,
    },
    winnersAnnouncedAt: {
      type: Date,
    },
    winnersAnnouncement: {
      type: String,
      trim: true,
      maxlength: [5000, "Winner announcement cannot exceed 5000 characters"],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
HackathonSchema.index({ organizationId: 1, status: 1 });
HackathonSchema.index({ status: 1, createdAt: -1 });
HackathonSchema.index({ organizationId: 1, createdAt: -1 });
// Note: slug index is automatically created by unique: true in field definition

// Validation: Date sequence must be: start < submission < judging < announcement
HackathonSchema.pre("save", async function (next) {
  // Auto-generate slug from title if not provided and title exists
  if (this.isModified("title") && this.title && !this.slug) {
    try {
      this.slug = await ensureUniqueHackathonSlug(
        generateSlug(this.title),
        this._id?.toString(),
      );
    } catch (error) {
      return next(
        error instanceof Error ? error : new Error("Failed to generate slug"),
      );
    }
  }

  // Regenerate slug if title changed and slug should be updated
  if (this.isModified("title") && this.title && this.slug) {
    const newSlug = generateSlug(this.title);
    if (newSlug !== this.slug) {
      try {
        this.slug = await ensureUniqueHackathonSlug(
          newSlug,
          this._id?.toString(),
        );
      } catch (error) {
        return next(
          error instanceof Error
            ? error
            : new Error("Failed to regenerate slug"),
        );
      }
    }
  }

  if (this.status === HackathonStatus.PUBLISHED) {
    // Only validate date sequence for published hackathons
    if (
      this.startDate &&
      this.submissionDeadline &&
      this.judgingDate &&
      this.winnerAnnouncementDate
    ) {
      if (this.startDate >= this.submissionDeadline) {
        return next(new Error("Submission deadline must be after start date"));
      }
      if (this.submissionDeadline >= this.judgingDate) {
        return next(
          new Error("Judging date must be after submission deadline"),
        );
      }
      if (this.judgingDate >= this.winnerAnnouncementDate) {
        return next(
          new Error("Winner announcement date must be after judging date"),
        );
      }
    }
  }

  // Validate team min/max
  if (this.teamMin && this.teamMax && this.teamMin > this.teamMax) {
    return next(new Error("Team min must be less than or equal to team max"));
  }

  // Validate registration deadline policy
  if (this.registrationDeadlinePolicy === RegistrationDeadlinePolicy.CUSTOM) {
    if (!this.registrationDeadline) {
      return next(
        new Error(
          "Registration deadline is required when policy is set to 'custom'",
        ),
      );
    }
    // Ensure custom deadline is before submission deadline if submission deadline exists
    if (
      this.submissionDeadline &&
      this.registrationDeadline >= this.submissionDeadline
    ) {
      return next(
        new Error(
          "Custom registration deadline must be before submission deadline",
        ),
      );
    }
    // Ensure custom deadline is after current time when hackathon is published
    if (
      this.status === HackathonStatus.PUBLISHED &&
      this.registrationDeadline <= new Date()
    ) {
      return next(
        new Error(
          "Custom registration deadline must be in the future when hackathon is published",
        ),
      );
    }
  }

  // Validate judging criteria weights sum to 100
  if (
    this.criteria &&
    this.criteria.length > 0 &&
    this.status === HackathonStatus.PUBLISHED
  ) {
    const totalWeight = this.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    );
    if (Math.abs(totalWeight - 100) > 0.01) {
      return next(
        new Error(
          `Judging criteria weights must sum to 100% (current: ${totalWeight}%)`,
        ),
      );
    }
  }

  next();
});

export default mongoose.model<IHackathon>("Hackathon", HackathonSchema);
