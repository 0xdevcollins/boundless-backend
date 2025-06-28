import { Request, Response } from "express";
import notificationModel from "../models/notification.model";

type MarkAsReadBody = { ids: string[]; all?: boolean };

const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const notifications = await notificationModel
      .find({ userId })
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await notificationModel.countDocuments();

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
    const { ids, all }: MarkAsReadBody = req.body;

    if (all) {
      await notificationModel.updateMany({ userId }, { read: true });
    } else if (ids && ids.length > 0) {
      await notificationModel.updateMany(
        { _id: { $in: ids }, userId },
        { read: true },
      );
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
