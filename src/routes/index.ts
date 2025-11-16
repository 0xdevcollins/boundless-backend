import { Router } from "express";
import authRoutes from "../features/auth/auth.route.js";
import userRoutes from "../features/users/user.route.js";
import projectIdeaRoutes from "../features/projects/project-idea.route.js";
import projectVotingRoutes from "../features/projects/project-voting.route.js";
import projectCommentRoutes from "../features/projects/project-comment.route.js";
import blogRoutes from "../features/blogs/blog.route.js";
import publicBlogRoutes from "../features/blogs/public-blog.route.js";
import commentRoutes from "../features/comments/comment.route.js";
import notificationRoutes from "../features/notifications/notification.route.js";
// import campaignRoutes from "../features/campaigns/campaign.route";
import grantRoutes from "../features/grants/grant.route.js";
import grantApplicationRoutes from "../features/grants/grant-application.route.js";
import milestoneRoutes from "../features/milestones/milestone.route.js";
import waitlistRoutes from "../features/waitlist/waitlist.route.js";
import newsletterRoutes from "../features/newsletter/newsletter.route.js";
import crowdfundingRoutes from "../features/crowdfunding/crowdfunding.route.js";
import uploadRoutes from "../features/upload/upload.route.js";
import organizationRoutes from "../features/organizations/organization.route.js";
import hackathonRoutes from "../features/hackathons/hackathon.route.js";
import publicHackathonRoutes from "../features/hackathons/public-hackathon.route.js";
import teamInvitationRoutes from "../features/team-invitations/team-invitation.route.js";
import { protect } from "../middleware/better-auth.middleware.js";

const router = Router();

// Public routes
router.use("/api", authRoutes);
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
router.use("/api/hackathons", publicHackathonRoutes); // Public hackathon routes (must be before organization routes)
router.use("/api/organizations", organizationRoutes);
router.use("/api/organizations", hackathonRoutes);
router.use("/api/notifications", protect, notificationRoutes);
router.use("/api/team-invitations", teamInvitationRoutes);

export default router;
