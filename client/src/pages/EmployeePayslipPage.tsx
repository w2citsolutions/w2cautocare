import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface PayrollPeriod {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

interface Employee {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
}

interface PayslipAdvance {
  id: number;
  date: string;
  amount: number;
  paymentMode: string;
  note?: string | null;
  paidBy?: string | null;
}

interface Payslip {
  id: number;
  employeeId: number;
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

interface PayslipDetailResponse {
  period: PayrollPeriod;
  employee: Employee;
  payslip: Payslip;
}

const EmployeePayslipPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { periodId, employeeId } = useParams();
  
  const [data, setData] = useState<PayslipDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const loadData = async () => {
    if (!periodId || !employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PayslipDetailResponse>(
        `/payroll/periods/${periodId}/payslips/${employeeId}`
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load payslip");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [periodId, employeeId]);

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
      <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 print:hidden">
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
        <div className="max-w-4xl mx-auto">
          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-8 print:hidden">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back to Payroll</span>
            </button>
            <button
              onClick={() => window.print()}
              disabled={loading || !data}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print Payslip</span>
            </button>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-16">
              <div className="text-gray-500">Loading payslip...</div>
            </div>
          ) : !data ? (
            <div className="text-center py-16">
              <div className="text-gray-500">No payslip data found</div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 print:shadow-none print:border-2">
              {/* Header */}
              <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-200">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    W2C Autocare
                  </h1>
                  <p className="text-sm text-gray-600">Monthly Payslip</p>
                  <p className="text-lg font-semibold text-blue-600 mt-2">
                    {data.period.name}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">Generated On</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatDate(data.payslip.generatedAt)}
                  </div>
                </div>
              </div>

              {/* Employee & Period Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Employee Details
                  </div>
                  <div className="text-lg font-bold text-gray-900 mb-1">
                    {data.employee.name}
                  </div>
                  {data.employee.phone && (
                    <div className="text-sm text-gray-600">
                      📞 {data.employee.phone}
                    </div>
                  )}
                  {data.employee.address && (
                    <div className="text-sm text-gray-600 mt-1">
                      📍 {data.employee.address}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Pay Period
                  </div>
                  <div className="text-sm text-gray-900">
                    {formatDate(data.period.startDate)} to{" "}
                    {formatDate(data.period.endDate)}
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Earnings */}
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-5">
                  <h3 className="text-sm font-bold text-green-800 mb-4 uppercase tracking-wider">
                    Earnings
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Gross Salary</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(data.payslip.grossSalary)}
                      </span>
                    </div>
                    {data.payslip.allowances > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Allowances</span>
                        <span className="font-semibold text-green-700">
                          +{formatCurrency(data.payslip.allowances)}
                        </span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-green-300">
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-gray-900">Total Earnings</span>
                        <span className="text-green-700">
                          {formatCurrency(
                            data.payslip.grossSalary + data.payslip.allowances
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-5">
                  <h3 className="text-sm font-bold text-red-800 mb-4 uppercase tracking-wider">
                    Deductions
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Advances</span>
                      <span className="font-semibold text-red-700">
                        -{formatCurrency(data.payslip.totalAdvances)}
                      </span>
                    </div>
                    {data.payslip.unpaidLeaveAmount && data.payslip.unpaidLeaveAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          Unpaid Leave ({data.payslip.unpaidLeaveDays} days)
                        </span>
                        <span className="font-semibold text-red-700">
                          -{formatCurrency(data.payslip.unpaidLeaveAmount)}
                        </span>
                      </div>
                    )}
                    {data.payslip.otherDeductions > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Other Deductions</span>
                        <span className="font-semibold text-red-700">
                          -{formatCurrency(data.payslip.otherDeductions)}
                        </span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-red-300">
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-gray-900">Total Deductions</span>
                        <span className="text-red-700">
                          -{formatCurrency(
                            data.payslip.totalAdvances +
                            (data.payslip.unpaidLeaveAmount || 0) +
                            data.payslip.otherDeductions
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">NET PAY</span>
                  <span className="text-3xl font-bold text-blue-700">
                    {formatCurrency(data.payslip.netPay)}
                  </span>
                </div>
              </div>

              {/* Advances Details */}
              {data.payslip.advances.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                    Advance Details (This Period)
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold text-gray-700">
                            Date
                          </th>
                          <th className="py-3 px-4 text-left font-semibold text-gray-700">
                            Payment Mode
                          </th>
                          <th className="py-3 px-4 text-left font-semibold text-gray-700">
                            Paid By
                          </th>
                          <th className="py-3 px-4 text-right font-semibold text-gray-700">
                            Amount
                          </th>
                          <th className="py-3 px-4 text-left font-semibold text-gray-700">
                            Note
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payslip.advances.map((adv) => (
                          <tr key={adv.id} className="border-t border-gray-200">
                            <td className="py-3 px-4 text-gray-900">
                              {formatDate(adv.date)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                                {adv.paymentMode}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {adv.paidBy ? (
                                <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded">
                                  {adv.paidBy}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-gray-900">
                              {formatCurrency(adv.amount)}
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {adv.note || "-"}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-300 bg-gray-50">
                          <td colSpan={3} className="py-3 px-4 font-bold text-gray-900">
                            Total Advances
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            {formatCurrency(data.payslip.totalAdvances)}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500">
                  This is a computer-generated payslip from W2C Autocare.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Generated on {formatDate(data.payslip.generatedAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default EmployeePayslipPage;