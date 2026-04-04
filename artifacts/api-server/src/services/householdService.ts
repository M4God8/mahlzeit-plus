import { db, householdsTable, householdMembersTable, shoppingListsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const GERMAN_WORDS = [
  "SONNE", "MOND", "STERN", "BERG", "WALD",
  "BLUME", "WOLKE", "FLUSS", "WIESE", "APFEL",
  "BIRNE", "KUCHEN", "TISCH", "STUHL", "LAMPE",
  "VOGEL", "KATZE", "HUND", "FISCH", "BAUM",
  "REGEN", "WIND", "FEUER", "STEIN", "BREZE",
  "MILCH", "HONIG", "SALAT", "NUDEL", "SUPPE",
  "LICHT", "KERZE", "HAFEN", "BROTE", "MELON",
  "TAUBE", "ADLER", "BIRKE", "EICHE", "AHORN",
];

export async function generateInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const word = GERMAN_WORDS[Math.floor(Math.random() * GERMAN_WORDS.length)]!;
    const num = Math.floor(Math.random() * 9990) + 10;
    const code = `${word}${num}`;

    const existing = await db
      .select({ id: householdsTable.id })
      .from(householdsTable)
      .where(eq(householdsTable.inviteCode, code));

    if (existing.length === 0) return code;
  }
  throw new Error("Failed to generate unique invite code after 5 attempts");
}

export async function ensureSoloHousehold(userId: string): Promise<number> {
  const existingMembership = await db
    .select({ householdId: householdMembersTable.householdId })
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));

  if (existingMembership.length > 0) {
    const householdId = existingMembership[0]!.householdId;
    await db
      .update(shoppingListsTable)
      .set({ householdId })
      .where(and(eq(shoppingListsTable.userId, userId), isNull(shoppingListsTable.householdId)));
    return householdId;
  }

  try {
    const [household] = await db
      .insert(householdsTable)
      .values({
        name: "Solo",
        ownerId: userId,
      })
      .returning();

    await db.insert(householdMembersTable).values({
      householdId: household!.id,
      userId,
      role: "owner",
    });

    await db
      .update(shoppingListsTable)
      .set({ householdId: household!.id })
      .where(and(eq(shoppingListsTable.userId, userId), isNull(shoppingListsTable.householdId)));

    return household!.id;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as Record<string, unknown>).code === "23505") {
      const retryMembership = await db
        .select({ householdId: householdMembersTable.householdId })
        .from(householdMembersTable)
        .where(eq(householdMembersTable.userId, userId));
      if (retryMembership.length > 0) {
        return retryMembership[0]!.householdId;
      }
    }
    throw err;
  }
}

export async function getUserHouseholdId(userId: string): Promise<number | null> {
  const [membership] = await db
    .select({ householdId: householdMembersTable.householdId })
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));

  return membership?.householdId ?? null;
}
