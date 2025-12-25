// server/src/routes/jobcards.ts
import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { PaymentMode, JobStatus, JobLineType, JobPaymentType } from "@prisma/client";

const router = Router();

/** -----------------------------
 * Types (API)
 * ----------------------------- */

interface CreateJobCardBody {
  vehicleId?: number;

  // aliases from UI
  regNumber?: string;
  vehicleNumber?: string;
  carNumber?: string;
  vehicleModel?: string;  // ✅ Added vehicle model

  // customer aliases
  customerName?: string;
  ownerName?: string;

  customerPhone?: string;
  ownerPhone?: string;

  // vehicle owner fallback
  ownerNameForVehicle?: string;

  inDate?: string;
  promisedDate?: string;

  odometer?: number;
  fuelLevel?: string;

  complaints?: string;
  additionalNotes?: string;
}

interface UpdateJobCardBody {
  inDate?: string | null;
  promisedDate?: string | null;

  status?: JobStatus;

  // ✅ Customer fields
  customerName?: string | null;
  customerPhone?: string | null;

  odometer?: number | null;
  fuelLevel?: string | null;

  complaints?: string | null;

  // DB fields
  diagnostics?: string | null;
  recommendations?: string | null;
  additionalNotes?: string | null;

  // ✅ UI aliases (Jobs page commonly sends these)
  diagnosis?: string | null; // -> diagnostics
  workRecommended?: string | null; // -> recommendations
  notes?: string | null; // -> additionalNotes

  discount?: number;
  tax?: number;

  invoiceNumber?: string | null;
  finalPaymentMode?: PaymentMode | string | null;
}

interface AddLineItemBody {
  lineType: JobLineType | string;
  description: string;
  quantity?: number;
  unitPrice: number;
  inventoryItemId?: number;
}

interface UpdateLineItemBody {
  lineType?: JobLineType | string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  inventoryItemId?: number | null;
}

interface AddPaymentBody {
  date?: string;
  amount: number;
  paymentMode: PaymentMode | string;
  paymentType?: JobPaymentType | string;
  receivedBy?: string; // ✅ Who received the payment
  reference?: string;
  note?: string;
}

interface UpdatePaymentBody {
  date?: string;
  amount?: number; // rupees
  paymentMode?: PaymentMode | string;
  paymentType?: JobPaymentType | string;
  receivedBy?: string; // ✅ Who received the payment
  reference?: string | null;
  note?: string | null;
}

interface CloseJobBody {
  outDate?: string;
  note?: string;
  finalPaymentMode?: PaymentMode | string | null;
  invoiceNumber?: string | null;
}

/** -----------------------------
 * Helpers
 * ----------------------------- */

function normalizeRegNumber(input: string) {
  return input.trim().toUpperCase();
}

function toPaise(rupees: number) {
  return Math.round(Number(rupees || 0) * 100);
}

function fromPaise(paise: number | null | undefined) {
  return (paise || 0) / 100;
}

function parsePaymentMode(input: any): PaymentMode | null {
  if (!input) return null;
  const upper = String(input).toUpperCase();
  return upper in PaymentMode ? (upper as PaymentMode) : null;
}

function parseJobLineType(input: any): JobLineType | null {
  if (!input) return null;
  const upper = String(input).toUpperCase();
  return upper in JobLineType ? (upper as JobLineType) : null;
}

function parseJobPaymentType(input: any): JobPaymentType {
  if (!input) return JobPaymentType.ADVANCE;
  const upper = String(input).toUpperCase();
  return upper in JobPaymentType ? (upper as JobPaymentType) : JobPaymentType.ADVANCE;
}

