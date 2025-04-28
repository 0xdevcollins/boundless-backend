import { Request, Response } from "express";
import Project from "../models/project.model";

const getOverview = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);

    const totalProjects = await Project.countDocuments();
    const projects = await Project.find()
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    res.status(200).json({
      totalProjects,
      projects,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalProjects / pageSize),
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

    res.status(200).json(project.toJSON());
  } catch (error) {
    console.error("Error fetching project analytics:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getContributionsAnalytics = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);

    const totalProjects = await Project.countDocuments();
    const projects = await Project.find()
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    res.status(200).json({
      totalProjects,
      projects,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalProjects / pageSize),
    });
  } catch (error) {
    console.error("Error fetching contributions analytics:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getEngagementAnalytics = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);

    const totalProjects = await Project.countDocuments();
    const projects = await Project.find()
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    res.status(200).json({
      totalProjects,
      projects,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalProjects / pageSize),
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
