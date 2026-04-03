import cron from "node-cron";
import { db } from "@workspace/db";
import { userLearnedPreferencesTable } from "@workspace/db";
import { aggregateUserPreferences } from "./aggregateService";
import { logger } from "../lib/logger";

export function startCronJobs(): void {
  cron.schedule("0 3 * * 1", async () => {
    logger.info("Weekly learn aggregation job started");

    try {
      const allRows = await db.select({ userId: userLearnedPreferencesTable.userId }).from(userLearnedPreferencesTable);

      const knownUsers: string[] = allRows.map((r) => r.userId);

      let succeeded = 0;
      let failed = 0;

      for (const userId of knownUsers) {
        try {
          await aggregateUserPreferences(userId);
          succeeded++;
        } catch (err) {
          logger.error({ err, userId }, "Aggregation failed for user");
          failed++;
        }
      }

      logger.info({ succeeded, failed }, "Weekly learn aggregation job completed");
    } catch (err) {
      logger.error({ err }, "Weekly learn aggregation job failed");
    }
  });

  logger.info("Cron jobs registered (weekly learn aggregation: Mondays 03:00)");
}
