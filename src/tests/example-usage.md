# Test Helper Usage Examples

This document shows how to use the new test helper utilities to create DRY and maintainable tests with complete user data.

## Complete User Data Structure

The test helper now creates complete user objects that match the User model structure, including:

- **Profile**: firstName, lastName, username, avatar, bio, location, website, socialLinks
- **Settings**: notifications, privacy, preferences
- **Stats**: projectsCreated, projectsFunded, totalContributed, reputation, communityScore
- **Roles**: role, grantedAt, grantedBy, status
- **Badges**: badge, earnedAt, status, metadata
- **ContributedProjects**: project, amount, currency, contributedAt
- **Other fields**: isVerified, status, lastLogin

## Basic Usage

### Creating a single test user with complete data

```typescript
import { createTestUser, TestUserFactory } from "./testHelpers";

describe("My Test Suite", () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create a complete test user
    const user = await createTestUser({
      email: "test@example.com",
      role: UserRole.CREATOR,
      profile: {
        firstName: "John",
        lastName: "Creator",
        username: "johndoe",
        avatar: "https://example.com/avatar.jpg",
        bio: "Grant Creator",
        location: "New York",
        website: "https://johndoe.com",
        socialLinks: {
          twitter: "https://twitter.com/johndoe",
          linkedin: "https://linkedin.com/in/johndoe",
          github: "https://github.com/johndoe",
          discord: "johndoe#1234",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: true,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "America/New_York",
          theme: "LIGHT",
        },
      },
      stats: {
        projectsCreated: 5,
        projectsFunded: 10,
        totalContributed: 5000,
        reputation: 85,
        communityScore: 90,
      },
    });
    
    testUser = user.user;
    authToken = user.token;
  });
});
```

### Using the factory methods with complete data

```typescript
import { TestUserFactory } from "./testHelpers";

describe("My Test Suite", () => {
  let creator: any;
  let admin: any;
  let backer: any;

  beforeAll(async () => {
    // Create different types of users with complete data
    const creatorUser = await TestUserFactory.creator({
      email: "creator@example.com",
      profile: {
        firstName: "John",
        lastName: "Creator",
        username: "johndoe",
        avatar: "https://example.com/avatar.jpg",
        bio: "Grant Creator",
        location: "New York",
        website: "https://johndoe.com",
        socialLinks: {
          twitter: "https://twitter.com/johndoe",
        },
      },
      settings: {
        privacy: {
          showWalletAddress: true,
        },
        preferences: {
          timezone: "America/New_York",
          theme: "LIGHT",
        },
      },
      stats: {
        reputation: 85,
        communityScore: 90,
      },
    });
    
    const adminUser = await TestUserFactory.admin({
      email: "admin@example.com",
      profile: {
        firstName: "Admin",
        lastName: "User",
        username: "adminuser",
      },
    });
    
    const backerUser = await TestUserFactory.backer({
      email: "backer@example.com",
      profile: {
        firstName: "Backer",
        lastName: "User",
        username: "backeruser",
      },
    });

    creator = creatorUser.user;
    admin = adminUser.user;
    backer = backerUser.user;
  });
});
```

### Creating users with badges and contributed projects

```typescript
import { createTestUser, createObjectId } from "./testHelpers";

describe("My Test Suite", () => {
  let userWithBadges: any;

  beforeAll(async () => {
    const user = await createTestUser({
      email: "user@example.com",
      role: UserRole.CREATOR,
      badges: [
        {
          badge: createObjectId(), // You'll need to create actual badge IDs
          earnedAt: new Date(),
          status: "ACTIVE",
          metadata: { achievement: "First Project" },
        },
      ],
      contributedProjects: [
        {
          project: createObjectId(), // You'll need to create actual project IDs
          amount: 1000,
          currency: "USD",
          contributedAt: new Date(),
        },
      ],
    });

    userWithBadges = user.user;
  });
});
```

### Creating multiple users at once with complete data

