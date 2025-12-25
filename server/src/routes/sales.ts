// server/src/routes/sales.ts
// ✅ FEATURE 2: Added receivedBy field to track who received payment

import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK" | "OTHER";

interface SaleBody {
  date?: string; // ISO
  amount: number; // rupees
  category?: string;
  paymentMode: string; // CASH | UPI | CARD | BANK | OTHER
  reference?: string;
  note?: string;
  receivedBy?: string; // ✅ FEATURE 2: "Nitesh" | "Tanmeet" | "Bank Account"
}

function parsePaymentMode(input: string): PaymentMode | null {
  const upper = input.toUpperCase() as PaymentMode;
  const allowed: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK", "OTHER"];
  return allowed.includes(upper) ? upper : null;
}

/**
 * Map DB -> API
 */
function mapSale(sale: any) {
  const v = sale.currentVersion;

  return {
    id: sale.id,
    jobCardId: sale.jobCardId, // ✅ ADD THIS LINE
    createdAt: sale.createdAt,

    // Flat fields (for mobile + simpler usage)
    date: v ? v.date : null,
    amount: v ? v.amount / 100 : 0,
    category: v ? v.category : null,
    paymentMode: v ? v.paymentMode : null,
    reference: v ? v.reference : null,
    note: v ? v.note : null,
    receivedBy: v ? v.receivedBy : null, // ✅ FEATURE 2

    // Old nested structure (for existing web UI)
    currentVersion: v
      ? {
          id: v.id,
          versionNumber: v.versionNumber,
          date: v.date,
          amount: v.amount / 100,
          category: v.category,
          paymentMode: v.paymentMode,
          reference: v.reference,
          note: v.note,
          receivedBy: v.receivedBy, // ✅ FEATURE 2
          createdAt: v.createdAt,
          createdById: v.createdById,
        }
      : null,
  };
}

// POST /sales  -> create sale + first version
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { date, amount, category, paymentMode, reference, note, receivedBy } =
      req.body as SaleBody;

    if (amount == null || !paymentMode) {
      return res
        .status(400)
        .json({ message: "amount (rupees) and paymentMode are required." });
    }

    const pm = parsePaymentMode(paymentMode);
    if (!pm) {
      return res.status(400).json({
        message: `Invalid paymentMode. Allowed: CASH, UPI, CARD, BANK, OTHER`,
      });
    }

    const amountPaise = Math.round(Number(amount) * 100);
    const dt = date ? new Date(date) : new Date();

    // 1. Create Sale
    const sale = await prisma.sale.create({
      data: {},
    });

    // 2. Create first version
    const version = await prisma.saleVersion.create({
      data: {
        saleId: sale.id,
        versionNumber: 1,
        date: dt,
        amount: amountPaise,
        category: category || null,
        paymentMode: pm,
        reference: reference || null,
        note: note || null,
        receivedBy: receivedBy || null, // ✅ FEATURE 2
        createdById: req.user?.id,
      },
    });

    // 3. Update sale.currentVersionId
    const updatedSale = await prisma.sale.update({
      where: { id: sale.id },
      data: { currentVersionId: version.id },
      include: { currentVersion: true },
    });

    // Audit
    await logAudit({
      userId: req.user?.id,
      entityType: "SALE",
      entityId: sale.id,
      action: "CREATE",
      summary: `Created sale of ₹${amount} (${pm})${receivedBy ? ` - received by ${receivedBy}` : ''}`,
      details: { versionId: version.id },
    });

    return res.status(201).json(mapSale(updatedSale));
  } catch (err) {
    console.error("Create sale error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /sales?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;

    const where: any = {};
    if (from || to) {
      where.currentVersion = { date: {} as any };
      if (from) where.currentVersion.date.gte = new Date(String(from));
      if (to) {
        const end = new Date(String(to));
        end.setHours(23, 59, 59, 999);
        where.currentVersion.date.lte = end;
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: { currentVersion: true },
      orderBy: {
        currentVersion: { date: "desc" },
      },
    });

    return res.json(sales.map((s: any) => mapSale(s)));
  } catch (err) {
    console.error("List sales error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /sales/:id
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sale id" });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { currentVersion: true },
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    return res.json(mapSale(sale));
  } catch (err) {
    console.error("Get sale error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /sales/:id  -> create a new version (edit)
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sale id" });
    }

    const existing = await prisma.sale.findUnique({
      where: { id },
      include: {
        currentVersion: true,
        versions: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const { date, amount, category, paymentMode, reference, note, receivedBy } =
      req.body as SaleBody;

    if (amount == null || !paymentMode) {
      return res
        .status(400)
        .json({ message: "amount (rupees) and paymentMode are required." });
    }

    const pm = parsePaymentMode(paymentMode);
    if (!pm) {
      return res.status(400).json({
        message: `Invalid paymentMode. Allowed: CASH, UPI, CARD, BANK, OTHER`,
      });
    }

    const amountPaise = Math.round(Number(amount) * 100);
    const dt = date ? new Date(date) : new Date();

    const maxVersion =
      existing.versions.reduce(
        (m: number, v: any) => (v.versionNumber > m ? v.versionNumber : m),
        0
      ) || 0;
    const newVersionNumber = maxVersion + 1;

    const newVersion = await prisma.saleVersion.create({
      data: {
        saleId: existing.id,
        versionNumber: newVersionNumber,
        date: dt,
        amount: amountPaise,
        category: category || null,
        paymentMode: pm,
        reference: reference || null,
        note: note || null,
        receivedBy: receivedBy || null, // ✅ FEATURE 2
        createdById: req.user?.id,
      },
    });

    const updated = await prisma.sale.update({
      where: { id: existing.id },
      data: { currentVersionId: newVersion.id },
      include: { currentVersion: true },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "SALE",
      entityId: existing.id,
      action: "UPDATE",
      summary: `Updated sale to ₹${amount} (${pm})${receivedBy ? ` - received by ${receivedBy}` : ''}`,
      details: {
        previousVersionId: existing.currentVersionId,
        newVersionId: newVersion.id,
      },
    });

    return res.json(mapSale(updated));
  } catch (err) {
    console.error("Update sale error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /sales/:id/versions
router.get("/:id/versions", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sale id" });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "asc" },
        },
      },
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const versions = sale.versions.map((v: any) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      date: v.date,
      amount: v.amount / 100,
      category: v.category,
      paymentMode: v.paymentMode,
      reference: v.reference,
      note: v.note,
      receivedBy: v.receivedBy, // ✅ FEATURE 2
      createdAt: v.createdAt,
      createdById: v.createdById,
    }));

    return res.json({ saleId: sale.id, versions });
  } catch (err) {
    console.error("List sale versions error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /sales/:id  -> remove sale and all its versions
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sale id" });
    }

    const existing = await prisma.sale.findUnique({
      where: { id },
      include: { currentVersion: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Sale not found" });
    }

    await prisma.saleVersion.deleteMany({
      where: { saleId: id },
    });

    await prisma.sale.delete({
      where: { id },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "SALE",
      entityId: id,
      action: "DELETE",
      summary: "Deleted sale",
      details: {
        currentVersionId: existing.currentVersionId,
      },
    });

    return res.status(204).send();
  } catch (err: any) {
    console.error("Delete sale error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;