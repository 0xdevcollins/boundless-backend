import { Request, Response } from "express";
import Blog from "../../models/blog.js";
import BlogCategory from "../../models/blog.category.js";
import Tag from "../../models/tag.model.js";

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  date: string;
  slug: string;
  category: string;
  author: {
    name: string;
    avatar: string;
    bio: string;
  };
  tags: string[];
  readTime: number;
  publishedAt: string;
  updatedAt?: string;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
}

export interface BlogListResponse {
  posts: BlogPost[];
  hasMore: boolean;
  total: number;
  currentPage: number;
  totalPages: number;
}

export interface SearchResponse {
  posts: BlogPost[];
  hasMore: boolean;
  total: number;
  query: string;
}

export class PublicBlogController {
  // GET /api/blog/posts
  static async getBlogPosts(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 12,
        category,
        search,
        sort = "latest",
        tags,
      } = req.query;

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(50, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter: any = { status: "published" };

      if (category) {
        const categoryDoc = await BlogCategory.findOne({ slug: category });
        if (categoryDoc) {
          filter.category = categoryDoc._id;
        }
      }

      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        const tagDocs = await Tag.find({ slug: { $in: tagArray } });
        if (tagDocs.length > 0) {
          filter.tags = { $in: tagDocs.map((tag) => tag._id) };
        }
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { excerpt: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
        ];
      }

      // Build sort
      let sortOptions: any = {};
      switch (sort) {
        case "latest":
          sortOptions = { publishedAt: -1 };
          break;
        case "oldest":
          sortOptions = { publishedAt: 1 };
          break;
        case "popular":
          sortOptions = { "stats.views": -1 };
          break;
        default:
          sortOptions = { publishedAt: -1 };
      }

