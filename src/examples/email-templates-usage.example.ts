/**
 * Example usage of the new professional email templates
 *
 * This file demonstrates how to use the EmailTemplatesService and EmailTemplateUtils
 * for sending professional authentication emails.
 */

import EmailTemplatesService from "../services/email/email-templates.service.js";
import EmailTemplateUtils from "../utils/email-template.utils.js";
import { sendEmail } from "../utils/email.utils.js";

// Example 1: Using EmailTemplatesService (recommended approach)
export const sendOtpEmailExample = async (
  email: string,
  otpCode: string,
  firstName: string,
) => {
  try {
    // Get the OTP verification template
    const template = EmailTemplatesService.getTemplate("otp-verification", {
      otpCode: otpCode,
      firstName: firstName,
      recipientName: firstName,
    });

    // Send the email
    await sendEmail({
      to: email,
      subject: template.subject,
      text: `Your verification code is: ${otpCode}`,
      html: template.html,
    });

    console.log("OTP email sent successfully");
  } catch (error) {
    console.error("Failed to send OTP email:", error);
  }
};

// Example 2: Using EmailTemplateUtils directly (for custom templates)
export const sendWelcomeEmailExample = async (
  email: string,
  firstName: string,
) => {
  try {
    // Generate the welcome email HTML directly
    const html = EmailTemplateUtils.generateWelcomeEmail(firstName);

    // Send the email
    await sendEmail({
      to: email,
      subject: `🎉 Welcome to Boundless, ${firstName}!`,
      text: `Welcome to Boundless, ${firstName}! Your account is ready.`,
      html: html,
    });

    console.log("Welcome email sent successfully");
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
};

// Example 3: Password reset email
export const sendPasswordResetEmailExample = async (
  email: string,
  resetToken: string,
  firstName: string,
) => {
  try {
    const template = EmailTemplatesService.getTemplate("password-reset", {
      resetToken: resetToken,
      firstName: firstName,
      recipientName: firstName,
    });

    await sendEmail({
      to: email,
      subject: template.subject,
      text: "You requested a password reset. Please use the link in the email to reset your password.",
      html: template.html,
    });

    console.log("Password reset email sent successfully");
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }
};

// Example 4: Email verification (alternative to OTP)
export const sendEmailVerificationExample = async (
  email: string,
  verificationToken: string,
  firstName: string,
) => {
  try {
    const template = EmailTemplatesService.getTemplate("email-verification", {
      verificationToken: verificationToken,
      firstName: firstName,
      recipientName: firstName,
    });

    await sendEmail({
      to: email,
      subject: template.subject,
      text: "Please verify your email address by clicking the link in the email.",
      html: template.html,
    });

    console.log("Email verification sent successfully");
  } catch (error) {
    console.error("Failed to send email verification:", error);
  }
};

// Example 5: Available template types
export const availableTemplateTypes = [
  "otp-verification", // OTP code verification
  "welcome", // Welcome email after verification
  "password-reset", // Password reset with token
  "email-verification", // Email verification with token
  // ... other project-related templates
  "project-created",
  "project-updated",
  "project-deleted",
  "project-verified",
  "project-rejected",
  "milestone-completed",
  "funding-goal-reached",
  "funding-received",
  "voting-started",
  "voting-ended",
  "admin-new-project",
];

// Example 6: Template data structure
export interface TemplateDataExample {
  // For OTP verification
  otpCode?: string;

  // For password reset
  resetToken?: string;

  // For email verification
  verificationToken?: string;

  // User information
  firstName?: string;
  lastName?: string;
  recipientName?: string;
  email?: string;

  // Project information (for project templates)
  projectTitle?: string;
  projectId?: string;
  fundingAmount?: string;
  creatorName?: string;
  creatorEmail?: string;

  // URLs
  frontendUrl?: string;
  adminUrl?: string;
  supportEmail?: string;
}

// Example 7: Error handling
export const sendEmailWithErrorHandling = async (
  templateType: string,
  data: any,
  email: string,
) => {
  try {
    const template = EmailTemplatesService.getTemplate(templateType, data);

    await sendEmail({
      to: email,
      subject: template.subject,
      text: "Please check the HTML version of this email.",
      html: template.html,
    });

    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.error(`Failed to send ${templateType} email:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
