import express from "express";
import {
  register,
  login,
  githubAuth,
  googleAuth,
  getMe,
  logout,
  verifyOtp,
  resendOtp,
  refreshToken,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller";
import { protect, protectWithRefresh } from "../middleware/auth";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/github", githubAuth);
router.post("/google", googleAuth);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/refresh", refreshToken);

export default router;
