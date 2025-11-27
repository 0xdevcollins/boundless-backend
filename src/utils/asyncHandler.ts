import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler =
  (
    // eslint-disable-next-line no-unused-vars
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
