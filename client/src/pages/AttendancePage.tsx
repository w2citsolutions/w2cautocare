import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface Employee {
  id: number;
  name: string;
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "UNPAID_LEAVE" | "PAID_LEAVE";

interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  status: AttendanceStatus;
  reason?: string | null;
  createdAt: string;
  employee?: { id: number; name: string };
}

const statusOptions: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "PRESENT", label: "Present", color: "green" },
  { value: "ABSENT", label: "Absent", color: "red" },
  { value: "UNPAID_LEAVE", label: "Unpaid Leave", color: "orange" },
  { value: "PAID_LEAVE", label: "Paid Leave", color: "blue" },
];

const AttendancePage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Form
  const [employeeId, setEmployeeId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [reason, setReason] = useState<string>("");

  const loadEmployees = async () => {
    const res = await apiFetch<{ id: number; name: string }[]>("/employees");
    setEmployees(res);
  };

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterEmployeeId !== "all") params.append("employeeId", filterEmployeeId);
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      const query = params.toString() ? `?${params.toString()}` : "";

      const res = await apiFetch<AttendanceRecord[]>(`/attendance${query}`);
      setRecords(res);
    } catch (err: any) {
      setError(err.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await loadEmployees();
        await loadRecords();
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !date || !status) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<AttendanceRecord>("/attendance", {
        method: "POST",
        body: JSON.stringify({
          employeeId: Number(employeeId),
          date,
          status,
          reason: reason || undefined,
        }),
      });

      setEmployeeId("");
      setDate("");
      setStatus("PRESENT");
      setReason("");
      await loadRecords();
    } catch (err: any) {
      setError(err.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this attendance record?")) return;
    try {
      await apiFetch(`/attendance/${id}`, { method: "DELETE" });
      await loadRecords();
    } catch (err: any) {
      setError(err.message || "Failed to delete record");
    }
  };

  const employeeNameById = (id: number) =>
    employees.find((e) => e.id === id)?.name || `#${id}`;

  // Apply client-side status filter
  const filteredRecords = records.filter((record) => {
    if (filterStatus !== "all" && record.status !== filterStatus) {
      return false;
    }
    return true;
  });

  // Calculate statistics
  const stats = {
    total: filteredRecords.length,
    present: filteredRecords.filter((r) => r.status === "PRESENT").length,
    absent: filteredRecords.filter((r) => r.status === "ABSENT").length,
    unpaidLeave: filteredRecords.filter((r) => r.status === "UNPAID_LEAVE").length,
    paidLeave: filteredRecords.filter((r) => r.status === "PAID_LEAVE").length,
  };

  const getStatusBadgeColor = (status: AttendanceStatus) => {
    switch (status) {
      case "PRESENT":
        return "bg-green-100 text-green-700";
      case "ABSENT":
        return "bg-red-100 text-red-700";
      case "UNPAID_LEAVE":
        return "bg-orange-100 text-orange-700";
      case "PAID_LEAVE":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
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
            <h2 className="text-3xl font-bold text-gray-900">Attendance Tracking</h2>
            <p className="text-gray-600 mt-1">Record and manage employee attendance</p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">Total Records</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <div className="text-sm text-green-700 font-medium mb-1">Present</div>
              <div className="text-2xl font-bold text-green-800">{stats.present}</div>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <div className="text-sm text-red-700 font-medium mb-1">Absent</div>
              <div className="text-2xl font-bold text-red-800">{stats.absent}</div>
            </div>
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
              <div className="text-sm text-orange-700 font-medium mb-1">Unpaid Leave</div>
              <div className="text-2xl font-bold text-orange-800">{stats.unpaidLeave}</div>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <div className="text-sm text-blue-700 font-medium mb-1">Paid Leave</div>
              <div className="text-2xl font-bold text-blue-800">{stats.paidLeave}</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={loadRecords}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Apply Filters
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  Status
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredRecords.length}</span> of{" "}
                <span className="font-semibold text-gray-900">{records.length}</span> records
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Mark Attendance
              </h3>

              <form onSubmit={handleSave} className="space-y-4">
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
                    Date *
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatus(opt.value)}
                        className={`px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                          status === opt.value
                            ? opt.color === "green"
                              ? "bg-green-600 text-white"
                              : opt.color === "red"
                              ? "bg-red-600 text-white"
                              : opt.color === "orange"
                              ? "bg-orange-600 text-white"
                              : "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason (optional)
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional reason for leave/absence"
                    rows={3}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Saving..." : "Mark Attendance"}
                </button>
              </form>
            </div>

            {/* Records List */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Attendance Records ({filteredRecords.length})
                </h3>

                {loading ? (
                  <div className="text-center py-12 text-gray-500">Loading...</div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">No records found</div>
                    <div className="text-sm text-gray-500">Mark attendance using the form</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRecords.map((record) => (
                      <div
                        key={record.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-lg font-bold text-gray-900">
                                {record.employee?.name || employeeNameById(record.employeeId)}
                              </h4>
                              <span
                                className={`inline-block px-2 py-1 text-xs font-semibold rounded ${getStatusBadgeColor(
                                  record.status
                                )}`}
                              >
                                {statusOptions.find((s) => s.value === record.status)?.label}
                              </span>
                            </div>
                            {record.reason && (
                              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                {record.reason}
                              </div>
                            )}
                          </div>
                          <div className="text-right text-sm text-gray-600 ml-4">
                            {new Date(record.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-gray-200">
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="w-full px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
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

export default AttendancePage;