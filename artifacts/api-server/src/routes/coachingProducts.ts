import { Router } from "express";
import { db, coachingProductsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { z } from "zod";

const router = Router();

const coachingProductCreateBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  url: z.string().max(500).optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  triggerKeywords: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

const coachingProductUpdateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  url: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  triggerKeywords: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

router.get("/admin/products", requireAdmin, async (_req, res) => {
  try {
    const products = await db
      .select()
      .from(coachingProductsTable)
      .orderBy(coachingProductsTable.id);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const [product] = await db
      .select()
      .from(coachingProductsTable)
      .where(eq(coachingProductsTable.id, id));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/products", requireAdmin, async (req, res) => {
  try {
    const parsed = coachingProductCreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Daten", details: parsed.error.flatten() });
      return;
    }
    const [product] = await db
      .insert(coachingProductsTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        url: parsed.data.url,
        tags: parsed.data.tags,
        triggerKeywords: parsed.data.triggerKeywords,
        isActive: parsed.data.isActive,
      })
      .returning();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const parsed = coachingProductUpdateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Daten", details: parsed.error.flatten() });
      return;
    }
    const [product] = await db
      .update(coachingProductsTable)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(coachingProductsTable.id, id))
      .returning();
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const [deleted] = await db
      .delete(coachingProductsTable)
      .where(eq(coachingProductsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
