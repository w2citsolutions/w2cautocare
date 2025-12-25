import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

const ALLOWED_PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK", "OTHER"] as const;
type PaymentMode = (typeof ALLOWED_PAYMENT_MODES)[number];

interface ExpenseBody {
  date?: string; // ISO
  amount: number; // rupees
  category?: string;
  vendor?: string;
  paymentMode: string;
  reference?: string;
  note?: string;
  paidBy?: string; // ✅ NEW: "Nitesh" | "Tanmeet" | "Bank Account"
}

// ✅ NEW: Helper functions for paidBy tracking
function addPaidByToNote(paidBy: string | undefined, note: string | undefined): string | null {
  if (!paidBy) return note || null;
  const prefix = `[PAID_BY:${paidBy}]`;
  return note ? `${prefix} ${note}` : prefix;
}

// ✅ FIXED: Added || null to ensure return type is string | null, not string | undefined
function parsePaidBy(note: string | null): string | null {
  if (!note) return null;
  const match = note.match(/^\[PAID_BY:([^\]]+)\]/);
  return match ? (match[1] || null) : null;
}

function getCleanNote(note: string | null): string | null {
  if (!note) return null;
  return note.replace(/^\[PAID_BY:[^\]]+\]\s*/, "");
}

function parsePaymentMode(input: string): PaymentMode | null {
  const upper = input.toUpperCase();
  return (ALLOWED_PAYMENT_MODES as readonly string[]).includes(upper)
    ? (upper as PaymentMode)
    : null;
}

/**
 * Map DB -> API
 */
function mapExpense(e: any) {
  const v = e.currentVersion;

  return {
    id: e.id,
    createdAt: e.createdAt,

    date: v ? v.date : null,
    amount: v ? v.amount / 100 : 0,
    category: v ? v.category : null,
    vendor: v ? v.vendor : null,
    paymentMode: v ? v.paymentMode : null,
    reference: v ? v.reference : null,
    note: v ? getCleanNote(v.note) : null, // ✅ Return clean note
    paidBy: v ? parsePaidBy(v.note) : null, // ✅ Extract paidBy

    currentVersion: v
      ? {
          id: v.id,
          versionNumber: v.versionNumber,
          date: v.date,
          amount: v.amount / 100,
          category: v.category,
          vendor: v.vendor,
          paymentMode: v.paymentMode,
          reference: v.reference,
          note: getCleanNote(v.note), // ✅ Return clean note
          paidBy: parsePaidBy(v.note), // ✅ Extract paidBy
          createdAt: v.createdAt,
          createdById: v.createdById,
        }
      : null,
  };
}

