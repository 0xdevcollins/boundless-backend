import { fundProject } from "../controllers.archive/blockchain.controller";
import { protect } from "../middleware/auth";
import express from "express";

const router = express.Router();

router.post("/:id/fund", protect, fundProject);
