import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

function mapVehicle(v: any) {
  return {
    id: v.id,
    regNumber: v.regNumber,
    make: v.make,
    model: v.model,
    variant: v.variant,
    fuelType: v.fuelType,
    year: v.year,
    color: v.color,
    ownerName: v.ownerName,
    ownerPhone: v.ownerPhone,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

// POST /vehicles
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      regNumber,
      make,
      model,
      variant,
      fuelType,
      year,
      color,
      ownerName,
      ownerPhone,
    } = req.body as {
      regNumber: string;
      make?: string;
      model?: string;
      variant?: string;
      fuelType?: string;
      year?: number;
      color?: string;
      ownerName: string;
      ownerPhone?: string;
    };

    if (!regNumber || !ownerName) {
      return res
        .status(400)
        .json({ message: "regNumber and ownerName are required." });
    }

    const reg = regNumber.trim().toUpperCase();

    const existing = await prisma.vehicle.findUnique({
      where: { regNumber: reg },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Vehicle with this registration already exists." });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        regNumber: reg,
        make: make?.trim() || null,
        model: model?.trim() || null,
        variant: variant?.trim() || null,
        fuelType: fuelType?.trim() || null,
        year: year ?? null,
        color: color?.trim() || null,
        ownerName,
        ownerPhone: ownerPhone || null,
      },
    });

    res.status(201).json(mapVehicle(vehicle));
  } catch (err) {
    console.error("Create vehicle error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /vehicles?q=...
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rawQ = req.query.q;
    const q = rawQ ? String(rawQ).trim() : "";

    const where: any = {};

    if (q) {
      const qUpper = q.toUpperCase();
      where.OR = [
        { regNumber: { contains: qUpper } },
        { ownerName: { contains: q } },
        { ownerPhone: { contains: q } },
      ];
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(vehicles.map(mapVehicle));
  } catch (err) {
    console.error("List vehicles error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /vehicles/:id
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid vehicle id" });

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.json(mapVehicle(vehicle));
  } catch (err) {
    console.error("Get vehicle error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /vehicles/:id
router.put("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid vehicle id" });

    const {
      make,
      model,
      variant,
      fuelType,
      year,
      color,
      ownerName,
      ownerPhone,
    } = req.body as {
      make?: string;
      model?: string;
      variant?: string;
      fuelType?: string;
      year?: number;
      color?: string;
      ownerName?: string;
      ownerPhone?: string;
    };

    const data: any = {};
    if (make !== undefined) data.make = make?.trim() || null;
    if (model !== undefined) data.model = model?.trim() || null;
    if (variant !== undefined) data.variant = variant?.trim() || null;
    if (fuelType !== undefined) data.fuelType = fuelType?.trim() || null;
    if (year !== undefined) data.year = year ?? null;
    if (color !== undefined) data.color = color?.trim() || null;
    if (ownerName !== undefined) data.ownerName = ownerName;
    if (ownerPhone !== undefined) data.ownerPhone = ownerPhone || null;

    const updated = await prisma.vehicle.update({
      where: { id },
      data,
    });

    res.json(mapVehicle(updated));
  } catch (err: any) {
    console.error("Update vehicle error:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /vehicles/by-reg/:regNumber  -> basic history
router.get(
  "/by-reg/:regNumber",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const reg = String(req.params.regNumber).trim().toUpperCase();

      const vehicle = await prisma.vehicle.findUnique({
        where: { regNumber: reg },
        include: {
          jobCards: {
            include: {
              lineItems: true,
              payments: true,
              // ✅ FIXED: Changed 'sale' to 'sales' (correct property name)
              sales: {
                include: { currentVersion: true },
              },
            },
            orderBy: { inDate: "desc" },
          },
        },
      });

      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      // ✅ FIXED: Added type annotation and optional chaining
      const jobs = vehicle.jobCards.map((j: any) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        status: j.status,
        inDate: j.inDate,
        promisedDate: j.promisedDate,
        invoiceNumber: j.invoiceNumber,
        // ✅ FIXED: Changed 'sale' to 'sales' to match the include
        saleAmount: j.sales?.currentVersion
          ? j.sales.currentVersion.amount / 100
          : null,
      }));

      res.json({
        vehicle: mapVehicle(vehicle),
        jobs,
      });
    } catch (err) {
      console.error("Vehicle by-reg history error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;