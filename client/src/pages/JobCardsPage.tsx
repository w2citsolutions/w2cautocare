import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

type JobStatus = "OPEN" | "IN_PROGRESS" | "READY" | "DELIVERED" | "CANCELLED";
type LineType = "LABOUR" | "PART" | "OTHER";
type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK" | "OTHER";

interface VehicleSummary {
  id: number;
  regNumber: string;
  make?: string | null;
  model?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
}

interface JobLineItem {
  id: number;
  lineType?: LineType;
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

interface JobPayment {
  id: number;
  date: string;
  amount: number;
  paymentMode: string;
  receivedBy?: string | null;
  note?: string | null;
}

interface JobCard {
  id: number;
  jobNumber: string;
  status: JobStatus;
  inDate: string;
  promisedDate?: string | null;
  outDate?: string | null;
  odometer?: number | null;
  fuelLevel?: string | null;
  complaints?: string | null;
  diagnosis?: string | null;
  workDone?: string | null;
  labourTotal: number;
  partsTotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  advancePaid: number;
  pendingAmount: number;
  notes?: string | null;
  vehicle?: VehicleSummary;
  lineItems?: JobLineItem[];
  payments?: JobPayment[];
}

interface Template {
  id: number;
  name: string;
  kind: string;
  isActive?: boolean;
}

const statusOptions = [
  { value: "OPEN", label: "Open", color: "bg-gray-100 text-gray-700" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { value: "READY", label: "Ready", color: "bg-green-100 text-green-700" },
  { value: "DELIVERED", label: "Delivered", color: "bg-purple-100 text-purple-700" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

const paymentModes: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK", "OTHER"];
const lineTypes: LineType[] = ["LABOUR", "PART", "OTHER"];
const receivedByOptions = ["Nitesh", "Tanmeet", "Bank Account"];

const JobCardsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [regFilter, setRegFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Create job
  const [creating, setCreating] = useState(false);
  const [newReg, setNewReg] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [newComplaints, setNewComplaints] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Edit job
  const [editDiagnosis, setEditDiagnosis] = useState("");
  const [editWorkDone, setEditWorkDone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [editTax, setEditTax] = useState("");

  // Line items
  const [editingLineItem, setEditingLineItem] = useState<JobLineItem | null>(null);
  const [liType, setLiType] = useState<LineType>("LABOUR");
  const [liDesc, setLiDesc] = useState("");
  const [liQty, setLiQty] = useState("1");
  const [liPrice, setLiPrice] = useState("");

  // Payments
  const [editingPayment, setEditingPayment] = useState<JobPayment | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<PaymentMode>("CASH");
  const [payReceivedBy, setPayReceivedBy] = useState("Nitesh");
  const [payNote, setPayNote] = useState("");

  // Template management
  const [templateName, setTemplateName] = useState("");
  const [templateKind, setTemplateKind] = useState("INVOICE");

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status: JobStatus) => {
    return statusOptions.find((s) => s.value === status)?.color || "bg-gray-100 text-gray-700";
  };

  const loadTemplates = async () => {
    try {
      const res = await apiFetch<Template[]>("/jobcard-templates");
      setTemplates(res.filter(t => t.isActive !== false));
    } catch (err) {
      console.log("Failed to load templates:", err);
    }
  };

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (regFilter.trim()) params.append("reg", regFilter.trim());
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);

      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await apiFetch<JobCard[]>(`/jobcards${query}`);
      setJobs(res);
    } catch (err: any) {
      setError(err.message || "Failed to load job cards");
    } finally {
      setLoading(false);
    }
  };

  const loadJobDetail = async (id: number) => {
    try {
      const job = await apiFetch<JobCard>(`/jobcards/${id}`);
      setSelectedJob(job);
      setEditDiagnosis(job.diagnosis || "");
      setEditWorkDone(job.workDone || "");
      setEditNotes(job.notes || "");
      setEditDiscount(String(job.discount || 0));
      setEditTax(String(job.tax || 0));
    } catch (err: any) {
      setError(err.message || "Failed to load job details");
    }
  };

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReg) return;

    setCreating(true);
    setError(null);

