import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { config } from "../../config/main.config.js";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export interface UploadOptions {
  folder?: string;
  public_id?: string;
  transformation?: any;
  resource_type?: "image" | "video" | "raw" | "auto";
  quality?: "auto" | number;
  format?: string;
  width?: number;
  height?: number;
  crop?: string;
  gravity?: string;
  tags?: string[];
}

export interface UploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  created_at: string;
}

export interface TransformationOptions {
  width?: number;
  height?: number;
  crop?: string;
  gravity?: string;
  quality?: "auto" | number;
  format?: string;
  effect?: string;
  radius?: number;
  border?: string;
  background?: string;
}

class CloudinaryService {
  /**
   * Upload a file to Cloudinary
   */
  async uploadFile(
    file: Buffer | string | Readable,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      const uploadOptions = {
        folder: options.folder || "boundless",
        resource_type: options.resource_type || "auto",
        quality: options.quality || "auto",
        transformation: options.transformation,
        tags: options.tags,
        ...options,
      };

      let result;
      if (Buffer.isBuffer(file)) {
        const base64 = file.toString("base64");
        const mimeType = "image/jpeg";
        const dataUrl = `data:${mimeType};base64,${base64}`;
        result = await cloudinary.uploader.upload(dataUrl, uploadOptions);
      } else if (typeof file === "string") {
        result = await cloudinary.uploader.upload(file, uploadOptions);
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString("base64");
        const mimeType = "image/jpeg";
        const dataUrl = `data:${mimeType};base64,${base64}`;
        result = await cloudinary.uploader.upload(dataUrl, uploadOptions);
      }

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
      };
    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error}`);
    }
  }

  /**
   * Upload multiple files to Cloudinary
   */
  async uploadMultipleFiles(
    files: (Buffer | string | Readable)[],
    options: UploadOptions = {},
  ): Promise<UploadResult[]> {
    try {
      const uploadPromises = files.map((file) =>
        this.uploadFile(file, options),
      );
      return await Promise.all(uploadPromises);
    } catch (error) {
      throw new Error(`Cloudinary multiple upload failed: ${error}`);
    }
  }

  /**
   * Delete a file from Cloudinary
   */
  async deleteFile(
    publicId: string,
    resourceType: string = "image",
  ): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      return result.result === "ok";
    } catch (error) {
      throw new Error(`Cloudinary delete failed: ${error}`);
    }
  }

  /**
   * Delete multiple files from Cloudinary
   */
  async deleteMultipleFiles(
    publicIds: string[],
    resourceType: string = "image",
  ): Promise<boolean> {
    try {
      const result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType,
      });
      return result.deleted && Object.keys(result.deleted).length > 0;
    } catch (error) {
      throw new Error(`Cloudinary multiple delete failed: ${error}`);
    }
  }

  /**
   * Generate optimized image URL with transformations
   */
  generateOptimizedUrl(
    publicId: string,
    transformations: TransformationOptions = {},
  ): string {
    const defaultTransformations = {
      quality: "auto",
      format: "auto",
      ...transformations,
    };

    return cloudinary.url(publicId, {
      ...defaultTransformations,
    });
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  generateResponsiveUrls(
    publicId: string,
    baseTransformations: TransformationOptions = {},
  ) {
    const breakpoints = [
      { width: 320, suffix: "_sm" },
      { width: 640, suffix: "_md" },
      { width: 1024, suffix: "_lg" },
      { width: 1280, suffix: "_xl" },
    ];

    return breakpoints.map(({ width, suffix }) => ({
      width,
      url: this.generateOptimizedUrl(publicId, {
        ...baseTransformations,
        width,
        crop: "scale",
      }),
      suffix,
    }));
  }

  /**
   * Create image thumbnails
   */
  generateThumbnailUrl(
    publicId: string,
    width: number = 300,
    height: number = 300,
    crop: string = "fill",
  ): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop,
      quality: "auto",
      format: "auto",
    });
  }

  /**
   * Generate avatar image with circular crop
   */
  generateAvatarUrl(publicId: string, size: number = 200): string {
    return cloudinary.url(publicId, {
      width: size,
      height: size,
      crop: "fill",
      gravity: "face",
      radius: "max",
      quality: "auto",
      format: "auto",
    });
  }

  /**
   * Generate project logo with specific dimensions
   */
  generateLogoUrl(
    publicId: string,
    width: number = 400,
    height: number = 400,
  ): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: "fit",
      quality: "auto",
      format: "auto",
    });
  }

  /**
   * Generate banner image for campaigns
   */
  generateBannerUrl(
    publicId: string,
    width: number = 1200,
    height: number = 600,
  ): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: "fill",
      gravity: "auto",
      quality: "auto",
      format: "auto",
    });
  }

  /**
   * Apply watermark to image
   */
  generateWatermarkedUrl(
    publicId: string,
    watermarkPublicId: string,
    opacity: number = 50,
    position: string = "south_east",
  ): string {
    return cloudinary.url(publicId, {
      overlay: watermarkPublicId,
      opacity,
      gravity: position,
      quality: "auto",
      format: "auto",
    });
  }

  /**
   * Get file information
   */
  async getFileInfo(publicId: string, resourceType: string = "image") {
    try {
      return await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });
    } catch (error) {
      throw new Error(`Failed to get file info: ${error}`);
    }
  }

  /**
   * Search files by tags or other criteria
   */
  async searchFiles(criteria: {
    tags?: string[];
    folder?: string;
    resource_type?: string;
    max_results?: number;
  }) {
    try {
      return await cloudinary.search
        .expression(
          [
            criteria.tags ? `tags:${criteria.tags.join(" AND ")}` : "",
            criteria.folder ? `folder:${criteria.folder}` : "",
            criteria.resource_type
              ? `resource_type:${criteria.resource_type}`
              : "",
          ]
            .filter(Boolean)
            .join(" AND "),
        )
        .max_results(criteria.max_results || 10)
        .execute();
    } catch (error) {
      throw new Error(`File search failed: ${error}`);
    }
  }

  /**
   * Create a folder structure
   */
  async createFolder(folderPath: string): Promise<boolean> {
    try {
      // Cloudinary doesn't have explicit folder creation, but we can upload a placeholder
      const placeholder = await this.uploadFile(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        {
          folder: folderPath,
          public_id: ".folder_placeholder",
          resource_type: "image",
        },
      );

      // Delete the placeholder immediately
      await this.deleteFile(placeholder.public_id);
      return true;
    } catch (error) {
      throw new Error(`Failed to create folder: ${error}`);
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats() {
    try {
      return await cloudinary.api.usage();
    } catch (error) {
      throw new Error(`Failed to get usage stats: ${error}`);
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file: any, maxSize: number = 10 * 1024 * 1024): boolean {
    if (!file) return false;
    if (file.size && file.size > maxSize) return false;
    return true;
  }

  /**
   * Get supported image formats
   */
  getSupportedFormats(): string[] {
    return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"];
  }

  /**
   * Get supported video formats
   */
  getSupportedVideoFormats(): string[] {
    return ["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv"];
  }
}

export default new CloudinaryService();
