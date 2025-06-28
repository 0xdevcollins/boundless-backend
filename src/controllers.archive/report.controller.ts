import { Response, Request } from "express";
import Project from "../models.archive/project.model";
import User from "../models/user.model";

const getProjectReport = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { start, end } = req.query;

    if (!start || !end) {
      res.status(400).json({ message: "Start and end dates are required" });
      return;
    }

    const project = await Project.findById({
      _id: projectId,
      "funding.startDate": { $gte: new Date(start as string) },
      "funding.endDate": { $lte: new Date(end as string) },
    });

    res.status(200).json({
      raised: project?.funding.raised,
      goal: project?.funding.goal,
      currency: project?.funding.currency,
    });
  } catch (error) {
    console.error("Error fetching contributions analytics:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getActivityReport = async (req: Request, res: Response) => {
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
      engagement: user.contributedProjects,
    });
  } catch (error) {
    console.error("Error fetching contributions analytics:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getFundingReport = async (req: Request, res: Response) => {
  try {
    const { projectId, start, end, format } = req.query;

    if (!start || !end) {
      res.status(400).json({ message: "Start and end dates are required" });
      return;
    }

    const filter: any = {
      "funding.startDate": { $gte: new Date(start as string) },
      "funding.endDate": { $lte: new Date(end as string) },
    };

    if (projectId) {
      filter._id = projectId;
    }

    const projects = await Project.find(filter);

    if (!projects.length) {
      res.status(404).json({ message: "No projects found" });
      return;
    }

    const report = projects.map((project) => ({
      projectId: project._id,
      name: project.title,
      raised: project.funding.raised,
      goal: project.funding.goal,
      currency: project.funding.currency,
    }));

    if (format === "csv") {
      const csv = report
        .map((row) =>
          Object.values(row)
            .map((value) => "${value}")
            .join(","),
        )
        .join("\n");
      res.header("Content-Type", "text/csv");
      res.status(200).send(csv);
      return;
    }

    res.status(200).json(report);
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
