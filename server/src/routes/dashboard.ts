import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseDateRange(from?: any, to?: any) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let start = new Date(year, month, 1, 0, 0, 0, 0);
  let end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  if (from) {
    const raw = Array.isArray(from) ? from[0] : from;
    const f = new Date(String(raw));
    if (!isNaN(f.getTime())) {
      start = f;
      start.setHours(0, 0, 0, 0);
    }
  }

  if (to) {
    const raw = Array.isArray(to) ? to[0] : to;
    const t = new Date(String(raw));
    if (!isNaN(t.getTime())) {
      end = t;
      end.setHours(23, 59, 59, 999);
    }
  }

  return { start, end };
}

function paiseToRupees(amount: number | null | undefined) {
  if (!amount) return 0;
  return Math.round(amount) / 100;
}

// Add this helper at the top of the file:
function parsePaidBy(note: string | null): string | null {
  if (!note) return null;
  const match = note.match(/^\[PAID_BY:([^\]]+)\]/);
  return match ? (match[1] || null) : null;
}

function computeCurrentStockForItem(
  transactions: { type: "IN" | "OUT"; quantity: number }[]
) {
  let stock = 0;
  for (const t of transactions) {
    if (t.type === "IN") stock += t.quantity;
    else stock -= t.quantity;
  }
  return stock;
}

