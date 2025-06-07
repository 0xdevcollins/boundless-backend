import { Request, Response } from "express";
import Blog from "../models/blog";
import BlogCategory from "../models/blog.category";
import mongoose from "mongoose";
import {
  CreateBlogRequest,
  UpdateBlogRequest,
  BlogListQuery,
  DeleteBlogRequest,
  AnalyticsQuery,
  PaginatedBlogResponse,
  BlogAnalytics,
} from "../types/blog";

export class BlogController {
  static async getAllBlogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        category,
        tag,
        author,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
        featured,
      } = req.query as BlogListQuery;

      const filter: any = {};
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (tag) filter.tags = { $in: [tag] };
      if (author) filter.authors = { $in: [author] };
      if (featured !== undefined) filter.featured = featured == true;

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { excerpt: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
        ];
      }

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(50, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [blogs, totalCount] = await Promise.all([
        Blog.find(filter)
          .populate("category", "name slug color")
          .populate("authors", "name email avatar")
          .select("-content -revisions")
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Blog.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      const response: PaginatedBlogResponse = {
        blogs,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limitNum,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      };

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error("Error fetching blogs:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching blogs",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async createBlog(req: Request, res: Response): Promise<void> {
    try {
      const blogData: CreateBlogRequest = req.body;
      const userId = req.user?.id; // Assuming auth middleware sets user

      const categoryExists = await BlogCategory.findById(blogData.category);
      if (!categoryExists) {
        res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
        return;
      }

      const blog = new Blog({
        ...blogData,
        authors: blogData.authors || [userId],
        revisions: [
          {
            version: 1,
            editedBy: userId,
            editedAt: new Date(),
            changes: "Initial creation",
          },
        ],
      });

      await blog.save();

      await BlogCategory.findByIdAndUpdate(blogData.category, {
        $inc: { postCount: 1 },
      });

      await blog.populate("category", "name slug color");
      await blog.populate("authors", "name email avatar");

      res.status(201).json({
        success: true,
        message: "Blog post created successfully",
        data: blog,
      });
    } catch (error) {
      console.error("Error creating blog:", error);
      res.status(500).json({
        success: false,
        message: "Error creating blog post",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getBlogById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid blog ID",
        });
        return;
      }

      const blog = await Blog.findById(id)
        .populate("category", "name slug description color icon")
        .populate("authors", "name email avatar bio")
        .populate("revisions.editedBy", "name email");

      if (!blog) {
        res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: blog,
      });
    } catch (error) {
      console.error("Error fetching blog:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching blog post",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async updateBlog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateBlogRequest = req.body;
      const userId = req.user?.id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid blog ID",
        });
        return;
      }

      const existingBlog = await Blog.findById(id);
      if (!existingBlog) {
        res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
        return;
      }

      if (updateData.category) {
        const categoryExists = await BlogCategory.findById(updateData.category);
        if (!categoryExists) {
          res.status(400).json({
            success: false,
            message: "Invalid category ID",
          });
          return;
        }

        if (updateData.category !== existingBlog.category.toString()) {
          await Promise.all([
            BlogCategory.findByIdAndUpdate(existingBlog.category, {
              $inc: { postCount: -1 },
            }),
            BlogCategory.findByIdAndUpdate(updateData.category, {
              $inc: { postCount: 1 },
            }),
          ]);
        }
      }

      const currentVersion = existingBlog.revisions.length + 1;
      const newRevision = {
        version: currentVersion,
        editedBy: new mongoose.Types.ObjectId(userId),
        editedAt: new Date(),
        changes:
          updateData.revisionNote || `Updated blog post (v${currentVersion})`,
      };

      const updatedBlog = await Blog.findByIdAndUpdate(
        id,
        {
          ...updateData,
          $push: { revisions: newRevision },
        },
        { new: true, runValidators: true },
      )
        .populate("category", "name slug color")
        .populate("authors", "name email avatar");

      res.status(200).json({
        success: true,
        message: "Blog post updated successfully",
        data: updatedBlog,
      });
    } catch (error) {
      console.error("Error updating blog:", error);
      res.status(500).json({
        success: false,
        message: "Error updating blog post",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async deleteBlog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        reason,
        permanent = false,
        redirectUrl,
      }: DeleteBlogRequest = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid blog ID",
        });
        return;
      }

      const blog = await Blog.findById(id);
      if (!blog) {
        res.status(404).json({
          success: false,
          message: "Blog post not found",
        });
        return;
      }

      if (permanent) {
        await Blog.findByIdAndDelete(id);

        await BlogCategory.findByIdAndUpdate(blog.category, {
          $inc: { postCount: -1 },
        });
      } else {
        await Blog.findByIdAndUpdate(id, { status: "archived" });
      }

      res.status(200).json({
        success: true,
        message: permanent
          ? "Blog post permanently deleted"
          : "Blog post archived",
        data: {
          deletedAt: new Date(),
          reason,
          permanent,
          redirectUrl,
        },
      });
    } catch (error) {
      console.error("Error deleting blog:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting blog post",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await BlogCategory.find()
        .populate("parent", "name slug")
        .populate("children", "name slug")
        .sort({ name: 1 });

      const categoriesWithHierarchy = categories.map((category) => ({
        ...category.toObject(),
        level: category.parent ? 1 : 0,
        hasChildren: category.children.length > 0,
      }));

      res.status(200).json({
        success: true,
        data: categoriesWithHierarchy,
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

  static async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const {
        startDate = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        endDate = new Date().toISOString(),
        period = "daily",
      } = req.query as AnalyticsQuery;

      const start = new Date(startDate);
      const end = new Date(endDate);

      const [totalStats, statusStats, topPosts, categoryStats] =
        await Promise.all([
          Blog.aggregate([
            {
              $group: {
                _id: null,
                totalPosts: { $sum: 1 },
                totalViews: { $sum: "$stats.views" },
                totalLikes: { $sum: "$stats.likes" },
                totalComments: { $sum: "$stats.commentCount" },
              },
            },
          ]),
          Blog.aggregate([
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ]),
          Blog.find({ status: "published" })
            .sort({ "stats.views": -1 })
            .limit(10)
            .select("title stats.views stats.likes stats.commentCount")
            .lean(),
          Blog.aggregate([
            {
              $lookup: {
                from: "blogcategories",
                localField: "category",
                foreignField: "_id",
                as: "categoryInfo",
              },
            },
            {
              $unwind: "$categoryInfo",
            },
            {
              $group: {
                _id: "$categoryInfo.name",
                postCount: { $sum: 1 },
                totalViews: { $sum: "$stats.views" },
              },
            },
            {
              $sort: { postCount: -1 },
            },
          ]),
        ]);

      const trendsMatch = {
        createdAt: { $gte: start, $lte: end },
      };

      const trends = await Blog.aggregate([
        { $match: trendsMatch },
        {
          $group: {
            _id: {
              [period]:
                period === "daily"
                  ? {
                      $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    }
                  : { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            },
            posts: { $sum: 1 },
            views: { $sum: "$stats.views" },
            likes: { $sum: "$stats.likes" },
            comments: { $sum: "$stats.commentCount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const overview = {
        totalPosts: totalStats[0]?.totalPosts || 0,
        totalViews: totalStats[0]?.totalViews || 0,
        totalLikes: totalStats[0]?.totalLikes || 0,
        totalComments: totalStats[0]?.totalComments || 0,
        publishedPosts:
          statusStats.find((s) => s._id === "published")?.count || 0,
        draftPosts: statusStats.find((s) => s._id === "draft")?.count || 0,
        archivedPosts:
          statusStats.find((s) => s._id === "archived")?.count || 0,
      };

      const totalCategoryPosts = categoryStats.reduce(
        (sum, cat) => sum + cat.postCount,
        0,
      );
      const categoryBreakdown = categoryStats.map((cat) => ({
        category: cat._id,
        postCount: cat.postCount,
        totalViews: cat.totalViews,
        percentage:
          totalCategoryPosts > 0
            ? Math.round((cat.postCount / totalCategoryPosts) * 100)
            : 0,
      }));

      const analytics: BlogAnalytics = {
        overview,
        trends: {
          [period]: trends.map((trend) => ({
            [period === "daily" ? "date" : "month"]: trend._id[period],
            posts: trend.posts,
            views: trend.views,
            likes: trend.likes,
            comments: trend.comments,
          })),
        },
        topPosts: topPosts.map((post) => ({
          id: post._id.toString(),
          title: post.title,
          views: post.stats.views,
          likes: post.stats.likes,
          comments: post.stats.commentCount,
        })),
        categoryBreakdown,
      };

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching blog analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
