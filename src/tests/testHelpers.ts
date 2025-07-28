import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import app from "../app";
import User, { UserRole, UserStatus } from "../models/user.model";
import { generateTokens } from "../utils/jwt.utils";

export interface TestUser {
  user: any;
  token: string;
  userId: string;
}

export interface CreateUserOptions {
  email?: string;
  password?: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  username?: string;
  isVerified?: boolean;
  status?: UserStatus;
  profile?: {
    firstName?: string;
    lastName?: string;
    username?: string;
    avatar?: string;
    bio?: string;
    location?: string;
    website?: string;
    socialLinks?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
      discord?: string;
    };
  };
  settings?: {
    notifications?: { email: boolean; push: boolean; inApp: boolean };
    privacy?: {
      profileVisibility?: "PUBLIC" | "PRIVATE" | "FRIENDS_ONLY";
      showWalletAddress?: boolean;
      showContributions?: boolean;
    };
    preferences?: {
      language?: string;
      timezone?: string;
      theme?: "LIGHT" | "DARK" | "SYSTEM";
    };
  };
  stats?: {
    projectsCreated?: number;
    projectsFunded?: number;
    totalContributed?: number;
    reputation?: number;
    communityScore?: number;
  };
  badges?: Array<{
    badge: mongoose.Types.ObjectId;
    earnedAt?: Date;
    status?: "ACTIVE" | "REVOKED";
    metadata?: Record<string, any>;
  }>;
  contributedProjects?: Array<{
    project: mongoose.Types.ObjectId;
    amount: number;
    currency?: string;
    contributedAt?: Date;
  }>;
  lastLogin?: Date;
}

/**
 * Creates a test user with the specified options and returns the user object and JWT token
 */
export async function createTestUser(
  options: CreateUserOptions = {},
): Promise<TestUser> {
  const {
    email = `test-${Date.now()}@example.com`,
    password = "TestPassword123!",
    role = UserRole.BACKER,
    firstName = "Test",
    lastName = "User",
    username = email.split("@")[0],
    isVerified = true,
    status = UserStatus.ACTIVE,
    profile = {},
    settings = {},
    stats = {},
    badges = [],
    contributedProjects = [],
    lastLogin = new Date(),
  } = options;

  const user = await User.create({
    email,
    password,
    isVerified,
    profile: {
      firstName: profile.firstName || firstName,
      lastName: profile.lastName || lastName,
      username: profile.username || username,
      avatar: profile.avatar || "",
      bio: profile.bio || "",
      location: profile.location || "",
      website: profile.website || "",
      socialLinks: {
        twitter: profile.socialLinks?.twitter || "",
        linkedin: profile.socialLinks?.linkedin || "",
        github: profile.socialLinks?.github || "",
        discord: profile.socialLinks?.discord || "",
      },
    },
    settings: {
      notifications: settings.notifications || {
        email: true,
        push: true,
        inApp: true,
      },
      privacy: {
        profileVisibility: settings.privacy?.profileVisibility || "PUBLIC",
        showWalletAddress: settings.privacy?.showWalletAddress ?? false,
        showContributions: settings.privacy?.showContributions ?? true,
      },
      preferences: {
        language: settings.preferences?.language || "en",
        timezone: settings.preferences?.timezone || "UTC",
        theme: settings.preferences?.theme || "SYSTEM",
      },
    },
    stats: {
      projectsCreated: stats.projectsCreated || 0,
      projectsFunded: stats.projectsFunded || 0,
      totalContributed: stats.totalContributed || 0,
      reputation: stats.reputation || 50,
      communityScore: stats.communityScore || 60,
    },
    status,
    badges: badges.map((badge) => ({
      badge: badge.badge,
      earnedAt: badge.earnedAt || new Date(),
      status: badge.status || "ACTIVE",
      metadata: badge.metadata || {},
    })),
    roles: [
      {
        role,
        grantedAt: new Date(),
        grantedBy: null, // Self-granted for test users
        status: "ACTIVE",
      },
    ],
    contributedProjects: contributedProjects.map((project) => ({
      project: project.project,
      amount: project.amount,
      currency: project.currency || "USD",
      contributedAt: project.contributedAt || new Date(),
    })),
    lastLogin,
  });

  // Generate token with proper payload structure
  const tokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    roles: user.roles.map((r: any) => r.role),
  };

  const token = generateTokens(tokenPayload).accessToken;

  return {
    user,
    token,
    userId: user._id.toString(),
  };
}

/**
 * Creates multiple test users with different roles
 */
export async function createTestUsers(
  users: CreateUserOptions[],
): Promise<TestUser[]> {
  const testUsers: TestUser[] = [];

  for (const userOptions of users) {
    const testUser = await createTestUser(userOptions);
    testUsers.push(testUser);
  }

  return testUsers;
}

/**
 * Creates a test user and logs in through the API to get a valid session token
 */
