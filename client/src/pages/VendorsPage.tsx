import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK" | "OTHER";
type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";

interface VendorPayment {
  id: number;
  date: string;
  amount: number;
  amountPaid: number;
  status: PaymentStatus;
  paymentMode?: PaymentMode;
  invoiceNumber?: string;
  description?: string;
  dueDate?: string;
  paidBy?: string;
}

interface Vendor {
  id: number;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  totalDue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  recentPayments?: VendorPayment[];
  payments?: VendorPayment[];
}

const paymentModes: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK", "OTHER"];
const paidByOptions = ["Nitesh", "Tanmeet", "Bank Account"];

const VendorsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Vendor form
  const [vendorName, setVendorName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Payment form
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidBy, setPaidBy] = useState("Nitesh");
  const [createExpense, setCreateExpense] = useState(false);
  const [editingPayment, setEditingPayment] = useState<VendorPayment | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const loadVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Vendor[]>("/vendors");
      setVendors(data);
    } catch (err: any) {
      setError(err.message || "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const loadVendorDetails = async (vendorId: number) => {
    try {
      const data = await apiFetch<Vendor>(`/vendors/${vendorId}`);
      setSelectedVendor(data);
      setShowDetailsModal(true);
    } catch (err: any) {
      setError(err.message || "Failed to load vendor details");
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const openAddVendor = () => {
    setEditingVendor(null);
    setVendorName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setGstNumber("");
    setShowVendorModal(true);
  };

  const openEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorName(vendor.name);
    setContactName(vendor.contactName || "");
    setPhone(vendor.phone || "");
    setEmail(vendor.email || "");
    setAddress(vendor.address || "");
    setGstNumber(vendor.gstNumber || "");
    setShowVendorModal(true);
  };

  const saveVendor = async () => {
    if (!vendorName.trim()) {
      alert("Vendor name is required");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: vendorName.trim(),
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined,
      };

      if (editingVendor) {
        await apiFetch(`/vendors/${editingVendor.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/vendors", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setShowVendorModal(false);
      loadVendors();
    } catch (err: any) {
      alert(err.message || "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  const deleteVendor = async (vendor: Vendor) => {
    if (!confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) return;

    try {
      await apiFetch(`/vendors/${vendor.id}`, { method: "DELETE" });
      loadVendors();
      if (selectedVendor?.id === vendor.id) {
        setShowDetailsModal(false);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete vendor");
    }
  };

  const toggleVendorStatus = async (vendor: Vendor) => {
    try {
      await apiFetch(`/vendors/${vendor.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !vendor.isActive }),
      });
      loadVendors();
      if (selectedVendor?.id === vendor.id) {
        loadVendorDetails(vendor.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to update vendor status");
    }
  };

  const openAddPayment = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setEditingPayment(null);
    setPaymentDate(getTodayDate());
    setPaymentAmount("");
    setAmountPaid("");
    setPaymentMode("CASH");
    setInvoiceNumber("");
    setDescription("");
    setDueDate("");
    setPaidBy("Nitesh");
    setCreateExpense(false);
    setShowPaymentModal(true);
  };

  const openEditPayment = (vendor: Vendor, payment: VendorPayment) => {
    setSelectedVendor(vendor);
    setEditingPayment(payment);
    setPaymentDate(payment.date.split("T")[0]);
    setPaymentAmount(String(payment.amount));
    setAmountPaid(String(payment.amountPaid));
    setPaymentMode(payment.paymentMode || "CASH");
    setInvoiceNumber(payment.invoiceNumber || "");
    setDescription(payment.description || "");
    setDueDate(payment.dueDate ? payment.dueDate.split("T")[0] : "");
    setPaidBy(payment.paidBy || "Nitesh");
    setCreateExpense(false);
    setShowPaymentModal(true);
  };

  const savePayment = async () => {
    if (!selectedVendor) return;

    const amt = parseFloat(paymentAmount);
    const paid = amountPaid ? parseFloat(amountPaid) : 0;

    if (isNaN(amt) || amt <= 0) {
      alert("Invalid payment amount");
      return;
    }

    if (isNaN(paid) || paid < 0) {
      alert("Invalid amount paid");
      return;
    }

    setSaving(true);
    try {
      const body = {
        date: new Date(paymentDate).toISOString(),
        amount: amt,
        amountPaid: paid,
        paymentMode: paymentMode,
        invoiceNumber: invoiceNumber.trim() || undefined,
        description: description.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        paidBy: paidBy || undefined,
        createExpense: createExpense,
      };

      if (editingPayment) {
        await apiFetch(`/vendors/${selectedVendor.id}/payments/${editingPayment.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/vendors/${selectedVendor.id}/payments`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setShowPaymentModal(false);
      loadVendors();
      if (showDetailsModal) {
        loadVendorDetails(selectedVendor.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async (vendor: Vendor, paymentId: number) => {
    if (!confirm("Delete this payment? This cannot be undone.")) return;

    try {
      await apiFetch(`/vendors/${vendor.id}/payments/${paymentId}`, {
        method: "DELETE",
      });
      loadVendors();
      if (selectedVendor?.id === vendor.id) {
        loadVendorDetails(vendor.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete payment");
    }
  };

  const filteredVendors = vendors.filter((v) => {
    if (filterStatus === "ACTIVE") return v.isActive;
    if (filterStatus === "INACTIVE") return !v.isActive;
    return true;
  });

  const totalDue = filteredVendors.reduce((sum, v) => sum + v.totalDue, 0);

  const getStatusBadge = (status: PaymentStatus) => {
    const colors = {
      PENDING: "bg-red-100 text-red-800",
      PARTIAL: "bg-yellow-100 text-yellow-800",
      PAID: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
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
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Vendors</h2>
              <p className="text-gray-600 mt-1">Manage vendors and track payments</p>
            </div>
            <button
              onClick={openAddVendor}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              + Add Vendor
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-1">Total Vendors</div>
              <div className="text-2xl font-bold text-gray-900">{filteredVendors.length}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-1">Active Vendors</div>
              <div className="text-2xl font-bold text-green-600">
                {filteredVendors.filter((v) => v.isActive).length}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-1">Total Amount Due</div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDue)}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-1">Vendors with Dues</div>
              <div className="text-2xl font-bold text-orange-600">
                {filteredVendors.filter((v) => v.totalDue > 0).length}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              {(["ALL", "ACTIVE", "INACTIVE"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    filterStatus === status
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Vendors List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading vendors...</div>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400">No vendors found</div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{vendor.name}</h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            vendor.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {vendor.isActive ? "Active" : "Inactive"}
                        </span>
                        {vendor.totalDue > 0 && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                            Due: {formatCurrency(vendor.totalDue)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {vendor.contactName && (
                          <div>
                            <span className="text-gray-500">Contact: </span>
                            <span className="text-gray-900">{vendor.contactName}</span>
                          </div>
                        )}
                        {vendor.phone && (
                          <div>
                            <span className="text-gray-500">Phone: </span>
                            <span className="text-gray-900">{vendor.phone}</span>
                          </div>
                        )}
                        {vendor.email && (
                          <div>
                            <span className="text-gray-500">Email: </span>
                            <span className="text-gray-900">{vendor.email}</span>
                          </div>
                        )}
                        {vendor.gstNumber && (
                          <div>
                            <span className="text-gray-500">GST: </span>
                            <span className="text-gray-900">{vendor.gstNumber}</span>
                          </div>
                        )}
                      </div>

                      {/* Recent Payments */}
                      {vendor.recentPayments && vendor.recentPayments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="text-xs font-medium text-gray-500 mb-2">
                            Recent Payments:
                          </div>
                          <div className="space-y-2">
                            {vendor.recentPayments.slice(0, 3).map((payment) => (
                              <div
                                key={payment.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-gray-500">
                                    {formatDate(payment.date)}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(
                                      payment.status
                                    )}`}
                                  >
                                    {payment.status}
                                  </span>
                                  {payment.invoiceNumber && (
                                    <span className="text-gray-500 text-xs">
                                      #{payment.invoiceNumber}
                                    </span>
                                  )}
                                </div>
                                <div className="text-gray-900 font-medium">
                                  {formatCurrency(payment.amountPaid)} / {formatCurrency(payment.amount)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-6">
                      <button
                        onClick={() => loadVendorDetails(vendor.id)}
                        className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => openAddPayment(vendor)}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        Add Payment
                      </button>
                      <button
                        onClick={() => openEditVendor(vendor)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleVendorStatus(vendor)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {vendor.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => deleteVendor(vendor)}
                        className="px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingVendor ? "Edit Vendor" : "Add Vendor"}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ABC Suppliers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="9876543210"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="vendor@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Complete address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GST Number
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowVendorModal(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveVendor}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingVendor ? "Update Vendor" : "Add Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPayment ? "Edit Payment" : "Add Payment"} - {selectedVendor.name}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="INV-2024-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Amount *
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10000"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5000"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {paymentModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Paid By
                  </label>
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {paidByOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Payment description or notes"
                />
              </div>

              {!editingPayment && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="createExpense"
                    checked={createExpense}
                    onChange={(e) => setCreateExpense(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="createExpense" className="ml-2 text-sm text-gray-700">
                    Create expense entry when payment is made
                  </label>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePayment}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingPayment ? "Update Payment" : "Add Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Details Modal */}
      {showDetailsModal && selectedVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedVendor.name}
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Vendor Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Contact:</span>{" "}
                    <span className="text-gray-900">{selectedVendor.contactName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>{" "}
                    <span className="text-gray-900">{selectedVendor.phone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>{" "}
                    <span className="text-gray-900">{selectedVendor.email || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">GST:</span>{" "}
                    <span className="text-gray-900">{selectedVendor.gstNumber || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Due:</span>{" "}
                    <span className="font-semibold text-red-600">
                      {formatCurrency(selectedVendor.totalDue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>{" "}
                    <span
                      className={`font-semibold ${
                        selectedVendor.isActive ? "text-green-600" : "text-gray-600"
                      }`}
                    >
                      {selectedVendor.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                {selectedVendor.address && (
                  <div className="mt-3 text-sm">
                    <span className="text-gray-500">Address:</span>{" "}
                    <span className="text-gray-900">{selectedVendor.address}</span>
                  </div>
                )}
              </div>

              {/* Payments List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold text-gray-900">Payment History</h4>
                  <button
                    onClick={() => openAddPayment(selectedVendor)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    + Add Payment
                  </button>
                </div>

                {selectedVendor.payments && selectedVendor.payments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedVendor.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-600">
                              {formatDate(payment.date)}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(
                                payment.status
                              )}`}
                            >
                              {payment.status}
                            </span>
                            {payment.invoiceNumber && (
                              <span className="text-sm text-gray-600">
                                #{payment.invoiceNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openEditPayment(selectedVendor, payment)}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deletePayment(selectedVendor, payment.id)}
                              className="text-sm text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Amount:</span>{" "}
                            <span className="font-medium text-gray-900">
                              {formatCurrency(payment.amount)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Paid:</span>{" "}
                            <span className="font-medium text-green-600">
                              {formatCurrency(payment.amountPaid)}
                            </span>
                          </div>
                          {payment.paymentMode && (
                            <div>
                              <span className="text-gray-500">Mode:</span>{" "}
                              <span className="text-gray-900">{payment.paymentMode}</span>
                            </div>
                          )}
                          {payment.paidBy && (
                            <div>
                              <span className="text-gray-500">Paid By:</span>{" "}
                              <span className="text-gray-900">{payment.paidBy}</span>
                            </div>
                          )}
                        </div>

                        {payment.description && (
                          <div className="mt-2 text-sm text-gray-600">{payment.description}</div>
                        )}

                        {payment.dueDate && (
                          <div className="mt-2 text-xs text-gray-500">
                            Due: {formatDate(payment.dueDate)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">No payments recorded</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorsPage;