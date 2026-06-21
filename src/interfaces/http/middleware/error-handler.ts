import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getLogger } from "../../../shared/logger.js";

const log = getLogger("ErrorHandler");

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  log.error(
    {
      err: { message: err.message, stack: err.stack },
      traceId: req.traceId,
      method: req.method,
      path: req.path,
    },
    "Unhandled error",
  );

  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation error",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    traceId: req.traceId,
  });
}