export async function createAndLoginUser(
  options: CreateUserOptions = {},
): Promise<TestUser> {
  const {
    email = `test-${Date.now()}@example.com`,
    password = "TestPassword123!",
    role = UserRole.BACKER,
    ...otherOptions
  } = options;

  // Create user with plain password for login
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hashedPassword,
    isVerified: true,
    profile: {
      firstName: otherOptions.firstName || "Test",
      lastName: otherOptions.lastName || "User",
      username: otherOptions.username || email.split("@")[0],
      avatar: "",
      bio: "",
      location: "",
      website: "",
      socialLinks: {
        twitter: "",
        linkedin: "",
        github: "",
        discord: "",
      },
    },
    settings: {
      notifications: { email: true, push: true, inApp: true },
      privacy: {
        profileVisibility: "PUBLIC",
        showWalletAddress: false,
        showContributions: true,
      },
      preferences: { language: "en", timezone: "UTC", theme: "SYSTEM" },
    },
    stats: {
      projectsCreated: 0,
      projectsFunded: 0,
      totalContributed: 0,
      reputation: 50,
      communityScore: 60,
    },
    status: UserStatus.ACTIVE,
    badges: [],
    roles: [
      {
        role,
        grantedAt: new Date(),
        grantedBy: null,
        status: "ACTIVE",
      },
    ],
    contributedProjects: [],
    lastLogin: new Date(),
  });

  // Login to get JWT
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  if (!res.body.data?.accessToken && !res.body.accessToken) {
    console.error("Login response:", res.body);
    throw new Error("Failed to get access token from login");
  }

  return {
    user,
    token: res.body.data?.accessToken || res.body.accessToken,
    userId: user._id.toString(),
  };
}

/**
 * Creates common test user types for different scenarios
 */
export const TestUserFactory = {
  /**
   * Creates a creator user
   */
  async creator(options: Partial<CreateUserOptions> = {}): Promise<TestUser> {
    return createTestUser({
      email: `creator-${Date.now()}@example.com`,
      role: UserRole.CREATOR,
      firstName: "Creator",
      lastName: "User",
      ...options,
    });
  },

  /**
   * Creates an admin user
   */
  async admin(options: Partial<CreateUserOptions> = {}): Promise<TestUser> {
    return createTestUser({
      email: `admin-${Date.now()}@example.com`,
      role: UserRole.ADMIN,
      firstName: "Admin",
      lastName: "User",
      ...options,
    });
  },

  /**
   * Creates a backer user
   */
  async backer(options: Partial<CreateUserOptions> = {}): Promise<TestUser> {
    return createTestUser({
      email: `backer-${Date.now()}@example.com`,
      role: UserRole.BACKER,
      firstName: "Backer",
      lastName: "User",
      ...options,
    });
  },

  /**
   * Creates a regular user (no special roles)
   */
  async regular(options: Partial<CreateUserOptions> = {}): Promise<TestUser> {
    return createTestUser({
      email: `user-${Date.now()}@example.com`,
      role: UserRole.BACKER,
      firstName: "Regular",
      lastName: "User",
      ...options,
    });
  },
};

/**
 * Generates a JWT token for a user without creating the user in the database
 */
export function generateTestToken(
  userId: string,
  email: string,
  roles: UserRole[] = [],
): string {
  return generateTokens({
    userId,
    email,
    roles,
  }).accessToken;
}

/**
 * Creates a mock user object for testing (without saving to database)
 */
export function createMockUser(options: Partial<CreateUserOptions> = {}): any {
  const {
    email = `mock-${Date.now()}@example.com`,
    role = UserRole.BACKER,
    firstName = "Mock",
    lastName = "User",
    username = email.split("@")[0],
  } = options;

  return {
    _id: new mongoose.Types.ObjectId(),
    email,
    profile: {
      firstName,
      lastName,
      username,
      avatar: "",
      bio: "",
      location: "",
      website: "",
      socialLinks: {
        twitter: "",
        linkedin: "",
        github: "",
        discord: "",
      },
    },
    roles: [
      {
        role,
        grantedAt: new Date(),
        grantedBy: null,
        status: "ACTIVE",
      },
    ],
    status: UserStatus.ACTIVE,
    badges: [],
    contributedProjects: [],
    lastLogin: new Date(),
  };
}

/**
 * Cleans up test users by email pattern
 */
export async function cleanupTestUsers(emailPatterns: string[]): Promise<void> {
  await User.deleteMany({
    email: {
      $in: emailPatterns.map((pattern) => new RegExp(pattern)),
    },
  });
}

/**
 * Cleans up all test data
 */
export async function cleanupTestData(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Waits for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a valid ObjectId string
 */
export function createObjectId(): string {
  return new mongoose.Types.ObjectId().toString();
}

/**
 * Creates multiple ObjectId strings
 */
export function createObjectIds(count: number): string[] {
  return Array.from({ length: count }, () => createObjectId());
}
