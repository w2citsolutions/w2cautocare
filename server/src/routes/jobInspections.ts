// server/src/routes/jobInspections.ts
import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { InspectionItemStatus, InspectionType } from "@prisma/client";

const router = Router();

interface CreateInspectionBody {
  templateId?: number;
  type?: InspectionType;
  name?: string;
  notes?: string;
}

/**
 * POST /jobcards/:jobCardId/inspections
 * Create an inspection for a job card.
 * If templateId provided, copies template items into JobInspectionItem.
 */
router.post(
  "/jobcards/:jobCardId/inspections",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const jobCardId = Number(req.params.jobCardId);
      if (isNaN(jobCardId)) return res.status(400).json({ message: "Invalid jobCardId" });

      const job = await prisma.jobCard.findUnique({ where: { id: jobCardId } });
      if (!job) return res.status(404).json({ message: "Job card not found" });

      const body = req.body as CreateInspectionBody;

      let template = null;
      if (body.templateId) {
        template = await prisma.inspectionTemplate.findUnique({
          where: { id: Number(body.templateId) },
          include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
        });
        if (!template) return res.status(404).json({ message: "Template not found" });
      }

      const inspection = await prisma.jobInspection.create({
        data: {
          jobCardId,
          templateId: template?.id ?? null,
          name: body.name ?? template?.name ?? null,
          type: body.type ?? null,
          notes: body.notes ?? null,
          items: {
            create: (template?.items ?? []).map((ti) => ({
              templateItemId: ti.id,
              label: ti.label,
              status: "OK",
              note: null,
            })),
          },
        },
        include: {
          items: { orderBy: [{ id: "asc" }] },
        },
      });

      return res.status(201).json(inspection);
    } catch (err) {
      console.error("Create job inspection error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * GET /jobcards/:jobCardId/inspections
 * List inspections + items
 */
router.get(
  "/jobcards/:jobCardId/inspections",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const jobCardId = Number(req.params.jobCardId);
      if (isNaN(jobCardId)) return res.status(400).json({ message: "Invalid jobCardId" });

      const inspections = await prisma.jobInspection.findMany({
        where: { jobCardId },
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: [{ id: "asc" }] },
        },
      });

      return res.json(inspections);
    } catch (err) {
      console.error("List job inspections error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

interface UpdateInspectionItemBody {
  status?: InspectionItemStatus;
  note?: string | null;
}

/**
 * PATCH /job-inspections/:inspectionId/items/:itemId
 * Update inspection item status/note
 */
router.patch(
  "/job-inspections/:inspectionId/items/:itemId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const inspectionId = Number(req.params.inspectionId);
      const itemId = Number(req.params.itemId);
      if (isNaN(inspectionId) || isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid ids" });
      }

      const body = req.body as UpdateInspectionItemBody;

      const item = await prisma.jobInspectionItem.findUnique({ where: { id: itemId } });
      if (!item || item.jobInspectionId !== inspectionId) {
        return res.status(404).json({ message: "Inspection item not found" });
      }

      const data: any = {};
      if (body.status !== undefined) data.status = body.status;
      if (body.note !== undefined) data.note = body.note;

      const updated = await prisma.jobInspectionItem.update({
        where: { id: itemId },
        data,
      });

      return res.json(updated);
    } catch (err) {
      console.error("Update inspection item error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
