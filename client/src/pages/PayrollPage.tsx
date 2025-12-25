import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

type PayrollStatus = "OPEN" | "CLOSED";

interface PayrollPeriod {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: PayrollStatus;
  createdAt: string;
  closedAt?: string | null;
}

interface PayslipAdvance {
  id: number;
  date: string;
  amount: number;
  paymentMode: string;
  note?: string | null;
}

interface Payslip {
  id: number;
  employeeId: number;
  employee?: { id: number; name: string };
  grossSalary: number;
  totalAdvances: number;
  otherDeductions: number;
  allowances: number;
  netPay: number;
  generatedAt: string;
  advances: PayslipAdvance[];
  unpaidLeaveDays?: number;
  unpaidLeaveAmount?: number;
}

interface PayslipResponse {
  period: PayrollPeriod;
  payslips: Payslip[];
}

const PayrollPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [runningAction, setRunningAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const loadPeriods = async () => {
    setLoadingPeriods(true);
    setError(null);
    try {
      const res = await apiFetch<PayrollPeriod[]>("/payroll/periods");
      setPeriods(res);
      if (!selectedPeriod && res.length > 0) {
        await loadPayslipsForPeriod(res[0].id, res[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load payroll periods");
    } finally {
      setLoadingPeriods(false);
    }
  };

  const loadPayslipsForPeriod = async (id: number, period?: PayrollPeriod) => {
    setLoadingPayslips(true);
    setError(null);
    try {
      const res = await apiFetch<PayslipResponse>(`/payroll/periods/${id}/payslips`);
      setSelectedPeriod(period || res.period);
      setPayslips(res.payslips);
    } catch (err: any) {
      setError(err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoadingPayslips(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  const handleCreatePeriod = async () => {
    setRunningAction(true);
    setError(null);
    try {
      const res = await apiFetch<PayrollPeriod>("/payroll/periods", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadPeriods();
      await loadPayslipsForPeriod(res.id, res);
    } catch (err: any) {
      setError(err.message || "Failed to create payroll period");
    } finally {
      setRunningAction(false);
    }
  };

  const handleGeneratePayslips = async () => {
    if (!selectedPeriod) return;
    setRunningAction(true);
    setError(null);
    try {
      await apiFetch(`/payroll/periods/${selectedPeriod.id}/generate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadPayslipsForPeriod(selectedPeriod.id, selectedPeriod);
    } catch (err: any) {
      setError(err.message || "Failed to generate payslips");
    } finally {
      setRunningAction(false);
    }
  };

  const handleClosePeriod = async () => {
    if (!selectedPeriod) return;
    setRunningAction(true);
    setError(null);
    try {
      const res = await apiFetch<PayrollPeriod>(
        `/payroll/periods/${selectedPeriod.id}/close`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setSelectedPeriod(res);
      await loadPeriods();
    } catch (err: any) {
      setError(err.message || "Failed to close payroll period");
    } finally {
      setRunningAction(false);
    }
  };

  const handleReopenPeriod = async () => {
    if (!selectedPeriod) return;
    setRunningAction(true);
    setError(null);
    try {
      const res = await apiFetch<PayrollPeriod>(
        `/payroll/periods/${selectedPeriod.id}/reopen`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setSelectedPeriod(res);
      await loadPeriods();
      await loadPayslipsForPeriod(res.id, res);
    } catch (err: any) {
      setError(err.message || "Failed to reopen payroll period");
    } finally {
      setRunningAction(false);
    }
  };

  const totalNetPay = payslips.reduce((sum, p) => sum + p.netPay, 0);
  const totalAdvances = payslips.reduce((sum, p) => sum + p.totalAdvances, 0);
  const totalLeaveDeduction = payslips.reduce(
    (sum, p) => sum + (p.unpaidLeaveAmount ?? 0),
    0
  );

  const navItems = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/employees", label: "Employees", icon: "👥" },
    { path: "/advances", label: "Advances", icon: "💵" },
    { path: "/payroll", label: "Payroll", icon: "💰" },
    { path: "/sales", label: "Sales", icon: "📈" },
    { path: "/expenses", label: "Expenses", icon: "💸" },
    { path: "/inventory", label: "Inventory", icon: "📦" },
    { path: "/attendance", label: "Attendance", icon: "📅" },
    { path: "/jobs", label: "Job Cards", icon: "🚗" },
    { path: "/vendors", label: "Vendors", icon: "🏪" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-8">
              <div>
                <h1 className="text-xl font-bold text-gray-900">W2C Autocare</h1>
                <p className="text-xs text-gray-500">Business Console</p>
              </div>

              {/* Horizontal Navigation */}
              <div className="hidden lg:flex items-center space-x-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      location.pathname === item.path
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Side - User & Logout */}
            <div className="flex items-center space-x-4">
              {user && (
                <>
                  <div className="hidden md:block text-right">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  <button
                    onClick={logout}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <span>Logout</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Payroll Management</h2>
              <p className="text-gray-600 mt-1">
                Generate payslips with automatic advance & unpaid leave deductions
              </p>
            </div>
            <button
              onClick={handleCreatePeriod}
              disabled={runningAction}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {runningAction ? "Creating..." : "New Period (Current Month)"}
            </button>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Period List */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Payroll Periods</h3>
                {loadingPeriods && (
                  <span className="text-sm text-gray-500">Loading...</span>
                )}
              </div>

              {periods.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">No periods yet</div>
                  <div className="text-sm text-gray-500">
                    Click "New Period" to create one
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {periods.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => loadPayslipsForPeriod(p.id, p)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                        selectedPeriod?.id === p.id
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-900">{p.name}</div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded ${
                            p.status === "OPEN"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(p.startDate).toLocaleDateString("en-IN")} -{" "}
                        {new Date(p.endDate).toLocaleDateString("en-IN")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Payslips */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-2 hover:shadow-md transition-shadow">
              {!selectedPeriod ? (
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-2">No period selected</div>
                  <div className="text-sm text-gray-500">
                    Select a period to view payslips
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedPeriod.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {payslips.length} payslip{payslips.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {selectedPeriod.status === "OPEN" ? (
                        <>
                          <button
                            onClick={handleGeneratePayslips}
                            disabled={runningAction}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            Generate Payslips
                          </button>
                          <button
                            onClick={handleClosePeriod}
                            disabled={runningAction || payslips.length === 0}
                            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            Close Period
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleReopenPeriod}
                          disabled={runningAction}
                          className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          Reopen Period
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Cards */}
                  {payslips.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="text-xs text-green-700 font-medium mb-1">
                          Total Net Pay
                        </div>
                        <div className="text-xl font-bold text-green-800">
                          {formatCurrency(totalNetPay)}
                        </div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <div className="text-xs text-orange-700 font-medium mb-1">
                          Total Advances
                        </div>
                        <div className="text-xl font-bold text-orange-800">
                          {formatCurrency(totalAdvances)}
                        </div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <div className="text-xs text-red-700 font-medium mb-1">
                          Unpaid Leave Deductions
                        </div>
                        <div className="text-xl font-bold text-red-800">
                          {formatCurrency(totalLeaveDeduction)}
                        </div>
                      </div>
                    </div>
                  )}

                  {loadingPayslips ? (
                    <div className="text-center py-12">
                      <div className="text-gray-500">Loading payslips...</div>
                    </div>
                  ) : payslips.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-2">No payslips generated</div>
                      <div className="text-sm text-gray-500">
                        Click "Generate Payslips" to create them
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {payslips.map((slip) => (
                        <div
                          key={slip.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() =>
                            navigate(
                              `/payroll/${selectedPeriod.id}/employee/${slip.employeeId}`
                            )
                          }
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-2">
                                {slip.employee?.name || `Employee #${slip.employeeId}`}
                              </h4>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Gross Salary:</span>
                                  <span className="font-medium text-gray-900">
                                    {formatCurrency(slip.grossSalary)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Allowances:</span>
                                  <span className="font-medium text-green-600">
                                    +{formatCurrency(slip.allowances)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Advances:</span>
                                  <span className="font-medium text-orange-600">
                                    -{formatCurrency(slip.totalAdvances)}
                                  </span>
                                </div>
                                {slip.unpaidLeaveAmount ? (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">
                                      Unpaid Leave ({slip.unpaidLeaveDays} days):
                                    </span>
                                    <span className="font-medium text-red-600">
                                      -{formatCurrency(slip.unpaidLeaveAmount)}
                                    </span>
                                  </div>
                                ) : null}
                                {slip.otherDeductions > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Other Deductions:</span>
                                    <span className="font-medium text-red-600">
                                      -{formatCurrency(slip.otherDeductions)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-6">
                              <div className="text-xs text-gray-500 mb-1">Net Pay</div>
                              <div className="text-2xl font-bold text-gray-900">
                                {formatCurrency(slip.netPay)}
                              </div>
                              <button className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-semibold">
                                View Details →
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PayrollPage;