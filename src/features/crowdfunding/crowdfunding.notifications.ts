import NotificationService from "../../features/notifications/notification.service";
import EmailTemplatesService from "../../services/email/email-templates.service";
import { NotificationType } from "../../models/notification.model";

export async function sendProjectCreatedNotifications(
  project: any,
  creator: any,
): Promise<void> {
  try {
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_CREATED,
        title: "Your crowdfunding project has been created!",
        message: `Your project "${project.title}" has been successfully created and is now in the idea stage.`,
        emailTemplate: EmailTemplatesService.getTemplate("project-created", {
          projectTitle: project.title,
          projectId: project._id,
          amount: project.funding.goal,
        }),
      },
    );

    await NotificationService.notifyAdminTeam({
      type: NotificationType.PROJECT_CREATED,
      title: "New crowdfunding project created",
      message: `A new crowdfunding project "${project.title}" has been created and requires review.`,
      data: {
        projectId: project._id,
        projectTitle: project.title,
        creatorName:
          `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim() ||
          "Creator",
        creatorEmail: creator.email,
        amount: project.funding.goal,
      },
      emailTemplate: EmailTemplatesService.getTemplate("admin-new-project", {
        projectTitle: project.title,
        projectId: project._id,
        creatorName:
          `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim() ||
          "Creator",
        creatorEmail: creator.email,
        amount: project.funding.goal,
      }),
    });

    if (project.team && project.team.length > 0) {
      const teamMembers = project.team.map((member: any) => ({
        userId: member.userId,
        name: member.name || "Team Member",
        email: member.email,
      }));

      await NotificationService.notifyTeamMembers(teamMembers, {
        type: NotificationType.PROJECT_CREATED,
        title: "You've been added to a new project!",
        message: `You've been added as a team member to the project "${project.title}".`,
        data: {
          projectId: project._id,
          projectTitle: project.title,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-created", {
          projectTitle: project.title,
          projectId: project._id,
          amount: project.funding.goal,
        }),
      });
    }
  } catch (error) {
    console.error("Error sending project creation notifications:", error);
    throw error;
  }
}

export async function sendProjectUpdatedNotifications(
  project: any,
  changes: string[],
): Promise<void> {
  try {
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_UPDATED,
        title: "Your project has been updated",
        message: `Your project "${project.title}" has been updated. Changes: ${changes.join(", ")}`,
        data: {
          projectId: project._id,
          changes: changes.join(", "),
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-updated", {
          projectTitle: project.title,
          projectId: project._id,
          changes: changes.join(", "),
        }),
      },
    );
  } catch (error) {
    console.error("Error sending project update notifications:", error);
    throw error;
  }
}

export async function sendProjectDeletedNotifications(
  project: any,
): Promise<void> {
  try {
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_CANCELLED,
        title: "Your project has been deleted",
        message: `Your project "${project.title}" has been deleted.`,
        data: {
          projectId: project._id,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-deleted", {
          projectTitle: project.title,
          projectId: project._id,
        }),
      },
    );
  } catch (error) {
    console.error("Error sending project deletion notifications:", error);
    throw error;
  }
}

export async function sendProjectFundingNotifications(
  project: any,
  contributor: any,
  amount: number,
): Promise<void> {
  try {
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_FUNDED,
        title: "Your project received funding!",
        message: `Your project "${project.title}" received $${amount} in funding.`,
        data: {
          projectId: project._id,
          amount: amount,
          contributorName:
            `${contributor.profile?.firstName || ""} ${contributor.profile?.lastName || ""}`.trim() ||
            "Anonymous",
          totalRaised: project.funding.raised,
          fundingGoal: project.funding.goal,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-funded", {
          projectTitle: project.title,
          projectId: project._id,
          amount: amount,
          contributorName:
            `${contributor.profile?.firstName || ""} ${contributor.profile?.lastName || ""}`.trim() ||
            "Anonymous",
          totalRaised: project.funding.raised,
          fundingGoal: project.funding.goal,
        }),
      },
    );

    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      contributor._id,
      {
        type: NotificationType.PROJECT_FUNDED,
        title: "Funding successful!",
        message: `Your $${amount} contribution to "${project.title}" was successful.`,
        data: {
          projectId: project._id,
          projectTitle: project.title,
          amount: amount,
          totalRaised: project.funding.raised,
          fundingGoal: project.funding.goal,
        },
        emailTemplate: EmailTemplatesService.getTemplate(
          "contribution-successful",
          {
            projectTitle: project.title,
            projectId: project._id,
            amount: amount,
            totalRaised: project.funding.raised,
            fundingGoal: project.funding.goal,
          },
        ),
      },
    );

    if (project.funding.raised >= project.funding.goal) {
      await NotificationService.notifyProjectCreator(
        project._id,
        project.title,
        project.creator,
        {
          type: NotificationType.PROJECT_FUNDED,
          title: "Project fully funded!",
          message: `Congratulations! Your project "${project.title}" has reached its funding goal of $${project.funding.goal}!`,
          data: {
            projectId: project._id,
            totalRaised: project.funding.raised,
            fundingGoal: project.funding.goal,
          },
          emailTemplate: EmailTemplatesService.getTemplate(
            "project-fully-funded",
            {
              projectTitle: project.title,
              projectId: project._id,
              totalRaised: project.funding.raised,
              fundingGoal: project.funding.goal,
            },
          ),
        },
      );
    }
  } catch (error) {
    console.error("Error sending project funding notifications:", error);
    throw error;
  }
}

export async function sendProjectApprovedNotifications(
  project: any,
): Promise<void> {
  try {
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_VERIFIED,
        title: "Your project has been approved!",
        message: `Your project "${project.title}" has been approved by admin and is now available for community voting.`,
        data: {
          projectId: project._id,
          projectTitle: project.title,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-approved", {
          projectTitle: project.title,
          projectId: project._id,
        }),
      },
    );
  } catch (error) {
    console.error("Error sending project approval notifications:", error);
    throw error;
  }
}

export async function sendProjectRejectedNotifications(
  project: any,
  adminNote?: string,
): Promise<void> {
  try {
    await NotificationService.notifyProjectCreator(
      project._id,
      project.title,
      project.creator,
      {
        type: NotificationType.PROJECT_REJECTED,
        title: "Your project has been rejected",
        message: `Your project "${project.title}" has been rejected by admin review.${adminNote ? ` Reason: ${adminNote}` : ""}`,
        data: {
          projectId: project._id,
          projectTitle: project.title,
          adminNote: adminNote,
        },
        emailTemplate: EmailTemplatesService.getTemplate("project-rejected", {
          projectTitle: project.title,
          projectId: project._id,
          adminNote: adminNote,
        }),
      },
    );
  } catch (error) {
    console.error("Error sending project rejection notifications:", error);
    throw error;
  }
}
