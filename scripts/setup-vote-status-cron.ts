import cron from "node-cron";
import ProjectStatusService from "../src/services/project-status.service";

export function setupVoteStatusCron() {
  cron.schedule("0 * * * *", async () => {
    console.log("Running project status check based on votes...");

    try {
      const results = await ProjectStatusService.processStatusTransitions();

      if (results.length > 0) {
        console.log(`Updated ${results.length} project statuses:`);
        results.forEach((result) => {
          console.log(
            `- Project ${result.projectId}: ${result.oldStatus} → ${result.newStatus} (${result.reason})`,
          );
        });
      } else {
        console.log("No project status updates needed");
      }
    } catch (error) {
      console.error("Error in project status cron job:", error);
    }
  });

  cron.schedule("0 */6 * * *", async () => {
    console.log("Checking for expired voting deadlines...");

    try {
      const results = await ProjectStatusService.processStatusTransitions({
        voteThreshold: 50,
        positiveVoteRatio: 0.55,
        negativeVoteRatio: 0.45,
      });

      const expiredResults = results.filter((r) =>
        r.reason.includes("deadline expired"),
      );

      if (expiredResults.length > 0) {
        console.log(
          `Processed ${expiredResults.length} expired voting deadlines:`,
        );
        expiredResults.forEach((result) => {
          console.log(`- Project ${result.projectId}: ${result.reason}`);
        });
      } else {
        console.log("No expired voting deadlines to process");
      }
    } catch (error) {
      console.error("Error in expired deadline cron job:", error);
    }
  });

  console.log("Vote status cron jobs scheduled successfully");
}

if (require.main === module) {
  setupVoteStatusCron();
  console.log("Cron jobs are now running...");
}
