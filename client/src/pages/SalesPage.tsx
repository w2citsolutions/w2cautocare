import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK" | "OTHER";

interface Sale {
  id: number;
  jobCardId?: number | null;
  createdAt: string;
  date: string | null;
  amount: number;
  category?: string | null;
  paymentMode: PaymentMode | null;
  receivedBy?: string | null;
  reference?: string | null;
  note?: string | null;
  currentVersion?: {
    id: number;
    versionNumber: number;
    date: string;
    amount: number;
    category?: string | null;
    paymentMode: PaymentMode;
    receivedBy?: string | null;
    reference?: string | null;
    note?: string | null;
    createdAt: string;
    createdById?: number | null;
  } | null;
}

// Grouped sale for display
interface GroupedSale {
  id: string; // Unique ID for grouped sale
  jobCardId: number | null;
  reference: string;
  totalAmount: number;
  date: string;
  category: string;
  note?: string;
  splits: {
    saleId: number;
    receivedBy: string;
    amount: number;
    paymentMode: string;
  }[];
  // For standalone sales
  isSingleSale: boolean;
  singleSale?: Sale;
}

const paymentModes: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK", "OTHER"];
const receivedByOptions = ["Nitesh", "Tanmeet", "Bank Account"];
const categoryOptions = [
  "Service",
  "Parts",
  "Labor",
  "Washing",
  "Detailing",
  "Accessories",
  "Other",
];

const SalesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [sales, setSales] = useState<Sale[]>([]);
  const [groupedSales, setGroupedSales] = useState<GroupedSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPaymentMode, setFilterPaymentMode] = useState("all");
  const [filterReceivedBy, setFilterReceivedBy] = useState("all");

  // Form
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [receivedBy, setReceivedBy] = useState("Nitesh");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const effectiveDate = (sale: Sale): string | null => {
    if (sale.date) return sale.date;
    if (sale.currentVersion?.date) return sale.currentVersion.date;
    return null;
  };

  const effectivePaymentMode = (sale: Sale): string => {
    if (sale.paymentMode) return sale.paymentMode;
    if (sale.currentVersion?.paymentMode) return sale.currentVersion.paymentMode;
    return "";
  };

  const effectiveAmount = (sale: Sale): number => {
    if (typeof sale.amount === "number") return sale.amount;
    if (sale.currentVersion?.amount != null) return sale.currentVersion.amount;
    return 0;
  };

  const effectiveReceivedBy = (sale: Sale): string => {
    if (sale.receivedBy) return sale.receivedBy;
    if (sale.currentVersion?.receivedBy) return sale.currentVersion.receivedBy;
    return "";
  };

  const effectiveCategory = (sale: Sale): string => {
    if (sale.category) return sale.category;
    if (sale.currentVersion?.category) return sale.currentVersion.category;
    return "";
  };

  const groupSalesByJob = (salesData: Sale[]) => {
    // Separate job-based sales from standalone sales
    const jobSales: { [key: number]: Sale[] } = {};
    const standaloneSales: Sale[] = [];

    salesData.forEach((sale) => {
      if (sale.jobCardId) {
        if (!jobSales[sale.jobCardId]) {
          jobSales[sale.jobCardId] = [];
        }
        jobSales[sale.jobCardId].push(sale);
      } else {
        standaloneSales.push(sale);
      }
    });

    const grouped: GroupedSale[] = [];

    // Group job-based sales
    Object.entries(jobSales).forEach(([jobCardId, jobSalesList]) => {
      const totalAmount = jobSalesList.reduce(
        (sum, sale) => sum + effectiveAmount(sale),
        0
      );
      const firstSale = jobSalesList[0];
      const reference = firstSale.reference || firstSale.currentVersion?.reference || `Job #${jobCardId}`;
      const date = effectiveDate(firstSale) || "";
      const category = effectiveCategory(firstSale);
      const note = firstSale.note || firstSale.currentVersion?.note;

      const splits = jobSalesList.map((sale) => ({
        saleId: sale.id,
        receivedBy: effectiveReceivedBy(sale),
        amount: effectiveAmount(sale),
        paymentMode: effectivePaymentMode(sale),
      }));

      grouped.push({
        id: `job-${jobCardId}`,
        jobCardId: Number(jobCardId),
        reference,
        totalAmount,
        date,
        category,
        note,
        splits,
        isSingleSale: splits.length === 1,
        singleSale: splits.length === 1 ? firstSale : undefined,
      });
    });

    // Add standalone sales
    standaloneSales.forEach((sale) => {
      grouped.push({
        id: `sale-${sale.id}`,
        jobCardId: null,
        reference: sale.reference || sale.currentVersion?.reference || "-",
        totalAmount: effectiveAmount(sale),
        date: effectiveDate(sale) || "",
        category: effectiveCategory(sale),
        note: sale.note || sale.currentVersion?.note,
        splits: [
          {
            saleId: sale.id,
            receivedBy: effectiveReceivedBy(sale),
            amount: effectiveAmount(sale),
            paymentMode: effectivePaymentMode(sale),
          },
        ],
        isSingleSale: true,
        singleSale: sale,
      });
    });

    // Sort by date (newest first)
    grouped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setGroupedSales(grouped);
  };

  const loadSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      const query = params.toString() ? `?${params.toString()}` : "";

      const res = await apiFetch<Sale[]>(`/sales${query}`);
      setSales(res);
      groupSalesByJob(res);
    } catch (err: any) {
      setError(err.message || "Failed to load sales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const resetForm = () => {
    setAmount("");
    setDate("");
    setCategory("");
    setPaymentMode("CASH");
    setReceivedBy("Nitesh");
    setReference("");
    setNote("");
    setEditingSale(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    setError(null);

    try {
      const body = {
        amount: Number(amount),
        date: date || undefined,
        category: category || undefined,
        paymentMode,
        receivedBy,
        reference: reference || undefined,
        note: note || undefined,
      };

      if (editingSale) {
        await apiFetch(`/sales/${editingSale.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/sales", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      resetForm();
      await loadSales();
    } catch (err: any) {
      setError(err.message || "Failed to save sale");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    const d = effectiveDate(sale);
    setDate(d ? d.slice(0, 10) : "");
    const amt = effectiveAmount(sale);
    setAmount(amt ? String(amt) : "");
    setCategory(effectiveCategory(sale));
    const pm = effectivePaymentMode(sale) as PaymentMode;
    setPaymentMode(pm || "CASH");
    setReceivedBy(effectiveReceivedBy(sale) || "Nitesh");
    setReference(sale.reference || sale.currentVersion?.reference || "");
    setNote(sale.note || sale.currentVersion?.note || "");
  };

  const handleDelete = async (saleId: number) => {
    if (!window.confirm("Delete this sale entry?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/sales/${saleId}`, {
        method: "DELETE",
      });
      if (editingSale?.id === saleId) {
        resetForm();
      }
      await loadSales();
    } catch (err: any) {
      setError(err.message || "Failed to delete sale");
    } finally {
      setSaving(false);
    }
  };

  // Apply client-side filters
  const filteredSales = groupedSales.filter((sale) => {
    if (filterCategory !== "all" && sale.category !== filterCategory) {
      return false;
    }
    if (filterPaymentMode !== "all") {
      const hasMode = sale.splits.some((s) => s.paymentMode === filterPaymentMode);
      if (!hasMode) return false;
    }
    if (filterReceivedBy !== "all") {
      const hasReceiver = sale.splits.some((s) => s.receivedBy === filterReceivedBy);
      if (!hasReceiver) return false;
    }
    return true;
  });

  const totalAmount = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);

  // Calculate totals by receiver
  const totalsByReceiver = filteredSales.reduce((acc, sale) => {
    sale.splits.forEach((split) => {
      if (!acc[split.receivedBy]) acc[split.receivedBy] = 0;
      acc[split.receivedBy] += split.amount;
    });
    return acc;
  }, {} as Record<string, number>);

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
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between max-w-[1800px] mx-auto">
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
                    <div className="text-sm font-semibold text-gray-900">{user.name}</div>
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
        <div className="max-w-[1800px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Sales Management</h2>
            <p className="text-gray-600 mt-1">Track and manage all sales transactions</p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Collection Summary */}
          {Object.keys(totalsByReceiver).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {Object.entries(totalsByReceiver).map(([receiver, total]) => (
                <div key={receiver} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{receiver}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(total)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-2xl">💰</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={loadSales}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Apply Filters
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Mode
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterPaymentMode}
                  onChange={(e) => setFilterPaymentMode(e.target.value)}
                >
                  <option value="all">All Modes</option>
                  {paymentModes.map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Received By
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterReceivedBy}
                  onChange={(e) => setFilterReceivedBy(e.target.value)}
                >
                  <option value="all">Everyone</option>
                  {receivedByOptions.map((person) => (
                    <option key={person} value={person}>{person}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                {editingSale ? "Edit Sale" : "Add New Sale"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g., 5000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {paymentModes.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                          paymentMode === mode
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Received By
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {receivedByOptions.map((person) => (
                      <button
                        key={person}
                        type="button"
                        onClick={() => setReceivedBy(person)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                          receivedBy === person
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {person === "Bank Account" ? "Bank" : person}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference / Invoice #
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving
                      ? editingSale
                        ? "Updating..."
                        : "Adding..."
                      : editingSale
                      ? "Update Sale"
                      : "Add Sale"}
                  </button>
                  {editingSale && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 bg-gray-100 text-gray-700 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Sales List */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Sales List ({filteredSales.length})
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Total: <span className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</span>
                    </p>
                  </div>
                  {loading && <span className="text-sm text-gray-500">Loading...</span>}
                </div>

                {filteredSales.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">No sales found</div>
                    <div className="text-sm text-gray-500">Add a sale using the form</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSales.map((groupedSale) => (
                      <div
                        key={groupedSale.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-xl font-bold text-gray-900">
                                {formatCurrency(groupedSale.totalAmount)}
                              </h4>
                              {groupedSale.category && (
                                <span className="inline-block px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded">
                                  {groupedSale.category}
                                </span>
                              )}
                              {groupedSale.jobCardId && (
                                <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                                  Job Card
                                </span>
                              )}
                            </div>
                            {groupedSale.reference && groupedSale.reference !== "-" && (
                              <div className="text-sm text-gray-600 mb-1">
                                Ref: <span className="font-medium">{groupedSale.reference}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-right text-sm text-gray-600">
                            {groupedSale.date
                              ? new Date(groupedSale.date).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "No date"}
                          </div>
                        </div>

                        {/* Payment Split or Single Payment */}
                        {groupedSale.splits.length > 1 ? (
                          <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="text-sm font-semibold text-gray-700 mb-2">
                              💰 Payment Split ({groupedSale.splits.length} receivers)
                            </div>
                            <div className="space-y-2">
                              {groupedSale.splits.map((split, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-white rounded px-3 py-2 border border-gray-200"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded">
                                      {split.receivedBy}
                                    </span>
                                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                                      {split.paymentMode}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-gray-900">
                                      {formatCurrency(split.amount)}
                                    </span>
                                    <button
                                      onClick={() => handleDelete(split.saleId)}
                                      disabled={saving}
                                      className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                              {groupedSale.splits[0].paymentMode}
                            </span>
                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded">
                              {groupedSale.splits[0].receivedBy}
                            </span>
                          </div>
                        )}

                        {/* Note */}
                        {groupedSale.note && (
                          <div className="mb-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {groupedSale.note}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-3 border-t border-gray-200">
                          {groupedSale.isSingleSale && groupedSale.singleSale && (
                            <>
                              <button
                                onClick={() => handleEdit(groupedSale.singleSale!)}
                                className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(groupedSale.splits[0].saleId)}
                                disabled={saving}
                                className="flex-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {groupedSale.jobCardId && (
                            <Link
                              to={`/jobs?job=${groupedSale.jobCardId}`}
                              className="flex-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-center"
                            >
                              View Job Card
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SalesPage;