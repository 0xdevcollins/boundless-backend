import mongoose from "mongoose";
import Activity, { ActivityType } from "../models/activity.model.js";
import User from "../models/user.model.js";
import Project from "../models/project.model.js";
import { pathToFileURL } from "url";

/**
 * Script to populate sample activities for testing
 * This will create various activities for users to test the profile endpoints
 */
async function populateActivities() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/boundless",
    );

    console.log("Connected to MongoDB");

    // Get a sample user
    const user = await User.findOne();
    if (!user) {
      console.log("No users found. Please create a user first.");
      return;
    }

    // Get a sample project
    const project = await Project.findOne();
    if (!project) {
      console.log("No projects found. Please create a project first.");
      return;
    }

    console.log(`Creating activities for user: ${user.profile.username}`);
    console.log(`Using project: ${project.title}`);

    // Create various activities
    const activities = [
      {
        userId: user._id,
        type: ActivityType.PROJECT_CREATED,
        details: {
          projectId: project._id,
        },
      },
      {
        userId: user._id,
        type: ActivityType.CONTRIBUTION_MADE,
        details: {
          projectId: project._id,
          amount: 100,
          transactionHash: "sample_tx_hash_1",
        },
      },
      {
        userId: user._id,
        type: ActivityType.PROJECT_VOTED,
        details: {
          projectId: project._id,
          vote: "positive",
        },
      },
      {
        userId: user._id,
        type: ActivityType.COMMENT_POSTED,
        details: {
          projectId: project._id,
          commentId: new mongoose.Types.ObjectId(),
        },
      },
      {
        userId: user._id,
        type: ActivityType.PROFILE_UPDATED,
        details: {},
      },
      {
        userId: user._id,
        type: ActivityType.LOGIN,
        details: {},
      },
    ];

    // Create activities with different timestamps
    for (let i = 0; i < activities.length; i++) {
      const activity = new Activity({
        ...activities[i],
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Spread over last few days
      });
      await activity.save();
      console.log(`Created activity: ${activities[i].type}`);
    }

    console.log("✅ Activities populated successfully!");
    console.log(`Total activities created: ${activities.length}`);
  } catch (error) {
    console.error("Error populating activities:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the script if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  populateActivities();
}

export default populateActivities;