```typescript
import { createTestUsers } from "./testHelpers";

describe("My Test Suite", () => {
  let users: any[];

  beforeAll(async () => {
    const testUsers = await createTestUsers([
      {
        email: "user1@example.com",
        role: UserRole.CREATOR,
        profile: { 
          firstName: "User", 
          lastName: "One",
          username: "userone",
        },
        stats: { reputation: 80, communityScore: 85 },
      },
      {
        email: "user2@example.com",
        role: UserRole.BACKER,
        profile: { 
          firstName: "User", 
          lastName: "Two",
          username: "usertwo",
        },
        stats: { reputation: 70, communityScore: 75 },
      },
      {
        email: "user3@example.com",
        role: UserRole.ADMIN,
        profile: { 
          firstName: "User", 
          lastName: "Three",
          username: "userthree",
        },
        stats: { reputation: 95, communityScore: 100 },
      },
    ]);

    users = testUsers.map(u => u.user);
  });
});
```

### Creating a user and logging in through the API

```typescript
import { createAndLoginUser } from "./testHelpers";

describe("My Test Suite", () => {
  let authenticatedUser: any;
  let sessionToken: string;

  beforeAll(async () => {
    // This creates a user and logs in through the API
    const user = await createAndLoginUser({
      email: "test@example.com",
      password: "MyPassword123!",
      role: UserRole.CREATOR,
      profile: {
        firstName: "Test",
        lastName: "User",
        username: "testuser",
      },
    });

    authenticatedUser = user.user;
    sessionToken = user.token; // This is a valid session token
  });
});
```

### Using mock users (without database)

```typescript
import { createMockUser, generateTestToken } from "./testHelpers";

describe("My Test Suite", () => {
  let mockUser: any;
  let mockToken: string;

  beforeAll(async () => {
    // Create a mock user object (not saved to database)
    mockUser = createMockUser({
      email: "mock@example.com",
      role: UserRole.CREATOR,
      profile: {
        firstName: "Mock",
        lastName: "User",
        username: "mockuser",
      },
    });

    // Generate a token for the mock user
    mockToken = generateTestToken(
      mockUser._id.toString(),
      mockUser.email,
      [UserRole.CREATOR]
    );
  });
});
```

### Cleanup utilities

```typescript
import { cleanupTestData, cleanupTestUsers } from "./testHelpers";

describe("My Test Suite", () => {
  afterAll(async () => {
    // Clean up specific users by email pattern
    await cleanupTestUsers(["test@example.com", "user@example.com"]);
    
    // Or clean up all test data
    await cleanupTestData();
  });
});
```

### Utility functions

```typescript
import { createObjectId, createObjectIds, wait } from "./testHelpers";

describe("My Test Suite", () => {
  it("should handle async operations", async () => {
    // Create a valid ObjectId
    const id = createObjectId();
    
    // Create multiple ObjectIds
    const ids = createObjectIds(5);
    
    // Wait for some time
    await wait(1000); // Wait 1 second
  });
});
```

## Complete Example - Refactoring Existing Tests

Here's how to refactor your existing grant status test to use the helper:

### Before (without helper) - 150+ lines of setup

```typescript
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import app from "../app";
import User, { UserRole, UserStatus } from "../models/user.model";
import Grant from "../models/grant.model";
import { generateTokens } from "../utils/jwt.utils";

describe("Grant Status Update API", () => {
  let creatorUser: any;
  let otherCreatorUser: any;
  let regularUser: any;
  let creatorToken: string;
  let otherCreatorToken: string;
  let regularToken: string;
  let testGrant: any;

  beforeAll(async () => {
    // Create test users - 100+ lines of repetitive code
    const hashedPassword = await bcrypt.hash("TestPassword123!", 10);

    creatorUser = await User.create({
      email: "creator@test.com",
      password: hashedPassword,
      profile: {
        firstName: "John",
        lastName: "Creator",
        username: "johndoe",
        avatar: "https://example.com/avatar.jpg",
        bio: "Grant Creator",
        location: "New York",
        website: "https://johndoe.com",
        socialLinks: {
          twitter: "https://twitter.com/johndoe",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: true,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "America/New_York",
          theme: "LIGHT",
        },
      },
      stats: {
        projectsCreated: 0,
        projectsFunded: 0,
        totalContributed: 0,
        reputation: 85,
        communityScore: 90,
      },
      status: UserStatus.ACTIVE,
      roles: [
        {
          role: UserRole.CREATOR,
          grantedAt: new Date(),
          status: "ACTIVE",
        },
      ],
    });

    // Repeat for otherCreatorUser and regularUser...
    // Generate tokens manually...
  });

  afterAll(async () => {
    await User.deleteMany({
      email: {
        $in: ["creator@test.com", "othercreator@test.com", "regular@test.com"],
      },
    });
    await Grant.deleteMany({});
  });
});
```