    try {
      const body: any = {
        regNumber: newReg,
        ownerName: newOwnerName || undefined,
        ownerPhone: newOwnerPhone || undefined,
        complaints: newComplaints || undefined,
      };

      if (selectedTemplateId) {
        body.templateId = Number(selectedTemplateId);
      }

      await apiFetch("/jobcards", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setShowCreateModal(false);
      setNewReg("");
      setNewOwnerName("");
      setNewOwnerPhone("");
      setNewComplaints("");
      setSelectedTemplateId("");
      await loadJobs();
    } catch (err: any) {
      setError(err.message || "Failed to create job card");
    } finally {
      setCreating(false);
    }
  };

  const updateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    try {
      await apiFetch(`/jobcards/${selectedJob.id}`, {
        method: "PUT",
        body: JSON.stringify({
          diagnosis: editDiagnosis || undefined,
          workDone: editWorkDone || undefined,
          notes: editNotes || undefined,
          discount: Number(editDiscount) || 0,
          tax: Number(editTax) || 0,
        }),
      });

      setShowEditModal(false);
      await loadJobs();
      await loadJobDetail(selectedJob.id);
    } catch (err: any) {
      setError(err.message || "Failed to update job");
    }
  };

  const updateJobStatus = async (jobId: number, newStatus: JobStatus) => {
    try {
      await apiFetch(`/jobcards/${jobId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadJobs();
      if (selectedJob?.id === jobId) {
        await loadJobDetail(jobId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    }
  };

  const deleteJob = async (jobId: number) => {
    if (!window.confirm("Delete this job card? This cannot be undone.")) return;

    try {
      await apiFetch(`/jobcards/${jobId}`, { method: "DELETE" });
      if (selectedJob?.id === jobId) {
        setSelectedJob(null);
      }
      await loadJobs();
    } catch (err: any) {
      setError(err.message || "Failed to delete job card");
    }
  };

  const saveLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !liDesc || !liQty || !liPrice) return;

    try {
      const body = {
        lineType: liType,
        description: liDesc,
        quantity: Number(liQty),
        unitPrice: Number(liPrice),
      };

      if (editingLineItem) {
        await apiFetch(`/jobcards/${selectedJob.id}/line-items/${editingLineItem.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/jobcards/${selectedJob.id}/line-items`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setShowLineItemModal(false);
      setEditingLineItem(null);
      setLiType("LABOUR");
      setLiDesc("");
      setLiQty("1");
      setLiPrice("");
      await loadJobs();
      await loadJobDetail(selectedJob.id);
    } catch (err: any) {
      setError(err.message || "Failed to save line item");
    }
  };

  const deleteLineItem = async (lineId: number) => {
    if (!selectedJob) return;
    if (!window.confirm("Delete this line item?")) return;

    try {
      await apiFetch(`/jobcards/${selectedJob.id}/line-items/${lineId}`, {
        method: "DELETE",
      });
      await loadJobs();
      await loadJobDetail(selectedJob.id);
    } catch (err: any) {
      setError(err.message || "Failed to delete line item");
    }
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !payAmount) return;

    try {
      const body = {
        amount: Number(payAmount),
        paymentMode: payMode,
        receivedBy: payReceivedBy,
        note: payNote || undefined,
        date: new Date().toISOString().slice(0, 10),
      };

      if (editingPayment) {
        await apiFetch(`/jobcards/${selectedJob.id}/payments/${editingPayment.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/jobcards/${selectedJob.id}/payments`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setShowPaymentModal(false);
      setEditingPayment(null);
      setPayAmount("");
      setPayMode("CASH");
      setPayReceivedBy("Nitesh");
      setPayNote("");
      await loadJobs();
      await loadJobDetail(selectedJob.id);
    } catch (err: any) {
      setError(err.message || "Failed to save payment");
    }
  };

  const deletePayment = async (paymentId: number) => {
    if (!selectedJob) return;
    if (!window.confirm("Delete this payment?")) return;

    try {
      await apiFetch(`/jobcards/${selectedJob.id}/payments/${paymentId}`, {
        method: "DELETE",
      });
      await loadJobs();
      await loadJobDetail(selectedJob.id);
    } catch (err: any) {
      setError(err.message || "Failed to delete payment");
    }
  };

  const openLineItemEdit = (item: JobLineItem) => {
    setEditingLineItem(item);
    setLiType(item.lineType || "LABOUR");
    setLiDesc(item.description);
    setLiQty(String(item.quantity));
    setLiPrice(String(item.unitPrice));
    setShowLineItemModal(true);
  };

  const openPaymentEdit = (payment: JobPayment) => {
    setEditingPayment(payment);
    setPayAmount(String(payment.amount));
    setPayMode(payment.paymentMode as PaymentMode);
    setPayReceivedBy(payment.receivedBy || "Nitesh");
    setPayNote(payment.note || "");
    setShowPaymentModal(true);
  };

  const generateInvoice = async () => {
    if (!selectedJob) return;
    try {
      const blob = await apiFetch(`/jobcards/${selectedJob.id}/invoice`, {
        method: "POST",
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${selectedJob.jobNumber}.pdf`;
      a.click();
    } catch (err: any) {
      setError(err.message || "Failed to generate invoice");
    }
  };

  const generateEstimate = async () => {
    if (!selectedJob) return;
    try {
      const blob = await apiFetch(`/jobcards/${selectedJob.id}/estimate`, {
        method: "POST",
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estimate-${selectedJob.jobNumber}.pdf`;
      a.click();
    } catch (err: any) {
      setError(err.message || "Failed to generate estimate");
    }
  };

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) return;

    try {
      await apiFetch("/jobcard-templates", {
        method: "POST",
        body: JSON.stringify({
          name: templateName,
          kind: templateKind,
        }),
      });

      setShowTemplateModal(false);
      setTemplateName("");
      setTemplateKind("INVOICE");
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to save template");
    }
  };

  const deleteTemplate = async (templateId: number) => {
    if (!window.confirm("Delete this template?")) return;

    try {
      await apiFetch(`/jobcard-templates/${templateId}`, {
        method: "DELETE",
      });
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to delete template");
    }
  };

  useEffect(() => {
    loadJobs();
    loadTemplates();
  }, []);

  const filteredJobs = jobs;
  const totalPending = filteredJobs.reduce((sum, j) => sum + (j.pendingAmount || 0), 0);

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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Job Cards</h2>
              <p className="text-gray-600 mt-1">
                Manage vehicle service jobs • Pending: <span className="font-semibold text-red-600">{formatCurrency(totalPending)}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-5 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Templates ({templates.length})</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Job Card</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={loadJobs}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Apply Filters
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Reg
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={regFilter}
                  onChange={(e) => setRegFilter(e.target.value)}
                  placeholder="Search reg number"
                />
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
            </div>

            <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredJobs.length}</span> jobs
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Jobs List */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Job Cards ({filteredJobs.length})
                </h3>

                {loading ? (
                  <div className="text-center py-12 text-gray-500">Loading...</div>
                ) : filteredJobs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">No jobs found</div>
                    <div className="text-sm text-gray-500">Create a new job card to get started</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredJobs.map((job) => {
                      const isSelected = selectedJob?.id === job.id;

                      return (
                        <div
                          key={job.id}
                          className={`border-2 rounded-lg p-4 transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 cursor-pointer" onClick={() => loadJobDetail(job.id)}>
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-lg font-bold text-gray-900">
                                  {job.vehicle?.regNumber || "N/A"}
                                </h4>
                                <span className="text-sm text-gray-600">
                                  #{job.jobNumber}
                                </span>
                                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${getStatusColor(job.status)}`}>
                                  {statusOptions.find((s) => s.value === job.status)?.label}
                                </span>
                              </div>
                              {job.vehicle?.ownerName && (
                                <div className="text-sm text-gray-600 mb-1">
                                  {job.vehicle.ownerName}
                                  {job.vehicle.ownerPhone && ` • ${job.vehicle.ownerPhone}`}
                                </div>
                              )}
                              {job.vehicle?.make && (
                                <div className="text-sm text-gray-600">
                                  {job.vehicle.make} {job.vehicle.model}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-sm text-gray-600">{formatDate(job.inDate)}</div>
                              {job.pendingAmount > 0 && (
                                <div className="text-sm font-semibold text-red-600 mt-1">
                                  Pending: {formatCurrency(job.pendingAmount)}
                                </div>
                              )}
                            </div>
                          </div>

                          {job.complaints && (
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-3">
                              {job.complaints}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                              <span className="text-gray-600">Total: </span>
                              <span className="font-semibold text-gray-900">{formatCurrency(job.grandTotal)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Paid: </span>
                              <span className="font-semibold text-green-600">{formatCurrency(job.advancePaid)}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-gray-200">
                            <button
                              onClick={() => loadJobDetail(job.id)}
                              className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => deleteJob(job.id)}
                              className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Job Details Panel */}
            <div className="space-y-4">
              {/* Main Details Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>
                  {selectedJob && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {!selectedJob ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">No job selected</div>
                    <div className="text-sm text-gray-500">Click a job to view details</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Vehicle & Owner Info */}
                    <div className="pb-4 border-b border-gray-200">
                      <div className="text-xl font-bold text-gray-900 mb-2">
                        {selectedJob.vehicle?.regNumber}
                      </div>
                      {selectedJob.vehicle?.make && (
                        <div className="text-sm text-gray-600 mb-2">
                          {selectedJob.vehicle.make} {selectedJob.vehicle.model}
                        </div>
                      )}
                      {selectedJob.vehicle?.ownerName && (
                        <div className="text-sm text-gray-600">
                          {selectedJob.vehicle.ownerName}
                          {selectedJob.vehicle.ownerPhone && ` • ${selectedJob.vehicle.ownerPhone}`}
                        </div>
                      )}
                    </div>

                    {/* Status Buttons */}
                    <div className="pb-4 border-b border-gray-200">
                      <div className="text-sm font-medium text-gray-700 mb-2">Status</div>
                      <div className="grid grid-cols-2 gap-2">
                        {statusOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateJobStatus(selectedJob.id, opt.value as JobStatus)}
                            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                              selectedJob.status === opt.value
                                ? opt.color
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Financials */}
                    <div className="pb-4 border-b border-gray-200">
                      <div className="text-sm font-medium text-gray-700 mb-2">Financials</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Labour:</span>
                          <span className="font-medium text-gray-900">{formatCurrency(selectedJob.labourTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Parts:</span>
                          <span className="font-medium text-gray-900">{formatCurrency(selectedJob.partsTotal)}</span>
                        </div>
                        {selectedJob.discount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Discount:</span>
                            <span className="font-medium text-red-600">-{formatCurrency(selectedJob.discount)}</span>
                          </div>
                        )}
                        {selectedJob.tax > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tax:</span>
                            <span className="font-medium text-gray-900">{formatCurrency(selectedJob.tax)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                          <span className="text-gray-900">Grand Total:</span>
                          <span className="text-blue-600">{formatCurrency(selectedJob.grandTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Advance Paid:</span>
                          <span className="font-medium text-green-600">{formatCurrency(selectedJob.advancePaid)}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold">
                          <span className="text-gray-900">Pending:</span>
                          <span className="text-red-600">{formatCurrency(selectedJob.pendingAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={generateInvoice}
                        className="px-3 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                      >
                        Invoice PDF
                      </button>
                      <button
                        onClick={generateEstimate}
                        className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                      >
                        Estimate PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Line Items Card */}
              {selectedJob && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">Line Items</h4>
                    <button
                      onClick={() => {
                        setEditingLineItem(null);
                        setLiType("LABOUR");
                        setLiDesc("");
                        setLiQty("1");
                        setLiPrice("");
                        setShowLineItemModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Add Item
                    </button>
                  </div>
                  {selectedJob.lineItems && selectedJob.lineItems.length > 0 ? (
                    <div className="space-y-2">
                      {selectedJob.lineItems.map((item) => (
                        <div key={item.id} className="border border-gray-200 rounded p-2 text-xs">
                          <div className="flex justify-between mb-1">
                            <span className="font-semibold text-gray-900">{item.description}</span>
                            <span className="text-gray-900">{formatCurrency(item.total || item.quantity * item.unitPrice)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600 mb-2">
                            <span>{item.lineType} • {item.quantity} × {formatCurrency(item.unitPrice)}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openLineItemEdit(item)}
                              className="flex-1 px-2 py-1 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteLineItem(item.id)}
                              className="flex-1 px-2 py-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-gray-500">No items added</div>
                  )}
                </div>
              )}

              {/* Payments Card */}
              {selectedJob && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">Payments</h4>
                    <button
                      onClick={() => {
                        setEditingPayment(null);
                        setPayAmount("");
                        setPayMode("CASH");
                        setPayReceivedBy("Nitesh");
                        setPayNote("");
                        setShowPaymentModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      Add Payment
                    </button>
                  </div>
                  {selectedJob.payments && selectedJob.payments.length > 0 ? (
                    <div className="space-y-2">
                      {selectedJob.payments.map((payment) => (
                        <div key={payment.id} className="border border-gray-200 rounded p-2 text-xs">
                          <div className="flex justify-between mb-1">
                            <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                            <span className="text-gray-600">{formatDate(payment.date)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                              {payment.paymentMode}
                            </span>
                            {payment.receivedBy && (
                              <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded">
                                {payment.receivedBy}
                              </span>
                            )}
                          </div>
                          {payment.note && (
                            <div className="text-gray-600 mb-2">{payment.note}</div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => openPaymentEdit(payment)}
                              className="flex-1 px-2 py-1 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deletePayment(payment.id)}
                              className="flex-1 px-2 py-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-gray-500">No payments recorded</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Create New Job Card</h3>

            <form onSubmit={createJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template (Optional)
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">No template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.kind})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Reg Number *
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={newReg}
                  onChange={(e) => setNewReg(e.target.value)}
                  placeholder="e.g., DL01AB1234"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner Name
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner Phone
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={newOwnerPhone}
                  onChange={(e) => setNewOwnerPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Complaints
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  value={newComplaints}
                  onChange={(e) => setNewComplaints(e.target.value)}
                  rows={3}
                  placeholder="What issues did the customer report?"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating..." : "Create Job Card"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Edit Job #{selectedJob.jobNumber}</h3>

            <form onSubmit={updateJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diagnosis
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  value={editDiagnosis}
                  onChange={(e) => setEditDiagnosis(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Done
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  value={editWorkDone}
                  onChange={(e) => setEditWorkDone(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={editTax}
                    onChange={(e) => setEditTax(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Update Job
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Line Item Modal */}
      {showLineItemModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {editingLineItem ? "Edit Line Item" : "Add Line Item"}
            </h3>

            <form onSubmit={saveLineItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {lineTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLiType(type)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        liType === type
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={liDesc}
                  onChange={(e) => setLiDesc(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={liQty}
                    onChange={(e) => setLiQty(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={liPrice}
                    onChange={(e) => setLiPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  {editingLineItem ? "Update Item" : "Add Item"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLineItemModal(false);
                    setEditingLineItem(null);
                  }}
                  className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {editingPayment ? "Edit Payment" : "Add Payment"}
            </h3>

            <form onSubmit={savePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
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
                      onClick={() => setPayMode(mode)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        payMode === mode
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
                      onClick={() => setPayReceivedBy(person)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        payReceivedBy === person
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
                  Note
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  {editingPayment ? "Update Payment" : "Add Payment"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setEditingPayment(null);
                  }}
                  className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Management Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Templates</h3>

            {/* Add Template Form */}
            <form onSubmit={saveTemplate} className="space-y-4 mb-6 pb-6 border-b border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Standard Service"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={templateKind}
                    onChange={(e) => setTemplateKind(e.target.value)}
                  >
                    <option value="INVOICE">Invoice</option>
                    <option value="ESTIMATE">Estimate</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Add Template
              </button>
            </form>

            {/* Templates List */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Saved Templates ({templates.length})</h4>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No templates created yet
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{template.name}</div>
                      <div className="text-sm text-gray-600">{template.kind}</div>
                    </div>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="w-full px-6 bg-gray-100 text-gray-700 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCardsPage;