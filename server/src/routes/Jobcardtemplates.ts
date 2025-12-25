import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

const ALLOWED_CATEGORIES = [
  "WASHING",
  "DECOR",
  "MECHANICAL",
  "DENTING_PAINTING",
  "GENERAL",
  "CUSTOM",
] as const;

const ALLOWED_LINE_TYPES = ["LABOUR", "PART", "OTHER"] as const;

type TemplateCategory = (typeof ALLOWED_CATEGORIES)[number];
type LineType = (typeof ALLOWED_LINE_TYPES)[number];

interface TemplateBody {
  name: string;
  category: string;
  description?: string;
  lineItems?: {
    lineType: string;
    description: string;
    quantity?: number;
    unitPrice: number; // rupees
    inventoryItemId?: number;
  }[];
}

interface TemplateItemBody {
  lineType: string;
  description: string;
  quantity?: number;
  unitPrice: number; // rupees
  sortOrder?: number;
  inventoryItemId?: number;
}

function parseCategory(input: string): TemplateCategory | null {
  const upper = input.toUpperCase();
  return (ALLOWED_CATEGORIES as readonly string[]).includes(upper)
    ? (upper as TemplateCategory)
    : null;
}

function parseLineType(input: string): LineType | null {
  const upper = input.toUpperCase();
  return (ALLOWED_LINE_TYPES as readonly string[]).includes(upper)
    ? (upper as LineType)
    : null;
}

