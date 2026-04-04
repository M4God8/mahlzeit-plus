import cron from "node-cron";
import { db } from "@workspace/db";
import { mealFeedbackTable } from "@workspace/db";
import { gte } from "drizzle-orm";
import { aggregateUserPreferences } from "./aggregateService";
import { updatePricesFromOpenFoodFacts } from "./priceUpdateService";
import { logger } from "../lib/logger";

const WINDOW_WEEKS = 4;

export function startCronJobs(): void {
  cron.schedule("0 3 * * 1", async () => {
    logger.info("Weekly learn aggregation job started");

    try {
      const since = new Date();
      since.setDate(since.getDate() - WINDOW_WEEKS * 7);

      const feedbackRows = await db
        .selectDistinct({ userId: mealFeedbackTable.userId })
        .from(mealFeedbackTable)
        .where(gte(mealFeedbackTable.createdAt, since));

      const knownUsers: string[] = feedbackRows.map((r) => r.userId);

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

  cron.schedule("0 4 1,15 * *", async () => {
    logger.info("Bi-monthly price update job started (1st and 15th)");

    try {
      const result = await updatePricesFromOpenFoodFacts();
      logger.info(result, "Bi-monthly price update job completed");
    } catch (err) {
      logger.error({ err }, "Bi-monthly price update job failed");
    }
  });

  logger.info("Cron jobs registered (weekly learn aggregation: Mondays 03:00, price update: 1st & 15th 04:00)");
}
