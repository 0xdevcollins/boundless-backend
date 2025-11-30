// Express is used in Express.Multer.File type reference below
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import { Express } from "express";
import { IUser } from "../models/user.model.js";
import { IAdmin } from "../models/admin.model.js";
import { AdminSession } from "../lib/admin-auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      admin?: IAdmin;
      adminSession?: AdminSession;
      file?: Express.Multer.File;
    }
  }
}
