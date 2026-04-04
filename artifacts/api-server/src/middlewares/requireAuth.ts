import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, userSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureSoloHousehold } from "../services/householdService";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;

  db.select({ isBlocked: userSettingsTable.isBlocked })
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId))
    .then(async ([settings]) => {
      if (settings?.isBlocked) {
        res.status(403).json({ error: "Account gesperrt" });
        return;
      }
      try {
        req.householdId = await ensureSoloHousehold(userId);
      } catch (err) {
        req.log?.error?.({ err }, "Failed to ensure household");
        res.status(503).json({ error: "Service unavailable" });
        return;
      }
      next();
    })
    .catch((err) => {
      req.log?.error?.({ err }, "Failed to check blocked status");
      res.status(503).json({ error: "Service unavailable" });
    });
}
