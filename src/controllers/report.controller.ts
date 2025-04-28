import { Response, Request } from "express";
import Project from "../models/project.model";

const getProjectReport = async (req: Request, res: Response) => {
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

const getActivityReport = async (req: Request, res: Response) => {
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

const getFundingReport = async (req: Request, res: Response) => {
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
  getProjectReport,
  getActivityReport,
  getFundingReport,
};
