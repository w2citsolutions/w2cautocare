// server/src/routes/advances.ts
// ✅ FEATURE 1: Auto-create/update/delete linked expenses
// ✅ FEATURE 2: Track who paid (paidBy field)

import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

const ALLOWED_PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK", "OTHER"] as const;
type PaymentMode = (typeof ALLOWED_PAYMENT_MODES)[number];

interface AdvanceBody {
  employeeId: number;
  amount: number; // rupees
  date?: string; // ISO
  paymentMode: PaymentMode | string;
  note?: string;
  paidBy?: string; // ✅ NEW: "Nitesh" | "Tanmeet" | "Bank Account"
}

// ✅ NEW: Helper functions for paidBy tracking
function addPaidByToNote(paidBy: string | undefined, note: string | undefined): string | null {
  if (!paidBy) return note || null;
  const prefix = `[PAID_BY:${paidBy}]`;
  return note ? `${prefix} ${note}` : prefix;
}

function parsePaidBy(note: string | null): string | null {
  if (!note) return null;
  const match = note.match(/^\[PAID_BY:([^\]]+)\]/);
  return match ? (match[1] || null) : null;  // Ensure null, not undefined
}

function getCleanNote(note: string | null): string | null {
  if (!note) return null;
  return note.replace(/^\[PAID_BY:[^\]]+\]\s*/, "");
}

function mapAdvance(a: any) {
  return {
    id: a.id,
    employeeId: a.employeeId,
    amount: a.amount / 100, // rupees
    date: a.date,
    paymentMode: a.paymentMode,
    note: getCleanNote(a.note), // ✅ Return clean note
    paidBy: parsePaidBy(a.note), // ✅ Extract paidBy
    createdAt: a.createdAt,
    createdById: a.createdById,
    relatedExpenseId: a.relatedExpenseId,
  };
}

function parsePaymentMode(input: string): PaymentMode | null {
  const upper = input.toUpperCase();
  return (ALLOWED_PAYMENT_MODES as readonly string[]).includes(upper)
    ? (upper as PaymentMode)
    : null;
}

// ✅ Helper: Create expense for advance
async function createExpenseForAdvance(
  advance: any,
  employeeName: string,
  userId?: number | null
) {
  // 1. Create expense
  const expense = await prisma.expense.create({
    data: {},
  });

  // 2. Create first version
  const version = await prisma.expenseVersion.create({
    data: {
      expenseId: expense.id,
      versionNumber: 1,
      date: advance.date,
      amount: advance.amount, // already in paise
      category: "Employee Advance",
      vendor: employeeName,
      paymentMode: advance.paymentMode,
      reference: `Advance #${advance.id}`,
      note: advance.note || `Advance for ${employeeName}`, // ✅ Contains paidBy if present
      createdById: userId,
    },
  });

  // 3. Link currentVersion
  await prisma.expense.update({
    where: { id: expense.id },
    data: { currentVersionId: version.id },
  });

  return expense.id;
}

// ✅ Helper: Update expense for advance
async function updateExpenseForAdvance(
  expenseId: number,
  advance: any,
  employeeName: string,
  userId?: number | null
) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { versions: true },
  });

  if (!expense) return;

  const maxVersion =
    expense.versions.reduce(
      (m: number, v: any) => (v.versionNumber > m ? v.versionNumber : m),
      0
    ) || 0;
  const newVersionNumber = maxVersion + 1;

  // Create new version
  const newVersion = await prisma.expenseVersion.create({
    data: {
      expenseId: expense.id,
      versionNumber: newVersionNumber,
      date: advance.date,
      amount: advance.amount, // paise
      category: "Employee Advance",
      vendor: employeeName,
      paymentMode: advance.paymentMode,
      reference: `Advance #${advance.id}`,
      note: advance.note || `Advance for ${employeeName}`, // ✅ Contains paidBy if present
      createdById: userId,
    },
  });

  // Update currentVersion
  await prisma.expense.update({
    where: { id: expense.id },
    data: { currentVersionId: newVersion.id },
  });
}

