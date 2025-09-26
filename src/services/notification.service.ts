import mongoose from "mongoose";
import User from "../models/user.model";
import Notification, { NotificationType } from "../models/notification.model";
import { sendEmail } from "../utils/email.utils";

export interface NotificationData {
  projectId?: mongoose.Types.ObjectId;
  commentId?: mongoose.Types.ObjectId;
  milestoneId?: mongoose.Types.ObjectId;
  amount?: number;
  transactionHash?: string;
  [key: string]: any; // Allow additional custom data
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
  priority?: "high" | "normal" | "low";
}

export interface NotificationRecipient {
  userId: mongoose.Types.ObjectId;
  email: string;
  name: string;
  preferences?: {
    email: boolean;
    inApp: boolean;
  };
}

export interface NotificationOptions {
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  recipients: NotificationRecipient[];
  emailTemplate?: EmailTemplate;
  sendEmail?: boolean;
  sendInApp?: boolean;
  delay?: number; // Delay in milliseconds
}

export class NotificationService {
  /**
   * Send a notification to multiple recipients
   */
  static async sendNotification(options: NotificationOptions): Promise<void> {
    try {
      const {
        type,
        title,
        message,
        data = {},
        recipients,
        emailTemplate,
        sendEmail = true,
        sendInApp = true,
        delay = 0,
      } = options;

      // Apply delay if specified
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Process each recipient
      const promises = recipients.map(async (recipient) => {
        const recipientPromises: Promise<void>[] = [];

        // Send in-app notification
        if (sendInApp && recipient.preferences?.inApp !== false) {
          recipientPromises.push(
            this.createInAppNotification(
              recipient.userId,
              type,
              title,
              message,
              data,
            ),
          );
        }

        // Send email notification
        if (
          sendEmail &&
          recipient.preferences?.email !== false &&
          emailTemplate
        ) {
          recipientPromises.push(
            this.sendEmailNotification(recipient, emailTemplate, data),
          );
        }

        return Promise.all(recipientPromises);
      });

      await Promise.all(promises);
      console.log(
        `✅ Notifications sent to ${recipients.length} recipients for ${type}`,
      );
    } catch (error) {
      console.error("Error sending notifications:", error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Send notification to a single recipient
   */
  static async sendSingleNotification(
    recipient: NotificationRecipient,
    options: Omit<NotificationOptions, "recipients">,
  ): Promise<void> {
    return this.sendNotification({
      ...options,
      recipients: [recipient],
    });
  }

  /**
   * Send notification to project creator
   */
  static async notifyProjectCreator(
    projectId: mongoose.Types.ObjectId,
    projectTitle: string,
    creatorId: mongoose.Types.ObjectId,
    options: Omit<NotificationOptions, "recipients">,
  ): Promise<void> {
    try {
      const creator = await User.findById(creatorId).select(
        "email profile.firstName profile.lastName settings.notifications",
      );

      if (!creator || !creator.email) {
        console.log(
          `Creator not found or no email for project: ${projectTitle}`,
        );
        return;
      }

      const recipient: NotificationRecipient = {
        userId: creatorId,
        email: creator.email,
        name:
          `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim() ||
          "Creator",
        preferences: {
          email: creator.settings?.notifications?.email !== false,
          inApp: creator.settings?.notifications?.inApp !== false,
        },
      };

      await this.sendSingleNotification(recipient, {
        ...options,
        data: {
          projectId,
          ...(options.data || {}),
        },
      });
    } catch (error) {
      console.error("Error notifying project creator:", error);
    }
  }

  /**
   * Send notification to admin team
   */
  static async notifyAdminTeam(
    options: Omit<NotificationOptions, "recipients">,
  ): Promise<void> {
    try {
      const adminUsers = await User.find({
        "roles.role": "ADMIN",
        "roles.status": "ACTIVE",
      }).select(
        "email profile.firstName profile.lastName settings.notifications",
      );

      if (adminUsers.length === 0) {
        console.log("No admin users found to notify");
        return;
      }

      const recipients: NotificationRecipient[] = adminUsers
        .filter((admin) => admin.email)
        .map((admin) => ({
          userId: admin._id,
          email: admin.email!,
          name:
            `${admin.profile?.firstName || ""} ${admin.profile?.lastName || ""}`.trim() ||
            "Admin",
          preferences: {
            email: admin.settings?.notifications?.email !== false,
            inApp: admin.settings?.notifications?.inApp !== false,
          },
        }));

      if (recipients.length === 0) {
        console.log("No admin emails found");
        return;
      }

      await this.sendNotification({
        ...options,
        recipients,
      });
    } catch (error) {
      console.error("Error notifying admin team:", error);
    }
  }

  /**
   * Send notification to team members
   */
  static async notifyTeamMembers(
    teamMembers: Array<{
      userId?: mongoose.Types.ObjectId;
      email?: string;
      name: string;
    }>,
    options: Omit<NotificationOptions, "recipients">,
  ): Promise<void> {
    try {
      const recipients: NotificationRecipient[] = [];

      for (const member of teamMembers) {
        if (member.userId) {
          // If user has an account, get their preferences
          const user = await User.findById(member.userId).select(
            "email profile.firstName profile.lastName settings.notifications",
          );

          if (user && user.email) {
            recipients.push({
              userId: member.userId,
              email: user.email,
              name:
                `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
                member.name,
              preferences: {
                email: user.settings?.notifications?.email !== false,
                inApp: user.settings?.notifications?.inApp !== false,
              },
            });
          }
        } else if (member.email) {
          // If no user account, just send email
          recipients.push({
            userId: new mongoose.Types.ObjectId(), // Dummy ID for non-users
            email: member.email,
            name: member.name,
            preferences: {
              email: true,
              inApp: false, // Can't send in-app to non-users
            },
          });
        }
      }

      if (recipients.length > 0) {
        await this.sendNotification({
          ...options,
          recipients,
        });
      }
    } catch (error) {
      console.error("Error notifying team members:", error);
    }
  }

  /**
   * Create in-app notification
   */
  private static async createInAppNotification(
    userId: mongoose.Types.ObjectId,
    type: NotificationType,
    title: string,
    message: string,
    data: NotificationData,
  ): Promise<void> {
    try {
      const notification = new Notification({
        userId: { type: userId },
        type,
        title,
        message,
        data,
        read: false,
        emailSent: false,
      });

      await notification.save();
    } catch (error) {
      console.error("Error creating in-app notification:", error);
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    recipient: NotificationRecipient,
    template: EmailTemplate,
    data: NotificationData,
  ): Promise<void> {
    try {
      // Replace placeholders in template
      const processedTemplate = this.processEmailTemplate(
        template,
        recipient,
        data,
      );

      await sendEmail({
        to: recipient.email,
        subject: processedTemplate.subject,
        html: processedTemplate.html,
        text: processedTemplate.text || "",
        priority: processedTemplate.priority || "normal",
        customHeaders: {
          "X-Email-Type": "notification",
          "X-Recipient-ID": recipient.userId.toString(),
          "X-Notification-Type": data.projectId ? "project" : "general",
        },
      });
    } catch (error) {
      console.error("Error sending email notification:", error);
    }
  }

  /**
   * Process email template with data
   */
  private static processEmailTemplate(
    template: EmailTemplate,
    recipient: NotificationRecipient,
    data: NotificationData,
  ): EmailTemplate {
    const replacements: Record<string, string> = {
      "{{recipientName}}": recipient.name,
      "{{recipientEmail}}": recipient.email,
      "{{projectId}}": data.projectId?.toString() || "",
      "{{projectTitle}}": data.projectTitle || "",
      "{{amount}}": data.amount?.toLocaleString() || "",
      "{{milestoneTitle}}": data.milestoneTitle || "",
      "{{frontendUrl}}": process.env.FRONTEND_URL || "https://boundlessfi.xyz",
      "{{adminUrl}}": process.env.ADMIN_URL || "https://admin.boundlessfi.xyz",
      "{{supportEmail}}":
        process.env.SUPPORT_EMAIL || "support@boundlessfi.xyz",
    };

    let processedSubject = template.subject;
    let processedHtml = template.html;
    let processedText = template.text || "";

    // Replace all placeholders
    Object.entries(replacements).forEach(([placeholder, value]) => {
      processedSubject = processedSubject.replace(
        new RegExp(placeholder, "g"),
        value,
      );
      processedHtml = processedHtml.replace(
        new RegExp(placeholder, "g"),
        value,
      );
      processedText = processedText.replace(
        new RegExp(placeholder, "g"),
        value,
      );
    });

    return {
      subject: processedSubject,
      html: processedHtml,
      text: processedText,
      priority: template.priority,
    };
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(userId: mongoose.Types.ObjectId): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    try {
      const total = await Notification.countDocuments({
        "userId.type": userId,
      });
      const unread = await Notification.countDocuments({
        "userId.type": userId,
        read: false,
      });

      const byType = await Notification.aggregate([
        { $match: { "userId.type": userId } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $project: { type: "$_id", count: 1, _id: 0 } },
      ]);

      const typeMap: Record<string, number> = {};
      byType.forEach((item) => {
        typeMap[item.type] = item.count;
      });

      return { total, unread, byType: typeMap };
    } catch (error) {
      console.error("Error getting notification stats:", error);
      return { total: 0, unread: 0, byType: {} };
    }
  }

  /**
   * Mark notifications as read
   */
  static async markAsRead(
    userId: mongoose.Types.ObjectId,
    notificationIds?: mongoose.Types.ObjectId[],
  ): Promise<void> {
    try {
      const filter: any = { "userId.type": userId };

      if (notificationIds && notificationIds.length > 0) {
        filter._id = { $in: notificationIds };
      }

      await Notification.updateMany(filter, {
        read: true,
        readAt: new Date(),
      });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  }

  /**
   * Delete old notifications
   */
  static async cleanupOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true,
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error("Error cleaning up old notifications:", error);
      return 0;
    }
  }
}

export default NotificationService;
