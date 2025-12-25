// server/src/routes/inspectionTemplates.ts
import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /inspection-templates
 * List active templates with their items
 */
router.get("/", authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const templates = await prisma.inspectionTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });

    return res.json(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        kind: t.kind,
        description: t.description,
        isActive: t.isActive,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        items: t.items.map((i) => ({
          id: i.id,
          label: i.label,
          section: i.section,
          sortOrder: i.sortOrder,
          isCritical: i.isCritical,
        })),
      }))
    );
  } catch (err) {
    console.error("List inspection templates error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
