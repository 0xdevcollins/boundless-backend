import { Router } from "express";
import authRoutes from "../features/auth/auth.route";
import userRoutes from "../features/users/user.route";
import projectIdeaRoutes from "../features/projects/project-idea.route";
import projectVotingRoutes from "../features/projects/project-voting.route";
import projectCommentRoutes from "../features/projects/project-comment.route";
import blogRoutes from "../features/blogs/blog.route";
import publicBlogRoutes from "../features/blogs/public-blog.route";
import commentRoutes from "../features/comments/comment.route";
import notificationRoutes from "../features/notifications/notification.route";
// import campaignRoutes from "../features/campaigns/campaign.route";
import grantRoutes from "../features/grants/grant.route";
import grantApplicationRoutes from "../features/grants/grant-application.route";
import milestoneRoutes from "../features/milestones/milestone.route";
import waitlistRoutes from "../features/waitlist/waitlist.route";
import newsletterRoutes from "../features/newsletter/newsletter.route";
import crowdfundingRoutes from "../features/crowdfunding/crowdfunding.route";
import uploadRoutes from "../features/upload/upload.route";
import organizationRoutes from "../features/organizations/organization.route";
import hackathonRoutes from "../features/hackathons/hackathon.route";
import teamInvitationRoutes from "../features/team-invitations/team-invitation.route";
import { authMiddleware } from "../utils/jwt.utils";

const router = Router();

// Public routes
router.use("/api/auth", authRoutes);
router.use("/api/users", userRoutes);
router.use("/api/projects", projectIdeaRoutes);
router.use("/api/projects", projectVotingRoutes);
router.use("/api/projects", projectCommentRoutes);
router.use("/api/blog", publicBlogRoutes); // Public blog routes
router.use("/api/blogs", blogRoutes); // Admin blog routes
router.use("/api/comments", commentRoutes);
// router.use("/api/campaigns", campaignRoutes);
router.use("/api/grants", grantRoutes);
router.use("/api/grant-applications", grantApplicationRoutes);
router.use("/api/milestones", milestoneRoutes);
router.use("/api/waitlist", waitlistRoutes);
router.use("/api/newsletter", newsletterRoutes);
router.use("/api/crowdfunding", crowdfundingRoutes);
router.use("/api/upload", uploadRoutes);
router.use("/api/organizations", organizationRoutes);
router.use("/api/organizations", hackathonRoutes);
router.use("/api/notifications", authMiddleware, notificationRoutes);
router.use("/api/team-invitations", teamInvitationRoutes);

export default router;