async function generateJobNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  const prefix = `JC-${yyyy}-${mm}-`;

  const lastJob = await prisma.jobCard.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { id: "desc" },
  });

  let seq = 1;
  if (lastJob?.jobNumber) {
    const parts = lastJob.jobNumber.split("-");
    const lastSeq = Number(parts[3] || "0");
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

function mapJobCard(j: any) {
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    status: j.status,
    inDate: j.inDate,
    promisedDate: j.promisedDate,

    customerName: j.customerName,
    customerPhone: j.customerPhone,

    odometer: j.odometer,
    fuelLevel: j.fuelLevel,

    complaints: j.complaints,
    diagnostics: j.diagnostics,
    recommendations: j.recommendations,
    additionalNotes: j.additionalNotes,

    labourTotal: fromPaise(j.labourTotal),
    partsTotal: fromPaise(j.partsTotal),
    discount: fromPaise(j.discount),
    tax: fromPaise(j.tax),
    grandTotal: fromPaise(j.grandTotal),

    advancePaid: fromPaise(j.advancePaid),
    pendingAmount: fromPaise(j.pendingAmount),

    finalPaymentMode: j.finalPaymentMode,
    invoiceNumber: j.invoiceNumber,
    saleId: j.saleId,

    createdAt: j.createdAt,
    updatedAt: j.updatedAt,

    vehicle: j.vehicle
      ? {
          id: j.vehicle.id,
          regNumber: j.vehicle.regNumber,
          make: j.vehicle.make,
          model: j.vehicle.model,
          variant: j.vehicle.variant,
          fuelType: j.vehicle.fuelType,
          year: j.vehicle.year,
          color: j.vehicle.color,
          ownerName: j.vehicle.ownerName,
          ownerPhone: j.vehicle.ownerPhone,
        }
      : null,

    lineItems: (j.lineItems || []).map((li: any) => ({
      id: li.id,
      lineType: li.lineType,
      description: li.description,
      quantity: li.quantity,
      unitPrice: fromPaise(li.unitPrice),
      total: fromPaise(li.total),
      inventoryItemId: li.inventoryItemId,
      createdAt: li.createdAt,
    })),

    payments: (j.payments || []).map((p: any) => ({
      id: p.id,
      paymentType: p.paymentType,
      amount: fromPaise(p.amount),
      date: p.date,
      paymentMode: p.paymentMode,
      receivedBy: p.receivedBy, // ✅ Include receivedBy
      reference: p.reference,
      note: p.note,
      createdAt: p.createdAt,
    })),
  };
}

/**
 * Recalculate totals using schema fields:
 * JobLineItem.total, JobLineItem.lineType
 */
async function recalcJobFinancials(jobCardId: number) {
  const lineItems = await prisma.jobLineItem.findMany({ where: { jobCardId } });

  let labour = 0;
  let parts = 0;

  for (const li of lineItems) {
    if (li.lineType === JobLineType.LABOUR) labour += li.total;
    else if (li.lineType === JobLineType.PART) parts += li.total;
    else parts += li.total;
  }

  const payments = await prisma.jobPayment.findMany({ where: { jobCardId } });
  const paid = payments.reduce((s, p) => s + p.amount, 0);

  const job = await prisma.jobCard.findUnique({ where: { id: jobCardId } });
  if (!job) throw new Error("JobCard not found");

  const discount = job.discount ?? 0;
  const tax = job.tax ?? 0;

  const grand = labour + parts - discount + tax;
  const pending = Math.max(0, grand - paid);

  return prisma.jobCard.update({
    where: { id: jobCardId },
    data: {
      labourTotal: labour,
      partsTotal: parts,
      grandTotal: grand,
      advancePaid: paid,
      pendingAmount: pending,
    },
    include: {
      vehicle: true,
      lineItems: { orderBy: { id: "asc" } },
      payments: { orderBy: { date: "asc" } },
    },
  });
}


/**
 * ✅ UPDATED: Create SEPARATE sales for each payment receiver
 * This ensures proper tracking when Nitesh, Tanmeet, and Bank each receive different amounts
 * 
 * Example:
 * Job has payments: ₹5000 (Nitesh), ₹3000 (Tanmeet), ₹2000 (Bank)
 * Creates 3 sales: one for each receiver
 */
