import { EmailTemplate } from "../../features/notifications/notification.service.js";
import EmailTemplateUtils from "../../utils/email-template.utils.js";

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
      "team-invitation-existing-user": () =>
        this.getTeamInvitationExistingUserTemplate(data),
      "team-invitation-new-user": () =>
        this.getTeamInvitationNewUserTemplate(data),
      "organization-created": () => this.getOrganizationCreatedTemplate(data),
      "organization-updated": () => this.getOrganizationUpdatedTemplate(data),
      "organization-deleted": () => this.getOrganizationDeletedTemplate(data),
      "organization-invite-sent": () =>
        this.getOrganizationInviteSentTemplate(data),
      "organization-invite-accepted": () =>
        this.getOrganizationInviteAcceptedTemplate(data),
      "organization-member-added": () =>
        this.getOrganizationMemberAddedTemplate(data),
      "organization-member-removed": () =>
        this.getOrganizationMemberRemovedTemplate(data),
      "organization-role-changed": () =>
        this.getOrganizationRoleChangedTemplate(data),
      "organization-archived": () => this.getOrganizationArchivedTemplate(data),
      "organization-unarchived": () =>
        this.getOrganizationUnarchivedTemplate(data),
      "hackathon-created": () => this.getHackathonCreatedTemplate(data),
      "hackathon-updated": () => this.getHackathonUpdatedTemplate(data),
      "hackathon-published": () => this.getHackathonPublishedTemplate(data),
      "hackathon-active": () => this.getHackathonActiveTemplate(data),
      "hackathon-completed": () => this.getHackathonCompletedTemplate(data),
      "hackathon-cancelled": () => this.getHackathonCancelledTemplate(data),
      "hackathon-deleted": () => this.getHackathonDeletedTemplate(data),
      "hackathon-registered": () => this.getHackathonRegisteredTemplate(data),
      "hackathon-submission-submitted": () =>
        this.getHackathonSubmissionSubmittedTemplate(data),
      "hackathon-submission-shortlisted": () =>
        this.getHackathonSubmissionShortlistedTemplate(data),
      "hackathon-submission-disqualified": () =>
        this.getHackathonSubmissionDisqualifiedTemplate(data),
      "hackathon-winners-announced": () =>
        this.getHackathonWinnersAnnouncedTemplate(data),
      "hackathon-deadline-approaching": () =>
        this.getHackathonDeadlineApproachingTemplate(data),
      "team-invitation-sent": () => this.getTeamInvitationSentTemplate(data),
      "team-invitation-accepted": () =>
        this.getTeamInvitationAcceptedTemplate(data),
      "team-invitation-declined": () =>
        this.getTeamInvitationDeclinedTemplate(data),
      "team-invitation-expired": () =>
        this.getTeamInvitationExpiredTemplate(data),
      "team-invitation-cancelled": () =>
        this.getTeamInvitationCancelledTemplate(data),
      "hackathon-team-invitation-existing-user": () =>
        this.getHackathonTeamInvitationExistingUserTemplate(data),
      "hackathon-team-invitation-new-user": () =>
        this.getHackathonTeamInvitationNewUserTemplate(data),
      "hackathon-team-invitation-accepted": () =>
        this.getHackathonTeamInvitationAcceptedTemplate(data),
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
            <p><strong>Funding Goal:</strong> ${fundingAmountVar}</p>
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

  /**
   * Team Invitation - Existing User Template
   */
  private static getTeamInvitationExistingUserTemplate(
    data: any,
  ): EmailTemplate {
    const {
      recipientName,
      projectTitle,
      projectId,
      role,
      inviterName,
      invitationUrl,
      projectUrl,
      expiresAt,
    } = data;

    if (
      !recipientName ||
      !projectTitle ||
      !role ||
      !inviterName ||
      !invitationUrl
    ) {
      throw new Error("Required data missing for team invitation email");
    }

    return {
      subject: `🤝 You've been invited to join "${projectTitle}" team`,
      priority: "high",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin-bottom: 10px;">🤝 Team Invitation</h1>
            <p style="color: #7f8c8d; font-size: 16px;">You've been invited to join a project team on Boundless</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-bottom: 15px;">Project Details</h2>
            <p style="margin: 10px 0;"><strong>Project:</strong> ${projectTitle}</p>
            <p style="margin: 10px 0;"><strong>Role:</strong> ${role}</p>
            <p style="margin: 10px 0;"><strong>Invited by:</strong> ${inviterName}</p>
            <p style="margin: 10px 0;"><strong>Expires:</strong> ${new Date(expiresAt).toLocaleDateString()}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <a href="${projectUrl}" 
               style="color: #3498db; text-decoration: none;">
              View Project Details
            </a>
          </div>

          <div style="background: #e8f4f8; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; color: #2c3e50; font-size: 14px;">
              <strong>Note:</strong> This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}. 
              If you don't want to join this project, you can simply ignore this email.
            </p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Team Invitation - New User Template
   */
  private static getTeamInvitationNewUserTemplate(data: any): EmailTemplate {
    const {
      recipientName,
      projectTitle,
      projectId,
      role,
      inviterName,
      registrationUrl,
      invitationUrl,
      projectUrl,
      expiresAt,
    } = data;

    if (
      !recipientName ||
      !projectTitle ||
      !role ||
      !inviterName ||
      !registrationUrl
    ) {
      throw new Error("Required data missing for team invitation email");
    }

    return {
      subject: `🤝 You've been invited to join "${projectTitle}" team - Create your account`,
      priority: "high",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin-bottom: 10px;">🤝 Team Invitation</h1>
            <p style="color: #7f8c8d; font-size: 16px;">You've been invited to join a project team on Boundless</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-bottom: 15px;">Project Details</h2>
            <p style="margin: 10px 0;"><strong>Project:</strong> ${projectTitle}</p>
            <p style="margin: 10px 0;"><strong>Role:</strong> ${role}</p>
            <p style="margin: 10px 0;"><strong>Invited by:</strong> ${inviterName}</p>
            <p style="margin: 10px 0;"><strong>Expires:</strong> ${new Date(expiresAt).toLocaleDateString()}</p>
          </div>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #27ae60; margin-bottom: 10px;">🚀 Get Started</h3>
            <p style="margin: 10px 0; color: #2c3e50;">
              To join this project team, you'll need to create a Boundless account first. 
              It's quick and free!
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" 
               style="background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
              Create Account & Join
            </a>
            <a href="${invitationUrl}" 
               style="background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              View Invitation
            </a>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <a href="${projectUrl}" 
               style="color: #3498db; text-decoration: none;">
              View Project Details
            </a>
          </div>

          <div style="background: #e8f4f8; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; color: #2c3e50; font-size: 14px;">
              <strong>Note:</strong> This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}. 
              If you don't want to join this project, you can simply ignore this email.
            </p>
          </div>
        </div>
      `,
    };
  }

  /**
   * Organization Created Template
   */
  private static getOrganizationCreatedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `🎉 Your organization ${data.organizationName || "Organization"} has been created!`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Organization Created",
        preheaderText: "Your organization is ready to use",
        headline: "Organization Created Successfully!",
        bodyText1: `Congratulations! Your organization <b>${data.organizationName || "Organization"}</b> has been successfully created.`,
        bodyText2:
          "You can now start inviting members, creating hackathons, and managing grants.",
        ctaUrl: `${frontendUrl}/organizations/${data.organizationId}`,
        ctaText: "View Organization",
        disclaimerText:
          "You are the owner of this organization and have full administrative access.",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Updated Template
   */
  private static getOrganizationUpdatedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `Organization ${data.organizationName || "Organization"} has been updated`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Organization Updated",
        preheaderText: "Your organization profile has been updated",
        headline: "📝 Organization Updated",
        bodyText1: `The organization <b>${data.organizationName || "Organization"}</b> has been updated.`,
        bodyText2: data.changes
          ? `Changes made: ${data.changes}`
          : "The organization profile or settings have been modified.",
        ctaUrl: `${frontendUrl}/organizations/${data.organizationId}`,
        ctaText: "View Organization",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Deleted Template
   */
  private static getOrganizationDeletedTemplate(data: any): EmailTemplate {
    return {
      subject: `⚠️ Organization ${data.organizationName || "Organization"} has been deleted`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Organization Deleted",
        preheaderText: "Your organization has been deleted",
        headline: "⚠️ Organization Deleted",
        bodyText1: `The organization <b>${data.organizationName || "Organization"}</b> has been permanently deleted.`,
        bodyText2:
          "All associated data, including hackathons and grants, have been removed.",
        disclaimerText:
          "This action cannot be undone. If this was done in error, please contact support immediately.",
        privacyUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/privacy`,
        termsUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Invite Sent Template
   */
  private static getOrganizationInviteSentTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    const acceptUrl =
      data.acceptUrl ||
      `${frontendUrl}/organizations/${data.organizationId}/invite/accept`;
    return {
      subject: `You've been invited to join ${data.organizationName || "an organization"}`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Organization Invitation",
        preheaderText: `You've been invited to join ${data.organizationName}`,
        headline: "You've been invited!",
        bodyText1: `You have been invited to join <b>${data.organizationName || "an organization"}</b> on Boundless.`,
        bodyText2: data.inviterName
          ? `${data.inviterName} has invited you to become a member.`
          : "Accept the invitation to start collaborating with the team.",
        ctaUrl: acceptUrl,
        ctaText: "Accept Invitation",
        disclaimerText:
          "If you did not expect this invitation, you can safely ignore this email.",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Invite Accepted Template
   */
  private static getOrganizationInviteAcceptedTemplate(
    data: any,
  ): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `${data.memberName || "A new member"} has joined ${data.organizationName || "your organization"}`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "New Member Joined",
        preheaderText: `${data.memberName || "Someone"} has joined your organization`,
        headline: "New Member Joined!",
        bodyText1: `${data.memberName || "A new member"} (${data.memberEmail || ""}) has accepted the invitation and joined <b>${data.organizationName || "your organization"}</b>.`,
        bodyText2:
          "They now have access to the organization and can participate in activities.",
        ctaUrl: `${frontendUrl}/organizations/${data.organizationId}/settings/members`,
        ctaText: "View Members",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Member Added Template
   */
  private static getOrganizationMemberAddedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `You've been added to ${data.organizationName || "an organization"}`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Added to Organization",
        preheaderText: `You're now a member of ${data.organizationName}`,
        headline: "Welcome to the team!",
        bodyText1: `You have been added as a member of <b>${data.organizationName || "an organization"}</b> on Boundless.`,
        bodyText2:
          "You can now access the organization and participate in its activities.",
        ctaUrl: `${frontendUrl}/organizations/${data.organizationId}`,
        ctaText: "View Organization",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Member Removed Template
   */
  private static getOrganizationMemberRemovedTemplate(
    data: any,
  ): EmailTemplate {
    return {
      subject: `You've been removed from ${data.organizationName || "an organization"}`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Removed from Organization",
        preheaderText: "You've been removed from an organization",
        headline: "Membership Removed",
        bodyText1: `You have been removed as a member of <b>${data.organizationName || "an organization"}</b> on Boundless.`,
        bodyText2:
          "You no longer have access to this organization or its resources.",
        disclaimerText:
          "If you believe this was done in error, please contact the organization owner.",
        privacyUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/privacy`,
        termsUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Role Changed Template
   */
  private static getOrganizationRoleChangedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    const roleChangeMessage =
      data.newRole === "owner"
        ? "You are now the owner of this organization."
        : data.newRole === "admin"
          ? "You have been promoted to administrator."
          : data.newRole === "member"
            ? "You have been changed to a regular member."
            : `Your role has been changed to ${data.newRole}.`;

    return {
      subject: `Your role in ${data.organizationName || "an organization"} has been changed`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Role Changed",
        preheaderText: `Your role in ${data.organizationName} has been updated`,
        headline: "Role Updated",
        bodyText1: `Your role in <b>${data.organizationName || "an organization"}</b> has been changed.`,
        bodyText2: roleChangeMessage,
        bodyText3: data.oldRole
          ? `Previous role: ${data.oldRole} → New role: ${data.newRole || "member"}`
          : undefined,
        ctaUrl: `${frontendUrl}/organizations/${data.organizationId}`,
        ctaText: "View Organization",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Created Template
   */
  private static getHackathonCreatedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `Hackathon "${data.hackathonName || "Hackathon"}" created`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Created",
        preheaderText: "A new hackathon has been created",
        headline: "Hackathon Created",
        bodyText1: `A new hackathon <b>${data.hackathonName || "Hackathon"}</b> has been created.`,
        bodyText2:
          "The hackathon is currently in draft status and will be published soon.",
        ctaUrl: `${frontendUrl}/organizations/${data.organizationId}/hackathons/${data.hackathonId}`,
        ctaText: "View Hackathon",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Updated Template
   */
  private static getHackathonUpdatedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `Hackathon "${data.hackathonName || "Hackathon"}" updated`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Updated",
        preheaderText: "Hackathon details have been updated",
        headline: "Hackathon Updated",
        bodyText1: `The hackathon <b>${data.hackathonName || "Hackathon"}</b> has been updated.`,
        bodyText2: data.changes
          ? `Changes made: ${data.changes}`
          : "The hackathon details or settings have been modified.",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Hackathon",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Published Template
   */
  private static getHackathonPublishedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `🎉 Hackathon "${data.hackathonName || "Hackathon"}" is now live!`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Published",
        preheaderText: "A new hackathon is now live",
        headline: "🎉 Hackathon is Live!",
        bodyText1: `The hackathon <b>${data.hackathonName || "Hackathon"}</b> has been published and is now live!`,
        bodyText2:
          "Participants can now register and start working on their projects.",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Hackathon",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Active Template
   */
  private static getHackathonActiveTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `🚀 Hackathon "${data.hackathonName || "Hackathon"}" is now active!`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Active",
        preheaderText: "The hackathon has started",
        headline: "🚀 Hackathon is Active!",
        bodyText1: `The hackathon <b>${data.hackathonName || "Hackathon"}</b> is now active and participants can start submitting their projects.`,
        bodyText2: data.startDate
          ? `The hackathon started on ${new Date(data.startDate).toLocaleDateString()}.`
          : "Start working on your project now!",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Hackathon",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Completed Template
   */
  private static getHackathonCompletedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `✅ Hackathon "${data.hackathonName || "Hackathon"}" has been completed`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Completed",
        preheaderText: "The hackathon has ended",
        headline: "✅ Hackathon Completed",
        bodyText1: `The hackathon <b>${data.hackathonName || "Hackathon"}</b> has been completed.`,
        bodyText2:
          "Thank you for participating! Winners will be announced soon.",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Hackathon",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Cancelled Template
   */
  private static getHackathonCancelledTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `⚠️ Hackathon "${data.hackathonName || "Hackathon"}" has been cancelled`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Cancelled",
        preheaderText: "The hackathon has been cancelled",
        headline: "⚠️ Hackathon Cancelled",
        bodyText1: `The hackathon <b>${data.hackathonName || "Hackathon"}</b> has been cancelled.`,
        bodyText2:
          data.reason || "We apologize for any inconvenience this may cause.",
        disclaimerText:
          "If you have any questions, please contact the organization.",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Deleted Template
   */
  private static getHackathonDeletedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `🗑️ Hackathon "${data.hackathonName || "Hackathon"}" has been deleted`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Deleted",
        preheaderText: "A hackathon has been deleted",
        headline: "🗑️ Hackathon Deleted",
        bodyText1: `The hackathon <b>${data.hackathonName || "Hackathon"}</b> has been deleted.`,
        bodyText2: data.deletedBy
          ? `This action was performed by ${data.deletedBy}.`
          : "The hackathon and all associated data have been permanently removed.",
        bodyText3: data.organizationName
          ? `This hackathon was organized by ${data.organizationName}.`
          : "If you have any questions or concerns, please contact the organization directly.",
        disclaimerText:
          "If you believe this was done in error, please contact the organization or support.",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Registered Template
   */
  private static getHackathonRegisteredTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `✅ You've registered for "${data.hackathonName || "Hackathon"}"`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Registration",
        preheaderText: "You've successfully registered for a hackathon",
        headline: "Registration Confirmed!",
        bodyText1: `You have successfully registered for <b>${data.hackathonName || "Hackathon"}</b>.`,
        bodyText2:
          "You can now start working on your project and submit it before the deadline.",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Hackathon",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Submission Submitted Template
   */
  private static getHackathonSubmissionSubmittedTemplate(
    data: any,
  ): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `✅ Your submission for "${data.hackathonName || "Hackathon"}" has been received`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Submission Received",
        preheaderText: "Your hackathon submission has been received",
        headline: "Submission Received!",
        bodyText1: `Your submission for <b>${data.hackathonName || "Hackathon"}</b> has been successfully received.`,
        bodyText2:
          "Your submission is now under review. You'll be notified when the results are available.",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Submission",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Submission Shortlisted Template
   */
  private static getHackathonSubmissionShortlistedTemplate(
    data: any,
  ): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `🎉 Your submission for "${data.hackathonName || "Hackathon"}" has been shortlisted!`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Submission Shortlisted",
        preheaderText: "Congratulations! Your submission has been shortlisted",
        headline: "🎉 Submission Shortlisted!",
        bodyText1: `Congratulations! Your submission for <b>${data.hackathonName || "Hackathon"}</b> has been shortlisted.`,
        bodyText2: "Your project is now in the final judging phase. Good luck!",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Submission",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Submission Disqualified Template
   */
  private static getHackathonSubmissionDisqualifiedTemplate(
    data: any,
  ): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `⚠️ Your submission for "${data.hackathonName || "Hackathon"}" has been disqualified`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Submission Disqualified",
        preheaderText: "Your submission has been disqualified",
        headline: "Submission Disqualified",
        bodyText1: `Your submission for <b>${data.hackathonName || "Hackathon"}</b> has been disqualified.`,
        bodyText2:
          data.reason || "Please review the hackathon rules and requirements.",
        disclaimerText:
          "If you have any questions, please contact the organization.",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Submission",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Winners Announced Template
   */
  private static getHackathonWinnersAnnouncedTemplate(
    data: any,
  ): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `🏆 Winners announced for "${data.hackathonName || "Hackathon"}"`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Winners Announced",
        preheaderText: "The hackathon winners have been announced",
        headline: "🏆 Winners Announced!",
        bodyText1: `The winners for <b>${data.hackathonName || "Hackathon"}</b> have been announced!`,
        bodyText2: data.isWinner
          ? "Congratulations! You are among the winners!"
          : "Check out the winning projects and see who took home the prizes.",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}/winners`,
        ctaText: "View Winners",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Deadline Approaching Template
   */
  private static getHackathonDeadlineApproachingTemplate(
    data: any,
  ): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    const deadlineType =
      data.deadlineType === "submission"
        ? "submission deadline"
        : data.deadlineType === "judging"
          ? "judging date"
          : "deadline";
    return {
      subject: `⏰ Reminder: ${deadlineType} approaching for "${data.hackathonName || "Hackathon"}"`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Deadline Reminder",
        preheaderText: `The ${deadlineType} is approaching`,
        headline: `⏰ ${deadlineType.charAt(0).toUpperCase() + deadlineType.slice(1)} Approaching`,
        bodyText1: `The ${deadlineType} for <b>${data.hackathonName || "Hackathon"}</b> is approaching.`,
        bodyText2: data.deadlineDate
          ? `The ${deadlineType} is on ${new Date(data.deadlineDate).toLocaleDateString()}.`
          : "Make sure to complete your submission on time.",
        ctaUrl: `${frontendUrl}/hackathons/${data.hackathonSlug || data.hackathonId}`,
        ctaText: "View Hackathon",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Team Invitation Sent Template
   */
  private static getTeamInvitationSentTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    const acceptUrl =
      data.acceptUrl || `${frontendUrl}/team-invitations/${data.token}/accept`;
    return {
      subject: `You've been invited to join "${data.projectName || "a project"}" team`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Team Invitation",
        preheaderText: `You've been invited to join ${data.projectName}`,
        headline: "You've been invited!",
        bodyText1: `You have been invited to join the team for <b>${data.projectName || "a project"}</b> on Boundless.`,
        bodyText2: data.inviterName
          ? `${data.inviterName} has invited you to join as ${data.role || "a team member"}.`
          : `You've been invited to join as ${data.role || "a team member"}.`,
        ctaUrl: acceptUrl,
        ctaText: "Accept Invitation",
        disclaimerText:
          "If you did not expect this invitation, you can safely ignore this email.",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Team Invitation Accepted Template
   */
  private static getTeamInvitationAcceptedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `${data.memberName || "Someone"} has joined "${data.projectName || "your project"}" team`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Team Member Joined",
        preheaderText: `${data.memberName || "Someone"} has joined your team`,
        headline: "New Team Member!",
        bodyText1: `${data.memberName || "A new member"} (${data.memberEmail || ""}) has accepted the invitation and joined the team for <b>${data.projectName || "your project"}</b>.`,
        bodyText2: "They can now collaborate on the project with you.",
        ctaUrl: `${frontendUrl}/projects/${data.projectId}`,
        ctaText: "View Project",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Team Invitation Declined Template
   */
  private static getTeamInvitationDeclinedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `Team invitation declined for "${data.projectName || "your project"}"`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Invitation Declined",
        preheaderText: "A team invitation has been declined",
        headline: "Invitation Declined",
        bodyText1: `${data.memberEmail || "The invited user"} has declined the invitation to join <b>${data.projectName || "your project"}</b>.`,
        bodyText2: "You can invite other team members if needed.",
        ctaUrl: `${frontendUrl}/projects/${data.projectId}`,
        ctaText: "View Project",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Team Invitation Expired Template
   */
  private static getTeamInvitationExpiredTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `Team invitation expired for "${data.projectName || "a project"}"`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Invitation Expired",
        preheaderText: "A team invitation has expired",
        headline: "Invitation Expired",
        bodyText1: `The team invitation for <b>${data.projectName || "a project"}</b> has expired.`,
        bodyText2:
          "If you still want to join, please request a new invitation from the project creator.",
        ctaUrl: `${frontendUrl}/projects/${data.projectId}`,
        ctaText: "View Project",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Team Invitation Cancelled Template
   */
  private static getTeamInvitationCancelledTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `Team invitation cancelled for "${data.projectName || "a project"}"`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Invitation Cancelled",
        preheaderText: "A team invitation has been cancelled",
        headline: "Invitation Cancelled",
        bodyText1: `The team invitation for <b>${data.projectName || "a project"}</b> has been cancelled by the project creator.`,
        bodyText2:
          "If you have any questions, please contact the project creator.",
        ctaUrl: `${frontendUrl}/projects/${data.projectId}`,
        ctaText: "View Project",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Archived Template
   */
  private static getOrganizationArchivedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `Organization ${data.organizationName || "Organization"} has been archived`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Organization Archived",
        preheaderText: "Your organization has been archived",
        headline: "Organization Archived",
        bodyText1: `The organization <b>${data.organizationName || "Organization"}</b> has been archived.`,
        bodyText2: data.archivedBy
          ? `This action was performed by ${data.archivedBy}.`
          : "The organization is now hidden from normal queries but can be restored.",
        bodyText3:
          "Archived organizations can be unarchived by owners or admins at any time.",
        disclaimerText:
          "If you believe this was done in error, please contact the organization owner or an admin.",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Organization Unarchived Template
   */
  private static getOrganizationUnarchivedTemplate(data: any): EmailTemplate {
    const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
    return {
      subject: `Organization ${data.organizationName || "Organization"} has been restored`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Organization Restored",
        preheaderText: "Your organization has been unarchived",
        headline: "Organization Restored",
        bodyText1: `The organization <b>${data.organizationName || "Organization"}</b> has been unarchived and is now active again.`,
        bodyText2: data.archivedBy
          ? `This action was performed by ${data.archivedBy}.`
          : "The organization is now visible and accessible to all members.",
        ctaUrl: `${frontendUrl}/organizations/${data.organizationId}`,
        ctaText: "View Organization",
        privacyUrl: `${frontendUrl}/privacy`,
        termsUrl: `${frontendUrl}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  private static getHackathonTeamInvitationExistingUserTemplate(
    data: any,
  ): EmailTemplate {
    const {
      recipientName,
      teamName,
      hackathonName,
      inviterName,
      invitationUrl,
      hackathonUrl,
      expiresAt,
    } = data;

    if (!recipientName || !teamName || !hackathonName || !invitationUrl) {
      throw new Error(
        "Required data missing for hackathon team invitation email",
      );
    }

    return {
      subject: `🤝 You've been invited to join ${teamName} for ${hackathonName}`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Team Invitation",
        preheaderText: `Join ${teamName} for ${hackathonName}`,
        headline: "🤝 Team Invitation",
        bodyText1: `<strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> for the hackathon <strong>${hackathonName}</strong>.`,
        bodyText2:
          "Click the button below to accept the invitation and join the team.",
        ctaUrl: invitationUrl,
        ctaText: "Accept Invitation",
        bodyText3: hackathonUrl
          ? `You can view the hackathon details here: <a href="${hackathonUrl}" style="color: #3498db;">${hackathonName}</a>`
          : undefined,
        disclaimerText: expiresAt
          ? `This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}. If you don't want to join this team, you can safely ignore this email.`
          : "If you don't want to join this team, you can safely ignore this email.",
        privacyUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/privacy`,
        termsUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Team Invitation - New User Template
   */
  private static getHackathonTeamInvitationNewUserTemplate(
    data: any,
  ): EmailTemplate {
    const {
      recipientName,
      teamName,
      hackathonName,
      inviterName,
      registrationUrl,
      invitationUrl,
      hackathonUrl,
      expiresAt,
    } = data;

    if (!recipientName || !teamName || !hackathonName || !registrationUrl) {
      throw new Error(
        "Required data missing for hackathon team invitation email",
      );
    }

    return {
      subject: `🤝 You've been invited to join ${teamName} for ${hackathonName}`,
      priority: "high",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Hackathon Team Invitation",
        preheaderText: `Join ${teamName} for ${hackathonName}`,
        headline: "🤝 Team Invitation",
        bodyText1: `<strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> for the hackathon <strong>${hackathonName}</strong>.`,
        bodyText2:
          "Create an account on Boundless to accept this invitation and join the team. It's quick and free!",
        ctaUrl: registrationUrl,
        ctaText: "Create Account & Join",
        bodyText3: hackathonUrl
          ? `You can view the hackathon details here: <a href="${hackathonUrl}" style="color: #3498db;">${hackathonName}</a>`
          : undefined,
        disclaimerText: expiresAt
          ? `This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}. You'll need to create an account with this email address to accept the invitation.`
          : "You'll need to create an account with this email address to accept the invitation.",
        privacyUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/privacy`,
        termsUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  /**
   * Hackathon Team Invitation Accepted Template
   */
  private static getHackathonTeamInvitationAcceptedTemplate(
    data: any,
  ): EmailTemplate {
    const {
      teamLeaderName,
      newMemberName,
      teamName,
      hackathonName,
      teamManagementUrl,
    } = data;

    if (!teamLeaderName || !newMemberName || !teamName || !hackathonName) {
      throw new Error(
        "Required data missing for hackathon team invitation accepted email",
      );
    }

    return {
      subject: `👥 ${newMemberName} joined your team ${teamName}`,
      priority: "normal",
      html: EmailTemplateUtils.generateEmail({
        emailTitle: "Team Member Joined",
        preheaderText: `${newMemberName} joined ${teamName}`,
        headline: "👥 Team Member Joined!",
        bodyText1: `Hello ${teamLeaderName}, <strong>${newMemberName}</strong> has accepted your invitation and joined <strong>${teamName}</strong> for ${hackathonName}.`,
        bodyText2:
          "They are now part of your hackathon team and can collaborate on the project.",
        ctaUrl: teamManagementUrl,
        ctaText: "Manage Team",
        disclaimerText:
          "You can manage your team members, roles, and settings from the team management page.",
        privacyUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/privacy`,
        termsUrl: `${process.env.FRONTEND_URL || "https://boundlessfi.xyz"}/terms`,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }
}

export default EmailTemplatesService;
