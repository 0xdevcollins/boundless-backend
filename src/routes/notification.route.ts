import express from "express";
import notificationController from "../controllers/notification.controller";

const router = express.Router();

router.get("/", notificationController.getNotifications);
router.put("/read", notificationController.markAsRead);
router.put("/preference", notificationController.updatePreference);

export default router;