async function syncJobCardSale(jobId: number) {
  // Get job with all payments and existing sales
  const job = await prisma.jobCard.findUnique({
    where: { id: jobId },
    include: {
      payments: true,
      sales: true, // ✅ Changed from 'sale' to 'sales' (1:many relationship)
    },
  });

  if (!job) return;

  // Get valid payments (exclude REFUND)
  const validPayments = job.payments.filter(
    (p) => p.paymentType === "ADVANCE" || p.paymentType === "FINAL"
  );

  // ✅ FIX: Delete SaleVersions BEFORE deleting Sales (foreign key constraint)
  if (job.sales && job.sales.length > 0) {
    // First, delete all sale versions for these sales
    for (const sale of job.sales) {
      await prisma.saleVersion.deleteMany({
        where: { saleId: sale.id },
      });
    }
    
    // Then delete the sales
    await prisma.sale.deleteMany({
      where: { jobCardId: jobId },
    });
  }

  // If no valid payments, we're done
  if (validPayments.length === 0) return;

  // Group payments by receivedBy
  const paymentsByReceiver = validPayments.reduce((acc, payment) => {
    const receiver = payment.receivedBy || "Unknown";
    if (!acc[receiver]) {
      acc[receiver] = [];
    }
    acc[receiver].push(payment);
    return acc;
  }, {} as Record<string, typeof validPayments>);

  // Create separate sale for each receiver
  for (const [receivedBy, payments] of Object.entries(paymentsByReceiver)) {
    // Calculate total amount for this receiver
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    // Get most recent payment for this receiver (for date and payment mode)
    const recentPayment = payments.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    // Create the sale
    const sale = await prisma.sale.create({
      data: { jobCardId: jobId },
    });

    // Create the sale version
    const version = await prisma.saleVersion.create({
      data: {
        saleId: sale.id,
        versionNumber: 1,
        date: recentPayment?.date || new Date(),
        amount: totalAmount,
        category: "Service",
        paymentMode: recentPayment?.paymentMode || "CASH",
        reference: job.jobNumber,
        receivedBy: receivedBy,
      },
    });

    // Link as current version
    await prisma.sale.update({
      where: { id: sale.id },
      data: { currentVersionId: version.id },
    });

    console.log(
      `✅ Created sale for ${receivedBy}: ₹${(totalAmount / 100).toFixed(2)} (Job ${job.jobNumber})`
    );
  }
}


/** -----------------------------
 * Routes
 * ----------------------------- */

