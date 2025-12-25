// server/src/routes/payroll.ts
// ✅ COMPLETE FIXED VERSION - All errors resolved
import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

const ALLOWED_PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK", "OTHER"] as const;
type PaymentMode = (typeof ALLOWED_PAYMENT_MODES)[number];

interface CreatePeriodBody {
  name?: string;
  startDate?: string;
  endDate?: string;
}

interface PaySalaryBody {
  paymentMode: string;
  paidBy?: string;
  note?: string;
  createExpense?: boolean;
}

// ✅ Helper functions for paidBy tracking
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

function parsePaymentMode(input: string): PaymentMode | null {
  const upper = input.toUpperCase();
  return (ALLOWED_PAYMENT_MODES as readonly string[]).includes(upper)
    ? (upper as PaymentMode)
    : null;
}

// ✅ NEW: Safe number helper to prevent NaN
function safeNum(val: any): number {
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

// Helper to map DB money (paise) -> rupees
function mapPayslip(p: any) {
  return {
    id: p.id,
    employeeId: p.employeeId,
    employee: p.employee
      ? {
          id: p.employee.id,
          name: p.employee.name,
        }
      : undefined,
    grossSalary: safeNum(p.grossSalary) / 100,
    totalAdvances: safeNum(p.totalAdvances) / 100,
    otherDeductions: safeNum(p.otherDeductions) / 100,
    allowances: safeNum(p.allowances) / 100,
    netPay: safeNum(p.netPay) / 100,
    generatedAt: p.generatedAt,
    
    // ✅ Payment tracking
    paidDate: p.paidDate,
    paymentMode: p.paymentMode,
    paidBy: p.paidNote ? parsePaidBy(p.paidNote) : null,
    paymentNote: p.paidNote ? getCleanNote(p.paidNote) : null,
    relatedExpenseId: p.relatedExpenseId,

    // Unpaid leave
    unpaidLeaveDays: p.unpaidLeaveDays ?? 0,
    unpaidLeaveAmount: safeNum(p.unpaidLeaveDeduction) / 100,
  };
}

// Get default month period
function getDefaultMonthPeriod(): { name: string; start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const name = `${year}-${String(month + 1).padStart(2, "0")}`;
  return { name, start, end };
}

// POST /payroll/periods - Create payroll period
router.post("/periods", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, startDate, endDate } = req.body as CreatePeriodBody;

    let periodName = name;
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (!periodName) {
        const y = start.getFullYear();
        const m = String(start.getMonth() + 1).padStart(2, "0");
        periodName = `${y}-${m}`;
      }
    } else {
      const def = getDefaultMonthPeriod();
      periodName = periodName || def.name;
      start = def.start;
      end = def.end;
    }

    const period = await prisma.payrollPeriod.upsert({
      where: { name: periodName },
      create: {
        name: periodName,
        startDate: start,
        endDate: end,
      },
      update: {},
    });

    return res.status(201).json(period);
  } catch (err) {
    console.error("Create payroll period error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /payroll/periods
router.get("/periods", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const periods = await prisma.payrollPeriod.findMany({
      orderBy: { startDate: "desc" },
    });
    return res.json(periods);
  } catch (err) {
    console.error("Get periods error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /payroll/periods/:id/generate - Generate payslips
router.post(
  "/periods/:id/generate",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid period id" });
      }

      const period = await prisma.payrollPeriod.findUnique({
        where: { id },
      });
      if (!period) {
        return res.status(404).json({ message: "Payroll period not found" });
      }

      // ✅ FIX: Use isActive instead of active
      const employees = await prisma.employee.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });

      // Get advances in the period
      const advancesData = await prisma.advance.findMany({
        where: {
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      const advancesByEmployee = new Map<number, number>();
      for (const adv of advancesData) {
        const prev = advancesByEmployee.get(adv.employeeId) || 0;
        advancesByEmployee.set(adv.employeeId, prev + safeNum(adv.amount));
      }

      // Get unpaid leave attendance
      const unpaidAttendance = await prisma.attendance.findMany({
        where: {
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
          status: "UNPAID_LEAVE",
        },
      });

      const unpaidDaysByEmployee = new Map<number, number>();
      for (const a of unpaidAttendance) {
        const prev = unpaidDaysByEmployee.get(a.employeeId) || 0;
        unpaidDaysByEmployee.set(a.employeeId, prev + 1);
      }

      // Generate payslips
      const payslips: any[] = [];
      for (const emp of employees) {
        // ✅ FIX: Safe number conversion and validation
        const baseSalary = safeNum(emp.baseSalary);
        if (baseSalary === 0) {
          console.warn(`Employee ${emp.name} has zero base salary, skipping`);
          continue;
        }

        const totalAdv = advancesByEmployee.get(emp.id) || 0;
        const unpaidDays = unpaidDaysByEmployee.get(emp.id) || 0;

        // Calculate unpaid leave deduction
        const daysInMonth = 30;
        const perDay = Math.floor(baseSalary / daysInMonth);
        const unpaidLeaveDeduction = unpaidDays * perDay;

        // ✅ FIX: Use proper variable names and safe math
        const grossSalary = Math.max(0, baseSalary);
        const otherDeductions = unpaidLeaveDeduction;
        const allowances = 0;
        const netPay = Math.max(0, grossSalary - totalAdv - otherDeductions + allowances);

        // Upsert payslip with safe values
        const payslip = await prisma.payslip.upsert({
          where: {
            payrollPeriodId_employeeId: {
              payrollPeriodId: period.id,
              employeeId: emp.id,
            },
          },
          create: {
            payrollPeriodId: period.id,
            employeeId: emp.id,
            grossSalary,
            totalAdvances: totalAdv,
            otherDeductions,
            allowances,
            netPay,
            unpaidLeaveDays: unpaidDays,
            unpaidLeaveDeduction,
          },
          update: {
            grossSalary,
            totalAdvances: totalAdv,
            otherDeductions,
            allowances,
            netPay,
            unpaidLeaveDays: unpaidDays,
            unpaidLeaveDeduction,
          },
          include: {
            employee: true,
          },
        });

        payslips.push(payslip);
      }

      return res.json({
        message: "Payslips generated/updated",
        count: payslips.length,
        payslips: payslips.map(mapPayslip),
      });
    } catch (err) {
      console.error("Generate payslips error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// POST /payroll/periods/:id/close
router.post(
  "/periods/:id/close",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid period id" });
      }

      const period = await prisma.payrollPeriod.update({
        where: { id },
        data: { 
          status: "CLOSED",
          closedAt: new Date(),
          closedById: req.user?.id ?? null,
        },
      });

      return res.json(period);
    } catch (err) {
      console.error("Close period error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// POST /payroll/periods/:id/reopen
router.post(
  "/periods/:id/reopen",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid period id" });
      }

      const period = await prisma.payrollPeriod.update({
        where: { id },
        data: { 
          status: "OPEN",
          closedAt: null,
          closedById: null,
        },
      });

      return res.json(period);
    } catch (err) {
      console.error("Reopen period error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// GET /payroll/periods/:id/payslips
router.get(
  "/periods/:id/payslips",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const periodId = Number(req.params.id);
      if (isNaN(periodId)) {
        return res.status(400).json({ message: "Invalid period id" });
      }

      const period = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        return res.status(404).json({ message: "Payroll period not found" });
      }

      const payslips = await prisma.payslip.findMany({
        where: { payrollPeriodId: periodId },
        include: {
          employee: true,
        },
        orderBy: {
          employee: { name: "asc" },
        },
      });

      // Get advances for employees in this period
      const empIds = payslips.map((p) => p.employeeId);
      const advances = await prisma.advance.findMany({
        where: {
          employeeId: { in: empIds },
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
      });

      const advancesByEmployee = new Map<number, any[]>();
      for (const adv of advances) {
        if (!advancesByEmployee.has(adv.employeeId)) {
          advancesByEmployee.set(adv.employeeId, []);
        }
        advancesByEmployee.get(adv.employeeId)!.push({
          id: adv.id,
          date: adv.date,
          amount: safeNum(adv.amount) / 100,
          paymentMode: adv.paymentMode,
          note: getCleanNote(adv.note),
          paidBy: parsePaidBy(adv.note),
        });
      }

      const result = payslips.map((p) => {
        const advsForEmp = advancesByEmployee.get(p.employeeId) || [];

        return {
          ...mapPayslip(p),
          advances: advsForEmp,
        };
      });

      return res.json({
        period,
        payslips: result,
      });
    } catch (err) {
      console.error("Get payslips error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// POST /payroll/payslips/:id/pay - Mark as paid
router.post(
  "/payslips/:id/pay",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const payslipId = Number(req.params.id);
      if (isNaN(payslipId)) {
        return res.status(400).json({ message: "Invalid payslip id" });
      }

      const { paymentMode, paidBy, note, createExpense = true } = req.body as PaySalaryBody;

      if (!paymentMode) {
        return res.status(400).json({ message: "paymentMode is required" });
      }

      const pm = parsePaymentMode(paymentMode);
      if (!pm) {
        return res.status(400).json({
          message: `Invalid paymentMode. Allowed: ${ALLOWED_PAYMENT_MODES.join(", ")}`,
        });
      }

      const payslip = await prisma.payslip.findUnique({
        where: { id: payslipId },
        include: {
          employee: true,
          payrollPeriod: true,
        },
      });

      if (!payslip) {
        return res.status(404).json({ message: "Payslip not found" });
      }

      if (payslip.paidDate) {
        return res.status(400).json({ message: "Payslip already paid" });
      }

      // Create expense if requested
      let expenseId = null;
      if (createExpense && payslip.netPay > 0) {
        const expense = await prisma.expense.create({ data: {} });

        const expenseVersion = await prisma.expenseVersion.create({
          data: {
            expenseId: expense.id,
            versionNumber: 1,
            date: new Date(),
            amount: payslip.netPay,
            category: "Salary Payment",
            vendor: payslip.employee.name,
            paymentMode: pm,
            reference: `${payslip.payrollPeriod.name} - ${payslip.employee.name}`,
            note: addPaidByToNote(
              paidBy,
              note || `Salary for ${payslip.payrollPeriod.name}`
            ),
            createdById: req.user?.id ?? null,
          },
        });

        await prisma.expense.update({
          where: { id: expense.id },
          data: { currentVersionId: expenseVersion.id },
        });

        expenseId = expense.id;
      }

      // Update payslip
      const updated = await prisma.payslip.update({
        where: { id: payslipId },
        data: {
          paidDate: new Date(),
          paymentMode: pm,
          paidNote: addPaidByToNote(paidBy, note),
          relatedExpenseId: expenseId,
        },
        include: {
          employee: true,
        },
      });

      return res.json({
        message: "Payslip marked as paid",
        payslip: mapPayslip(updated),
        expenseId,
      });
    } catch (err) {
      console.error("Pay salary error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// POST /payroll/payslips/:id/unpay - Unmark as paid
router.post(
  "/payslips/:id/unpay",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const payslipId = Number(req.params.id);
      if (isNaN(payslipId)) {
        return res.status(400).json({ message: "Invalid payslip id" });
      }

      const payslip = await prisma.payslip.findUnique({
        where: { id: payslipId },
      });

      if (!payslip) {
        return res.status(404).json({ message: "Payslip not found" });
      }

      if (!payslip.paidDate) {
        return res.status(400).json({ message: "Payslip not paid yet" });
      }

      // Delete related expense if exists
      if (payslip.relatedExpenseId) {
        await prisma.expenseVersion.deleteMany({
          where: { expenseId: payslip.relatedExpenseId },
        });
        await prisma.expense.delete({
          where: { id: payslip.relatedExpenseId },
        });
      }

      // Update payslip
      const updated = await prisma.payslip.update({
        where: { id: payslipId },
        data: {
          paidDate: null,
          paymentMode: null,
          paidNote: null,
          relatedExpenseId: null,
        },
        include: {
          employee: true,
        },
      });

      return res.json({
        message: "Payment reverted",
        payslip: mapPayslip(updated),
      });
    } catch (err) {
      console.error("Unpay salary error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/periods/:periodId/payslips/:employeeId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const periodId = Number(req.params.periodId);
      const employeeId = Number(req.params.employeeId);

      if (isNaN(periodId) || isNaN(employeeId)) {
        return res.status(400).json({ message: "Invalid period or employee id" });
      }

      const period = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        return res.status(404).json({ message: "Payroll period not found" });
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const payslip = await prisma.payslip.findFirst({
        where: {
          payrollPeriodId: periodId,
          employeeId: employeeId,
        },
      });

      if (!payslip) {
        return res.status(404).json({ message: "Payslip not found for this employee in this period" });
      }

      // Get advances for this employee in this period
      const advances = await prisma.advance.findMany({
        where: {
          employeeId: employeeId,
          date: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      const advancesFormatted = advances.map((adv) => ({
        id: adv.id,
        date: adv.date,
        amount: safeNum(adv.amount) / 100,
        paymentMode: adv.paymentMode,
        note: getCleanNote(adv.note),
        paidBy: parsePaidBy(adv.note),
      }));

      const payslipData = {
        ...mapPayslip(payslip),
        advances: advancesFormatted,
      };

      return res.json({
        period,
        employee: {
          id: employee.id,
          name: employee.name,
          phone: employee.phone,
          address: employee.address,
        },
        payslip: payslipData,
      });
    } catch (err) {
      console.error("Get employee payslip error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);


export default router;