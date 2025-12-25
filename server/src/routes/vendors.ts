import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

const ALLOWED_PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK", "OTHER"] as const;
type PaymentMode = (typeof ALLOWED_PAYMENT_MODES)[number];

const ALLOWED_PAYMENT_STATUSES = ["PENDING", "PARTIAL", "PAID"] as const;
type PaymentStatus = (typeof ALLOWED_PAYMENT_STATUSES)[number];

interface VendorBody {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
}

interface VendorPaymentBody {
  date?: string;
  amount: number; // rupees
  amountPaid?: number; // rupees
  paymentMode?: string;
  invoiceNumber?: string;
  description?: string;
  dueDate?: string;
  createExpense?: boolean; // If true, creates expense when payment is made
  paidBy?: string; // ✅ NEW: "Nitesh" | "Tanmeet" | "Bank Account"
}

function parsePaymentMode(input: string): PaymentMode | null {
  const upper = input.toUpperCase();
  return (ALLOWED_PAYMENT_MODES as readonly string[]).includes(upper)
    ? (upper as PaymentMode)
    : null;
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
  return match ? match[1] : null;
}

function getCleanNote(note: string | null): string | null {
  if (!note) return null;
  return note.replace(/^\[PAID_BY:[^\]]+\]\s*/, "");
}

function calculatePaymentStatus(amount: number, amountPaid: number): PaymentStatus {
  if (amountPaid === 0) return "PENDING";
  if (amountPaid >= amount) return "PAID";
  return "PARTIAL";
}

/**
 * GET /vendors - List all vendors
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: { name: "asc" },
      include: {
        payments: {
          orderBy: { date: "desc" },
          take: 5, // Last 5 payments
        },
      },
    });

    const vendorsList = vendors.map((v) => ({
      id: v.id,
      name: v.name,
      contactName: v.contactName,
      phone: v.phone,
      email: v.email,
      address: v.address,
      gstNumber: v.gstNumber,
      totalDue: v.totalDue / 100,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      recentPayments: v.payments.map((p) => ({
        id: p.id,
        date: p.date,
        amount: p.amount / 100,
        amountPaid: p.amountPaid / 100,
        status: p.status,
        invoiceNumber: p.invoiceNumber,
      })),
    }));

    return res.json(vendorsList);
  } catch (err) {
    console.error("List vendors error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /vendors - Create new vendor
 */
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, contactName, phone, email, address, gstNumber } =
      req.body as VendorBody;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Vendor name is required" });
    }

    const vendor = await prisma.vendor.create({
      data: {
        name: name.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        gstNumber: gstNumber?.trim() || null,
        totalDue: 0,
        isActive: true,
      },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "VENDOR",
      entityId: vendor.id,
      action: "CREATE",
      summary: `Created vendor: ${vendor.name}`,
    });

    return res.status(201).json({
      id: vendor.id,
      name: vendor.name,
      contactName: vendor.contactName,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      gstNumber: vendor.gstNumber,
      totalDue: vendor.totalDue / 100,
      isActive: vendor.isActive,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
    });
  } catch (err) {
    console.error("Create vendor error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /vendors/:id - Get vendor details with payment history
 */
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid vendor id" });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { date: "desc" },
          include: {
            relatedExpense: {
              include: {
                currentVersion: true,
              },
            },
          },
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const payments = vendor.payments.map((p) => ({
      id: p.id,
      date: p.date,
      amount: p.amount / 100,
      amountPaid: p.amountPaid / 100,
      paymentMode: p.paymentMode,
      invoiceNumber: p.invoiceNumber,
      description: p.description,
      dueDate: p.dueDate,
      status: p.status,
      hasExpense: !!p.relatedExpenseId,
      expenseAmount: p.relatedExpense?.currentVersion?.amount
        ? p.relatedExpense.currentVersion.amount / 100
        : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    // Calculate summary statistics
    const totalBilled = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const pendingPayments = payments.filter((p) => p.status !== "PAID").length;

    return res.json({
      id: vendor.id,
      name: vendor.name,
      contactName: vendor.contactName,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      gstNumber: vendor.gstNumber,
      totalDue: vendor.totalDue / 100,
      isActive: vendor.isActive,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      payments,
      summary: {
        totalBilled,
        totalPaid,
        totalDue: totalBilled - totalPaid,
        pendingPayments,
      },
    });
  } catch (err) {
    console.error("Get vendor error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PUT /vendors/:id - Update vendor
 */
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid vendor id" });
    }

    const { name, contactName, phone, email, address, gstNumber, isActive } =
      req.body;

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        contactName: contactName !== undefined ? contactName?.trim() || null : existing.contactName,
        phone: phone !== undefined ? phone?.trim() || null : existing.phone,
        email: email !== undefined ? email?.trim() || null : existing.email,
        address: address !== undefined ? address?.trim() || null : existing.address,
        gstNumber: gstNumber !== undefined ? gstNumber?.trim() || null : existing.gstNumber,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "VENDOR",
      entityId: vendor.id,
      action: "UPDATE",
      summary: `Updated vendor: ${vendor.name}`,
    });

    return res.json({
      id: vendor.id,
      name: vendor.name,
      contactName: vendor.contactName,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      gstNumber: vendor.gstNumber,
      totalDue: vendor.totalDue / 100,
      isActive: vendor.isActive,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
    });
  } catch (err) {
    console.error("Update vendor error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /vendors/:id - Delete vendor
 */
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid vendor id" });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // ✅ Delete all vendor payments first (to respect FK constraints)
    if (vendor.payments.length > 0) {
      await prisma.vendorPayment.deleteMany({ where: { vendorId: id } });
    }

    await prisma.vendor.delete({ where: { id } });

    await logAudit({
      userId: req.user?.id,
      entityType: "VENDOR",
      entityId: id,
      action: "DELETE",
      summary: `Deleted vendor: ${vendor.name}`,
    });

    return res.status(204).send();
  } catch (err: any) {
    console.error("Delete vendor error:", err);
    if (err.code === "P2003") {
      return res.status(400).json({
        message: "Cannot delete vendor with related records",
      });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /vendors/:id/payments - Create vendor payment/bill
 */
router.post("/:id/payments", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const vendorId = Number(req.params.id);
    if (isNaN(vendorId)) {
      return res.status(400).json({ message: "Invalid vendor id" });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const {
      date,
      amount,
      amountPaid,
      paymentMode,
      invoiceNumber,
      description,
      dueDate,
      createExpense,
      paidBy,
    } = req.body as VendorPaymentBody;

    if (amount == null || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const amountPaise = Math.round(Number(amount) * 100);
    const amountPaidPaise = Math.round(Number(amountPaid || 0) * 100);

    if (amountPaidPaise > amountPaise) {
      return res
        .status(400)
        .json({ message: "Amount paid cannot exceed total amount" });
    }

    const dt = date ? new Date(date) : new Date();
    const dueDt = dueDate ? new Date(dueDate) : null;

    let pm: PaymentMode | null = null;
    if (paymentMode) {
      pm = parsePaymentMode(paymentMode);
      if (!pm) {
        return res.status(400).json({
          message: `Invalid paymentMode. Allowed: ${ALLOWED_PAYMENT_MODES.join(", ")}`,
        });
      }
    }

    const status = calculatePaymentStatus(amountPaise, amountPaidPaise);

    // Create vendor payment
    const payment = await prisma.vendorPayment.create({
      data: {
        vendorId,
        date: dt,
        amount: amountPaise,
        amountPaid: amountPaidPaise,
        paymentMode: pm,
        invoiceNumber: invoiceNumber?.trim() || null,
        description: description?.trim() || null,
        dueDate: dueDt,
        status,
      },
    });

    // Update vendor total due
    const dueIncrease = amountPaise - amountPaidPaise;
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        totalDue: { increment: dueIncrease },
      },
    });

    // Create expense if payment was made and requested
    let expenseId = null;
    if (createExpense && amountPaidPaise > 0 && pm) {
      const expense = await prisma.expense.create({ data: {} });

      const expenseVersion = await prisma.expenseVersion.create({
        data: {
          expenseId: expense.id,
          versionNumber: 1,
          date: dt,
          amount: amountPaidPaise,
          category: "Vendor Payment",
          vendor: vendor.name,
          paymentMode: pm,
          reference: invoiceNumber?.trim() || null,
          note: addPaidByToNote(paidBy, `Payment to ${vendor.name}${description ? `: ${description}` : ""}`),
          createdById: req.user?.id ?? null,
        },
      });

      await prisma.expense.update({
        where: { id: expense.id },
        data: { currentVersionId: expenseVersion.id },
      });

      await prisma.vendorPayment.update({
        where: { id: payment.id },
        data: { relatedExpenseId: expense.id },
      });

      expenseId = expense.id;

      await logAudit({
        userId: req.user?.id,
        entityType: "EXPENSE",
        entityId: expense.id,
        action: "CREATE",
        summary: `Auto-created expense for vendor payment: ${vendor.name}`,
      });
    }

    await logAudit({
      userId: req.user?.id,
      entityType: "VENDOR_PAYMENT",
      entityId: payment.id,
      action: "CREATE",
      summary: `Created payment for vendor ${vendor.name}: ₹${amount}`,
      details: { vendorId, expenseId },
    });

    return res.status(201).json({
      id: payment.id,
      vendorId: payment.vendorId,
      date: payment.date,
      amount: payment.amount / 100,
      amountPaid: payment.amountPaid / 100,
      paymentMode: payment.paymentMode,
      invoiceNumber: payment.invoiceNumber,
      description: payment.description,
      dueDate: payment.dueDate,
      status: payment.status,
      relatedExpenseId: expenseId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  } catch (err) {
    console.error("Create vendor payment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PUT /vendors/:vendorId/payments/:paymentId - Update vendor payment
 */
router.put(
  "/:vendorId/payments/:paymentId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const vendorId = Number(req.params.vendorId);
      const paymentId = Number(req.params.paymentId);

      if (isNaN(vendorId) || isNaN(paymentId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      const existing = await prisma.vendorPayment.findUnique({
        where: { id: paymentId },
        include: { vendor: true, relatedExpense: true },
      });

      if (!existing || existing.vendorId !== vendorId) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const {
        date,
        amount,
        amountPaid,
        paymentMode,
        invoiceNumber,
        description,
        dueDate,
        createExpense,
      paidBy,
      } = req.body as VendorPaymentBody;

      const newAmountPaise =
        amount != null ? Math.round(Number(amount) * 100) : existing.amount;
      const newAmountPaidPaise =
        amountPaid != null
          ? Math.round(Number(amountPaid) * 100)
          : existing.amountPaid;

      if (newAmountPaidPaise > newAmountPaise) {
        return res
          .status(400)
          .json({ message: "Amount paid cannot exceed total amount" });
      }

      let pm = existing.paymentMode;
      if (paymentMode !== undefined) {
        if (paymentMode === null) {
          pm = null;
        } else {
          const parsed = parsePaymentMode(paymentMode);
          if (!parsed) {
            return res.status(400).json({
              message: `Invalid paymentMode. Allowed: ${ALLOWED_PAYMENT_MODES.join(", ")}`,
            });
          }
          pm = parsed;
        }
      }

      const newStatus = calculatePaymentStatus(newAmountPaise, newAmountPaidPaise);

      // Calculate difference in due amount
      const oldDue = existing.amount - existing.amountPaid;
      const newDue = newAmountPaise - newAmountPaidPaise;
      const dueChange = newDue - oldDue;

      const payment = await prisma.vendorPayment.update({
        where: { id: paymentId },
        data: {
          date: date ? new Date(date) : undefined,
          amount: newAmountPaise,
          amountPaid: newAmountPaidPaise,
          paymentMode: pm,
          invoiceNumber:
            invoiceNumber !== undefined ? invoiceNumber?.trim() || null : undefined,
          description:
            description !== undefined ? description?.trim() || null : undefined,
          dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
          status: newStatus,
        },
      });

      // Update vendor total due
      if (dueChange !== 0) {
        await prisma.vendor.update({
          where: { id: vendorId },
          data: { totalDue: { increment: dueChange } },
        });
      }

      // Handle expense creation/update if payment was made
      const paymentIncrease = newAmountPaidPaise - existing.amountPaid;
      if (createExpense && paymentIncrease > 0 && pm) {
        if (existing.relatedExpenseId) {
          // Update existing expense
          const expense = await prisma.expense.findUnique({
            where: { id: existing.relatedExpenseId },
            include: { currentVersion: true, versions: true },
          });

          if (expense) {
            const maxVersion =
              expense.versions.reduce(
                (m: number, v: any) => (v.versionNumber > m ? v.versionNumber : m),
                0
              ) || 0;

            const newVersion = await prisma.expenseVersion.create({
              data: {
                expenseId: expense.id,
                versionNumber: maxVersion + 1,
                date: date ? new Date(date) : expense.currentVersion!.date,
                amount: newAmountPaidPaise,
                category: "Vendor Payment",
                vendor: existing.vendor.name,
                paymentMode: pm,
                reference: invoiceNumber?.trim() || null,
                note: addPaidByToNote(paidBy, `Payment to ${existing.vendor.name}${description ? `: ${description}` : ""}`),
                createdById: req.user?.id ?? null,
              },
            });

            await prisma.expense.update({
              where: { id: expense.id },
              data: { currentVersionId: newVersion.id },
            });
          }
        } else {
          // Create new expense
          const expense = await prisma.expense.create({ data: {} });

          const expenseVersion = await prisma.expenseVersion.create({
            data: {
              expenseId: expense.id,
              versionNumber: 1,
              date: date ? new Date(date) : new Date(),
              amount: newAmountPaidPaise,
              category: "Vendor Payment",
              vendor: existing.vendor.name,
              paymentMode: pm,
              reference: invoiceNumber?.trim() || null,
              note: addPaidByToNote(paidBy, `Payment to ${existing.vendor.name}${description ? `: ${description}` : ""}`),
              createdById: req.user?.id ?? null,
            },
          });

          await prisma.expense.update({
            where: { id: expense.id },
            data: { currentVersionId: expenseVersion.id },
          });

          await prisma.vendorPayment.update({
            where: { id: paymentId },
            data: { relatedExpenseId: expense.id },
          });
        }
      }

      await logAudit({
        userId: req.user?.id,
        entityType: "VENDOR_PAYMENT",
        entityId: paymentId,
        action: "UPDATE",
        summary: `Updated payment for vendor ${existing.vendor.name}`,
      });

      return res.json({
        id: payment.id,
        vendorId: payment.vendorId,
        date: payment.date,
        amount: payment.amount / 100,
        amountPaid: payment.amountPaid / 100,
        paymentMode: payment.paymentMode,
        invoiceNumber: payment.invoiceNumber,
        description: payment.description,
        dueDate: payment.dueDate,
        status: payment.status,
        relatedExpenseId: payment.relatedExpenseId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      });
    } catch (err) {
      console.error("Update vendor payment error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * DELETE /vendors/:vendorId/payments/:paymentId - Delete vendor payment
 */
router.delete(
  "/:vendorId/payments/:paymentId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const vendorId = Number(req.params.vendorId);
      const paymentId = Number(req.params.paymentId);

      if (isNaN(vendorId) || isNaN(paymentId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      const payment = await prisma.vendorPayment.findUnique({
        where: { id: paymentId },
        include: { vendor: true },
      });

      if (!payment || payment.vendorId !== vendorId) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Delete related expense if exists
      if (payment.relatedExpenseId) {
        await prisma.expenseVersion.deleteMany({
          where: { expenseId: payment.relatedExpenseId },
        });
        await prisma.expense.delete({
          where: { id: payment.relatedExpenseId },
        });

        await logAudit({
          userId: req.user?.id,
          entityType: "EXPENSE",
          entityId: payment.relatedExpenseId,
          action: "DELETE",
          summary: `Auto-deleted expense linked to vendor payment`,
        });
      }

      // Update vendor total due
      const dueDecrease = payment.amount - payment.amountPaid;
      await prisma.vendor.update({
        where: { id: vendorId },
        data: { totalDue: { decrement: dueDecrease } },
      });

      await prisma.vendorPayment.delete({ where: { id: paymentId } });

      await logAudit({
        userId: req.user?.id,
        entityType: "VENDOR_PAYMENT",
        entityId: paymentId,
        action: "DELETE",
        summary: `Deleted payment for vendor ${payment.vendor.name}`,
      });

      return res.status(204).send();
    } catch (err) {
      console.error("Delete vendor payment error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;