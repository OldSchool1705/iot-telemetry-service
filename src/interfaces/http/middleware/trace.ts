import type { Request, Response, NextFunction } from "express";
import { setTraceId } from "../../../shared/logger.js";

export function traceMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const traceId =
    (req.headers["x-trace-id"] as string) ?? crypto.randomUUID();
  setTraceId(traceId);
  req.traceId = traceId;
  next();
}

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
    }
  }
}
