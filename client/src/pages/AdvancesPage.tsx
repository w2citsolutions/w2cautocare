import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface Employee {
  id: number;
  name: string;
}

type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK" | "OTHER";

interface Advance {
  id: number;
  employeeId: number;
  amount: number;
  date: string;
  paymentMode: PaymentMode;
  note?: string | null;
  createdAt: string;
  createdById?: number | null;
}

const paymentModes: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK", "OTHER"];
const paidByOptions = ["Nitesh", "Tanmeet", "Bank Account"];

const AdvancesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Add form
  const [employeeId, setEmployeeId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [paidBy, setPaidBy] = useState<string>("Nitesh");
  const [note, setNote] = useState<string>("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editPaymentMode, setEditPaymentMode] = useState<PaymentMode>("CASH");
  const [editPaidBy, setEditPaidBy] = useState<string>("Nitesh");
  const [editNote, setEditNote] = useState<string>("");

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const loadEmployees = async () => {
    const res = await apiFetch<{ id: number; name: string }[]>("/employees");
    setEmployees(res.map((e) => ({ id: e.id, name: e.name })));
  };

  const loadAdvances = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterEmployeeId !== "all") {
        params.append("employeeId", filterEmployeeId);
      }
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);

      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await apiFetch<Advance[]>(`/advances${query}`);
      setAdvances(res);
    } catch (err: any) {
      setError(err.message || "Failed to load advances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await loadEmployees();
        await loadAdvances();
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      }
    })();
  }, []);

  const handleFilterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadAdvances();
  };

  const handleAddAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !amount) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        employeeId: Number(employeeId),
        amount: Number(amount),
        paymentMode,
        paidBy,
        note: note || undefined,
        date: date || undefined,
      };
      await apiFetch<Advance>("/advances", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setAmount("");
      setNote("");
      setDate("");
      setPaidBy("Nitesh");

      await loadAdvances();
    } catch (err: any) {
      setError(err.message || "Failed to add advance");
    } finally {
      setSaving(false);
    }
  };

  const startEditAdvance = (adv: Advance) => {
    setEditingId(adv.id);
    setEditAmount(String(adv.amount));
    setEditDate(adv.date ? adv.date.slice(0, 10) : "");
    setEditPaymentMode(adv.paymentMode);
    setEditPaidBy((adv as any).paidBy || "Nitesh");
    setEditNote(adv.note ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditDate("");
    setEditPaymentMode("CASH");
    setEditPaidBy("Nitesh");
    setEditNote("");
  };

  const handleUpdateAdvance = async (advId: number) => {
    if (!editAmount) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        amount: Number(editAmount),
        date: editDate || undefined,
        paymentMode: editPaymentMode,
        paidBy: editPaidBy,
        note: editNote || undefined,
      };
      await apiFetch<Advance>(`/advances/${advId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      cancelEdit();
      await loadAdvances();
    } catch (err: any) {
      setError(err.message || "Failed to update advance");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdvance = async (advId: number) => {
    const ok = window.confirm("Delete this advance?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<void>(`/advances/${advId}`, { method: "DELETE" });
      await loadAdvances();
    } catch (err: any) {
      setError(err.message || "Failed to delete advance");
    } finally {
      setSaving(false);
    }
  };

  const employeeNameById = (id: number) =>
    employees.find((e) => e.id === id)?.name || `#${id}`;

  const totalAdvancesForList = advances.reduce((sum, adv) => sum + adv.amount, 0);

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
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Employee Advances</h2>
            <p className="text-gray-600 mt-1">Track salary advances given to employees</p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
            <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                >
                  <option value="all">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
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
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left: Add Advance Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Add New Advance</h3>

              <form onSubmit={handleAddAdvance} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee *
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required
                  >
                    <option value="">Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
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
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
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
                        {person}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note"
                    rows={3}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Adding..." : "Add Advance"}
                </button>
              </form>
            </div>

            {/* Right: Advances List */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 xl:col-span-2 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Advances List ({advances.length})
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Total: <span className="font-semibold text-gray-900">{formatCurrency(totalAdvancesForList)}</span>
                  </p>
                </div>
                {loading && (
                  <span className="text-sm text-gray-500">Loading...</span>
                )}
              </div>

              {advances.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-2">No advances found</div>
                  <div className="text-sm text-gray-500">Add an advance using the form</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {advances.map((adv) => {
                    const isEditing = editingId === adv.id;
                    return (
                      <div
                        key={adv.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        {isEditing ? (
                          // Edit Mode
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Amount (₹)
                                </label>
                                <input
                                  type="number"
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">
                                Payment Mode
                              </label>
                              <div className="flex gap-2">
                                {paymentModes.map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setEditPaymentMode(mode)}
                                    className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                                      editPaymentMode === mode
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
                              <label className="block text-xs font-medium text-gray-700 mb-2">
                                Paid By
                              </label>
                              <div className="flex gap-2">
                                {paidByOptions.map((person) => (
                                  <button
                                    key={person}
                                    type="button"
                                    onClick={() => setEditPaidBy(person)}
                                    className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                                      editPaidBy === person
                                        ? "bg-green-600 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                  >
                                    {person}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Note
                              </label>
                              <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                              />
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateAdvance(adv.id)}
                                disabled={saving}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-900">
                                  {employeeNameById(adv.employeeId)}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(adv.date).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-900">
                                  {formatCurrency(adv.amount)}
                                </div>
                                <div className="flex gap-2 justify-end mt-1">
                                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded">
                                    {adv.paymentMode}
                                  </span>
                                  {(adv as any).paidBy && (
                                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 rounded">
                                      {(adv as any).paidBy}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {adv.note && (
                              <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded">
                                {adv.note}
                              </p>
                            )}

                            <div className="flex gap-2 pt-3 border-t border-gray-200">
                              <button
                                onClick={() => startEditAdvance(adv)}
                                className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAdvance(adv.id)}
                                disabled={saving}
                                className="flex-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdvancesPage;