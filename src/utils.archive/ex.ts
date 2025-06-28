// Typically in a file like src/types/express.d.ts
import { IUser } from "../models/user.model"; // Adjust path as needed

declare global {
  namespace Express {
    interface Request {
      Iuser: IUser; // Make sure IUser is properly defined
    }
  }
}

export interface AuthenticatedRequest extends Express.Request {
  Iuser: IUser;
}
