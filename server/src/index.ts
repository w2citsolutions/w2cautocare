// server/src/index.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import prisma from "./config/prisma";

import authRoutes from "./routes/auth";
import employeeRoutes from "./routes/employees";
import advanceRoutes from "./routes/advances";
import payrollRoutes from "./routes/payroll";
import salesRoutes from "./routes/sales";
import expenseRoutes from "./routes/expenses";
import inventoryRoutes from "./routes/inventory";
import dashboardRoutes from "./routes/dashboard";
import attendanceRoutes from "./routes/attendance";
import vehicleRoutes from "./routes/vehicles";
import jobCardRoutes from "./routes/jobcards";
import inspectionTemplateRoutes from "./routes/inspectionTemplates";
import jobInspectionRoutes from "./routes/jobInspections";
// ✅ NEW ROUTES
import vendorRoutes from "./routes/vendors";
import jobCardTemplatesRouter from './routes/Jobcardtemplates';
//import dashboardEnhancedRoutes from "./routes/dashboard_enhanced";


const app = express();

/**
 * Global CORS + preflight middleware
 * - Reflects whatever Origin is sent (so works for localhost and Railway frontend)
 * - Answers ALL OPTIONS requests with 204
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = (req.headers.origin as string) || "*";

  // Allow the calling origin (or *)
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Vary", "Origin");

  // Allowed methods and headers
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization"
  );

  // If this is a preflight request, stop here
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

// Public routes
app.use("/auth", authRoutes);

// Protected routes
app.use("/employees", employeeRoutes);
app.use("/advances", advanceRoutes);
app.use("/payroll", payrollRoutes);
app.use("/sales", salesRoutes);
app.use("/expenses", expenseRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/jobcards", jobCardRoutes);
app.use("/inspection-templates", inspectionTemplateRoutes);
app.use("/", jobInspectionRoutes);

// ✅ NEW ROUTES - FIXED VARIABLE NAME
app.use("/vendors", vendorRoutes);
app.use("/job-card-templates", jobCardTemplatesRouter); // ✅ Correct variable name
//app.use("/dashboard-enhanced", dashboardEnhancedRoutes);


// Health
app.get("/health", async (_req: Request, res: Response) => {
  try {
    const now = await prisma.$queryRaw`SELECT NOW()`;
    res.json({ status: "ok", now });
  } catch (error) {
    console.error("Health check DB error:", error);
    res.status(500).json({ status: "error", error: String(error) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`W2CAutocare API running on port ${PORT}`);
});