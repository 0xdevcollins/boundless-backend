import express from "express";
import grantRoutes from "./grant.route";

const router = express.Router();

router.use("/api", grantRoutes);

export default router;
