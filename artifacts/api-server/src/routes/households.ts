import { Router } from "express";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { db, householdsTable, householdMembersTable, shoppingListsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { generateInviteCode } from "../services/householdService";

const router = Router();

function isSoloHousehold(household: { inviteCode: string | null }): boolean {
  return household.inviteCode === null;
}

function formatHousehold(
  household: typeof householdsTable.$inferSelect,
  members: (typeof householdMembersTable.$inferSelect)[],
) {
  return {
    id: household.id,
    name: household.name,
    ownerId: household.ownerId,
    inviteCode: household.inviteCode,
    inviteCodeExpiresAt: household.inviteCodeExpiresAt?.toISOString() ?? null,
    maxMembers: household.maxMembers,
    createdAt: household.createdAt.toISOString(),
    updatedAt: household.updatedAt.toISOString(),
    members: members.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

router.get("/households/me", requireAuth, async (req, res): Promise<void> => {
  try {
    const householdId = req.householdId!;

    const [household] = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.id, householdId));

    if (!household) {
      res.status(404).json({ error: "Haushalt nicht gefunden" });
      return;
    }

    const members = await db
      .select()
      .from(householdMembersTable)
      .where(eq(householdMembersTable.householdId, householdId));

    res.json(formatHousehold(household, members));
  } catch (err) {
    req.log.error({ err }, "Failed to get household");
    res.status(500).json({ error: "Internal server error" });
  }
});

const createSharedSchema = z.object({
  name: z.string().min(1).max(100),
});

router.post("/households/create-shared", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const parsed = createSharedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Eingabe" });
      return;
    }

    const currentHouseholdId = req.householdId!;
    const [currentHousehold] = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.id, currentHouseholdId));

    if (currentHousehold && !isSoloHousehold(currentHousehold)) {
      res.status(400).json({ error: "Du bist bereits in einem geteilten Haushalt" });
      return;
    }

    const inviteCode = await generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const result = await db.transaction(async (tx) => {
      const [newHousehold] = await tx
        .insert(householdsTable)
        .values({
          name: parsed.data.name,
          ownerId: userId,
          inviteCode,
          inviteCodeExpiresAt: expiresAt,
        })
        .returning();

      await tx
        .delete(householdMembersTable)
        .where(eq(householdMembersTable.userId, userId));

      if (currentHousehold) {
        const remainingMembers = await tx
          .select()
          .from(householdMembersTable)
          .where(eq(householdMembersTable.householdId, currentHousehold.id));
        if (remainingMembers.length === 0) {
          await tx.delete(householdsTable).where(eq(householdsTable.id, currentHousehold.id));
        }
      }

      await tx.insert(householdMembersTable).values({
        householdId: newHousehold!.id,
        userId,
        role: "owner",
      });

      await tx
        .update(shoppingListsTable)
        .set({ householdId: newHousehold!.id })
        .where(eq(shoppingListsTable.userId, userId));

      const members = await tx
        .select()
        .from(householdMembersTable)
        .where(eq(householdMembersTable.householdId, newHousehold!.id));

      return { household: newHousehold!, members };
    });

    res.status(201).json(formatHousehold(result.household, result.members));
  } catch (err) {
    req.log.error({ err }, "Failed to create shared household");
    res.status(500).json({ error: "Internal server error" });
  }
});

const joinSchema = z.object({
  inviteCode: z.string().min(1).max(20),
});

