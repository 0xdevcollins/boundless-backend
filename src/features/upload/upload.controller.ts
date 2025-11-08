import { Request, Response } from "express";
import cloudinaryService from "../../services/storage/cloudinary.service";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|mp4|webm|mov|avi/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images and videos are allowed."));
    }
  },
});

/**
 * Upload single file
 */
export const uploadSingle = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No file provided",
      });
      return;
    }

    const { folder, tags } = req.body;
    const tagsArray = tags
      ? tags.split(",").map((tag: string) => tag.trim())
      : [];

    const result = await cloudinaryService.uploadFile(req.file.buffer, {
      folder: folder || "boundless/uploads",
      tags: tagsArray,
    });

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Upload multiple files
 */
export const uploadMultiple = async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        message: "No files provided",
      });
      return;
    }

    const { folder, tags } = req.body;
    const tagsArray = tags
      ? tags.split(",").map((tag: string) => tag.trim())
      : [];

    const files = req.files.map((file) => file.buffer);
    const results = await cloudinaryService.uploadMultipleFiles(files, {
      folder: folder || "boundless/uploads",
      tags: tagsArray,
    });

    res.status(200).json({
      success: true,
      message: "Files uploaded successfully",
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete file
 */
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const { publicId, resourceType = "image" } = req.params;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    const result = await cloudinaryService.deleteFile(publicId, resourceType);

    if (result) {
      res.status(200).json({
        success: true,
        message: "File deleted successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "File not found or already deleted",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Delete failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Generate optimized URL
 */
export const generateOptimizedUrl = async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;
    const { width, height, crop, quality, format } = req.query;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    const transformations = {
      width: width ? parseInt(width as string) : undefined,
      height: height ? parseInt(height as string) : undefined,
      crop: crop as string,
      quality:
        quality === "auto"
          ? "auto"
          : quality
            ? parseInt(quality as string)
            : "auto",
      format: format as string,
    } as const;

    const optimizedUrl = cloudinaryService.generateOptimizedUrl(
      publicId,
      transformations,
    );

    res.status(200).json({
      success: true,
      data: {
        url: optimizedUrl,
        transformations,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate optimized URL",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Generate responsive URLs
 */
export const generateResponsiveUrls = async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;
    const { width, height, crop, quality, format } = req.query;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    const baseTransformations = {
      width: width ? parseInt(width as string) : undefined,
      height: height ? parseInt(height as string) : undefined,
      crop: crop as string,
      quality:
        quality === "auto"
          ? "auto"
          : quality
            ? parseInt(quality as string)
            : "auto",
      format: format as string,
    } as const;

    const responsiveUrls = cloudinaryService.generateResponsiveUrls(
      publicId,
      baseTransformations,
    );

    res.status(200).json({
      success: true,
      data: responsiveUrls,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate responsive URLs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Generate avatar URL
 */
export const generateAvatarUrl = async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;
    const { size = 200 } = req.query;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    const avatarUrl = cloudinaryService.generateAvatarUrl(
      publicId,
      parseInt(size as string),
    );

    res.status(200).json({
      success: true,
      data: {
        url: avatarUrl,
        size: parseInt(size as string),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate avatar URL",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Generate logo URL
 */
export const generateLogoUrl = async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;
    const { width = 400, height = 400 } = req.query;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    const logoUrl = cloudinaryService.generateLogoUrl(
      publicId,
      parseInt(width as string),
      parseInt(height as string),
    );

    res.status(200).json({
      success: true,
      data: {
        url: logoUrl,
        width: parseInt(width as string),
        height: parseInt(height as string),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate logo URL",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Generate banner URL
 */
export const generateBannerUrl = async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;
    const { width = 1200, height = 600 } = req.query;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    const bannerUrl = cloudinaryService.generateBannerUrl(
      publicId,
      parseInt(width as string),
      parseInt(height as string),
    );

    res.status(200).json({
      success: true,
      data: {
        url: bannerUrl,
        width: parseInt(width as string),
        height: parseInt(height as string),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate banner URL",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get file information
 */
export const getFileInfo = async (req: Request, res: Response) => {
  try {
    const { publicId, resourceType = "image" } = req.params;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    const fileInfo = await cloudinaryService.getFileInfo(
      publicId,
      resourceType,
    );

    res.status(200).json({
      success: true,
      data: fileInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get file information",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Search files
 */
export const searchFiles = async (req: Request, res: Response) => {
  try {
    const { tags, folder, resourceType, maxResults = 10 } = req.query;

    const criteria = {
      tags: tags
        ? (tags as string).split(",").map((tag) => tag.trim())
        : undefined,
      folder: folder as string,
      resource_type: resourceType as string,
      max_results: parseInt(maxResults as string),
    };

    const results = await cloudinaryService.searchFiles(criteria);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "File search failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get usage statistics
 */
export const getUsageStats = async (req: Request, res: Response) => {
  try {
    const stats = await cloudinaryService.getUsageStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get usage statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export { upload };
