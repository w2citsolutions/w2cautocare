import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface DashboardData {
  range: { from: string; to: string };
  kpis: {
    totalSales: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    expenseRatio: number;
    totalAdvances: number;
    salaryLiability: number;
    vendorDue: number;
  };
  sales: {
    total: number;
    count: number;
    avgSale: number;
    byPaymentMode: { mode: string; amount: number; percentage: number }[];
    byReceiver: { receiver: string; amount: number; percentage: number }[];
    byCategory: { category: string; amount: number; percentage: number }[];
  };
  expenses: {
    total: number;
    count: number;
    avgExpense: number;
    byCategory: { category: string; amount: number; percentage: number }[];
    byPaidBy: { paidBy: string; amount: number; percentage: number }[];
    byVendor: { vendor: string; amount: number; percentage: number }[];
  };
  // ✅ NEW: Separate employee advances section
  employeeAdvances: {
    total: number;
    count: number;
    byEmployee: { name: string; amount: number; percentage: number }[];
  };
  cashFlow: {
    [person: string]: { received: number; paid: number; net: number };
  };
  jobCards: {
    total: number;
    byStatus: { open: number; inProgress: number; ready: number; delivered: number; cancelled: number };
    revenue: {
      total: number;
      advances: number;
      pending: number;
      avgJobValue: number;
    };
    composition: {
      labour: number;
      parts: number;
      labourPercentage: number;
      partsPercentage: number;
    };
    byMake: { make: string; count: number }[];
    topCustomers: { name: string; jobCount: number; totalRevenue: number }[];
  };
  vendors: {
    stats: { totalActive: number; totalInactive: number; pendingPayments: number; partialPayments: number; paidPayments: number };
    totalDue: number;
    totalPayments: number;
    topDue: { id: number; name: string; totalDue: number; paymentsCount: number }[];
  };
  employees: {
    stats: { active: number; inactive: number };
    salaryLiability: number;
    totalAdvances: number;
    advancesByEmployee: { employeeId: number; employeeName: string; totalAdvances: number }[];
    attendance: { present: number; absent: number; paidLeave: number; unpaidLeave: number };
  };
  inventory: {
    stats: { totalItems: number; lowStockCount: number; outOfStockCount: number };
    lowStockItems: { id: number; name: string; category: string; currentStock: number; minStock: number }[];
    byCategory: { category: string; count: number }[];
  };
  trends: {
    daily: { date: string; sales: number; expenses: number; profit: number }[];
  };
  activity: { action: string; summary: string; createdAt: string; user: string }[];
}