router.post("/households/join", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültiger Code" });
      return;
    }

    const code = parsed.data.inviteCode.toUpperCase();

    const [household] = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.inviteCode, code));

    if (!household) {
      res.status(404).json({ error: "Einladungscode nicht gefunden" });
      return;
    }

    if (household.inviteCodeExpiresAt && household.inviteCodeExpiresAt < new Date()) {
      res.status(410).json({ error: "Einladungscode abgelaufen" });
      return;
    }

    const currentHouseholdId = req.householdId!;

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1 FROM households WHERE id = ${household.id} FOR UPDATE`);

      const members = await tx
        .select()
        .from(householdMembersTable)
        .where(eq(householdMembersTable.householdId, household.id));

      if (members.length >= household.maxMembers) {
        throw new JoinError("Haushalt ist voll (max. 6 Mitglieder)", 409);
      }

      const alreadyMember = members.find(m => m.userId === userId);
      if (alreadyMember) {
        throw new JoinError("Du bist bereits Mitglied dieses Haushalts", 409);
      }

      const [currentHousehold] = await tx
        .select()
        .from(householdsTable)
        .where(eq(householdsTable.id, currentHouseholdId));

      if (currentHousehold && !isSoloHousehold(currentHousehold)) {
        throw new JoinError("Du musst zuerst deinen aktuellen Haushalt verlassen", 400);
      }

      await tx
        .delete(householdMembersTable)
        .where(eq(householdMembersTable.userId, userId));

      if (currentHousehold) {
        const remainingMembers = await tx
          .select()
          .from(householdMembersTable)
          .where(eq(householdMembersTable.householdId, currentHousehold.id));
        if (remainingMembers.length === 0) {
          await tx.delete(householdsTable).where(eq(householdsTable.id, currentHousehold.id));
        }
      }

      await tx.insert(householdMembersTable).values({
        householdId: household.id,
        userId,
        role: "member",
      });

      await tx
        .update(shoppingListsTable)
        .set({ householdId: household.id })
        .where(and(eq(shoppingListsTable.userId, userId), eq(shoppingListsTable.householdId, currentHouseholdId)));

      const updatedMembers = await tx
        .select()
        .from(householdMembersTable)
        .where(eq(householdMembersTable.householdId, household.id));

      return updatedMembers;
    });

    res.json(formatHousehold(household, result));
  } catch (err) {
    if (err instanceof JoinError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to join household");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/households/regenerate-code", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const householdId = req.householdId!;

    const [household] = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.id, householdId));

    if (!household) {
      res.status(404).json({ error: "Haushalt nicht gefunden" });
      return;
    }

    if (isSoloHousehold(household)) {
      res.status(400).json({ error: "Solo-Haushalte haben keinen Einladungscode" });
      return;
    }

    if (household.ownerId !== userId) {
      res.status(403).json({ error: "Nur der Besitzer kann den Code erneuern" });
      return;
    }

    const newCode = await generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const updated = await db.transaction(async (tx) => {
      const [result] = await tx
        .update(householdsTable)
        .set({
          inviteCode: newCode,
          inviteCodeExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(householdsTable.id, householdId))
        .returning();
      return result!;
    });

    res.json({
      inviteCode: updated.inviteCode,
      inviteCodeExpiresAt: updated.inviteCodeExpiresAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to regenerate invite code");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/households/leave", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const householdId = req.householdId!;

    const [household] = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.id, householdId));

    if (!household || isSoloHousehold(household)) {
      res.status(400).json({ error: "Du bist bereits in einem Solo-Haushalt" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      await tx
        .delete(householdMembersTable)
        .where(and(
          eq(householdMembersTable.householdId, householdId),
          eq(householdMembersTable.userId, userId)
        ));

      if (household.ownerId === userId) {
        const remainingMembers = await tx
          .select()
          .from(householdMembersTable)
          .where(eq(householdMembersTable.householdId, householdId));

        if (remainingMembers.length > 0) {
          const newOwner = remainingMembers[0]!;
          await tx
            .update(householdsTable)
            .set({ ownerId: newOwner.userId, updatedAt: new Date() })
            .where(eq(householdsTable.id, householdId));
          await tx
            .update(householdMembersTable)
            .set({ role: "owner" })
            .where(eq(householdMembersTable.id, newOwner.id));
        } else {
          await tx.delete(householdsTable).where(eq(householdsTable.id, householdId));
        }
      }

      const [soloHousehold] = await tx
        .insert(householdsTable)
        .values({
          name: "Solo",
          ownerId: userId,
        })
        .returning();

      await tx.insert(householdMembersTable).values({
        householdId: soloHousehold!.id,
        userId,
        role: "owner",
      });

      await tx
        .update(shoppingListsTable)
        .set({ householdId: soloHousehold!.id })
        .where(and(eq(shoppingListsTable.userId, userId), eq(shoppingListsTable.householdId, householdId)));

      const soloMembers = await tx
        .select()
        .from(householdMembersTable)
        .where(eq(householdMembersTable.householdId, soloHousehold!.id));

      return { household: soloHousehold!, members: soloMembers };
    });

    res.json(formatHousehold(result.household, result.members));
  } catch (err) {
    req.log.error({ err }, "Failed to leave household");
    res.status(500).json({ error: "Internal server error" });
  }
});

class JoinError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default router;
