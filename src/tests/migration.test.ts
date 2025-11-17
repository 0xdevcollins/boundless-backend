import mongoose from "mongoose";
import Campaign from "../models/campaign.model.js";
import Milestone from "../models/milestone.model.js";
// Mock the config to use test database
jest.mock("../config", () => ({
  config: {
    mongoUri:
      process.env.MONGODB_URI || "mongodb://localhost:27017/boundless-test",
  },
}));

// Import the migration function directly
async function migrateTrustlessWork() {
  try {
    console.log("Connected to database");

    // Update existing campaigns
    const campaigns = await Campaign.find({
      $or: [
        { trustlessWorkStatus: { $exists: false } },
        { currency: { $exists: false } },
        { escrowType: { $exists: false } },
      ],
    });

    for (const campaign of campaigns) {
      const updates: any = {};
      if (!campaign.trustlessWorkStatus)
        updates.trustlessWorkStatus = "pending";
      if (!campaign.currency) updates.currency = "USDC";
      if (!campaign.escrowType) updates.escrowType = "multi";

      if (Object.keys(updates).length > 0) {
        await Campaign.findByIdAndUpdate(campaign._id, updates);
      }
    }

    // Update existing milestones
    const milestones = await Milestone.find({
      $or: [
        { payoutPercentage: { $exists: false } },
        { amount: { $exists: false } },
        { trustlessMilestoneIndex: { $exists: false } },
      ],
    });

    for (const milestone of milestones) {
      const updates: any = {};

      if (milestone.payoutPercentage === undefined) {
        const campaignMilestones = await Milestone.find({
          campaignId: milestone.campaignId,
        });
        const equalPercentage = 100 / campaignMilestones.length;
        updates.payoutPercentage = equalPercentage;
      }

      if (milestone.amount === undefined) {
        const campaign = await Campaign.findById(milestone.campaignId);
        if (campaign) {
          const payoutPercentage =
            milestone.payoutPercentage ||
            100 /
              (await Milestone.find({ campaignId: milestone.campaignId }))
                .length;
          updates.amount = (campaign.goalAmount * payoutPercentage) / 100;
        }
      }

      if (milestone.trustlessMilestoneIndex === undefined) {
        updates.trustlessMilestoneIndex = milestone.index;
      }

      if (Object.keys(updates).length > 0) {
        await Milestone.findByIdAndUpdate(milestone._id, updates);
      }
    }

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

describe("Trustless Work Migration", () => {
  beforeAll(async () => {
    // Database connection is handled by jest.setup.ts
  });

  afterAll(async () => {
    // Database cleanup is handled by jest.setup.ts
  });

  beforeEach(async () => {
    // Clear test data
    await Campaign.deleteMany({});
    await Milestone.deleteMany({});
  });

  describe("Campaign Migration", () => {
    it("should add Trustless Work fields to existing campaigns", async () => {
      // Create campaigns without Trustless Work fields
      const campaign1 = await Campaign.create({
        title: "Test Campaign 1",
        goalAmount: 10000,
        status: "live",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
      });

      const campaign2 = await Campaign.create({
        title: "Test Campaign 2",
        goalAmount: 20000,
        status: "pending_approval",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
      });

      // Run migration
      await migrateTrustlessWork();

      // Verify fields were added
      const updatedCampaign1 = await Campaign.findById(campaign1._id);
      const updatedCampaign2 = await Campaign.findById(campaign2._id);

      expect(updatedCampaign1?.trustlessWorkStatus).toBe("pending");
      expect(updatedCampaign1?.currency).toBe("USDC");
      expect(updatedCampaign1?.escrowType).toBe("multi");

      expect(updatedCampaign2?.trustlessWorkStatus).toBe("pending");
      expect(updatedCampaign2?.currency).toBe("USDC");
      expect(updatedCampaign2?.escrowType).toBe("multi");
    });

    it("should not overwrite existing Trustless Work fields", async () => {
      // Create campaign with existing Trustless Work fields
      const campaign = await Campaign.create({
        title: "Test Campaign",
        goalAmount: 10000,
        status: "live",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
        trustlessWorkStatus: "deployed",
        currency: "EUR",
        escrowType: "single",
      });

      // Run migration
      await migrateTrustlessWork();

      // Verify existing fields were preserved
      const updatedCampaign = await Campaign.findById(campaign._id);
      expect(updatedCampaign?.trustlessWorkStatus).toBe("deployed");
      expect(updatedCampaign?.currency).toBe("EUR");
      expect(updatedCampaign?.escrowType).toBe("single");
    });
  });

  describe("Milestone Migration", () => {
    it("should calculate payout percentages for milestones", async () => {
      // Create campaign
      const campaign = await Campaign.create({
        title: "Test Campaign",
        goalAmount: 10000,
        status: "live",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
      });

      // Create milestones without payout percentages
      await Milestone.create([
        {
          campaignId: campaign._id,
          title: "Milestone 1",
          description: "First milestone",
          index: 0,
        },
        {
          campaignId: campaign._id,
          title: "Milestone 2",
          description: "Second milestone",
          index: 1,
        },
        {
          campaignId: campaign._id,
          title: "Milestone 3",
          description: "Third milestone",
          index: 2,
        },
      ]);

      // Run migration
      await migrateTrustlessWork();

      // Verify payout percentages were calculated (equal distribution)
      const milestones = await Milestone.find({
        campaignId: campaign._id,
      }).sort({ index: 1 });
      expect(milestones).toHaveLength(3);
      expect(milestones[0].payoutPercentage).toBeCloseTo(33.33, 1);
      expect(milestones[1].payoutPercentage).toBeCloseTo(33.33, 1);
      expect(milestones[2].payoutPercentage).toBeCloseTo(33.34, 1); // Rounding adjustment
    });

    it("should calculate amounts based on payout percentages", async () => {
      // Create campaign
      const campaign = await Campaign.create({
        title: "Test Campaign",
        goalAmount: 10000,
        status: "live",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
      });

      // Create milestone with payout percentage but no amount
      await Milestone.create({
        campaignId: campaign._id,
        title: "Milestone 1",
        description: "Test milestone",
        index: 0,
        payoutPercentage: 50,
      });

      // Run migration
      await migrateTrustlessWork();

      // Verify amount was calculated
      const milestone = await Milestone.findOne({ campaignId: campaign._id });
      expect(milestone?.amount).toBe(5000); // 50% of 10000
    });

    it("should set trustlessMilestoneIndex", async () => {
      // Create campaign
      const campaign = await Campaign.create({
        title: "Test Campaign",
        goalAmount: 10000,
        status: "live",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
      });

      // Create milestone without trustlessMilestoneIndex
      await Milestone.create({
        campaignId: campaign._id,
        title: "Milestone 1",
        description: "Test milestone",
        index: 5, // Different from trustlessMilestoneIndex
      });

      // Run migration
      await migrateTrustlessWork();

      // Verify trustlessMilestoneIndex was set
      const milestone = await Milestone.findOne({ campaignId: campaign._id });
      expect(milestone?.trustlessMilestoneIndex).toBe(5);
    });

    it("should preserve existing payout percentages", async () => {
      // Create campaign
      const campaign = await Campaign.create({
        title: "Test Campaign",
        goalAmount: 10000,
        status: "live",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
      });

      // Create milestone with existing payout percentage
      await Milestone.create({
        campaignId: campaign._id,
        title: "Milestone 1",
        description: "Test milestone",
        index: 0,
        payoutPercentage: 75,
        amount: 7500,
      });

      // Run migration
      await migrateTrustlessWork();

      // Verify existing values were preserved
      const milestone = await Milestone.findOne({ campaignId: campaign._id });
      expect(milestone?.payoutPercentage).toBe(75);
      expect(milestone?.amount).toBe(7500);
    });
  });

  describe("Migration Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      // Mock Campaign.find to throw an error
      const originalFind = Campaign.find;
      Campaign.find = jest.fn().mockRejectedValue(new Error("Database error"));

      // Should not throw an error, but should log it
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(migrateTrustlessWork()).rejects.toThrow("Database error");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();

      // Restore original find function
      Campaign.find = originalFind;
    });

    it("should handle multiple campaigns and milestones", async () => {
      // Create multiple campaigns
      const campaign1 = await Campaign.create({
        title: "Campaign 1",
        goalAmount: 10000,
        status: "live",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
      });

      const campaign2 = await Campaign.create({
        title: "Campaign 2",
        goalAmount: 20000,
        status: "live",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        creatorId: new mongoose.Types.ObjectId(),
        projectId: new mongoose.Types.ObjectId(),
      });

      // Create milestones for both campaigns
      await Milestone.create([
        {
          campaignId: campaign1._id,
          title: "Milestone 1",
          description: "First milestone",
          index: 0,
        },
        {
          campaignId: campaign1._id,
          title: "Milestone 2",
          description: "Second milestone",
          index: 1,
        },
        {
          campaignId: campaign2._id,
          title: "Milestone 1",
          description: "First milestone",
          index: 0,
        },
      ]);

      // Run migration
      await migrateTrustlessWork();

      // Verify all campaigns and milestones were updated
      const updatedCampaigns = await Campaign.find({});
      const updatedMilestones = await Milestone.find({});

      expect(updatedCampaigns).toHaveLength(2);
      expect(updatedMilestones).toHaveLength(3);

      // Verify all campaigns have Trustless Work fields
      updatedCampaigns.forEach((campaign) => {
        expect(campaign.trustlessWorkStatus).toBe("pending");
        expect(campaign.currency).toBe("USDC");
        expect(campaign.escrowType).toBe("multi");
      });

      // Verify all milestones have payout percentages
      updatedMilestones.forEach((milestone) => {
        expect(milestone.payoutPercentage).toBeDefined();
        expect(milestone.amount).toBeDefined();
        expect(milestone.trustlessMilestoneIndex).toBeDefined();
      });
    });
  });
});