type QuickRange = "TODAY" | "WEEK" | "MONTH" | "ALL";

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quickRange, setQuickRange] = useState<QuickRange>("MONTH");

  const buildDateParams = () => {
    const now = new Date();
    let from: string | null = null;
    let to: string | null = null;

    if (quickRange === "TODAY") {
      from = now.toISOString().split("T")[0];
      to = from;
    } else if (quickRange === "WEEK") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      from = weekAgo.toISOString().split("T")[0];
      to = now.toISOString().split("T")[0];
    } else if (quickRange === "MONTH") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      from = monthStart.toISOString().split("T")[0];
      to = now.toISOString().split("T")[0];
    }

    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    return params.toString();
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildDateParams();
      const res = await apiFetch<DashboardData>(`/dashboard?${params}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [quickRange]);

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

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
            <div className="flex items-center space-x-8">
              <div>
                <h1 className="text-xl font-bold text-gray-900">W2C Autocare</h1>
                <p className="text-xs text-gray-500">Business Console</p>
              </div>

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
              <h2 className="text-3xl font-bold text-gray-900">Business Dashboard</h2>
              <p className="text-gray-600 mt-1">Complete overview of your business metrics</p>
            </div>
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="flex space-x-2 mb-8">
            {(["TODAY", "WEEK", "MONTH", "ALL"] as QuickRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setQuickRange(range)}
                className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  quickRange === range
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {data && (
            <p className="text-sm text-gray-600 mb-8">
              {formatDate(data.range.from)} - {formatDate(data.range.to)}
            </p>
          )}

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="text-center py-16">
              <div className="text-gray-400">Loading dashboard data...</div>
            </div>
          )}

          {data && (
            <div className="space-y-8">
              {/* KPIs */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="text-sm text-gray-600 mb-1">Total Sales</div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpis.totalSales)}</div>
                    <div className="text-xs text-gray-500 mt-1">{data.sales.count} transactions</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="text-sm text-gray-600 mb-1">Total Expenses</div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpis.totalExpenses)}</div>
                    <div className="text-xs text-gray-500 mt-1">{data.expenses.count} transactions</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="text-sm text-gray-600 mb-1">Net Profit</div>
                    <div className={`text-2xl font-bold ${data.kpis.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(data.kpis.netProfit)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{formatPercent(data.kpis.profitMargin)} margin</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="text-sm text-gray-600 mb-1">Salary Due</div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpis.salaryLiability)}</div>
                    <div className="text-xs text-gray-500 mt-1">{data.employees.stats.active} employees</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="text-sm text-gray-600 mb-1">Vendor Due</div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpis.vendorDue)}</div>
                    <div className="text-xs text-gray-500 mt-1">{data.vendors.stats.totalActive} vendors</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="text-sm text-gray-600 mb-1">Advances</div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpis.totalAdvances)}</div>
                    <div className="text-xs text-gray-500 mt-1">Employee advances</div>
                  </div>
                </div>
              </section>

              {/* Cash Flow */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow by Person</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(data.cashFlow).map(([person, flow]) => (
                    <div key={person} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-gray-900">{person}</h4>
                        <span className={`text-xl font-bold ${flow.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {flow.net >= 0 ? '+' : ''}{formatCurrency(flow.net)}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Received</span>
                          <span className="font-medium text-green-600">+{formatCurrency(flow.received)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Paid</span>
                          <span className="font-medium text-red-600">-{formatCurrency(flow.paid)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Sales & Expenses */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sales Analytics */}
                <section>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Analytics</h3>
                  <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between pb-3 border-b">
                      <span className="text-sm text-gray-600">Total Revenue</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(data.sales.total)}</span>
                    </div>
                    <div className="flex justify-between pb-3 border-b">
                      <span className="text-sm text-gray-600">Average Sale</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(data.sales.avgSale)}</span>
                    </div>

                    {data.sales.byPaymentMode.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">By Payment Mode</h4>
                        <div className="space-y-2">
                          {data.sales.byPaymentMode.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.mode}</span>
                              <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {data.sales.byCategory.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">By Category</h4>
                        <div className="space-y-2">
                          {data.sales.byCategory.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.category}</span>
                              <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* ✅ UNIFIED Expense Analytics - Single Card */}
                <section>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Analytics</h3>
                  <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
                    
                    {/* Grand Total Header */}
                    <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-300">Grand Total</span>
                        <span className="text-2xl font-bold text-white">
                          {formatCurrency(data.expenses.total + (data.employeeAdvances?.total || 0))}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Vendor Expenses Section */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                          <span className="text-lg">🏪</span>
                          <h4 className="text-sm font-bold text-gray-900">Vendor Expenses</h4>
                          <span className="ml-auto text-lg font-bold text-gray-900">
                            {formatCurrency(data.expenses.total)}
                          </span>
                        </div>
                        
                        <div className="space-y-2 ml-6">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Transactions</span>
                            <span className="font-medium text-gray-900">{data.expenses.count}</span>
                          </div>

                          {data.expenses.byVendor.length > 0 && (
                            <div className="mt-3">
                              <h5 className="text-xs font-semibold text-gray-500 mb-2">Top Vendors</h5>
                              {data.expenses.byVendor.slice(0, 3).map((item, i) => (
                                <div key={i} className="flex justify-between text-sm py-1">
                                  <span className="text-gray-600">• {item.vendor}</span>
                                  <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {data.expenses.byCategory.length > 0 && (
                            <div className="mt-3">
                              <h5 className="text-xs font-semibold text-gray-500 mb-2">By Category</h5>
                              {data.expenses.byCategory.slice(0, 3).map((item, i) => (
                                <div key={i} className="flex justify-between text-sm py-1">
                                  <span className="text-gray-600">• {item.category}</span>
                                  <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Employee Advances Section */}
                      {data.employeeAdvances && data.employeeAdvances.count > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200">
                            <span className="text-lg">👤</span>
                            <h4 className="text-sm font-bold text-blue-700">Employee Advances</h4>
                            <span className="ml-auto text-lg font-bold text-blue-600">
                              {formatCurrency(data.employeeAdvances.total)}
                            </span>
                          </div>
                          
                          <div className="space-y-2 ml-6">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Employees</span>
                              <span className="font-medium text-gray-900">{data.employeeAdvances.count}</span>
                            </div>

                            {data.employeeAdvances.byEmployee.length > 0 && (
                              <div className="mt-3">
                                <h5 className="text-xs font-semibold text-gray-500 mb-2">By Employee</h5>
                                {data.employeeAdvances.byEmployee.slice(0, 3).map((item, i) => (
                                  <div key={i} className="flex justify-between text-sm py-1">
                                    <span className="text-blue-600 font-medium">• {item.name}</span>
                                    <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* Job Cards */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Cards Overview</h3>
                <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-3xl font-bold text-orange-600">{data.jobCards.byStatus.open}</div>
                      <div className="text-xs text-orange-800 mt-1">Open</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{data.jobCards.byStatus.inProgress}</div>
                      <div className="text-xs text-blue-800 mt-1">In Progress</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600">{data.jobCards.byStatus.ready}</div>
                      <div className="text-xs text-purple-800 mt-1">Ready</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">{data.jobCards.byStatus.delivered}</div>
                      <div className="text-xs text-green-800 mt-1">Delivered</div>
                    </div>
                  </div>

                  {data.jobCards.topCustomers.length > 0 && (
                    <div className="pt-6 border-t">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4">Top Customers</h4>
                      <div className="space-y-3">
                        {data.jobCards.topCustomers.slice(0, 5).map((customer, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                              <div className="text-xs text-gray-500">{customer.jobCount} jobs</div>
                            </div>
                            <div className="text-sm font-semibold text-gray-900">{formatCurrency(customer.totalRevenue)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Bottom Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {data.vendors.topDue.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Dues</h3>
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between mb-4 pb-4 border-b">
                        <span className="text-sm text-gray-600">Total Due</span>
                        <span className="text-lg font-bold text-red-600">{formatCurrency(data.vendors.totalDue)}</span>
                      </div>
                      <div className="space-y-3">
                        {data.vendors.topDue.slice(0, 5).map((vendor) => (
                          <div key={vendor.id} className="flex justify-between text-sm">
                            <div>
                              <div className="font-medium text-gray-900">{vendor.name}</div>
                              <div className="text-xs text-gray-500">{vendor.paymentsCount} payments</div>
                            </div>
                            <div className="font-semibold text-red-600">{formatCurrency(vendor.totalDue)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Employees</h3>
                  <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active Employees</span>
                      <span className="font-semibold text-gray-900">{data.employees.stats.active}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Salary Due</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(data.employees.salaryLiability)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Advances</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(data.employees.totalAdvances)}</span>
                    </div>
                  </div>
                </section>

                {data.inventory.lowStockItems.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Items</h3>
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        {data.inventory.lowStockItems.slice(0, 5).map((item) => (
                          <div key={item.id} className="text-sm">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-600">
                              Stock: <span className="text-red-600 font-semibold">{item.currentStock}</span> / Min: {item.minStock}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Daily Trends */}
              {data.trends.daily.length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Trends (Last 7 Days)</h3>
                  <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="space-y-2">
                      {data.trends.daily.slice(-7).map((day, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                          <span className="text-sm text-gray-600 w-24">{formatDate(day.date)}</span>
                          <div className="flex space-x-6 flex-1 text-sm">
                            <span className="text-green-600 font-medium">↑ {formatCurrency(day.sales)}</span>
                            <span className="text-red-600 font-medium">↓ {formatCurrency(day.expenses)}</span>
                            <span className={`font-semibold ${day.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                              = {formatCurrency(day.profit)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;