import { EmailTemplate } from "./notification.service";
import EmailTemplateUtils from "../utils/email-template.utils";

export class EmailTemplatesService {
  /**
   * Get email template by type
   */
  static getTemplate(templateType: string, data: any = {}): EmailTemplate {
    const templates: Record<string, () => EmailTemplate> = {
      "project-created": () => this.getProjectCreatedTemplate(data),
      "project-updated": () => this.getProjectUpdatedTemplate(data),
      "project-deleted": () => this.getProjectDeletedTemplate(data),
      "project-verified": () => this.getProjectVerifiedTemplate(data),
      "project-rejected": () => this.getProjectRejectedTemplate(data),
      "milestone-completed": () => this.getMilestoneCompletedTemplate(data),
      "funding-goal-reached": () => this.getFundingGoalReachedTemplate(data),
      "funding-received": () => this.getFundingReceivedTemplate(data),
      "voting-started": () => this.getVotingStartedTemplate(data),
      "voting-ended": () => this.getVotingEndedTemplate(data),
      "admin-new-project": () => this.getAdminNewProjectTemplate(data),
      welcome: () => this.getWelcomeTemplate(data),
      "password-reset": () => this.getPasswordResetTemplate(data),
      "email-verification": () => this.getEmailVerificationTemplate(data),
      "otp-verification": () => this.getOtpVerificationTemplate(data),
    };

    const templateFunction = templates[templateType];
    if (!templateFunction) {
      throw new Error(`Email template '${templateType}' not found`);
    }

    return templateFunction();
  }

