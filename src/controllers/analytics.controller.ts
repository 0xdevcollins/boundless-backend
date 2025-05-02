import { Request, Response } from "express";
import Project from "../models/project.model";
import User from "../models/user.model";

const getOverview = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    const projects = await Project.find({ owner: userId });

    const totalFunding = projects.reduce(
      (acc, project) => acc + project.funding.raised,
      0,
    );
    const recentActivity = projects
      .map((project) => ({
        title: project.title,
        status: project.status,
        lastUpdated: project.updatedAt,
      }))
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
      .slice(0, 3);

    const engagement = projects.map((project) => ({
      title: project.title,
      totalVotes: project.voting.totalVotes,
      totalContributors: project.funding.contributors.length,
    }));

    res.status(200).json({
      totalFunding,
      recentActivity,
      engagement,
    });
  } catch (error) {
    console.error("Error fetching overview:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getProjectAnalytics = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(200).json({
      funding: {
        goal: project.funding.goal,
        raised: project.funding.raised,
        currency: project.funding.currency,
        endDate: project.funding.endDate,
      },
      engagement: {
        totalVotes: project.voting.totalVotes,
        positiveVotes: project.voting.positiveVotes,
        negativeVotes: project.voting.negativeVotes,
      },
    });
  } catch (error) {
    console.error("Error fetching project analytics:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getContributionsAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    const user = await User.findById(userId).populate(
      "contributedProjects.project",
    );

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const totalContributions = user.contributedProjects.length;

    res.status(200).json({
      totalContributions,
      history: user.contributedProjects,
    });
  } catch (error) {
    console.error("Error fetching contributions analytics:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getEngagementAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    const projects = await Project.find({ owner: userId });
    const totalProjects = projects.length;
    const totalVotes = projects.reduce(
      (acc, project) => acc + project.voting.totalVotes,
      0,
    );

    res.status(200).json({
      totalProjects,
      totalVotes,
    });
  } catch (error) {
    console.error("Error fetching contributions analytics:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default {
  getOverview,
  getProjectAnalytics,
  getContributionsAnalytics,
  getEngagementAnalytics,
};