// ✅ Helper: Delete expense for advance
async function deleteExpenseForAdvance(expenseId: number) {
  try {
    // Delete all versions
    await prisma.expenseVersion.deleteMany({ where: { expenseId } });
    // Delete expense
    await prisma.expense.delete({ where: { id: expenseId } });
  } catch (err) {
    console.error("Error deleting expense:", err);
  }
}

/**
 * GET /advances - List all advances
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { employeeId, from, to } = req.query;

    const where: any = {};
    if (employeeId) where.employeeId = Number(employeeId);

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(String(from));
      if (to) {
        const endDate = new Date(String(to));
        endDate.setHours(23, 59, 59, 999);
        where.date.lte = endDate;
      }
    }

    const advances = await prisma.advance.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    const mapped = advances.map((a) => ({
      ...mapAdvance(a),
      employee: a.employee,
      createdBy: a.createdBy,
    }));

    return res.json(mapped);
  } catch (err) {
    console.error("GET /advances error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /advances - Create advance
 */
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const body = req.body as AdvanceBody;

    if (!body.employeeId || !body.amount) {
      return res.status(400).json({ message: "employeeId and amount required" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: body.employeeId },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const pm = parsePaymentMode(body.paymentMode);
    if (!pm) {
      return res.status(400).json({ message: "Invalid paymentMode" });
    }

    // Create advance with paidBy in note
    const advance = await prisma.advance.create({
      data: {
        employeeId: body.employeeId,
        amount: Math.round(body.amount * 100), // paise
        date: body.date ? new Date(body.date) : new Date(),
        paymentMode: pm,
        note: addPaidByToNote(body.paidBy, body.note), // ✅ Store paidBy in note
        createdById: req.user?.id,
      },
    });

    // ✅ Auto-create linked expense
    const expenseId = await createExpenseForAdvance(
      advance,
      employee.name,
      req.user?.id
    );

    // Link the expense
    await prisma.advance.update({
      where: { id: advance.id },
      data: { relatedExpenseId: expenseId },
    });

    const created = await prisma.advance.findUnique({
      where: { id: advance.id },
      include: {
        employee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      ...mapAdvance(created),
      employee: created?.employee,
      createdBy: created?.createdBy,
    });
  } catch (err) {
    console.error("POST /advances error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PUT /advances/:id - Update advance
 */
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid advance id" });
    }

    const body = req.body as AdvanceBody;

    const existing = await prisma.advance.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Advance not found" });
    }

    const data: any = {};

    if (body.amount !== undefined) {
      data.amount = Math.round(body.amount * 100);
    }
    if (body.date !== undefined) {
      data.date = body.date ? new Date(body.date) : new Date();
    }
    if (body.paymentMode !== undefined) {
      const pm = parsePaymentMode(body.paymentMode);
      if (!pm) {
        return res.status(400).json({ message: "Invalid paymentMode" });
      }
      data.paymentMode = pm;
    }
    if (body.note !== undefined || body.paidBy !== undefined) {
      // ✅ Update note with paidBy
      data.note = addPaidByToNote(body.paidBy, body.note);
    }

    const updated = await prisma.advance.update({
      where: { id },
      data,
    });

    // ✅ Update linked expense if exists
    if (existing.relatedExpenseId) {
      await updateExpenseForAdvance(
        existing.relatedExpenseId,
        updated,
        existing.employee.name,
        req.user?.id
      );
    }

    const result = await prisma.advance.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }, // ✅ FIXED: Changed username to name
      },
    });

    return res.json({
      ...mapAdvance(result),
      employee: result?.employee,
      createdBy: result?.createdBy,
    });
  } catch (err) {
    console.error("PUT /advances/:id error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /advances/:id - Delete advance
 */
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid advance id" });
    }

    const existing = await prisma.advance.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Advance not found" });
    }

    // ✅ Delete linked expense if exists
    if (existing.relatedExpenseId) {
      await deleteExpenseForAdvance(existing.relatedExpenseId);
    }

    await prisma.advance.delete({ where: { id } });

    return res.status(204).send();
  } catch (err) {
    console.error("DELETE /advances/:id error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;