import User from "../models/user.model";
import Campaign from "../models/campaign.model";
import { sendEmail } from "../utils/email.utils";

class NotificationService {
  /**
   * Notify admins about new campaign submission
   */
  async notifyAdminsNewCampaign(campaignId: string): Promise<void> {
    try {
      const campaign = await Campaign.findById(campaignId)
        .populate("projectId", "title")
        .populate({
          path: "creatorId",
          select: "profile.firstName profile.lastName email",
        });

      if (!campaign) return;

      const admins = await User.find({ "roles.role": "ADMIN" });

      const emailPromises = admins.map((admin) =>
        sendEmail({
          to: admin.email,
          subject: "New Campaign Pending Approval",
          text: `Hello ${admin.profile?.firstName || ""} ${admin.profile?.lastName || ""},\n\nA new campaign titled "${typeof campaign.projectId === "object" && campaign.projectId && "title" in campaign.projectId ? (campaign.projectId as { title: string }).title : ""}" has been submitted by ${typeof campaign.creatorId === "object" && "profile" in campaign.creatorId ? `${(campaign.creatorId as any).profile?.firstName || ""} ${(campaign.creatorId as any).profile?.lastName || ""}`.trim() : ""} for review.\nGoal Amount: ${campaign.goalAmount} ${campaign.metadata.currency}\nReview it here: ${process.env.ADMIN_DASHBOARD_URL}/campaigns/pending/${campaignId}`,
          data: {
            adminName:
              `${admin.profile?.firstName || ""} ${admin.profile?.lastName || ""}`.trim(),
            campaignTitle:
              typeof campaign.projectId === "object" &&
              campaign.projectId &&
              "title" in campaign.projectId
                ? (campaign.projectId as { title: string }).title
                : "",
            creatorName:
              typeof campaign.creatorId === "object" &&
              "profile" in campaign.creatorId
                ? `${(campaign.creatorId as any).profile?.firstName || ""} ${(campaign.creatorId as any).profile?.lastName || ""}`.trim()
                : "",
            goalAmount: campaign.goalAmount,
            currency: campaign.metadata.currency,
            reviewUrl: `${process.env.ADMIN_DASHBOARD_URL}/campaigns/pending/${campaignId}`,
          },
        }),
      );

      await Promise.all(emailPromises);
    } catch (error) {
      console.error("Error notifying admins about new campaign:", error);
    }
  }

  /**
   * Notify admins when campaign is submitted for approval
   */
  async notifyAdminsCampaignSubmitted(campaignId: string): Promise<void> {
    // Same as notifyAdminsNewCampaign for now
    await this.notifyAdminsNewCampaign(campaignId);
  }

  /**
   * Notify campaign creator about approval
   */
  async notifyCampaignApproved(
    creatorId: string,
    campaignId: string,
  ): Promise<void> {
    try {
      const creator = await User.findById(creatorId);
      const campaign = await Campaign.findById(campaignId).populate(
        "projectId",
        "title",
      );

      if (!creator || !campaign) return;

      await sendEmail({
        to: creator.email,
        subject: "Campaign Approved - Now Live!",
        text: `Hello ${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""},\n\nYour campaign "${typeof campaign.projectId === "object" && campaign.projectId && "title" in campaign.projectId ? (campaign.projectId as { title: string }).title : ""}" has been approved and is now live!\nGoal Amount: ${campaign.goalAmount} ${campaign.metadata.currency}\nView your campaign here: ${process.env.FRONTEND_URL}/campaigns/${campaignId}\nSmart Contract Address: ${campaign.smartContractAddress || "N/A"}`,
        data: {
          creatorName:
            `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim(),
          campaignTitle:
            typeof campaign.projectId === "object" &&
            campaign.projectId &&
            "title" in campaign.projectId
              ? (campaign.projectId as { title: string }).title
              : "",
          goalAmount: campaign.goalAmount,
          currency: campaign.metadata.currency,
          campaignUrl: `${process.env.FRONTEND_URL}/campaigns/${campaignId}`,
          smartContractAddress: campaign.smartContractAddress,
        },
      });
    } catch (error) {
      console.error("Error notifying campaign approval:", error);
    }
  }

  /**
   * Notify campaign creator about rejection
   */
  async notifyCampaignRejected(
    creatorId: string,
    campaignId: string,
    rejectionReason: string,
  ): Promise<void> {
    try {
      const creator = await User.findById(creatorId);
      const campaign = await Campaign.findById(campaignId).populate(
        "projectId",
        "title",
      );

      if (!creator || !campaign) return;

      await sendEmail({
        to: creator.email,
        subject: "Campaign Review Update",
        text: `Hello ${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""},\n\nYour campaign "${typeof campaign.projectId === "object" && campaign.projectId && "title" in campaign.projectId ? (campaign.projectId as { title: string }).title : ""}" was not approved for the following reason:\n\n${rejectionReason}\n\nYou can edit and resubmit your campaign here: ${process.env.FRONTEND_URL}/campaigns/${campaignId}/edit`,
        data: {
          campaignTitle:
            typeof campaign.projectId === "object" &&
            campaign.projectId &&
            "title" in campaign.projectId
              ? (campaign.projectId as { title: string }).title
              : "",
          rejectionReason,
          editUrl: `${process.env.FRONTEND_URL}/campaigns/${campaignId}/edit`,
        },
      });
    } catch (error) {
      console.error("Error notifying campaign rejection:", error);
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