// ✅ UPDATED: POST /jobcards - now handles vehicleModel
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const body = req.body as CreateJobCardBody;

    const reg = body.regNumber || body.vehicleNumber || body.carNumber || "";
    const customerName = (body.customerName || body.ownerName || "").trim();
    const customerPhone = (body.customerPhone || body.ownerPhone || "").trim();
    const vehicleModel = body.vehicleModel?.trim() || null;  // ✅ Extract model

    let vehicleId: number;

    if (body.vehicleId) {
      const v = await prisma.vehicle.findUnique({ where: { id: body.vehicleId } });
      if (!v) return res.status(404).json({ message: "Vehicle not found" });
      vehicleId = v.id;
    } else {
      if (!reg.trim() || !customerName) {
        return res.status(400).json({ message: "regNumber and customerName are required." });
      }

      const regNumber = normalizeRegNumber(reg);
      let v = await prisma.vehicle.findUnique({ where: { regNumber } });

      if (!v) {
        // ✅ Create new vehicle with model
        v = await prisma.vehicle.create({
          data: {
            regNumber,
            model: vehicleModel,  // ✅ Store model
            ownerName: customerName,
            ownerPhone: customerPhone || null,
          },
        });
      } else {
        // ✅ Update existing vehicle with new info including model
        const updates: any = {};
        if (customerName && customerName !== v.ownerName) updates.ownerName = customerName;
        if (customerPhone && customerPhone !== (v.ownerPhone || "")) updates.ownerPhone = customerPhone;
        if (vehicleModel && vehicleModel !== v.model) updates.model = vehicleModel;  // ✅ Update model if provided
        
        if (Object.keys(updates).length) {
          v = await prisma.vehicle.update({ where: { id: v.id }, data: updates });
        }
      }

      vehicleId = v.id;
    }

    const jobNumber = await generateJobNumber();

    const job = await prisma.jobCard.create({
      data: {
        jobNumber,
        vehicleId,

        customerName: customerName || "Customer",
        customerPhone: customerPhone || null,

        inDate: body.inDate ? new Date(body.inDate) : new Date(),
        promisedDate: body.promisedDate ? new Date(body.promisedDate) : null,

        status: JobStatus.OPEN,

        odometer: typeof body.odometer === "number" ? body.odometer : null,
        fuelLevel: body.fuelLevel || null,

        complaints: body.complaints || null,
        additionalNotes: body.additionalNotes || null,

        labourTotal: 0,
        partsTotal: 0,
        discount: 0,
        tax: 0,
        grandTotal: 0,
        advancePaid: 0,
        pendingAmount: 0,
      },
      include: {
        vehicle: true,
        lineItems: true,
        payments: true,
      },
    });

    return res.status(201).json(mapJobCard(job));
  } catch (err) {
    console.error("Create jobcard error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /jobcards
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { status, reg, from, to } = req.query as any;

    const where: any = {};

    if (status) where.status = String(status).toUpperCase();

    if (from || to) {
      where.inDate = {};
      if (from) where.inDate.gte = new Date(String(from));
      if (to) {
        const end = new Date(String(to));
        end.setHours(23, 59, 59, 999);
        where.inDate.lte = end;
      }
    }

    if (reg) {
      const norm = String(reg).trim().toUpperCase();
      where.vehicle = { regNumber: { contains: norm, mode: "insensitive" } };
    }

    const jobs = await prisma.jobCard.findMany({
      where,
      orderBy: { inDate: "desc" },
      include: { vehicle: true },
      take: 200,
    });

    return res.json(jobs.map((j) => mapJobCard({ ...j, lineItems: [], payments: [] })));
  } catch (err) {
    console.error("List jobcards error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /jobcards/:id
 */
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid job id" });

    const job = await prisma.jobCard.findUnique({
      where: { id },
      include: {
        vehicle: true,
        lineItems: { orderBy: { id: "asc" } },
        payments: { orderBy: { date: "asc" } },
      },
    });

    if (!job) return res.status(404).json({ message: "Job not found" });
    return res.json(mapJobCard(job));
  } catch (err) {
    console.error("Get jobcard error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PUT /jobcards/:id
 * ✅ Accepts UI aliases: diagnosis/notes/workRecommended
 */
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid job id" });

    const body = req.body as UpdateJobCardBody;
    const data: any = {};

    if (body.inDate !== undefined) data.inDate = body.inDate ? new Date(body.inDate) : null;
    if (body.promisedDate !== undefined) data.promisedDate = body.promisedDate ? new Date(body.promisedDate) : null;

    // status (no backend restriction here)
    if (body.status !== undefined) data.status = body.status;

    // ✅ Customer fields
    if (body.customerName !== undefined) data.customerName = body.customerName || "";
    if (body.customerPhone !== undefined) data.customerPhone = body.customerPhone || null;

    if (body.odometer !== undefined) data.odometer = typeof body.odometer === "number" ? body.odometer : null;
    if (body.fuelLevel !== undefined) data.fuelLevel = body.fuelLevel || null;

    if (body.complaints !== undefined) data.complaints = body.complaints || null;

    // ✅ accept both DB fields & UI aliases
    const diagnostics = body.diagnostics ?? body.diagnosis;
    const recommendations = body.recommendations ?? body.workRecommended;
    const additionalNotes = body.additionalNotes ?? body.notes;

    if (diagnostics !== undefined) data.diagnostics = diagnostics || null;
    if (recommendations !== undefined) data.recommendations = recommendations || null;
    if (additionalNotes !== undefined) data.additionalNotes = additionalNotes || null;

    if (body.discount !== undefined) data.discount = toPaise(body.discount);
    if (body.tax !== undefined) data.tax = toPaise(body.tax);

    if (body.invoiceNumber !== undefined) data.invoiceNumber = body.invoiceNumber || null;

    if (body.finalPaymentMode !== undefined) {
      data.finalPaymentMode =
        body.finalPaymentMode == null
          ? null
          : typeof body.finalPaymentMode === "string"
          ? parsePaymentMode(body.finalPaymentMode)
          : body.finalPaymentMode;
    }

    await prisma.jobCard.update({ where: { id }, data });

    const updated = await recalcJobFinancials(id);
    return res.json(mapJobCard(updated));
  } catch (err: any) {
    console.error("Update jobcard error:", err);
    if (err.code === "P2025") return res.status(404).json({ message: "Job not found" });
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /jobcards/:id/line-items
 */
router.post("/:id/line-items", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job id" });

    const job = await prisma.jobCard.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const body = req.body as AddLineItemBody;

    const lineType = parseJobLineType((body as any).lineType ?? (body as any).type);
    const description = body.description;
    const quantity = Number(body.quantity ?? 1);
    const unitPriceRupees = body.unitPrice;

    if (!lineType || !description || !quantity || unitPriceRupees == null) {
      return res.status(400).json({
        message: "lineType, description, quantity, unitPrice are required",
      });
    }

    const unitPrice = toPaise(unitPriceRupees);
    const total = quantity * unitPrice;

    await prisma.jobLineItem.create({
      data: {
        jobCardId: jobId,
        lineType,
        description,
        quantity,
        unitPrice,
        total,
        inventoryItemId: body.inventoryItemId || null,
      },
    });

    const updated = await recalcJobFinancials(jobId);
    return res.status(201).json(mapJobCard(updated));
  } catch (err) {
    console.error("Add line item error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PUT /jobcards/:id/line-items/:lineId
 */
router.put("/:id/line-items/:lineId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.id);
    const lineId = Number(req.params.lineId);
    if (isNaN(jobId) || isNaN(lineId)) return res.status(400).json({ message: "Invalid ids" });

    const existing = await prisma.jobLineItem.findUnique({ where: { id: lineId } });
    if (!existing || existing.jobCardId !== jobId) return res.status(404).json({ message: "Line item not found" });

    const body = req.body as UpdateLineItemBody;
    const data: any = {};

    if (body.lineType !== undefined) {
      const lt = parseJobLineType(body.lineType);
      if (!lt) return res.status(400).json({ message: "Invalid lineType" });
      data.lineType = lt;
    }

    if (body.description !== undefined) data.description = body.description;
    if (body.quantity !== undefined) data.quantity = Number(body.quantity);
    if (body.unitPrice !== undefined) data.unitPrice = toPaise(body.unitPrice);
    if (body.inventoryItemId !== undefined) data.inventoryItemId = body.inventoryItemId || null;

    const newQty = data.quantity ?? existing.quantity;
    const newUnit = data.unitPrice ?? existing.unitPrice;
    data.total = newQty * newUnit;

    await prisma.jobLineItem.update({ where: { id: lineId }, data });

    const updated = await recalcJobFinancials(jobId);
    return res.json(mapJobCard(updated));
  } catch (err) {
    console.error("Update line item error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /jobcards/:id/line-items/:lineId
 */
router.delete("/:id/line-items/:lineId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.id);
    const lineId = Number(req.params.lineId);
    if (isNaN(jobId) || isNaN(lineId)) return res.status(400).json({ message: "Invalid ids" });

    const existing = await prisma.jobLineItem.findUnique({ where: { id: lineId } });
    if (!existing || existing.jobCardId !== jobId) return res.status(404).json({ message: "Line item not found" });

    await prisma.jobLineItem.delete({ where: { id: lineId } });

    const updated = await recalcJobFinancials(jobId);
    return res.json(mapJobCard(updated));
  } catch (err) {
    console.error("Delete line item error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /jobcards/:id/payments
 * ✅ Now stores receivedBy in payment record
 */
router.post("/:id/payments", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job id" });

    const job = await prisma.jobCard.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const body = req.body as AddPaymentBody;

    if (body.amount == null || !body.paymentMode) {
      return res.status(400).json({ message: "amount (rupees) and paymentMode are required." });
    }

    const pm = typeof body.paymentMode === "string" ? parsePaymentMode(body.paymentMode) : body.paymentMode;
    if (!pm) {
      return res.status(400).json({
        message: `Invalid paymentMode. Allowed: ${Object.keys(PaymentMode).join(", ")}`,
      });
    }

    const paymentType = parseJobPaymentType(body.paymentType);
    const amount = toPaise(body.amount);

    await prisma.jobPayment.create({
      data: {
        jobCardId: jobId,
        paymentType,
        amount,
        date: body.date ? new Date(body.date) : new Date(),
        paymentMode: pm,
        receivedBy: body.receivedBy || null, // ✅ Store receivedBy
        reference: body.reference || null,
        note: body.note || null,
      },
    });

    // ✅ Sync with sales (now reads receivedBy from payment records)
    await syncJobCardSale(jobId);

    const updated = await recalcJobFinancials(jobId);
    return res.status(201).json(mapJobCard(updated));
  } catch (err) {
    console.error("Add payment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PUT /jobcards/:id/payments/:paymentId
 * ✅ Now updates receivedBy in payment record
 */
router.put("/:id/payments/:paymentId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.id);
    const paymentId = Number(req.params.paymentId);
    if (isNaN(jobId) || isNaN(paymentId)) return res.status(400).json({ message: "Invalid ids" });

    const payment = await prisma.jobPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.jobCardId !== jobId) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const body = req.body as UpdatePaymentBody;
    const data: any = {};

    if (body.amount !== undefined) {
      const amt = Number(body.amount);
      if (isNaN(amt) || amt < 0) return res.status(400).json({ message: "Invalid amount" });
      data.amount = toPaise(amt);
    }

    if (body.paymentMode !== undefined) {
      const pm = typeof body.paymentMode === "string" ? parsePaymentMode(body.paymentMode) : body.paymentMode;
      if (!pm) {
        return res.status(400).json({
          message: `Invalid paymentMode. Allowed: ${Object.keys(PaymentMode).join(", ")}`,
        });
      }
      data.paymentMode = pm;
    }

    if (body.paymentType !== undefined) data.paymentType = parseJobPaymentType(body.paymentType);
    if (body.receivedBy !== undefined) data.receivedBy = body.receivedBy || null; // ✅ Update receivedBy
    if (body.note !== undefined) data.note = body.note || null;
    if (body.reference !== undefined) data.reference = body.reference || null;
    if (body.date !== undefined) data.date = body.date ? new Date(body.date) : payment.date;

    await prisma.jobPayment.update({ where: { id: paymentId }, data });

    // ✅ Sync with sales (now reads receivedBy from payment records)
    await syncJobCardSale(jobId);
    
    const updated = await recalcJobFinancials(jobId);
    return res.json(mapJobCard(updated));
  } catch (err) {
    console.error("Update payment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /jobcards/:id/payments/:paymentId
 */
router.delete("/:id/payments/:paymentId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.id);
    const paymentId = Number(req.params.paymentId);
    if (isNaN(jobId) || isNaN(paymentId)) return res.status(400).json({ message: "Invalid ids" });

    const payment = await prisma.jobPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.jobCardId !== jobId) {
      return res.status(404).json({ message: "Payment not found" });
    }

    await prisma.jobPayment.delete({ where: { id: paymentId } });

    // ✅ Sync with sales (recreates sales based on remaining payments)
    await syncJobCardSale(jobId);
    
    const updated = await recalcJobFinancials(jobId);
    return res.json(mapJobCard(updated));
  } catch (err) {
    console.error("Delete payment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /jobcards/:id/close
 */
router.post("/:id/close", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job id" });

    const body = req.body as CloseJobBody;

    const job = await prisma.jobCard.findUnique({
      where: { id: jobId },
      include: { vehicle: true },
    });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const withTotals = await recalcJobFinancials(jobId);
    const outDate = body.outDate ? new Date(body.outDate) : new Date();

    const finalMode =
      body.finalPaymentMode == null
        ? null
        : typeof body.finalPaymentMode === "string"
        ? parsePaymentMode(body.finalPaymentMode)
        : body.finalPaymentMode;

    const delivered = await prisma.jobCard.update({
      where: { id: jobId },
      data: {
        status: JobStatus.DELIVERED,
        promisedDate: withTotals.promisedDate,
        finalPaymentMode: finalMode,
        invoiceNumber: body.invoiceNumber ?? withTotals.invoiceNumber,
        additionalNotes: body.note ?? withTotals.additionalNotes,
      },
      include: { vehicle: true, lineItems: true, payments: true },
    });

    // ✅ Sync sale based on actual payments
    await syncJobCardSale(jobId);

    const finalJob = await prisma.jobCard.findUnique({
      where: { id: jobId },
      include: {
        vehicle: true,
        lineItems: { orderBy: { id: "asc" } },
        payments: { orderBy: { date: "asc" } },
      },
    });

    return res.json(mapJobCard(finalJob));
  } catch (err) {
    console.error("Close jobcard error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /jobcards/:id
 * ✅ Now deletes ALL associated sales (1:many relationship)
 */
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid job id" });

    const job = await prisma.jobCard.findUnique({ 
      where: { id },
      include: { sales: true } // ✅ Changed from 'sale' to 'sales'
    });
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Delete related data
    await prisma.jobPayment.deleteMany({ where: { jobCardId: id } });
    await prisma.jobLineItem.deleteMany({ where: { jobCardId: id } });
    await prisma.jobInspectionItem.deleteMany({
      where: { inspection: { jobCardId: id } },
    });
    await prisma.jobInspection.deleteMany({ where: { jobCardId: id } });

    // ✅ Delete ALL sales for this job card
    if (job.sales && job.sales.length > 0) {
      // Delete all sale versions for each sale
      for (const sale of job.sales) {
        await prisma.saleVersion.deleteMany({ where: { saleId: sale.id } });
      }
      // Then delete all sales
      await prisma.sale.deleteMany({ where: { jobCardId: id } });
    }

    await prisma.jobCard.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete jobcard error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;