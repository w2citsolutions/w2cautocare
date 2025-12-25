import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface Employee {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  joinDate?: string | null;
  isActive: boolean;
  baseSalary: number;
  createdAt: string;
  updatedAt: string;
}

const EmployeesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isEditing = editingId !== null;

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setAddress("");
    setJoinDate("");
    setBaseSalary("");
    setIsActive(true);
  };

  const formatCurrency = (value: number) =>
    `₹${(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = includeInactive ? "?includeInactive=true" : "";
      const res = await apiFetch<Employee[]>(`/employees${query}`);
      setEmployees(res);
    } catch (err: any) {
      setError(err.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [includeInactive]);

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setName(emp.name);
    setPhone(emp.phone || "");
    setAddress(emp.address || "");
    setJoinDate(
      emp.joinDate ? new Date(emp.joinDate).toISOString().slice(0, 10) : ""
    );
    setBaseSalary(String(emp.baseSalary));
    setIsActive(emp.isActive);
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !baseSalary) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        phone: phone || undefined,
        address: address || undefined,
        joinDate: joinDate || undefined,
        baseSalary: Number(baseSalary),
        isActive,
      };

      if (isEditing && editingId != null) {
        await apiFetch<Employee>(`/employees/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch<Employee>("/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      await loadEmployees();
      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch<Employee>(`/employees/${emp.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !emp.isActive }),
      });
      await loadEmployees();
    } catch (err: any) {
      setError(err.message || "Failed to update employee status");
    } finally {
      setSaving(false);
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
              <h2 className="text-3xl font-bold text-gray-900">Employees</h2>
              <p className="text-gray-600 mt-1">Manage your staff details and fixed salary</p>
            </div>
            <label className="flex items-center space-x-2 text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              <span>Show inactive employees</span>
            </label>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left: Add / Edit Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditing ? "Edit Employee" : "Add New Employee"}
                </h3>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-sm text-gray-500 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee Name *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Join Date
                    </label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={joinDate}
                      onChange={(e) => setJoinDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address, city"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Salary (₹ per month) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="e.g., 25000"
                    required
                  />
                </div>

                {isEditing && (
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      id="isActive"
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">
                      Employee is currently active
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving
                    ? isEditing
                      ? "Saving..."
                      : "Adding..."
                    : isEditing
                    ? "Save Changes"
                    : "Add Employee"}
                </button>
              </form>
            </div>

            {/* Right: Employee List */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 xl:col-span-2 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Employee List ({employees.length})
                </h3>
                {loading && (
                  <span className="text-sm text-gray-500">Loading...</span>
                )}
              </div>

              {employees.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-2">No employees found</div>
                  <div className="text-sm text-gray-500">Add your first employee using the form</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Name</th>
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Phone</th>
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Joined</th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Salary</th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">Status</th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-2">
                            <div className="font-medium text-gray-900">{emp.name}</div>
                            {emp.address && (
                              <div className="text-xs text-gray-500 mt-1">
                                {emp.address}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-2 text-sm text-gray-700">
                            {emp.phone || "-"}
                          </td>
                          <td className="py-4 px-2 text-sm text-gray-700">
                            {emp.joinDate
                              ? new Date(emp.joinDate).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </td>
                          <td className="py-4 px-2 text-right text-sm font-semibold text-gray-900">
                            {formatCurrency(emp.baseSalary)}
                          </td>
                          <td className="py-4 px-2 text-center">
                            <span
                              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                emp.isActive
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {emp.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleEdit(emp)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleToggleActive(emp)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                  emp.isActive
                                    ? "text-red-700 bg-red-50 border border-red-200 hover:bg-red-100"
                                    : "text-green-700 bg-green-50 border border-green-200 hover:bg-green-100"
                                }`}
                                disabled={saving}
                              >
                                {emp.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeesPage;