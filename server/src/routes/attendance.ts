import { Router } from "express";
import prisma from "../config/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// ✅ FIXED: Removed WEEKLY_OFF and HOLIDAY (not in schema enum)
const ALLOWED_ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "UNPAID_LEAVE",
  "PAID_LEAVE",
] as const;
type AttendanceStatusString = (typeof ALLOWED_ATTENDANCE_STATUSES)[number];

interface AttendanceBody {
  employeeId: number;
  date: string; // ISO
  status: AttendanceStatusString | string;
  reason?: string;
}

function normalizeDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error("Invalid date");
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

// map DB -> API
function mapAttendance(a: any) {
  return {
    id: a.id,
    employeeId: a.employeeId,
    date: a.date,
    status: a.status,
    reason: a.reason,
    createdAt: a.createdAt,
    employee: a.employee
      ? { id: a.employee.id, name: a.employee.name }
      : undefined,
  };
}

// POST /attendance  -> create or update a record for (employee, date)
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { employeeId, date, status, reason } = req.body as AttendanceBody;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        message: "employeeId, date and status are required.",
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: Number(employeeId) },
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const dateObj = normalizeDate(date);
    const statusStr =
      typeof status === "string" ? status.toUpperCase() : String(status);

    if (
      !(ALLOWED_ATTENDANCE_STATUSES as readonly string[]).includes(statusStr)
    ) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${ALLOWED_ATTENDANCE_STATUSES.join(
          ", "
        )}`,
      });
    }

    const record = (await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: Number(employeeId),
          date: dateObj,
        },
      },
      create: {
        employeeId: Number(employeeId),
        date: dateObj,
        // Prisma's type is a specific enum, but we've validated the string:
        status: statusStr as any,
        reason: reason ?? null,
      },
      update: {
        status: statusStr as any,
        reason: reason ?? null,
      },
      include: {
        employee: {
          select: { id: true, name: true },
        },
      },
    })) as any;

    return res.status(201).json(mapAttendance(record));
  } catch (err: any) {
    console.error("Create/update attendance error:", err);
    if (err.message === "Invalid date") {
      return res.status(400).json({ message: "Invalid date format" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /attendance/:id -> update a single attendance record
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid attendance id" });
    }

    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Attendance not found" });
    }

    const { employeeId, date, status, reason } =
      req.body as Partial<AttendanceBody>;

    const data: any = {};

    if (employeeId != null) {
      const emp = await prisma.employee.findUnique({
        where: { id: Number(employeeId) },
      });
      if (!emp) {
        return res.status(404).json({ message: "Employee not found" });
      }
      data.employeeId = Number(employeeId);
    }

    if (typeof date === "string") {
      const dt = new Date(date);
      if (isNaN(dt.getTime())) {
        return res.status(400).json({ message: "Invalid date" });
      }
      data.date = dt;
    }

    if (status) {
      const upper = status.toString().toUpperCase();
      if (
        !(ALLOWED_ATTENDANCE_STATUSES as readonly string[]).includes(upper)
      ) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${ALLOWED_ATTENDANCE_STATUSES.join(
            ", "
          )}`,
        });
      }
      // Again, cast to any to satisfy Prisma's enum typing
      data.status = upper as any;
    }

    // ✅ FIXED: Changed note to reason to match schema
    if (reason !== undefined) {
      data.reason = reason ?? null;
    }

    const updated: any = await prisma.attendance.update({
      where: { id },
      data,
      include: {
        employee: {
          select: { id: true, name: true },
        },
      },
    });

    return res.json(mapAttendance(updated));
  } catch (err) {
    console.error("Update attendance error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /attendance?employeeId=&from=&to=
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { employeeId, from, to } = req.query;

    const where: any = {};

    if (employeeId) {
      where.employeeId = Number(employeeId);
    }

    if (from || to) {
      where.date = {};
      if (from) {
        const f = normalizeDate(String(from));
        where.date.gte = f;
      }
      if (to) {
        const t = normalizeDate(String(to));
        t.setHours(23, 59, 59, 999);
        where.date.lte = t;
      }
    }

    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        employee: {
          select: { id: true, name: true },
        },
      },
    });

    return res.json(records.map(mapAttendance));
  } catch (err) {
    console.error("List attendance error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /attendance/:id
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid attendance id" });
    }

    await prisma.attendance.delete({
      where: { id },
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Delete attendance error:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Attendance not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;