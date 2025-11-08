import { Response } from "express";

interface checkerType {
  res: Response;
  condition: boolean | undefined | null | {};
  message: String;
  errorCode: number;
}

export const resourceChecker = (
  res: checkerType["res"],
  condition: checkerType["condition"],
  message: checkerType["message"],
  errorCode: checkerType["errorCode"],
): void | null => {
  if (condition) {
    res.status(errorCode).json({
      success: false,
      message,
    });
    return;
  }
};