/**
 * GET /job-card-templates - List all templates
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { category, active } = req.query;

    const where: any = {};
    if (category) {
      const cat = parseCategory(String(category));
      if (cat) where.category = cat;
    }
    if (active !== undefined) {
      where.isActive = active === "true" || active === "1";
    }

    const templates = await prisma.jobCardTemplate.findMany({
      where,
      include: {
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            inventoryItem: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const response = templates.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      isActive: t.isActive,
      lineItems: t.lineItems.map((item) => ({
        id: item.id,
        lineType: item.lineType,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice / 100,
        sortOrder: item.sortOrder,
        inventoryItem: item.inventoryItem,
      })),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return res.json(response);
  } catch (err) {
    console.error("List templates error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /job-card-templates - Create new template
 */
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, category, description, lineItems } = req.body as TemplateBody;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Template name is required" });
    }

    const cat = parseCategory(category);
    if (!cat) {
      return res.status(400).json({
        message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
      });
    }

    const template = await prisma.jobCardTemplate.create({
      data: {
        name: name.trim(),
        category: cat,
        description: description?.trim() || null,
        isActive: true,
      },
    });

    // Add line items if provided
    if (lineItems && lineItems.length > 0) {
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        const lineType = parseLineType(item.lineType);

        if (!lineType) {
          await prisma.jobCardTemplate.delete({ where: { id: template.id } });
          return res.status(400).json({
            message: `Invalid lineType at index ${i}. Allowed: ${ALLOWED_LINE_TYPES.join(", ")}`,
          });
        }

        await prisma.jobCardTemplateItem.create({
          data: {
            templateId: template.id,
            lineType,
            description: item.description,
            quantity: item.quantity || 1,
            unitPrice: Math.round(Number(item.unitPrice) * 100),
            sortOrder: i,
            inventoryItemId: item.inventoryItemId || null,
          },
        });
      }
    }

    const created = await prisma.jobCardTemplate.findUnique({
      where: { id: template.id },
      include: {
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            inventoryItem: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        },
      },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "JOB_CARD",
      entityId: template.id,
      action: "CREATE",
      summary: `Created job card template: ${template.name}`,
    });

    return res.status(201).json({
      id: created!.id,
      name: created!.name,
      category: created!.category,
      description: created!.description,
      isActive: created!.isActive,
      lineItems: created!.lineItems.map((item) => ({
        id: item.id,
        lineType: item.lineType,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice / 100,
        sortOrder: item.sortOrder,
        inventoryItem: item.inventoryItem,
      })),
      createdAt: created!.createdAt,
      updatedAt: created!.updatedAt,
    });
  } catch (err) {
    console.error("Create template error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /job-card-templates/:id - Get template details
 */
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const template = await prisma.jobCardTemplate.findUnique({
      where: { id },
      include: {
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            inventoryItem: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    return res.json({
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
      isActive: template.isActive,
      lineItems: template.lineItems.map((item) => ({
        id: item.id,
        lineType: item.lineType,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice / 100,
        sortOrder: item.sortOrder,
        inventoryItem: item.inventoryItem,
      })),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (err) {
    console.error("Get template error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PUT /job-card-templates/:id - Update template
 */
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const existing = await prisma.jobCardTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }

    const { name, category, description, isActive } = req.body;

    let cat = existing.category;
    if (category !== undefined) {
      const parsed = parseCategory(category);
      if (!parsed) {
        return res.status(400).json({
          message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
        });
      }
      cat = parsed;
    }

    const template = await prisma.jobCardTemplate.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        category: cat,
        description:
          description !== undefined ? description?.trim() || null : existing.description,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
      include: {
        lineItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            inventoryItem: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        },
      },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "JOB_CARD",
      entityId: id,
      action: "UPDATE",
      summary: `Updated job card template: ${template.name}`,
    });

    return res.json({
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
      isActive: template.isActive,
      lineItems: template.lineItems.map((item) => ({
        id: item.id,
        lineType: item.lineType,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice / 100,
        sortOrder: item.sortOrder,
        inventoryItem: item.inventoryItem,
      })),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (err) {
    console.error("Update template error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /job-card-templates/:id - Delete template
 */
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const template = await prisma.jobCardTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Delete template items (cascade will handle this)
    await prisma.jobCardTemplate.delete({ where: { id } });

    await logAudit({
      userId: req.user?.id,
      entityType: "JOB_CARD",
      entityId: id,
      action: "DELETE",
      summary: `Deleted job card template: ${template.name}`,
    });

    return res.status(204).send();
  } catch (err) {
    console.error("Delete template error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /job-card-templates/:id/items - Add item to template
 */
router.post(
  "/:id/items",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const templateId = Number(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template id" });
      }

      const template = await prisma.jobCardTemplate.findUnique({
        where: { id: templateId },
        include: { lineItems: true },
      });

      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const { lineType, description, quantity, unitPrice, sortOrder, inventoryItemId } =
        req.body as TemplateItemBody;

      const lt = parseLineType(lineType);
      if (!lt) {
        return res.status(400).json({
          message: `Invalid lineType. Allowed: ${ALLOWED_LINE_TYPES.join(", ")}`,
        });
      }

      const maxSortOrder =
        template.lineItems.reduce(
          (max, item) => Math.max(max, item.sortOrder),
          -1
        ) + 1;

      const item = await prisma.jobCardTemplateItem.create({
        data: {
          templateId,
          lineType: lt,
          description,
          quantity: quantity || 1,
          unitPrice: Math.round(Number(unitPrice) * 100),
          sortOrder: sortOrder !== undefined ? sortOrder : maxSortOrder,
          inventoryItemId: inventoryItemId || null,
        },
        include: {
          inventoryItem: {
            select: { id: true, name: true, sku: true, unit: true },
          },
        },
      });

      return res.status(201).json({
        id: item.id,
        lineType: item.lineType,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice / 100,
        sortOrder: item.sortOrder,
        inventoryItem: item.inventoryItem,
      });
    } catch (err) {
      console.error("Add template item error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * PUT /job-card-templates/:templateId/items/:itemId - Update template item
 */
router.put(
  "/:templateId/items/:itemId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const templateId = Number(req.params.templateId);
      const itemId = Number(req.params.itemId);

      if (isNaN(templateId) || isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      const existing = await prisma.jobCardTemplateItem.findUnique({
        where: { id: itemId },
      });

      if (!existing || existing.templateId !== templateId) {
        return res.status(404).json({ message: "Template item not found" });
      }

      const { lineType, description, quantity, unitPrice, sortOrder, inventoryItemId } =
        req.body as TemplateItemBody;

      let lt = existing.lineType;
      if (lineType !== undefined) {
        const parsed = parseLineType(lineType);
        if (!parsed) {
          return res.status(400).json({
            message: `Invalid lineType. Allowed: ${ALLOWED_LINE_TYPES.join(", ")}`,
          });
        }
        lt = parsed;
      }

      const item = await prisma.jobCardTemplateItem.update({
        where: { id: itemId },
        data: {
          lineType: lt,
          description: description || existing.description,
          quantity: quantity !== undefined ? quantity : existing.quantity,
          unitPrice:
            unitPrice !== undefined
              ? Math.round(Number(unitPrice) * 100)
              : existing.unitPrice,
          sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
          inventoryItemId:
            inventoryItemId !== undefined ? inventoryItemId || null : existing.inventoryItemId,
        },
        include: {
          inventoryItem: {
            select: { id: true, name: true, sku: true, unit: true },
          },
        },
      });

      return res.json({
        id: item.id,
        lineType: item.lineType,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice / 100,
        sortOrder: item.sortOrder,
        inventoryItem: item.inventoryItem,
      });
    } catch (err) {
      console.error("Update template item error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * DELETE /job-card-templates/:templateId/items/:itemId - Delete template item
 */
router.delete(
  "/:templateId/items/:itemId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const templateId = Number(req.params.templateId);
      const itemId = Number(req.params.itemId);

      if (isNaN(templateId) || isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      const item = await prisma.jobCardTemplateItem.findUnique({
        where: { id: itemId },
      });

      if (!item || item.templateId !== templateId) {
        return res.status(404).json({ message: "Template item not found" });
      }

      await prisma.jobCardTemplateItem.delete({ where: { id: itemId } });

      return res.status(204).send();
    } catch (err) {
      console.error("Delete template item error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;