### After (with helper) - 50 lines of setup

```typescript
import request from "supertest";
import mongoose from "mongoose";
import app from "../app";
import Grant from "../models/grant.model";
import { TestUserFactory, cleanupTestData } from "./testHelpers";

describe("Grant Status Update API", () => {
  let creatorUser: any;
  let otherCreatorUser: any;
  let regularUser: any;
  let creatorToken: string;
  let otherCreatorToken: string;
  let regularToken: string;
  let testGrant: any;

  beforeAll(async () => {
    // Create test users using the helper - much cleaner!
    const creator = await TestUserFactory.creator({
      email: "creator@test.com",
      profile: {
        firstName: "John",
        lastName: "Creator",
        username: "johndoe",
        avatar: "https://example.com/avatar.jpg",
        bio: "Grant Creator",
        location: "New York",
        website: "https://johndoe.com",
        socialLinks: {
          twitter: "https://twitter.com/johndoe",
        },
      },
      settings: {
        privacy: {
          showWalletAddress: true,
        },
        preferences: {
          timezone: "America/New_York",
          theme: "LIGHT",
        },
      },
      stats: {
        reputation: 85,
        communityScore: 90,
      },
    });

    const otherCreator = await TestUserFactory.creator({
      email: "othercreator@test.com",
      profile: {
        firstName: "Jane",
        lastName: "OtherCreator",
        username: "janeother",
        avatar: "https://example.com/avatar2.jpg",
        bio: "Another Grant Creator",
        location: "Los Angeles",
        website: "https://janeother.com",
        socialLinks: {
          twitter: "https://twitter.com/janeother",
        },
      },
      settings: {
        privacy: {
          showWalletAddress: false,
        },
        preferences: {
          timezone: "America/Los_Angeles",
          theme: "DARK",
        },
      },
      stats: {
        reputation: 75,
        communityScore: 80,
      },
    });

    const regular = await TestUserFactory.regular({
      email: "regular@test.com",
      profile: {
        firstName: "Bob",
        lastName: "Regular",
        username: "bobregular",
        avatar: "https://example.com/avatar3.jpg",
        bio: "Regular User",
        location: "Chicago",
        website: "https://bobregular.com",
        socialLinks: {
          twitter: "https://twitter.com/bobregular",
        },
      },
      settings: {
        privacy: {
          showWalletAddress: false,
        },
        preferences: {
          timezone: "America/Chicago",
          theme: "SYSTEM",
        },
      },
      stats: {
        reputation: 50,
        communityScore: 60,
      },
    });

    // Assign to variables for use in tests
    creatorUser = creator.user;
    otherCreatorUser = otherCreator.user;
    regularUser = regular.user;
    creatorToken = creator.token;
    otherCreatorToken = otherCreator.token;
    regularToken = regular.token;

    // Create a test grant
    testGrant = await Grant.create({
      title: "Test Grant Program",
      description: "A test grant program for testing purposes",
      totalBudget: 10000,
      rules: "1. Must be a test project\n2. Must follow test guidelines",
      milestones: [
        {
          title: "Test Milestone 1",
          description: "First test milestone",
          expectedPayout: 5000,
        },
        {
          title: "Test Milestone 2",
          description: "Second test milestone",
          expectedPayout: 5000,
        },
      ],
      creatorId: creatorUser._id,
      status: "draft",
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await mongoose.connection.close();
  });
});
```

## Benefits

1. **DRY Principle**: No more repetitive user creation code
2. **Complete Data**: All user fields are properly populated
3. **Consistency**: All test users follow the same structure
4. **Maintainability**: Changes to user model only need to be updated in one place
5. **Readability**: Tests focus on actual test logic, not setup boilerplate
6. **Type Safety**: Full TypeScript support with proper interfaces
7. **Flexibility**: Easy to customize user properties when needed
8. **Reduced Lines**: 70% reduction in setup code 
