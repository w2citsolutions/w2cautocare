import prisma from "../config/prisma";

// Keep it simple: use string types for now.
// This matches how we're calling logAudit in routes
//   entityType: "EXPENSE" | "SALE" | ...
//   action: "CREATE" | "UPDATE" | "DELETE" | ...
export async function logAudit(options: {
  userId?: number;
  entityType: string;
  entityId: number;
  action: string;
  summary?: string;
  details?: any;
}) {
  const { userId, entityType, entityId, action, summary, details } = options;

  try {
    const data: any = {
      entityType,
      entityId,
      action,
    };

    if (userId !== undefined) {
      data.userId = userId;
    }

    if (summary !== undefined) {
      data.summary = summary;
    }

    if (details !== undefined) {
      data.details = details;
    }

    await prisma.auditLog.create({ data });
  } catch (err) {
    // Avoid crashing main flow if audit logging fails
    console.error("Audit log error:", err);
  }
}