// POST /expenses
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { date, amount, category, vendor, paymentMode, reference, note, paidBy } =
      req.body as ExpenseBody;

    if (amount == null || !paymentMode) {
      return res
        .status(400)
        .json({ message: "amount (rupees) and paymentMode are required." });
    }

    const pm = parsePaymentMode(paymentMode);
    if (!pm) {
      return res.status(400).json({
        message: `Invalid paymentMode. Allowed: ${ALLOWED_PAYMENT_MODES.join(
          ", "
        )}`,
      });
    }

    // 1. Create empty Expense
    const expense = await prisma.expense.create({
      data: {},
    });

    // 2. Create first version
    const version = await prisma.expenseVersion.create({
      data: {
        expenseId: expense.id,
        versionNumber: 1,
        date: date ? new Date(date) : new Date(),
        amount: Math.round(amount * 100), // paise
        category: category || null,
        vendor: vendor || null,
        paymentMode: pm,
        reference: reference || null,
        note: addPaidByToNote(paidBy, note), // ✅ Store paidBy in note
        createdById: req.user?.id,
      },
    });

    // 3. Link currentVersion
    await prisma.expense.update({
      where: { id: expense.id },
      data: { currentVersionId: version.id },
    });

    // 4. Audit
    await logAudit({
      userId: req.user?.id,
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "CREATE",
      summary: `Created expense: ${category || "Uncategorized"} - ₹${amount}`,
    });

    const created = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: { currentVersion: true },
    });

    return res.status(201).json(mapExpense(created));
  } catch (err) {
    console.error("POST /expenses error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /expenses
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { category, vendor, from, to } = req.query;

    const where: any = {};

    // Filter currentVersion by criteria
    if (category || vendor || from || to) {
      where.currentVersion = {};

      if (category) where.currentVersion.category = String(category);
      if (vendor) {
        where.currentVersion.vendor = {
          contains: String(vendor),
          mode: "insensitive",
        };
      }

      if (from || to) {
        where.currentVersion.date = {};
        if (from) where.currentVersion.date.gte = new Date(String(from));
        if (to) {
          const end = new Date(String(to));
          end.setHours(23, 59, 59, 999);
          where.currentVersion.date.lte = end;
        }
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { currentVersion: true },
      orderBy: { createdAt: "desc" },
    });

    const mapped = expenses.map(mapExpense);
    return res.json(mapped);
  } catch (err) {
    console.error("GET /expenses error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /expenses/:id
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid expense id" });
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        currentVersion: true,
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const result = {
      ...mapExpense(expense),
      versions: expense.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        date: v.date,
        amount: v.amount / 100,
        category: v.category,
        vendor: v.vendor,
        paymentMode: v.paymentMode,
        reference: v.reference,
        note: getCleanNote(v.note), // ✅ Clean note
        paidBy: parsePaidBy(v.note), // ✅ Extract paidBy
        createdAt: v.createdAt,
        createdById: v.createdById,
      })),
    };

    return res.json(result);
  } catch (err) {
    console.error("GET /expenses/:id error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /expenses/:id
router.put("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid expense id" });
    }

    const { date, amount, category, vendor, paymentMode, reference, note, paidBy } =
      req.body as ExpenseBody;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { currentVersion: true, versions: true },
    });

    if (!expense || !expense.currentVersion) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Validate payment mode if provided
    if (paymentMode) {
      const pm = parsePaymentMode(paymentMode);
      if (!pm) {
        return res.status(400).json({
          message: `Invalid paymentMode. Allowed: ${ALLOWED_PAYMENT_MODES.join(
            ", "
          )}`,
        });
      }
    }

    // Calculate next version number
    const maxVersion = expense.versions.reduce(
      (m: number, v: any) => (v.versionNumber > m ? v.versionNumber : m),
      0
    );
    const newVersionNumber = maxVersion + 1;

    // ✅ FIXED: Convert parsePaidBy result to string | undefined for addPaidByToNote
    const existingPaidBy = parsePaidBy(expense.currentVersion.note);
    const finalPaidBy = paidBy !== undefined ? paidBy : (existingPaidBy || undefined);
    
    const existingNote = getCleanNote(expense.currentVersion.note);
    const finalNote = note !== undefined ? note : (existingNote || undefined);

    // Create new version
    const newVersion = await prisma.expenseVersion.create({
      data: {
        expenseId: expense.id,
        versionNumber: newVersionNumber,
        date: date ? new Date(date) : expense.currentVersion.date,
        amount:
          amount != null
            ? Math.round(amount * 100)
            : expense.currentVersion.amount,
        category: category !== undefined ? category : expense.currentVersion.category,
        vendor: vendor !== undefined ? vendor : expense.currentVersion.vendor,
        paymentMode: paymentMode
          ? parsePaymentMode(paymentMode)!
          : expense.currentVersion.paymentMode,
        reference:
          reference !== undefined ? reference : expense.currentVersion.reference,
        note: addPaidByToNote(finalPaidBy, finalNote), // ✅ FIXED: Type-safe parameters
        createdById: req.user?.id,
      },
    });

    // Update currentVersion pointer
    await prisma.expense.update({
      where: { id: expense.id },
      data: { currentVersionId: newVersion.id },
    });

    // Audit
    await logAudit({
      userId: req.user?.id,
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "UPDATE",
      summary: `Updated expense to version ${newVersionNumber}`,
    });

    const updated = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: { currentVersion: true },
    });

    return res.json(mapExpense(updated));
  } catch (err) {
    console.error("PUT /expenses/:id error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /expenses/:id
router.delete("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid expense id" });
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { currentVersion: true },
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Delete all versions
    await prisma.expenseVersion.deleteMany({ where: { expenseId: id } });

    // Delete expense
    await prisma.expense.delete({ where: { id } });

    // Audit
    await logAudit({
      userId: req.user?.id,
      entityType: "EXPENSE",
      entityId: id,
      action: "DELETE",
      summary: `Deleted expense: ${expense.currentVersion?.category || "Uncategorized"}`,
    });

    return res.status(204).send();
  } catch (err) {
    console.error("DELETE /expenses/:id error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;