  /**
   * Project Created Template
   */
  private static getProjectCreatedTemplate(_data: any): EmailTemplate {
    const fundingAmountVar = "{{fundingAmount}}";
    return {
      subject: `🎉 Your crowdfunding project "{{projectTitle}}" has been created!`,
      priority: "high",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin-bottom: 10px;">🎉 Project Created Successfully!</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Your crowdfunding project is now live on Boundless</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Project Details</h2>
            <p><strong>Project Name:</strong> {{projectTitle}}</p>
            <p><strong>Status:</strong> Idea Stage</p>
            <p><strong>Funding Goal:</strong> $${fundingAmountVar}</p>
          </div>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #27ae60; margin-top: 0;">What happens next?</h3>
            <ul style="color: #2c3e50;">
              <li>Your project will be reviewed by our team</li>
              <li>Community members can vote on your project</li>
              <li>Once approved, your project will move to the campaigning phase</li>
              <li>You'll receive notifications about any updates</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}" 
               style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Your Project
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless. If you have any questions, please contact our support team at {{supportEmail}}.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Project Updated Template
   */
  private static getProjectUpdatedTemplate(_data: any): EmailTemplate {
    return {
      subject: `📝 Your project "{{projectTitle}}" has been updated`,
      priority: "normal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin-bottom: 10px;">📝 Project Updated</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Your crowdfunding project has been successfully updated</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Project Details</h2>
            <p><strong>Project Name:</strong> {{projectTitle}}</p>
            <p><strong>Changes Made:</strong> {{changes}}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}" 
               style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Updated Project
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Project Deleted Template
   */
  private static getProjectDeletedTemplate(_data: any): EmailTemplate {
    return {
      subject: `🗑️ Your project "{{projectTitle}}" has been deleted`,
      priority: "normal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #e74c3c; margin-bottom: 10px;">🗑️ Project Deleted</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Your crowdfunding project has been deleted</p>
          </div>
          
          <div style="background: #fdf2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #e74c3c; margin-top: 0;">Project Details</h2>
            <p><strong>Project Name:</strong> {{projectTitle}}</p>
            <p><strong>Status:</strong> Deleted</p>
          </div>
          
          <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #2980b9; margin-top: 0;">Need help?</h3>
            <p style="color: #2c3e50;">If you have any questions about this deletion or need assistance, please contact our support team at {{supportEmail}}.</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Project Verified Template
   */
  private static getProjectVerifiedTemplate(_data: any): EmailTemplate {
    return {
      subject: `✅ Your project "{{projectTitle}}" has been verified!`,
      priority: "high",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #27ae60; margin-bottom: 10px;">✅ Project Verified!</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Congratulations! Your project has been approved</p>
          </div>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #27ae60; margin-top: 0;">Project Details</h2>
            <p><strong>Project Name:</strong> {{projectTitle}}</p>
            <p><strong>Status:</strong> ✅ Verified</p>
            <p><strong>Next Phase:</strong> Campaigning</p>
          </div>
          
          <div style="background: #fef9e7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #f39c12; margin-top: 0;">What's next?</h3>
            <ul style="color: #2c3e50;">
              <li>Your project is now live and visible to the community</li>
              <li>Backers can start funding your project</li>
              <li>You can begin working on your milestones</li>
              <li>Keep your backers updated on progress</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}" 
               style="background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Your Project
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Project Rejected Template
   */
  private static getProjectRejectedTemplate(_data: any): EmailTemplate {
    return {
      subject: `❌ Project review update for "{{projectTitle}}"`,
      priority: "normal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #e74c3c; margin-bottom: 10px;">❌ Project Review Update</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Your project requires some adjustments</p>
          </div>
          
          <div style="background: #fdf2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #e74c3c; margin-top: 0;">Project Details</h2>
            <p><strong>Project Name:</strong> {{projectTitle}}</p>
            <p><strong>Status:</strong> Requires Changes</p>
            <p><strong>Reason:</strong> {{rejectionReason}}</p>
          </div>
          
          <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #2980b9; margin-top: 0;">Next Steps</h3>
            <ul style="color: #2c3e50;">
              <li>Review the feedback provided</li>
              <li>Make the necessary changes to your project</li>
              <li>Resubmit your project for review</li>
              <li>Contact support if you need clarification</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}/edit" 
               style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Edit Your Project
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless. If you have questions, contact us at {{supportEmail}}.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Milestone Completed Template
   */
  private static getMilestoneCompletedTemplate(_data: any): EmailTemplate {
    return {
      subject: `🎯 Milestone completed for "{{projectTitle}}"`,
      priority: "normal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #27ae60; margin-bottom: 10px;">🎯 Milestone Completed!</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Great progress on your crowdfunding project</p>
          </div>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #27ae60; margin-top: 0;">Milestone Details</h2>
            <p><strong>Project:</strong> {{projectTitle}}</p>
            <p><strong>Milestone:</strong> {{milestoneTitle}}</p>
            <p><strong>Status:</strong> ✅ Completed</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}" 
               style="background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Project Progress
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Funding Goal Reached Template
   */
  private static getFundingGoalReachedTemplate(_data: any): EmailTemplate {
    const fundingAmountVar = "{{fundingAmount}}";
    return {
      subject: `💰 Funding goal reached for "{{projectTitle}}"!`,
      priority: "high",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f39c12; margin-bottom: 10px;">💰 Funding Goal Reached!</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Congratulations on reaching your funding target!</p>
          </div>
          
          <div style="background: #fef9e7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #f39c12; margin-top: 0;">Funding Achievement</h2>
            <p><strong>Project:</strong> {{projectTitle}}</p>
            <p><strong>Funding Goal:</strong> $${fundingAmountVar}</p>
            <p><strong>Status:</strong> 🎉 Goal Reached!</p>
          </div>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #27ae60; margin-top: 0;">What's next?</h3>
            <ul style="color: #2c3e50;">
              <li>Your project will move to the next phase</li>
              <li>Funds will be released according to your milestones</li>
              <li>Continue updating your backers on progress</li>
              <li>Deliver on your project promises</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}" 
               style="background: #f39c12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Project Dashboard
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Funding Received Template
   */
  private static getFundingReceivedTemplate(_data: any): EmailTemplate {
    const fundingAmountVar = "{{fundingAmount}}";
    const totalRaisedVar = "{{totalRaised}}";
    return {
      subject: `💸 New funding received for "{{projectTitle}}"`,
      priority: "normal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #27ae60; margin-bottom: 10px;">💸 New Funding Received!</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Your project has received new funding</p>
          </div>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #27ae60; margin-top: 0;">Funding Details</h2>
            <p><strong>Project:</strong> {{projectTitle}}</p>
            <p><strong>Amount Received:</strong> $${fundingAmountVar}</p>
            <p><strong>From:</strong> {{backerName}}</p>
            <p><strong>Total Raised:</strong> $${totalRaisedVar}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}" 
               style="background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Project
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Voting Started Template
   */
  private static getVotingStartedTemplate(_data: any): EmailTemplate {
    return {
      subject: `🗳️ Voting has started for "{{projectTitle}}"`,
      priority: "normal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3498db; margin-bottom: 10px;">🗳️ Voting Started!</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Community voting is now open for your project</p>
          </div>
          
          <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #3498db; margin-top: 0;">Voting Details</h2>
            <p><strong>Project:</strong> {{projectTitle}}</p>
            <p><strong>Voting Period:</strong> {{votingStartDate}} - {{votingEndDate}}</p>
            <p><strong>Threshold:</strong> {{voteThreshold}} votes needed</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}" 
               style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Project
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Voting Ended Template
   */
  private static getVotingEndedTemplate(_data: any): EmailTemplate {
    return {
      subject: `🗳️ Voting has ended for "{{projectTitle}}"`,
      priority: "normal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #9b59b6; margin-bottom: 10px;">🗳️ Voting Ended</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Community voting has concluded for your project</p>
          </div>
          
          <div style="background: #f4f0f7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #9b59b6; margin-top: 0;">Voting Results</h2>
            <p><strong>Project:</strong> {{projectTitle}}</p>
            <p><strong>Total Votes:</strong> {{totalVotes}}</p>
            <p><strong>Positive Votes:</strong> {{positiveVotes}}</p>
            <p><strong>Negative Votes:</strong> {{negativeVotes}}</p>
            <p><strong>Result:</strong> {{votingResult}}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{frontendUrl}}/projects/{{projectId}}" 
               style="background: #9b59b6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Results
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from Boundless.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Admin New Project Template
   */
  private static getAdminNewProjectTemplate(_data: any): EmailTemplate {
    const fundingAmountVar = "{{fundingAmount}}";
    return {
      subject: `🆕 New crowdfunding project created: "{{projectTitle}}"`,
      priority: "normal",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin-bottom: 10px;">🆕 New Project Created</h1>
            <p style="color: #7f8c8d; font-size: 16px;">A new crowdfunding project requires review</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Project Details</h2>
            <p><strong>Project Name:</strong> {{projectTitle}}</p>
            <p><strong>Creator:</strong> {{creatorName}}</p>
            <p><strong>Creator Email:</strong> {{creatorEmail}}</p>
            <p><strong>Funding Goal:</strong> $${fundingAmountVar}</p>
            <p><strong>Status:</strong> Idea Stage (Pending Review)</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="{{adminUrl}}/projects/{{projectId}}" 
               style="background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Review Project
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification for admin review.</p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Welcome Template
   */
  private static getWelcomeTemplate(data: any): EmailTemplate {
    const recipientName = data.recipientName || data.firstName || "there";
    return {
      subject: `🎉 Welcome to Boundless, ${recipientName}!`,
      priority: "high",
      html: EmailTemplateUtils.generateWelcomeEmail(recipientName),
    };
  }

  /**
   * Password Reset Template
   */
  private static getPasswordResetTemplate(data: any): EmailTemplate {
    const resetToken = data.resetToken;
    const recipientName = data.recipientName || data.firstName;

    if (!resetToken) {
      throw new Error("Reset token is required for password reset email");
    }

    return {
      subject: `🔐 Password reset request for Boundless`,
      priority: "high",
      html: EmailTemplateUtils.generatePasswordResetEmail(
        resetToken,
        recipientName,
      ),
    };
  }

  /**
   * Email Verification Template
   */
  private static getEmailVerificationTemplate(data: any): EmailTemplate {
    const verificationToken = data.verificationToken;
    const recipientName = data.recipientName || data.firstName;

    if (!verificationToken) {
      throw new Error("Verification token is required for email verification");
    }

    return {
      subject: `📧 Verify your email address for Boundless`,
      priority: "high",
      html: EmailTemplateUtils.generateEmailVerificationEmail(
        verificationToken,
        recipientName,
      ),
    };
  }

  /**
   * OTP Verification Template
   */
  private static getOtpVerificationTemplate(data: any): EmailTemplate {
    const otpCode = data.otpCode || data.otp;
    const recipientName = data.recipientName || data.firstName;

    if (!otpCode) {
      throw new Error("OTP code is required for OTP verification email");
    }

    return {
      subject: `🔐 Your verification code for Boundless`,
      priority: "high",
      html: EmailTemplateUtils.generateOtpEmail(otpCode, recipientName),
    };
  }
}

export default EmailTemplatesService;
