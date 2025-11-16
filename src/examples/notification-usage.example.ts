/**
 * Example usage of the reusable NotificationService
 *
 * This file demonstrates how to use the notification system
 * across different parts of the application.
 */

import NotificationService from "../features/notifications/notification.service.js";
import EmailTemplatesService from "../services/email/email-templates.service.js";
import { NotificationType } from "../models/notification.model.js";
import mongoose from "mongoose";

// Example 1: Send a simple notification to a user
export async function sendSimpleNotification() {
  const recipient = {
    userId: new mongoose.Types.ObjectId(),
    email: "user@example.com",
    name: "John Doe",
    preferences: {
      email: true,
      inApp: true,
    },
  };

  await NotificationService.sendSingleNotification(recipient, {
    type: NotificationType.PROJECT_CREATED,
    title: "🎉 Welcome to our platform!",
    message: "Your account has been successfully created.",
    emailTemplate: EmailTemplatesService.getTemplate("welcome", {
      recipientName: "John Doe",
    }),
  });
}

// Example 2: Notify project creator about milestone completion
export async function notifyMilestoneCompletion(
  projectId: mongoose.Types.ObjectId,
  projectTitle: string,
  creatorId: mongoose.Types.ObjectId,
  milestoneTitle: string,
) {
  await NotificationService.notifyProjectCreator(
    projectId,
    projectTitle,
    creatorId,
    {
      type: NotificationType.MILESTONE_COMPLETED,
      title: "🎯 Milestone completed!",
      message: `The milestone "${milestoneTitle}" has been completed.`,
      data: {
        milestoneTitle,
      },
      emailTemplate: EmailTemplatesService.getTemplate("milestone-completed", {
        projectTitle,
        projectId: projectId.toString(),
        milestoneTitle,
      }),
    },
  );
}

// Example 3: Notify admin team about new project
export async function notifyAdminAboutNewProject(
  projectId: mongoose.Types.ObjectId,
  projectTitle: string,
  creatorName: string,
  creatorEmail: string,
  fundingAmount: number,
) {
  await NotificationService.notifyAdminTeam({
    type: NotificationType.PROJECT_CREATED,
    title: "🆕 New project requires review",
    message: `A new project "${projectTitle}" has been created and needs admin review.`,
    data: {
      projectId,
      projectTitle,
      creatorName,
      creatorEmail,
      amount: fundingAmount,
    },
    emailTemplate: EmailTemplatesService.getTemplate("admin-new-project", {
      projectTitle,
      projectId: projectId.toString(),
      creatorName,
      creatorEmail,
      amount: fundingAmount,
    }),
  });
}

// Example 4: Notify multiple team members
export async function notifyTeamMembers(
  projectId: mongoose.Types.ObjectId,
  projectTitle: string,
  teamMembers: Array<{
    userId?: mongoose.Types.ObjectId;
    email?: string;
    name: string;
  }>,
) {
  await NotificationService.notifyTeamMembers(teamMembers, {
    type: NotificationType.PROJECT_CREATED,
    title: "🎉 You've been added to a project!",
    message: `You've been added as a team member to "${projectTitle}".`,
    data: {
      projectId,
      projectTitle,
    },
    emailTemplate: EmailTemplatesService.getTemplate("project-created", {
      projectTitle,
      projectId: projectId.toString(),
    }),
  });
}

// Example 5: Send notification with custom template
export async function sendCustomNotification() {
  const recipients = [
    {
      userId: new mongoose.Types.ObjectId(),
      email: "user1@example.com",
      name: "User One",
      preferences: { email: true, inApp: true },
    },
    {
      userId: new mongoose.Types.ObjectId(),
      email: "user2@example.com",
      name: "User Two",
      preferences: { email: true, inApp: false },
    },
  ];

  const customTemplate = {
    subject: "🚀 Custom Notification",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2c3e50;">Custom Notification</h1>
        <p>Hello {{recipientName}},</p>
        <p>This is a custom notification with your name: {{recipientName}}</p>
        <p>Best regards,<br>The Team</p>
      </div>
    `,
    priority: "high" as const,
  };

  await NotificationService.sendNotification({
    type: NotificationType.PROJECT_CREATED,
    title: "Custom Notification",
    message: "This is a custom notification message.",
    recipients,
    emailTemplate: customTemplate,
  });
}

// Example 6: Get notification statistics
export async function getNotificationStats(userId: mongoose.Types.ObjectId) {
  const stats = await NotificationService.getNotificationStats(userId);
  console.log("Notification Stats:", stats);
  return stats;
}

// Example 7: Mark notifications as read
export async function markNotificationsAsRead(
  userId: mongoose.Types.ObjectId,
  notificationIds?: mongoose.Types.ObjectId[],
) {
  await NotificationService.markAsRead(userId, notificationIds);
  console.log("Notifications marked as read");
}

// Example 8: Cleanup old notifications
export async function cleanupOldNotifications() {
  const deletedCount = await NotificationService.cleanupOldNotifications(90); // 90 days
  console.log(`Cleaned up ${deletedCount} old notifications`);
}

/**
 * How to add a new email template:
 *
 * 1. Add the template function to EmailTemplatesService
 * 2. Add the template type to the getTemplate method
 * 3. Use it in your notification calls
 *
 * Example:
 *
 * // In EmailTemplatesService
 * private static getCustomTemplate(data: any): EmailTemplate {
 *   return {
 *     subject: `Custom: ${data.title}`,
 *     html: `<div>Custom HTML for ${data.title}</div>`,
 *     priority: "normal",
 *   };
 * }
 *
 * // In getTemplate method
 * 'custom-template': () => this.getCustomTemplate(data),
 *
 * // Usage
 * EmailTemplatesService.getTemplate('custom-template', { title: 'My Title' })
 */