/**
 * GET /dashboard - Comprehensive 360° Business Dashboard
 * ✅ UPDATED: Works with new sales structure (no currentVersion)
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    const { start, end } = parseDateRange(from, to);

    // ============================================
    // 1. SALES ANALYTICS
    // ✅ FIXED: Sales still use currentVersion pattern
    // ============================================
    const sales = await prisma.sale.findMany({
      where: {
        currentVersion: {
          date: {
            gte: start,
            lte: end,
          },
        },
      },
      include: {
        currentVersion: true,
      },
    });

    let totalSalesPaise = 0;
    const salesByDate = new Map<string, number>();
    const salesByMode = new Map<string, number>();
    const salesByReceiver = new Map<string, number>();
    const salesByCategory = new Map<string, number>();

    for (const s of sales) {
      const v = s.currentVersion;
      if (!v) continue;

      totalSalesPaise += v.amount;

      const date = v.date.toISOString().slice(0, 10);
      salesByDate.set(date, (salesByDate.get(date) || 0) + v.amount);

      salesByMode.set(v.paymentMode, (salesByMode.get(v.paymentMode) || 0) + v.amount);

      const receiver = v.receivedBy || "Untracked";
      salesByReceiver.set(receiver, (salesByReceiver.get(receiver) || 0) + v.amount);

      const category = v.category || "General";
      salesByCategory.set(category, (salesByCategory.get(category) || 0) + v.amount);
    }

    // ============================================
    // 2. EXPENSES ANALYTICS
    // ============================================
    const expenses = await prisma.expense.findMany({
      where: {
        currentVersion: {
          date: { gte: start, lte: end },
        },
      },
      include: { currentVersion: true },
    });

    let totalExpensesPaise = 0;
    let totalEmployeeAdvancesPaise = 0;
    const expensesByDate = new Map<string, number>();
    const expensesByCategory = new Map<string, number>();
    const expensesByPaidBy = new Map<string, number>();
    const expensesByVendor = new Map<string, number>();
    const employeeAdvances = new Map<string, number>();

    for (const e of expenses) {
      const v = e.currentVersion;
      if (!v) continue;

      const isEmployeeAdvance = v.category === "Employee Advance";

      if (isEmployeeAdvance) {
        // ✅ Track employee advances separately
        totalEmployeeAdvancesPaise += v.amount;
        const employeeName = v.vendor || "Unknown Employee";
        employeeAdvances.set(employeeName, (employeeAdvances.get(employeeName) || 0) + v.amount);
      } else {
        // ✅ Track regular expenses only
        totalExpensesPaise += v.amount;

        const date = v.date.toISOString().slice(0, 10);
        expensesByDate.set(date, (expensesByDate.get(date) || 0) + v.amount);

        const category = v.category || "General";
        expensesByCategory.set(category, (expensesByCategory.get(category) || 0) + v.amount);

        const paidBy = parsePaidBy(v.note) || "Untracked";
        expensesByPaidBy.set(paidBy, (expensesByPaidBy.get(paidBy) || 0) + v.amount);

        const vendor = v.vendor || "Direct";
        expensesByVendor.set(vendor, (expensesByVendor.get(vendor) || 0) + v.amount);
      }
    }

    // ============================================
    // 3. CASH FLOW TRACKING
    // ============================================
    const cashFlow: any = {
      Nitesh: { received: 0, paid: 0, net: 0 },
      Tanmeet: { received: 0, paid: 0, net: 0 },
      "Bank Account": { received: 0, paid: 0, net: 0 },
    };

    salesByReceiver.forEach((amount, person) => {
      if (cashFlow[person]) cashFlow[person].received += amount;
    });

    expensesByPaidBy.forEach((amount, person) => {
      if (cashFlow[person]) cashFlow[person].paid += amount;
    });

    Object.keys(cashFlow).forEach((person) => {
      cashFlow[person].net = cashFlow[person].received - cashFlow[person].paid;
      cashFlow[person].received = paiseToRupees(cashFlow[person].received);
      cashFlow[person].paid = paiseToRupees(cashFlow[person].paid);
      cashFlow[person].net = paiseToRupees(cashFlow[person].net);
    });

    // ============================================
    // 4. JOB CARDS ANALYTICS
    // ============================================
    const jobCards = await prisma.jobCard.findMany({
      where: { inDate: { gte: start, lte: end } },
      include: {
        vehicle: true,
        lineItems: true,
        payments: true,
      },
    });

    const jobStats = {
      total: jobCards.length,
      open: 0,
      inProgress: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: 0,
      totalAdvances: 0,
      totalPending: 0,
      avgJobValue: 0,
      labourTotal: 0,
      partsTotal: 0,
    };

    const jobsByStatus = new Map<string, number>();
    const jobsByMake = new Map<string, number>();
    const topCustomers = new Map<string, { count: number; revenue: number }>();

    for (const job of jobCards) {
      jobStats[job.status.toLowerCase() as keyof typeof jobStats]++;
      jobStats.totalRevenue += job.grandTotal;
      jobStats.totalAdvances += job.advancePaid;
      jobStats.totalPending += job.pendingAmount;
      jobStats.labourTotal += job.labourTotal;
      jobStats.partsTotal += job.partsTotal;

      jobsByStatus.set(job.status, (jobsByStatus.get(job.status) || 0) + 1);

      if (job.vehicle?.make) {
        jobsByMake.set(job.vehicle.make, (jobsByMake.get(job.vehicle.make) || 0) + 1);
      }

      const customer = job.customerName;
      if (customer) {
        const existing = topCustomers.get(customer) || { count: 0, revenue: 0 };
        topCustomers.set(customer, {
          count: existing.count + 1,
          revenue: existing.revenue + job.grandTotal,
        });
      }
    }

    jobStats.avgJobValue = jobStats.total > 0 ? jobStats.totalRevenue / jobStats.total : 0;

    // ============================================
    // 5. VENDOR ANALYTICS
    // ============================================
    const vendors = await prisma.vendor.findMany({
      include: {
        payments: {
          where: { date: { gte: start, lte: end } },
        },
      },
    });

    let totalVendorDue = 0;
    let totalVendorPayments = 0;
    const vendorStats = {
      totalActive: 0,
      totalInactive: 0,
      pendingPayments: 0,
      partialPayments: 0,
      paidPayments: 0,
    };

    const topVendorsDue: any[] = [];

    for (const vendor of vendors) {
      if (vendor.isActive) vendorStats.totalActive++;
      else vendorStats.totalInactive++;

      totalVendorDue += vendor.totalDue;

      for (const payment of vendor.payments) {
        totalVendorPayments += payment.amountPaid; // ✅ FIX: Use amountPaid, not amount
        if (payment.status === "PENDING") vendorStats.pendingPayments++;
        else if (payment.status === "PARTIAL") vendorStats.partialPayments++;
        else if (payment.status === "PAID") vendorStats.paidPayments++;
      }

      // ✅ FIX: Show vendors with payments in period OR outstanding dues
      if (vendor.payments.length > 0 || vendor.totalDue > 0) {
        topVendorsDue.push({
          id: vendor.id,
          name: vendor.name,
          totalDue: paiseToRupees(vendor.totalDue),
          paymentsCount: vendor.payments.length,
        });
      }
    }

    topVendorsDue.sort((a, b) => b.totalDue - a.totalDue);

    // ============================================
    // 6. EMPLOYEE & PAYROLL
    // ============================================
    const employees = await prisma.employee.findMany({
      include: {
        advances: {
          where: { date: { gte: start, lte: end } },
        },
        attendances: {
          where: { date: { gte: start, lte: end } },
        },
      },
    });

    let totalSalaryLiability = 0;
    let totalAdvances = 0;
    const employeeStats = {
      active: 0,
      inactive: 0,
      totalAdvances: 0,
    };

    const advancesByEmployee: any[] = [];
    const attendanceStats = {
      present: 0,
      absent: 0,
      paidLeave: 0,
      unpaidLeave: 0,
    };

    for (const emp of employees) {
      if (emp.isActive) {
        employeeStats.active++;
        totalSalaryLiability += emp.baseSalary;
      } else {
        employeeStats.inactive++;
      }

      let empAdvances = 0;
      for (const adv of emp.advances) {
        empAdvances += adv.amount;
        totalAdvances += adv.amount;
      }

      if (empAdvances > 0) {
        advancesByEmployee.push({
          employeeId: emp.id,
          employeeName: emp.name,
          totalAdvances: paiseToRupees(empAdvances),
        });
      }

      for (const att of emp.attendances) {
        if (att.status === "PRESENT") attendanceStats.present++;
        else if (att.status === "ABSENT") attendanceStats.absent++;
        else if (att.status === "PAID_LEAVE") attendanceStats.paidLeave++;
        else if (att.status === "UNPAID_LEAVE") attendanceStats.unpaidLeave++;
      }
    }

    advancesByEmployee.sort((a, b) => b.totalAdvances - a.totalAdvances);

    // ============================================
    // 7. INVENTORY ANALYTICS
    // ============================================
    const inventoryItems = await prisma.inventoryItem.findMany({
      include: {
        stockTransactions: {
          select: { type: true, quantity: true },
        },
      },
    });

    const inventoryStats = {
      totalItems: inventoryItems.length,
      lowStockCount: 0,
      outOfStockCount: 0,
    };

    const lowStockItems: any[] = [];
    const inventoryByCategory = new Map<string, number>();

    for (const item of inventoryItems) {
      const currentStock = computeCurrentStockForItem(item.stockTransactions);

      const category = item.category || "Uncategorized";
      inventoryByCategory.set(category, (inventoryByCategory.get(category) || 0) + 1);

      if (currentStock === 0) {
        inventoryStats.outOfStockCount++;
      } else if (currentStock <= item.minStock) {
        inventoryStats.lowStockCount++;
        lowStockItems.push({
          id: item.id,
          name: item.name,
          category: item.category,
          sku: item.sku,
          unit: item.unit,
          minStock: item.minStock,
          currentStock,
        });
      }
    }

    lowStockItems.sort((a, b) => a.currentStock - b.currentStock);

    // ============================================
    // 8. RECENT ACTIVITY
    // ============================================
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const recentActivity = auditLogs.map((log) => ({
      action: log.action,
      summary: log.summary || `${log.action} on ${log.entityType}`,
      createdAt: log.timestamp,
      user: log.user?.name || "System",
    }));

    // ============================================
    // 9. TRENDS & CHARTS
    // ============================================
    const datesSet = new Set<string>();
    salesByDate.forEach((_, date) => datesSet.add(date));
    expensesByDate.forEach((_, date) => datesSet.add(date));

    const allDates = Array.from(datesSet).sort();
    const dailyTrends = allDates.map((date) => ({
      date,
      sales: paiseToRupees(salesByDate.get(date) || 0),
      expenses: paiseToRupees(expensesByDate.get(date) || 0),
      profit: paiseToRupees((salesByDate.get(date) || 0) - (expensesByDate.get(date) || 0)),
    }));

    // ============================================
    // 10. COMPREHENSIVE RESPONSE
    // ============================================
    const netProfit = totalSalesPaise - totalExpensesPaise;

    return res.json({
      range: {
        from: start.toISOString(),
        to: end.toISOString(),
      },

      // Core KPIs
      kpis: {
        totalSales: paiseToRupees(totalSalesPaise),
        totalExpenses: paiseToRupees(totalExpensesPaise),
        netProfit: paiseToRupees(netProfit),
        profitMargin: totalSalesPaise > 0 ? (netProfit / totalSalesPaise) * 100 : 0,
        expenseRatio: totalSalesPaise > 0 ? (totalExpensesPaise / totalSalesPaise) * 100 : 0,
        totalAdvances: paiseToRupees(totalAdvances),
        salaryLiability: paiseToRupees(totalSalaryLiability),
        vendorDue: paiseToRupees(totalVendorDue),
      },

      // Sales breakdown
      sales: {
        total: paiseToRupees(totalSalesPaise),
        count: sales.length,
        avgSale: sales.length > 0 ? paiseToRupees(totalSalesPaise) / sales.length : 0,
        byPaymentMode: Array.from(salesByMode.entries())
          .map(([mode, amount]) => ({
            mode,
            amount: paiseToRupees(amount),
            percentage: totalSalesPaise > 0 ? (amount / totalSalesPaise) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
        byReceiver: Array.from(salesByReceiver.entries())
          .map(([receiver, amount]) => ({
            receiver,
            amount: paiseToRupees(amount),
            percentage: totalSalesPaise > 0 ? (amount / totalSalesPaise) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
        byCategory: Array.from(salesByCategory.entries())
          .map(([category, amount]) => ({
            category,
            amount: paiseToRupees(amount),
            percentage: totalSalesPaise > 0 ? (amount / totalSalesPaise) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
      },

      // Expenses breakdown (excluding employee advances)
      expenses: {
        total: paiseToRupees(totalExpensesPaise),
        count: expenses.length - employeeAdvances.size,
        avgExpense: (expenses.length - employeeAdvances.size) > 0 
          ? paiseToRupees(totalExpensesPaise) / (expenses.length - employeeAdvances.size) 
          : 0,
        byCategory: Array.from(expensesByCategory.entries())
          .map(([category, amount]) => ({
            category,
            amount: paiseToRupees(amount),
            percentage: totalExpensesPaise > 0 ? (amount / totalExpensesPaise) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
        byPaidBy: Array.from(expensesByPaidBy.entries())
          .map(([paidBy, amount]) => ({
            paidBy,
            amount: paiseToRupees(amount),
            percentage: totalExpensesPaise > 0 ? (amount / totalExpensesPaise) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
        byVendor: Array.from(expensesByVendor.entries())
          .map(([vendor, amount]) => ({
            vendor,
            amount: paiseToRupees(amount),
            percentage: totalExpensesPaise > 0 ? (amount / totalExpensesPaise) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10),
      },

      // Employee advances (separate from expenses)
      employeeAdvances: {
        total: paiseToRupees(totalEmployeeAdvancesPaise),
        count: employeeAdvances.size,
        byEmployee: Array.from(employeeAdvances.entries())
          .map(([name, amount]) => ({
            name,
            amount: paiseToRupees(amount),
            percentage: totalEmployeeAdvancesPaise > 0 
              ? (amount / totalEmployeeAdvancesPaise) * 100 
              : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
      },

      // Cash flow by person
      cashFlow,

      // Job cards
      jobCards: {
        total: jobStats.total,
        byStatus: {
          open: jobStats.open,
          inProgress: jobStats.inProgress,
          ready: jobStats.ready,
          delivered: jobStats.delivered,
          cancelled: jobStats.cancelled,
        },
        revenue: {
          total: paiseToRupees(jobStats.totalRevenue),
          advances: paiseToRupees(jobStats.totalAdvances),
          pending: paiseToRupees(jobStats.totalPending),
          avgJobValue: paiseToRupees(jobStats.avgJobValue),
        },
        composition: {
          labour: paiseToRupees(jobStats.labourTotal),
          parts: paiseToRupees(jobStats.partsTotal),
          labourPercentage:
            jobStats.totalRevenue > 0 ? (jobStats.labourTotal / jobStats.totalRevenue) * 100 : 0,
          partsPercentage:
            jobStats.totalRevenue > 0 ? (jobStats.partsTotal / jobStats.totalRevenue) * 100 : 0,
        },
        byMake: Array.from(jobsByMake.entries())
          .map(([make, count]) => ({ make, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        topCustomers: Array.from(topCustomers.entries())
          .map(([name, data]) => ({
            name,
            jobCount: data.count,
            totalRevenue: paiseToRupees(data.revenue),
          }))
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 10),
      },

      // Vendors
      vendors: {
        stats: vendorStats,
        totalDue: paiseToRupees(totalVendorDue),
        totalPayments: paiseToRupees(totalVendorPayments),
        topDue: topVendorsDue.slice(0, 10),
      },

      // Employees
      employees: {
        stats: employeeStats,
        salaryLiability: paiseToRupees(totalSalaryLiability),
        totalAdvances: paiseToRupees(totalAdvances),
        advancesByEmployee: advancesByEmployee.slice(0, 10),
        attendance: attendanceStats,
      },

      // Inventory
      inventory: {
        stats: inventoryStats,
        lowStockItems: lowStockItems.slice(0, 10),
        byCategory: Array.from(inventoryByCategory.entries()).map(([category, count]) => ({
          category,
          count,
        })),
      },

      // Trends
      trends: {
        daily: dailyTrends,
      },

      // Recent activity
      activity: recentActivity,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;