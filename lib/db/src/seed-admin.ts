import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { userSettingsTable } from "./schema";
import { sql } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seedAdmin() {
  const targetUserId = process.argv[2];

  if (!targetUserId) {
    console.log("Usage: npx tsx lib/db/src/seed-admin.ts <clerk-user-id>");
    console.log("\nCurrent users with admin role:");
    const admins = await db
      .select({ userId: userSettingsTable.userId, role: userSettingsTable.role })
      .from(userSettingsTable)
      .where(sql`${userSettingsTable.role} = 'admin'`);
    if (admins.length === 0) {
      console.log("  (none)");
    } else {
      for (const a of admins) {
        console.log(`  ${a.userId}`);
      }
    }
    await pool.end();
    return;
  }

  const [updated] = await db
    .update(userSettingsTable)
    .set({ role: "admin" })
    .where(sql`${userSettingsTable.userId} = ${targetUserId}`)
    .returning();

  if (updated) {
    console.log(`User ${targetUserId} has been set to admin.`);
  } else {
    console.log(`User ${targetUserId} not found in user_settings. Make sure they have logged in and completed onboarding first.`);
  }

  await pool.end();
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
