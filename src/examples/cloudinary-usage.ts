/**
 * Cloudinary Service Usage Examples
 *
 * This file demonstrates how to use the Cloudinary service for various operations
 */

import cloudinaryService from "../services/cloudinary.service";
import fs from "fs";
import path from "path";

// Example 1: Upload a single image
export async function uploadSingleImage() {
  try {
    // Read a local image file
    const imagePath = path.join(__dirname, "../assets/sample-image.jpg");
    const imageBuffer = fs.readFileSync(imagePath);

    const result = await cloudinaryService.uploadFile(imageBuffer, {
      folder: "boundless/projects",
      tags: ["project", "sample"],
      transformation: {
        width: 800,
        height: 600,
        crop: "fill",
        quality: "auto",
      },
    });

    console.log("Upload successful:", result);
    return result;
  } catch (error) {
    console.error("Upload failed:", error);
  }
}

// Example 2: Upload multiple images
export async function uploadMultipleImages() {
  try {
    const images = [
      fs.readFileSync(path.join(__dirname, "../assets/image1.jpg")),
      fs.readFileSync(path.join(__dirname, "../assets/image2.jpg")),
      fs.readFileSync(path.join(__dirname, "../assets/image3.jpg")),
    ];

    const results = await cloudinaryService.uploadMultipleFiles(images, {
      folder: "boundless/gallery",
      tags: ["gallery", "multiple"],
    });

    console.log("Multiple upload successful:", results);
    return results;
  } catch (error) {
    console.error("Multiple upload failed:", error);
  }
}

// Example 3: Generate optimized URLs
export function generateOptimizedUrls(publicId: string) {
  // Generate different sizes for responsive design
  const responsiveUrls = cloudinaryService.generateResponsiveUrls(publicId, {
    quality: "auto",
    format: "auto",
  });

  console.log("Responsive URLs:", responsiveUrls);

  // Generate avatar
  const avatarUrl = cloudinaryService.generateAvatarUrl(publicId, 200);
  console.log("Avatar URL:", avatarUrl);

  // Generate logo
  const logoUrl = cloudinaryService.generateLogoUrl(publicId, 400, 400);
  console.log("Logo URL:", logoUrl);

  // Generate banner
  const bannerUrl = cloudinaryService.generateBannerUrl(publicId, 1200, 600);
  console.log("Banner URL:", bannerUrl);

  return {
    responsive: responsiveUrls,
    avatar: avatarUrl,
    logo: logoUrl,
    banner: bannerUrl,
  };
}

// Example 4: Apply transformations
export function applyTransformations(publicId: string) {
  // Basic optimization
  const optimized = cloudinaryService.generateOptimizedUrl(publicId, {
    width: 800,
    height: 600,
    crop: "fill",
    quality: "auto",
    format: "auto",
  });

  // With effects
  const withEffects = cloudinaryService.generateOptimizedUrl(publicId, {
    width: 400,
    height: 400,
    crop: "fill",
    gravity: "face",
    // radius: "max",
    effect: "sepia",
    quality: "auto",
  });

  // Watermarked
  const watermarked = cloudinaryService.generateWatermarkedUrl(
    publicId,
    "boundless/watermark",
    30,
    "south_east",
  );

  console.log("Optimized:", optimized);
  console.log("With effects:", withEffects);
  console.log("Watermarked:", watermarked);

  return {
    optimized,
    withEffects,
    watermarked,
  };
}

// Example 5: File management
export async function manageFiles() {
  try {
    // Get file information
    const fileInfo = await cloudinaryService.getFileInfo(
      "boundless/projects/sample-image",
    );
    console.log("File info:", fileInfo);

    // Search files by tags
    const searchResults = await cloudinaryService.searchFiles({
      tags: ["project"],
      folder: "boundless/projects",
      max_results: 10,
    });
    console.log("Search results:", searchResults);

    // Get usage statistics
    const usageStats = await cloudinaryService.getUsageStats();
    console.log("Usage stats:", usageStats);

    return {
      fileInfo,
      searchResults,
      usageStats,
    };
  } catch (error) {
    console.error("File management failed:", error);
  }
}