      const [blogs, totalCount] = await Promise.all([
        Blog.find(filter)
          .populate("category", "name slug")
          .populate("authors", "name avatar bio")
          .populate("tags", "name slug")
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Blog.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const posts: BlogPost[] = blogs.map((blog: any) => ({
        id: (blog._id as any).toString(),
        title: blog.title,
        excerpt: blog.excerpt,
        content: blog.content,
        image: blog.image || "",
        date: blog.publishedAt
          ? new Date(blog.publishedAt).toLocaleDateString()
          : "",
        slug: blog.slug,
        category: (blog.category as any)?.name || "",
        author: {
          name: (blog.authors as any)?.[0]?.name || "",
          avatar: (blog.authors as any)?.[0]?.avatar || "",
          bio: (blog.authors as any)?.[0]?.bio || "",
        },
        tags: (blog.tags as any)?.map((tag: any) => tag.name) || [],
        readTime: blog.readingTime,
        publishedAt: blog.publishedAt?.toISOString() || "",
        updatedAt: blog.updatedAt?.toISOString(),
        seo: blog.seo || {},
      }));

      const response: BlogListResponse = {
        posts,
        hasMore: pageNum < totalPages,
        total: totalCount,
        currentPage: pageNum,
        totalPages,
      };

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching blog posts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // GET /api/blog/posts/[slug]
  static async getBlogPost(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      const blog = await Blog.findOne({ slug, status: "published" })
        .populate("category", "name slug description")
        .populate("authors", "name avatar bio socialLinks")
        .populate("tags", "name slug color");

      if (!blog) {
        res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
        return;
      }

      // Increment view count
      await Blog.findByIdAndUpdate(blog._id, {
        $inc: { "stats.views": 1 },
      });

      const post: BlogPost = {
        id: (blog._id as any).toString(),
        title: blog.title,
        excerpt: blog.excerpt,
        content: blog.content,
        image: blog.image || "",
        date: blog.publishedAt
          ? new Date(blog.publishedAt).toLocaleDateString()
          : "",
        slug: blog.slug,
        category: (blog.category as any)?.name || "",
        author: {
          name: (blog.authors as any)?.[0]?.name || "",
          avatar: (blog.authors as any)?.[0]?.avatar || "",
          bio: (blog.authors as any)?.[0]?.bio || "",
        },
        tags: (blog.tags as any)?.map((tag: any) => tag.name) || [],
        readTime: blog.readingTime,
        publishedAt: blog.publishedAt?.toISOString() || "",
        updatedAt: blog.updatedAt?.toISOString(),
        seo: blog.seo || {},
      };

      res.status(200).json({
        success: true,
        data: post,
      });
    } catch (error) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching blog post",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // GET /api/blog/posts/[slug]/related
  static async getRelatedPosts(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const { limit = 3 } = req.query;

      const currentBlog = await Blog.findOne({ slug, status: "published" })
        .populate("category", "name")
        .populate("tags", "name");

      if (!currentBlog) {
        res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
        return;
      }

      const limitNum = Math.min(10, Math.max(1, Number(limit)));

      // Find related posts by category and tags
      const relatedBlogs = await Blog.find({
        _id: { $ne: currentBlog._id },
        status: "published",
        $or: [
          { category: (currentBlog.category as any)._id },
          {
            tags: { $in: (currentBlog.tags as any).map((tag: any) => tag._id) },
          },
        ],
      })
        .populate("category", "name slug")
        .populate("authors", "name avatar bio")
        .populate("tags", "name slug")
        .sort({ publishedAt: -1 })
        .limit(limitNum)
        .lean();

      const posts: BlogPost[] = relatedBlogs.map((blog: any) => ({
        id: (blog._id as any).toString(),
        title: blog.title,
        excerpt: blog.excerpt,
        content: blog.content,
        image: blog.image || "",
        date: blog.publishedAt
          ? new Date(blog.publishedAt).toLocaleDateString()
          : "",
        slug: blog.slug,
        category: (blog.category as any)?.name || "",
        author: {
          name: (blog.authors as any)?.[0]?.name || "",
          avatar: (blog.authors as any)?.[0]?.avatar || "",
          bio: (blog.authors as any)?.[0]?.bio || "",
        },
        tags: (blog.tags as any)?.map((tag: any) => tag.name) || [],
        readTime: blog.readingTime,
        publishedAt: blog.publishedAt?.toISOString() || "",
        updatedAt: blog.updatedAt?.toISOString(),
        seo: blog.seo || {},
      }));

      res.status(200).json({
        success: true,
        data: posts,
      });
    } catch (error) {
      console.error("Error fetching related posts:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching related posts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // GET /api/blog/categories
  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await BlogCategory.find({ isActive: true })
        .populate("parent", "name slug")
        .sort({ name: 1 });

      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const postCount = await Blog.countDocuments({
            category: category._id,
            status: "published",
          });

          return {
            id: (category._id as any).toString(),
            name: category.name,
            slug: category.slug,
            description: category.description,
            postCount,
            color: category.color,
            icon: category.icon,
          };
        }),
      );

      res.status(200).json({
        success: true,
        data: categoriesWithCounts,
      });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching categories",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // GET /api/blog/tags
  static async getTags(req: Request, res: Response): Promise<void> {
    try {
      const tags = await Tag.find({ isActive: true })
        .sort({ postCount: -1, name: 1 })
        .limit(50);

      const tagsWithCounts = await Promise.all(
        tags.map(async (tag) => {
          const postCount = await Blog.countDocuments({
            tags: tag._id,
            status: "published",
          });

          return {
            id: (tag._id as any).toString(),
            name: tag.name,
            slug: tag.slug,
            description: tag.description,
            postCount,
            color: tag.color,
          };
        }),
      );

      res.status(200).json({
        success: true,
        data: tagsWithCounts,
      });
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching tags",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // GET /api/blog/search
  static async searchPosts(req: Request, res: Response): Promise<void> {
    try {
      const { q, page = 1, limit = 12, category, tags } = req.query;

      if (!q || typeof q !== "string") {
        res.status(400).json({
          success: false,
          message: "Search query is required",
        });
        return;
      }

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(50, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter: any = {
        status: "published",
        $or: [
          { title: { $regex: q, $options: "i" } },
          { excerpt: { $regex: q, $options: "i" } },
          { content: { $regex: q, $options: "i" } },
        ],
      };

      if (category) {
        const categoryDoc = await BlogCategory.findOne({ slug: category });
        if (categoryDoc) {
          filter.category = categoryDoc._id;
        }
      }

      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        const tagDocs = await Tag.find({ slug: { $in: tagArray } });
        if (tagDocs.length > 0) {
          filter.tags = { $in: tagDocs.map((tag) => tag._id) };
        }
      }

      const [blogs, totalCount] = await Promise.all([
        Blog.find(filter)
          .populate("category", "name slug")
          .populate("authors", "name avatar bio")
          .populate("tags", "name slug")
          .sort({ publishedAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Blog.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const posts: BlogPost[] = blogs.map((blog: any) => ({
        id: (blog._id as any).toString(),
        title: blog.title,
        excerpt: blog.excerpt,
        content: blog.content,
        image: blog.image || "",
        date: blog.publishedAt
          ? new Date(blog.publishedAt).toLocaleDateString()
          : "",
        slug: blog.slug,
        category: (blog.category as any)?.name || "",
        author: {
          name: (blog.authors as any)?.[0]?.name || "",
          avatar: (blog.authors as any)?.[0]?.avatar || "",
          bio: (blog.authors as any)?.[0]?.bio || "",
        },
        tags: (blog.tags as any)?.map((tag: any) => tag.name) || [],
        readTime: blog.readingTime,
        publishedAt: blog.publishedAt?.toISOString() || "",
        updatedAt: blog.updatedAt?.toISOString(),
        seo: blog.seo || {},
      }));

      const response: SearchResponse = {
        posts,
        hasMore: pageNum < totalPages,
        total: totalCount,
        query: q,
      };

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error("Error searching posts:", error);
      res.status(500).json({
        success: false,
        message: "Error searching posts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
