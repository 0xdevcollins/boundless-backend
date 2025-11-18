import { Request, Response } from "express";
import notificationModel from "../../models/notification.model.js";

type MarkAsReadBody = { ids: string[]; all?: boolean };

const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Query using the nested userId.type field
    const query = { "userId.type": userId };

    const notifications = await notificationModel
      .find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Count only the user's notifications
    const total = await notificationModel.countDocuments(query);

    res.status(200).json({
      data: notifications,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { ids, all }: MarkAsReadBody = req.body;

    // Query using the nested userId.type field
    const userQuery = { "userId.type": userId };

    if (all) {
      await notificationModel.updateMany(userQuery, {
        read: true,
        readAt: new Date(),
      });
    } else if (ids && ids.length > 0) {
      await notificationModel.updateMany(
        {
          _id: { $in: ids },
          ...userQuery, // Ensure user can only mark their own notifications as read
        },
        { read: true, readAt: new Date() },
      );
    } else {
      return res
        .status(400)
        .json({ message: "Either 'ids' or 'all' must be provided" });
    }

    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updatePreference = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    console.log("User ID:", userId);

    res.status(200).json({
      message: "Notification preference updated",
    });
  } catch (error) {
    console.error("Error updating notification preference:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  getNotifications,
  markAsRead,
  updatePreference,
};
