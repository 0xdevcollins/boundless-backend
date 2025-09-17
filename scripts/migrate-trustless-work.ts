import mongoose from "mongoose";
import Campaign from "../src/models/campaign.model";
import Milestone from "../src/models/milestone.model";
import { config } from "../src/config";

async function migrateTrustlessWork() {
  try {
    
    await mongoose.connect(config.mongoUri);
    console.log("Connected to database");

    
    const campaigns = await Campaign.find({
      $or: [
        { trustlessWorkStatus: { $exists: false } },
        { currency: { $exists: false } },
        { escrowType: { $exists: false } },
      ],
    });

    console.log(`Found ${campaigns.length} campaigns to migrate`);

    for (const campaign of campaigns) {
     
      const updates: any = {};

      if (!campaign.trustlessWorkStatus) {
        updates.trustlessWorkStatus = "pending";
      }

      if (!campaign.currency) {
        updates.currency = "USDC";
      }

      if (!campaign.escrowType) {
        updates.escrowType = "multi";
      }

      if (Object.keys(updates).length > 0) {
        await Campaign.findByIdAndUpdate(campaign._id, updates);
        console.log(
          `Updated campaign ${campaign._id} with Trustless Work fields`,
        );
      }
    }

    
    const milestones = await Milestone.find({
      $or: [
        { payoutPercentage: { $exists: false } },
        { amount: { $exists: false } },
        { trustlessMilestoneIndex: { $exists: false } },
      ],
    });

    console.log(`Found ${milestones.length} milestones to migrate`);

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
          const campaignMilestones = await Milestone.find({
            campaignId: milestone.campaignId,
          });
          const payoutPercentage =
            milestone.payoutPercentage || 100 / campaignMilestones.length;
          updates.amount = (campaign.goalAmount * payoutPercentage) / 100;
        }
      }

      if (milestone.trustlessMilestoneIndex === undefined) {
        updates.trustlessMilestoneIndex = milestone.index;
      }

      if (Object.keys(updates).length > 0) {
        await Milestone.findByIdAndUpdate(milestone._id, updates);
        console.log(
          `Updated milestone ${milestone._id} with Trustless Work fields`,
        );
      }
    }

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database");
  }
}


if (require.main === module) {
  migrateTrustlessWork();
}

export default migrateTrustlessWork;
