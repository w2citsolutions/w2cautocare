import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// Types for request body
interface EmployeeBody {
  name: string;
  phone?: string;
  address?: string;
  joinDate?: string; // ISO string from client
  baseSalary: number; // in rupees from client
}

// Helper to map DB -> API (paise -> rupees)
function mapEmployee(e: any) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone,
    address: e.address,
    joinDate: e.joinDate,
    isActive: e.isActive,
    baseSalary: e.baseSalary / 100, // rupees
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

// POST /employees
router.post(
  "/",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { name, phone, address, joinDate, baseSalary } = req.body as EmployeeBody;

      if (!name || baseSalary == null) {
        return res
          .status(400)
          .json({ message: "Name and baseSalary (in rupees) are required." });
      }

      const baseSalaryPaise = Math.round(Number(baseSalary) * 100);

      const employee = await prisma.employee.create({
        data: {
          name,
          phone,
          address,
          joinDate: joinDate ? new Date(joinDate) : null,
          baseSalary: baseSalaryPaise,
        },
      });

      return res.status(201).json(mapEmployee(employee));
    } catch (err) {
      console.error("Create employee error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// GET /employees?includeInactive=true|false
router.get(
  "/",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { includeInactive } = req.query;
      const includeAll = includeInactive === "true";

      const employees = await prisma.employee.findMany({
        where: includeAll ? {} : { isActive: true },
        orderBy: { name: "asc" },
      });

      return res.json(employees.map(mapEmployee));
    } catch (err) {
      console.error("List employees error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// GET /employees/:id
router.get(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid employee id" });
      }

      const employee = await prisma.employee.findUnique({ where: { id } });
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      return res.json(mapEmployee(employee));
    } catch (err) {
      console.error("Get employee error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// PUT /employees/:id  (full update)
router.put(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid employee id" });
      }

      const { name, phone, address, joinDate, baseSalary, isActive } =
        req.body as EmployeeBody & { isActive?: boolean };

      if (!name || baseSalary == null) {
        return res
          .status(400)
          .json({ message: "Name and baseSalary (in rupees) are required." });
      }

      const baseSalaryPaise = Math.round(Number(baseSalary) * 100);

      const employee = await prisma.employee.update({
        where: { id },
        data: {
          name,
          phone,
          address,
          joinDate: joinDate ? new Date(joinDate) : null,
          baseSalary: baseSalaryPaise,
          // we allow isActive toggle from here too if provided
          ...(typeof isActive === "boolean" ? { isActive } : {}),
        },
      });

      return res.json(mapEmployee(employee));
    } catch (err: any) {
      console.error("Update employee error:", err);
      if (err.code === "P2025") {
        // Prisma "record not found"
        return res.status(404).json({ message: "Employee not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// PATCH /employees/:id/status  (activate/deactivate)
router.patch(
  "/:id/status",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid employee id" });
      }

      const { isActive } = req.body as { isActive: boolean };

      if (typeof isActive !== "boolean") {
        return res
          .status(400)
          .json({ message: "isActive (boolean) is required." });
      }

      const employee = await prisma.employee.update({
        where: { id },
        data: { isActive },
      });

      return res.json(mapEmployee(employee));
    } catch (err: any) {
      console.error("Update employee status error:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ message: "Employee not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
