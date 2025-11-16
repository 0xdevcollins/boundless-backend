import { Express } from "express";
import { IUser } from "../models/user.model.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      file?: Express.Multer.File;
    }
  }
}
