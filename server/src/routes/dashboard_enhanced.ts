import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

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
  return amount / 100;
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
 * GET /dashboard - Enhanced dashboard with comprehensive analytics
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    const { start, end } = parseDateRange(from, to);

    // ============================================
    // 1. SALES ANALYTICS (with money tracking)
    // ============================================
    const sales = await prisma.sale.findMany({
      where: {
        currentVersion: {
          date: { gte: start, lte: end },
        },
      },
      include: { currentVersion: true },
    });

    let totalSalesPaise = 0;
    const salesByDate = new Map<string, number>();
    const salesByMode = new Map<string, number>();
    const salesByReceiver = new Map<string, number>(); // ✅ NEW: Track money by owner
    const salesByCategory = new Map<string, number>(); // ✅ NEW: Track sales by category
    const moneyTracking = {
      nitesh: 0,
      tanmeet: 0,
      bankAccount: 0,
      untracked: 0,
    };

    for (const s of sales) {
      const v = s.currentVersion;
      if (!v) continue;

      totalSalesPaise += v.amount;

      // By date
      const d = v.date.toISOString().slice(0, 10);
      salesByDate.set(d, (salesByDate.get(d) || 0) + v.amount);

      // By payment mode
      salesByMode.set(v.paymentMode, (salesByMode.get(v.paymentMode) || 0) + v.amount);

      // ✅ By category
      const category = v.category || "Uncategorized";
      salesByCategory.set(category, (salesByCategory.get(category) || 0) + v.amount);

      // ✅ By receiver (for "Money by Owner" chart)
      const receiverName = v.receivedBy || "Unknown";
      salesByReceiver.set(receiverName, (salesByReceiver.get(receiverName) || 0) + v.amount);

      // Money tracking
      const receiver = v.receivedBy?.toLowerCase();
      if (receiver === "nitesh") {
        moneyTracking.nitesh += v.amount;
      } else if (receiver === "tanmeet") {
        moneyTracking.tanmeet += v.amount;
      } else if (receiver === "bank account" || receiver === "bank") {
        moneyTracking.bankAccount += v.amount;
      } else {
        moneyTracking.untracked += v.amount;
      }
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
    let advanceExpensesPaise = 0; // ✅ Track advance expenses separately
    const expensesByDate = new Map<string, number>();
    const expensesByCategory = new Map<string, number>();
    const expensesByVendor = new Map<string, number>(); // ✅ NEW: Track expenses by vendor
    const expensesByMode = new Map<string, number>(); // ✅ NEW: Track payment modes

    for (const e of expenses) {
      const v = e.currentVersion;
      if (!v) continue;

      totalExpensesPaise += v.amount;

      // Track advances
      if (v.category?.toLowerCase().includes("advance")) {
        advanceExpensesPaise += v.amount;
      }

      const d = v.date.toISOString().slice(0, 10);
      expensesByDate.set(d, (expensesByDate.get(d) || 0) + v.amount);

      const cat = v.category || "Uncategorized";
      expensesByCategory.set(cat, (expensesByCategory.get(cat) || 0) + v.amount);

      // ✅ By vendor
      const vendorName = v.vendor || "No Vendor";
      expensesByVendor.set(vendorName, (expensesByVendor.get(vendorName) || 0) + v.amount);

      // ✅ By payment mode
      if (v.paymentMode) {
        expensesByMode.set(v.paymentMode, (expensesByMode.get(v.paymentMode) || 0) + v.amount);
      }
    }

    const netProfitPaise = totalSalesPaise - totalExpensesPaise;

    // ============================================
    // 3. JOB CARDS ANALYTICS
    // ============================================
    const jobCards = await prisma.jobCard.findMany({
      where: {
        inDate: { gte: start, lte: end },
      },
      include: {
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
    };

    const jobsByTemplate = new Map<string, number>();

    for (const job of jobCards) {
      // Status count
      jobStats[job.status.toLowerCase() as keyof typeof jobStats]++;

      jobStats.totalRevenue += job.grandTotal;
      jobStats.totalAdvances += job.advancePaid;
      jobStats.totalPending += job.pendingAmount;

      // By template
      const template = job.templateUsed || "GENERAL";
      jobsByTemplate.set(template, (jobsByTemplate.get(template) || 0) + 1);
    }

    // ============================================
    // 4. VENDOR ANALYTICS
    // ============================================
    const vendors = await prisma.vendor.findMany({
      where: { isActive: true },
      include: {
        payments: {
          where: {
            date: { gte: start, lte: end },
          },
        },
      },
    });

    let totalVendorDue = 0;
    const vendorPaymentsByStatus = {
      pending: 0,
      partial: 0,
      paid: 0,
    };

    let totalVendorPayments = 0;

    for (const vendor of vendors) {
      totalVendorDue += vendor.totalDue;

      for (const payment of vendor.payments) {
        totalVendorPayments += payment.amount;
        vendorPaymentsByStatus[payment.status.toLowerCase() as keyof typeof vendorPaymentsByStatus]++;
      }
    }

    const topVendorsDue = vendors
      .filter((v) => v.totalDue > 0)
      .sort((a, b) => b.totalDue - a.totalDue)
      .slice(0, 5)
      .map((v) => ({
        id: v.id,
        name: v.name,
        totalDue: paiseToRupees(v.totalDue),
        paymentsCount: v.payments.length,
      }));

    // ============================================
    // 5. EMPLOYEE & PAYROLL
    // ============================================
    const activeEmployees = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, baseSalary: true },
    });

    const salaryLiabilityPaise = activeEmployees.reduce(
      (sum, emp) => sum + emp.baseSalary,
      0
    );

    const advances = await prisma.advance.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      include: {
        employee: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: "asc" },
    });

    const totalAdvancesPaise = advances.reduce((sum, a) => sum + a.amount, 0);

    const advancesByEmployee: {
      [employeeId: number]: {
        employeeId: number;
        employeeName: string;
        totalAdvances: number;
      };
    } = {};

    for (const adv of advances) {
      if (!adv.employee) continue;
      const empId = adv.employee.id;
      if (!advancesByEmployee[empId]) {
        advancesByEmployee[empId] = {
          employeeId: empId,
          employeeName: adv.employee.name,
          totalAdvances: 0,
        };
      }
      advancesByEmployee[empId].totalAdvances += paiseToRupees(adv.amount);
    }

    // ============================================
    // 6. INVENTORY
    // ============================================
    const inventoryItems = await prisma.inventoryItem.findMany({
      include: {
        stockTransactions: {
          select: { type: true, quantity: true },
        },
      },
    });

    const lowStockItems = inventoryItems
      .map((item: any) => {
        const currentStock = computeCurrentStockForItem(item.stockTransactions);
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          sku: item.sku,
          unit: item.unit,
          minStock: item.minStock,
          currentStock,
        };
      })
      .filter((i: any) => i.currentStock <= i.minStock)
      .sort((a: any, b: any) => a.currentStock - b.currentStock);

    // ============================================
    // 7. RECENT ACTIVITY
    // ============================================
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 20,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const recentActivity = auditLogs.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      user: log.user
        ? { id: log.user.id, name: log.user.name, email: log.user.email }
        : null,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      summary: log.summary,
    }));

    // ============================================
    // 8. PREPARE CHART DATA
    // ============================================
    const datesSet = new Set<string>();
    for (const d of salesByDate.keys()) datesSet.add(d);
    for (const d of expensesByDate.keys()) datesSet.add(d);
    const allDates = Array.from(datesSet).sort();

    const timeseries = allDates.map((d) => ({
      date: d,
      sales: paiseToRupees(salesByDate.get(d) || 0),
      expenses: paiseToRupees(expensesByDate.get(d) || 0),
      profit: paiseToRupees((salesByDate.get(d) || 0) - (expensesByDate.get(d) || 0)),
    }));

    // ✅ Sales analytics with percentages
    const salesByPaymentMode = Array.from(salesByMode.entries()).map(
      ([mode, amount]) => ({
        mode,
        amount: paiseToRupees(amount),
        percentage: totalSalesPaise > 0 ? amount / totalSalesPaise : 0,
      })
    );

    const salesByCategoryChart = Array.from(salesByCategory.entries())
      .map(([category, amount]) => ({
        category,
        amount: paiseToRupees(amount),
        percentage: totalSalesPaise > 0 ? amount / totalSalesPaise : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const salesByReceiverChart = Array.from(salesByReceiver.entries())
      .map(([receiver, amount]) => ({
        receiver,
        amount: paiseToRupees(amount),
        percentage: totalSalesPaise > 0 ? amount / totalSalesPaise : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // ✅ Expenses analytics with percentages
    const expensesByCategoryChart = Array.from(expensesByCategory.entries())
      .map(([category, amount]) => ({
        category,
        amount: paiseToRupees(amount),
        percentage: totalExpensesPaise > 0 ? amount / totalExpensesPaise : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const expensesByVendorChart = Array.from(expensesByVendor.entries())
      .map(([vendor, amount]) => ({
        vendor,
        amount: paiseToRupees(amount),
        percentage: totalExpensesPaise > 0 ? amount / totalExpensesPaise : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const expensesByPaymentMode = Array.from(expensesByMode.entries()).map(
      ([mode, amount]) => ({
        mode,
        amount: paiseToRupees(amount),
        percentage: totalExpensesPaise > 0 ? amount / totalExpensesPaise : 0,
      })
    );

    // ✅ Convert job template from array to object for frontend
    const jobsByTemplateObj: Record<string, number> = {};
    jobsByTemplate.forEach((count, template) => {
      jobsByTemplateObj[template] = count;
    });

    // ============================================
    // RESPONSE - Frontend Compatible Format
    // ============================================
    const response = {
      range: {
        from: start.toISOString(),
        to: end.toISOString(),
      },
      kpis: {
        totalSales: paiseToRupees(totalSalesPaise),
        totalExpenses: paiseToRupees(totalExpensesPaise),
        netProfit: paiseToRupees(netProfitPaise),
        profitMargin: totalSalesPaise > 0 ? netProfitPaise / totalSalesPaise : 0,
        expenseRatio: totalSalesPaise > 0 ? totalExpensesPaise / totalSalesPaise : 0,
        salaryLiability: paiseToRupees(salaryLiabilityPaise),
        totalAdvances: paiseToRupees(totalAdvancesPaise),
        cashIn: paiseToRupees(totalSalesPaise),
        cashOut: paiseToRupees(totalExpensesPaise),
        netCashFlow: paiseToRupees(netProfitPaise),
      },
      // ✅ Sales breakdown
      sales: {
        total: paiseToRupees(totalSalesPaise),
        count: sales.length,
        byCategory: salesByCategoryChart,
        byPaymentMode: salesByPaymentMode,
        byReceiver: salesByReceiverChart, // ✅ Money by owner
      },
      // ✅ Expenses breakdown
      expenses: {
        total: paiseToRupees(totalExpensesPaise),
        count: expenses.length,
        advanceExpenses: paiseToRupees(advanceExpensesPaise),
        otherExpenses: paiseToRupees(totalExpensesPaise - advanceExpensesPaise),
        byCategory: expensesByCategoryChart,
        byPaymentMode: expensesByPaymentMode,
        byVendor: expensesByVendorChart, // ✅ Top vendors by expense
      },
      // ✅ Job cards with proper format
      jobCards: {
        ...jobStats,
        totalRevenue: paiseToRupees(jobStats.totalRevenue),
        totalAdvances: paiseToRupees(jobStats.totalAdvances),
        totalPending: paiseToRupees(jobStats.totalPending),
        byTemplate: jobsByTemplateObj, // ✅ Object format instead of array
      },
      // ✅ Vendor dues
      vendors: {
        totalActive: vendors.filter((v) => v.isActive).length,
        totalDue: paiseToRupees(totalVendorDue),
        paymentsByStatus: vendorPaymentsByStatus,
        topVendorsDue,
      },
      // ✅ Money tracking
      moneyTracking: {
        nitesh: paiseToRupees(moneyTracking.nitesh),
        tanmeet: paiseToRupees(moneyTracking.tanmeet),
        bankAccount: paiseToRupees(moneyTracking.bankAccount),
        untracked: paiseToRupees(moneyTracking.untracked),
      },
      // ✅ Jobs overview (original format kept for compatibility)
      jobs: {
        total: jobStats.total,
        byStatus: Object.entries(jobStats as any)
          .filter(([key]) => !["total", "open", "inProgress", "ready", "delivered", "cancelled", "totalRevenue", "totalAdvances", "totalPending"].includes(key))
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as Record<string, number>),
        totalRevenue: paiseToRupees(jobStats.totalRevenue),
        totalPending: paiseToRupees(jobStats.totalPending),
        totalAdvances: paiseToRupees(jobStats.totalAdvances),
        avgJobValue: jobStats.total > 0 ? paiseToRupees(jobStats.totalRevenue) / jobStats.total : 0,
        overdueCount: 0, // Would need additional calculation
        byMake: [], // Would need additional data
        labourVsParts: {
          labour: 0,
          parts: 0,
          labourPercentage: 0,
          partsPercentage: 0,
        },
        paymentsByMode: [],
      },
      // ✅ Employees
      employees: {
        activeCount: activeEmployees.length,
        totalSalaryLiability: paiseToRupees(salaryLiabilityPaise),
        advances: Object.values(advancesByEmployee),
        totalAdvances: paiseToRupees(totalAdvancesPaise),
      },
      // ✅ Inventory
      inventory: {
        totalItems: lowStockItems.length, // This should ideally count all items
        lowStockCount: lowStockItems.length,
        lowStockItems,
        byCategory: [],
      },
      // ✅ Trends
      trends: {
        daily: timeseries,
      },
      // ✅ Top customers (placeholder - would need query)
      topCustomers: [],
    };

    return res.json(response);
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ NEW: Helper to parse paidBy from note field
function parsePaidBy(note: string | null): string | null {
  if (!note) return null;
  const match = note.match(/^\[PAID_BY:([^\]]+)\]/);
  return match ? match[1] : null;
}

/**
 * GET /dashboard/cashflow
 * ✅ NEW: Returns cash flow summary by person
 * Shows who received money (sales) and who paid money (expenses)
 */
router.get("/cashflow", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    
    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) {
      const endDate = new Date(to as string);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }
    
    const whereClause = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : undefined;
    
    // Get all sales (money received)
    const sales = await prisma.saleVersion.findMany({
      where: whereClause,
      select: { receivedBy: true, amount: true },
    });
    
    // Get all expenses (money paid)
    const expenses = await prisma.expenseVersion.findMany({
      where: whereClause,
      select: { note: true, amount: true },
    });
    
    // Initialize cash flow object
    const cashFlow: any = {
      Nitesh: { received: 0, paid: 0, net: 0 },
      Tanmeet: { received: 0, paid: 0, net: 0 },
      "Bank Account": { received: 0, paid: 0, net: 0 },
    };
    
    // Process sales (money received)
    sales.forEach(sale => {
      const person = sale.receivedBy || "Nitesh"; // Default to Nitesh if not specified
      if (cashFlow[person]) {
        cashFlow[person].received += sale.amount;
      }
    });
    
    // Process expenses (money paid)
    expenses.forEach(expense => {
      const paidBy = parsePaidBy(expense.note);
      if (paidBy && cashFlow[paidBy]) {
        cashFlow[paidBy].paid += expense.amount;
      }
    });
    
    // Calculate net for each person
    Object.keys(cashFlow).forEach(person => {
      cashFlow[person].net = cashFlow[person].received - cashFlow[person].paid;
    });
    
    return res.json(cashFlow);
  } catch (err) {
    console.error("Cash flow error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;