import { Request, Response } from "express";
import Project, {
  IProject,
  ProjectStatus,
} from "../models.archive/project.model";
import { v2 as cloudinary } from "cloudinary";
import { config } from "../config/main.config";
import { Types } from "mongoose";
import { Multer } from "multer";

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

interface MulterRequest extends Request {
  files?: {
    [fieldname: string]: Express.Multer.File[];
  };
  file?: Express.Multer.File;
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  [key: string]: any;
}

export const initializeProject = async (req: MulterRequest, res: Response) => {
  try {
    const { title, description, fundingGoal, category } = req.body;
    const banner = req.files?.["banner"]?.[0];
    const logo = req.files?.["logo"]?.[0];

    // Validate files
    if (!banner || !logo) {
      return res.status(400).json({ message: "Banner and logo are required" });
    }

    // Upload files to Cloudinary
    const [bannerUpload, logoUpload] = await Promise.all([
      new Promise<CloudinaryUploadResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "project-banners" }, (error, result) => {
            if (error) reject(error);
            else resolve(result as CloudinaryUploadResponse);
          })
          .end(banner.buffer);
      }),
      new Promise<CloudinaryUploadResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "project-logos" }, (error, result) => {
            if (error) reject(error);
            else resolve(result as CloudinaryUploadResponse);
          })
          .end(logo.buffer);
      }),
    ]);

    // Create project
    const project = await Project.create({
      title,
      description,
      category,
      status: ProjectStatus.DRAFT,
      owner: req.user?._id,
      funding: {
        goal: fundingGoal,
        raised: 0,
        currency: "USD",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        contributors: [],
      },
      media: {
        banner: bannerUpload.secure_url,
        logo: logoUpload.secure_url,
      },
    });

    res.status(201).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error initializing project" });
  }
};

export const updateProjectDetails = async (
  req: MulterRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { milestones, team } = req.body;
    const whitepaper = req.files?.["whitepaper"]?.[0];
    const pitchDeck = req.files?.["pitchDeck"]?.[0];

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership
    if (project.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Upload documents if provided
    let whitepaperUrl = project.documents.whitepaper;
    let pitchDeckUrl = project.documents.pitchDeck;

    if (whitepaper) {
      const upload = await new Promise<CloudinaryUploadResponse>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ folder: "project-documents" }, (error, result) => {
              if (error) reject(error);
              else resolve(result as CloudinaryUploadResponse);
            })
            .end(whitepaper.buffer);
        },
      );
      whitepaperUrl = upload.secure_url;
    }

    if (pitchDeck) {
      const upload = await new Promise<CloudinaryUploadResponse>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ folder: "project-documents" }, (error, result) => {
              if (error) reject(error);
              else resolve(result as CloudinaryUploadResponse);
            })
            .end(pitchDeck.buffer);
        },
      );
      pitchDeckUrl = upload.secure_url;
    }

    // Update project
    project.milestones = milestones.map((milestone: any) => ({
      title: milestone.title,
      description: milestone.description,
      amount: milestone.amount,
      dueDate: milestone.dueDate,
      status: "PENDING",
    }));

    project.team = team.map((member: any) => ({
      userId: member.userId,
      role: member.role,
      joinedAt: new Date(),
    }));

    project.documents = {
      whitepaper: whitepaperUrl,
      pitchDeck: pitchDeckUrl,
    };
    project.status = ProjectStatus.PENDING_DEPLOYMENT;

    await project.save();

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating project" });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await Project.find()
      .populate("owner", "username email")
      .populate("team.userId", "username email");
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching projects" });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("owner", "username email")
      .populate("team.userId", "username email")
      .populate("funding.contributors.user", "username email");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching project" });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership
    if (project.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Delete associated files from Cloudinary
    if (project.media.banner) {
      await cloudinary.uploader.destroy(project.media.banner);
    }
    if (project.media.logo) {
      await cloudinary.uploader.destroy(project.media.logo);
    }
    if (project.documents.whitepaper) {
      await cloudinary.uploader.destroy(project.documents.whitepaper);
    }
    if (project.documents.pitchDeck) {
      await cloudinary.uploader.destroy(project.documents.pitchDeck);
    }

    await Project.deleteOne({ _id: project._id });
    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting project" });
  }
};

export const addMilestone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, amount, dueDate } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership
    if (project.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Add milestone
    project.milestones.push({
      title,
      description,
      amount,
      dueDate,
      status: "PENDING",
    });

    await project.save();
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding milestone" });
  }
};

export const addTeamMember = async (req: MulterRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;
    const avatar = req.files?.["avatar"]?.[0];

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership
    if (project.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Upload avatar if provided
    let avatarUrl;
    if (avatar) {
      const upload = await new Promise<CloudinaryUploadResponse>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ folder: "team-avatars" }, (error, result) => {
              if (error) reject(error);
              else resolve(result as CloudinaryUploadResponse);
            })
            .end(avatar.buffer);
        },
      );
      avatarUrl = upload.secure_url;
    }

    // Add team member
    project.team.push({
      userId,
      role,
      joinedAt: new Date(),
    });

    await project.save();
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding team member" });
  }
};

export const uploadDocument = async (req: MulterRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const file = req.files?.["file"]?.[0];

    if (!file || !["whitepaper", "pitchDeck"].includes(type)) {
      return res.status(400).json({ message: "Invalid file or document type" });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership
    if (project.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Upload document
    const upload = await new Promise<CloudinaryUploadResponse>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "project-documents" }, (error, result) => {
            if (error) reject(error);
            else resolve(result as CloudinaryUploadResponse);
          })
          .end(file.buffer);
      },
    );

    // Update project
    if (type === "whitepaper") {
      project.documents.whitepaper = upload.secure_url;
    } else {
      project.documents.pitchDeck = upload.secure_url;
    }
    await project.save();

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error uploading document" });
  }
};