// Example 6: Delete files
export async function deleteFiles() {
  try {
    // Delete single file
    const deleted = await cloudinaryService.deleteFile(
      "boundless/projects/sample-image",
    );
    console.log("File deleted:", deleted);

    // Delete multiple files
    const multipleDeleted = await cloudinaryService.deleteMultipleFiles([
      "boundless/projects/image1",
      "boundless/projects/image2",
    ]);
    console.log("Multiple files deleted:", multipleDeleted);

    return { deleted, multipleDeleted };
  } catch (error) {
    console.error("Delete failed:", error);
  }
}

// Example 7: Project-specific uploads
export class ProjectUploadService {
  /**
   * Upload project logo
   */
  static async uploadProjectLogo(imageBuffer: Buffer, projectId: string) {
    return await cloudinaryService.uploadFile(imageBuffer, {
      folder: `boundless/projects/${projectId}`,
      public_id: "logo",
      transformation: {
        width: 400,
        height: 400,
        crop: "fit",
        quality: "auto",
        format: "auto",
      },
      tags: ["project", "logo", projectId],
    });
  }

  /**
   * Upload project banner
   */
  static async uploadProjectBanner(imageBuffer: Buffer, projectId: string) {
    return await cloudinaryService.uploadFile(imageBuffer, {
      folder: `boundless/projects/${projectId}`,
      public_id: "banner",
      transformation: {
        width: 1200,
        height: 600,
        crop: "fill",
        gravity: "auto",
        quality: "auto",
        format: "auto",
      },
      tags: ["project", "banner", projectId],
    });
  }

  /**
   * Upload project gallery images
   */
  static async uploadProjectGallery(images: Buffer[], projectId: string) {
    return await cloudinaryService.uploadMultipleFiles(images, {
      folder: `boundless/projects/${projectId}/gallery`,
      transformation: {
        width: 800,
        height: 600,
        crop: "fill",
        quality: "auto",
        format: "auto",
      },
      tags: ["project", "gallery", projectId],
    });
  }

  /**
   * Generate project URLs
   */
  static generateProjectUrls(projectId: string) {
    const basePath = `boundless/projects/${projectId}`;

    return {
      logo: cloudinaryService.generateLogoUrl(`${basePath}/logo`),
      banner: cloudinaryService.generateBannerUrl(`${basePath}/banner`),
      logoThumbnail: cloudinaryService.generateThumbnailUrl(
        `${basePath}/logo`,
        100,
        100,
      ),
      bannerThumbnail: cloudinaryService.generateThumbnailUrl(
        `${basePath}/banner`,
        300,
        150,
      ),
    };
  }
}

// Example 8: User avatar service
export class UserAvatarService {
  /**
   * Upload user avatar
   */
  static async uploadAvatar(imageBuffer: Buffer, userId: string) {
    return await cloudinaryService.uploadFile(imageBuffer, {
      folder: `boundless/users/${userId}`,
      public_id: "avatar",
      transformation: {
        width: 200,
        height: 200,
        crop: "fill",
        gravity: "face",
        radius: "max",
        quality: "auto",
        format: "auto",
      },
      tags: ["user", "avatar", userId],
    });
  }

  /**
   * Generate avatar URLs for different sizes
   */
  static generateAvatarUrls(userId: string) {
    const basePath = `boundless/users/${userId}/avatar`;

    return {
      small: cloudinaryService.generateAvatarUrl(basePath, 50),
      medium: cloudinaryService.generateAvatarUrl(basePath, 100),
      large: cloudinaryService.generateAvatarUrl(basePath, 200),
      xlarge: cloudinaryService.generateAvatarUrl(basePath, 400),
    };
  }
}

// Example usage in a controller
export async function handleProjectImageUpload(req: any, res: any) {
  try {
    const { projectId } = req.params;
    const { type } = req.body; // 'logo', 'banner', or 'gallery'

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    let result;

    switch (type) {
      case "logo":
        result = await ProjectUploadService.uploadProjectLogo(
          req.file.buffer,
          projectId,
        );
        break;
      case "banner":
        result = await ProjectUploadService.uploadProjectBanner(
          req.file.buffer,
          projectId,
        );
        break;
      case "gallery":
        result = await ProjectUploadService.uploadProjectGallery(
          [req.file.buffer],
          projectId,
        );
        break;
      default:
        return res.status(400).json({ error: "Invalid upload type" });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    });
  }
}

export default {
  uploadSingleImage,
  uploadMultipleImages,
  generateOptimizedUrls,
  applyTransformations,
  manageFiles,
  deleteFiles,
  ProjectUploadService,
  UserAvatarService,
  handleProjectImageUpload,
};
