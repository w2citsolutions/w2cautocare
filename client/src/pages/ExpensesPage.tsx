import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK" | "OTHER";

interface Expense {
  id: number;
  createdAt: string;
  date: string | null;
  amount: number;
  category: string | null;
  vendor: string | null;
  paymentMode: PaymentMode | null;
  paidBy?: string | null;
  reference: string | null;
  note: string | null;
}

const paymentModes: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK", "OTHER"];
const paidByOptions = ["Nitesh", "Tanmeet", "Bank Account"];
const categoryOptions = [
  "Rent",
  "Utilities",
  "Salaries",
  "Supplies",
  "Maintenance",
  "Marketing",
  "Insurance",
  "Transportation",
  "Equipment",
  "Other",
];

const ExpensesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Helper to detect if expense is from employee advance
  const isEmployeeAdvance = (exp: Expense): boolean => {
    return (
      exp.category === "Employee Advance" ||
      (exp.reference?.startsWith("Advance #") ?? false)
    );
  };

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPaymentMode, setFilterPaymentMode] = useState("all");
  const [filterPaidBy, setFilterPaidBy] = useState("all");

  // Form
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [vendor, setVendor] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [paidBy, setPaidBy] = useState("Nitesh");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const formatDate = (iso: string | null) => {
    if (!iso) return "No date";
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const loadExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      const query = params.toString() ? `?${params.toString()}` : "";

      const res = await apiFetch<Expense[]>(`/expenses${query}`);
      setExpenses(res);
    } catch (err: any) {
      setError(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const resetForm = () => {
    setAmount("");
    setDate("");
    setCategory("");
    setVendor("");
    setPaymentMode("CASH");
    setPaidBy("Nitesh");
    setReference("");
    setNote("");
    setEditingExpense(null);
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
        vendor: vendor || undefined,
        paymentMode,
        paidBy,
        reference: reference || undefined,
        note: note || undefined,
      };

      if (editingExpense) {
        await apiFetch(`/expenses/${editingExpense.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/expenses", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      resetForm();
      await loadExpenses();
    } catch (err: any) {
      setError(err.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    // ✅ Check if this is an employee advance
    if (isEmployeeAdvance(expense)) {
      alert(
        "⚠️ Cannot Edit Auto-Synced Expense\n\n" +
        "This expense is automatically synced from an Employee Advance.\n\n" +
        "To modify it, please go to the Advances page and update the advance entry.\n\n" +
        `Reference: ${expense.reference || "N/A"}\n` +
        `Employee: ${expense.vendor || "N/A"}`
      );
      return;
    }

    setEditingExpense(expense);
    setDate(expense.date ? expense.date.slice(0, 10) : "");
    setAmount(String(expense.amount));
    setCategory(expense.category || "");
    setVendor(expense.vendor || "");
    setPaymentMode(expense.paymentMode || "CASH");
    setPaidBy(expense.paidBy || "Nitesh");
    setReference(expense.reference || "");
    setNote(expense.note || "");
  };

  const handleDelete = async (expense: Expense) => {
    // ✅ Check if this is an employee advance
    if (isEmployeeAdvance(expense)) {
      alert(
        "⚠️ Cannot Delete Auto-Synced Expense\n\n" +
        "This expense is automatically synced from an Employee Advance.\n\n" +
        "To delete it, please go to the Advances page and delete the advance entry.\n\n" +
        `Reference: ${expense.reference || "N/A"}\n` +
        `Employee: ${expense.vendor || "N/A"}`
      );
      return;
    }

    if (!window.confirm("Delete this expense entry?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/expenses/${expense.id}`, {
        method: "DELETE",
      });
      if (editingExpense?.id === expense.id) {
        resetForm();
      }
      await loadExpenses();
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    } finally {
      setSaving(false);
    }
  };

  const filteredExpenses = expenses.filter((expense) => {
    if (filterCategory !== "all" && expense.category !== filterCategory) {
      return false;
    }
    if (filterPaymentMode !== "all" && expense.paymentMode !== filterPaymentMode) {
      return false;
    }
    if (filterPaidBy !== "all" && expense.paidBy !== filterPaidBy) {
      return false;
    }
    return true;
  });

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

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
        <div className="max-w-[1800px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Expense Management</h2>
            <p className="text-gray-600 mt-1">Track and manage all business expenses</p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={loadExpenses}
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
                  <option value="Employee Advance">Employee Advance</option>
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
                  Paid By
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterPaidBy}
                  onChange={(e) => setFilterPaidBy(e.target.value)}
                >
                  <option value="all">Everyone</option>
                  {paidByOptions.map((person) => (
                    <option key={person} value={person}>{person}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredExpenses.length}</span> of{" "}
                <span className="font-semibold text-gray-900">{expenses.length}</span> expenses
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                {editingExpense ? "Edit Expense" : "Add New Expense"}
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
                    Vendor
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="Vendor name"
                  />
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
                    Paid By
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {paidByOptions.map((person) => (
                      <button
                        key={person}
                        type="button"
                        onClick={() => setPaidBy(person)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                          paidBy === person
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
                    Reference / Bill #
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
                      ? editingExpense
                        ? "Updating..."
                        : "Adding..."
                      : editingExpense
                      ? "Update Expense"
                      : "Add Expense"}
                  </button>
                  {editingExpense && (
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

            {/* Expenses List */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Expenses List ({filteredExpenses.length})
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Total: <span className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</span>
                    </p>
                  </div>
                  {loading && <span className="text-sm text-gray-500">Loading...</span>}
                </div>

                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">No expenses found</div>
                    <div className="text-sm text-gray-500">Add an expense using the form</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredExpenses.map((expense) => {
                      const isAdvance = isEmployeeAdvance(expense);
                      
                      return (
                        <div
                          key={expense.id}
                          className={`border border-gray-200 rounded-lg p-4 transition-colors ${
                            isAdvance 
                              ? "bg-blue-50 border-blue-200" 
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-xl font-bold text-gray-900">
                                  {formatCurrency(expense.amount)}
                                </h4>
                                {expense.category && (
                                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                                    isAdvance
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-purple-100 text-purple-700"
                                  }`}>
                                    {expense.category}
                                  </span>
                                )}
                                {isAdvance && (
                                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded">
                                    Auto-Synced
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {expense.paymentMode && (
                                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                                    {expense.paymentMode}
                                  </span>
                                )}
                                {expense.paidBy && (
                                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded">
                                    {expense.paidBy}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-600">
                              {formatDate(expense.date)}
                            </div>
                          </div>

                          {(expense.vendor || expense.reference || expense.note) && (
                            <div className="mb-3 space-y-2 text-sm">
                              {expense.vendor && (
                                <div className="text-gray-600">
                                  {isAdvance ? (
                                    <>
                                      <span className="text-blue-600 font-semibold">👤 Employee:</span>{" "}
                                      <span className="font-medium text-blue-700">{expense.vendor}</span>
                                    </>
                                  ) : (
                                    <>
                                      Vendor: <span className="font-medium">{expense.vendor}</span>
                                    </>
                                  )}
                                </div>
                              )}
                              {expense.reference && (
                                <div className="text-gray-600">
                                  Ref: <span className="font-medium">{expense.reference}</span>
                                </div>
                              )}
                              {expense.note && (
                                <div className="text-gray-600 bg-gray-50 p-2 rounded">
                                  {expense.note}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2 pt-3 border-t border-gray-200">
                            {isAdvance ? (
                              <button
                                onClick={() => handleEdit(expense)}
                                className="flex-1 px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                                title="This expense is auto-synced from Advances"
                              >
                                📋 View Only (Auto-Synced)
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(expense)}
                                  className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(expense)}
                                  disabled={saving}
                                  className="flex-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

export default ExpensesPage;