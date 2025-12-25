import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface InventoryItem {
  id: number;
  name: string;
  category: string | null;
  sku: string | null;
  brand: string | null;
  unit: string | null;
  minStock: number;
  currentStock: number;
  createdAt: string;
  updatedAt: string;
}

interface StockTx {
  id: number;
  type: "IN" | "OUT";
  quantity: number;
  unitPrice: number | null;
  reason: string | null;
  date: string;
  createdAt: string;
}

const categoryOptions = [
  "Oils & Lubricants",
  "Filters",
  "Brake Parts",
  "Engine Parts",
  "Electrical",
  "Body Parts",
  "Tires",
  "Cleaning Supplies",
  "Tools",
  "Other",
];

const unitOptions = ["Pieces", "Liters", "Kg", "Bottles", "Sets", "Pairs"];

const InventoryPage: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [stockTxs, setStockTxs] = useState<StockTx[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

  // Item form (add/edit)
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [itemBrand, setItemBrand] = useState("");
  const [itemUnit, setItemUnit] = useState("");
  const [itemMinStock, setItemMinStock] = useState("0");
  const [savingItem, setSavingItem] = useState(false);

  // Stock adjustment form
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockType, setStockType] = useState<"IN" | "OUT">("IN");
  const [stockQty, setStockQty] = useState("");
  const [stockUnitPrice, setStockUnitPrice] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [stockDate, setStockDate] = useState("");
  const [savingStock, setSavingStock] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLowStock, setFilterLowStock] = useState(false);

  const todayInput = () => new Date().toISOString().slice(0, 10);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<InventoryItem[]>("/inventory");
      setItems(res);
    } catch (err: any) {
      setError(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const loadStockTxs = async (itemId: number) => {
    setLoadingTxs(true);
    try {
      const res = await apiFetch<{
        item: { id: number; name: string };
        transactions: StockTx[];
      }>(`/inventory/${itemId}/stock-transactions`);
      setStockTxs(res.transactions);
    } catch (err) {
      console.log("Load stock tx error", err);
      setStockTxs([]);
    } finally {
      setLoadingTxs(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openNewItem = () => {
    setEditingItem(null);
    setItemName("");
    setItemCategory("");
    setItemSku("");
    setItemBrand("");
    setItemUnit("");
    setItemMinStock("0");
    setShowItemForm(true);
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategory(item.category || "");
    setItemSku(item.sku || "");
    setItemBrand(item.brand || "");
    setItemUnit(item.unit || "");
    setItemMinStock(String(item.minStock ?? 0));
    setShowItemForm(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName) {
      setError("Name is required for inventory item.");
      return;
    }

    setSavingItem(true);
    setError(null);

    const payload = {
      name: itemName,
      category: itemCategory || undefined,
      sku: itemSku || undefined,
      brand: itemBrand || undefined,
      unit: itemUnit || undefined,
      minStock: Number(itemMinStock) || 0,
    };

    try {
      if (editingItem) {
        await apiFetch(`/inventory/${editingItem.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/inventory", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setShowItemForm(false);
      await loadItems();
    } catch (err: any) {
      setError(err.message || "Failed to save item");
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (item: InventoryItem) => {
    if (item.currentStock !== 0) {
      alert("Cannot delete item while stock is not zero. Adjust stock first.");
      return;
    }

    if (!window.confirm(`Delete "${item.name}"?`)) return;

    try {
      await apiFetch(`/inventory/${item.id}`, { method: "DELETE" });
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
        setStockTxs([]);
      }
      await loadItems();
    } catch (err: any) {
      alert(err.message || "Failed to delete item");
    }
  };

  const openStockForm = (item: InventoryItem, type: "IN" | "OUT") => {
    setSelectedItem(item);
    setStockType(type);
    setStockQty("");
    setStockUnitPrice("");
    setStockReason("");
    setStockDate(todayInput());
    setShowStockForm(true);
  };

  const saveStockTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !stockQty) {
      setError("Quantity is required for stock movement.");
      return;
    }

    setSavingStock(true);
    setError(null);

    const payload = {
      type: stockType,
      quantity: Number(stockQty),
      unitPrice: stockUnitPrice ? Number(stockUnitPrice) : undefined,
      reason: stockReason || undefined,
      date: stockDate || undefined,
    };

    try {
      await apiFetch(`/inventory/${selectedItem.id}/stock`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowStockForm(false);
      await loadItems();
      if (selectedItem) {
        await loadStockTxs(selectedItem.id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save stock transaction");
    } finally {
      setSavingStock(false);
    }
  };

  const deleteStockTx = async (tx: StockTx) => {
    if (!selectedItem) return;
    if (!window.confirm("Delete this stock movement?")) return;

    try {
      await apiFetch(`/inventory/stock-transactions/${tx.id}`, {
        method: "DELETE",
      });
      await loadItems();
      await loadStockTxs(selectedItem.id);
    } catch (err: any) {
      alert(err.message || "Failed to delete transaction");
    }
  };

  const selectItemAndLoadTxs = (item: InventoryItem) => {
    setSelectedItem(item);
    loadStockTxs(item.id);
  };

  // Apply filters
  const filteredItems = items.filter((item) => {
    if (filterCategory !== "all" && item.category !== filterCategory) {
      return false;
    }
    if (filterLowStock && item.currentStock >= item.minStock) {
      return false;
    }
    return true;
  });

  const lowStockCount = items.filter(
    (item) => item.currentStock < item.minStock
  ).length;

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
              <h2 className="text-3xl font-bold text-gray-900">Inventory Management</h2>
              <p className="text-gray-600 mt-1">
                Track stock levels and movements • {lowStockCount > 0 && (
                  <span className="text-red-600 font-semibold">{lowStockCount} items low on stock</span>
                )}
              </p>
            </div>
            <button
              onClick={openNewItem}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Item</span>
            </button>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-7">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      checked={filterLowStock}
                      onChange={(e) => setFilterLowStock(e.target.checked)}
                    />
                    <span className="text-sm font-medium text-gray-700">Show only low stock</span>
                  </label>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredItems.length}</span> of{" "}
                <span className="font-semibold text-gray-900">{items.length}</span> items
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Items List */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Inventory Items ({filteredItems.length})
                </h3>

                {loading ? (
                  <div className="text-center py-12 text-gray-500">Loading...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">No items found</div>
                    <div className="text-sm text-gray-500">Add an item to get started</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredItems.map((item) => {
                      const isLowStock = item.currentStock < item.minStock;
                      const isSelected = selectedItem?.id === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : isLowStock
                              ? "border-red-300 bg-red-50 hover:border-red-400"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                          onClick={() => selectItemAndLoadTxs(item)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-lg font-bold text-gray-900">
                                  {item.name}
                                </h4>
                                {item.category && (
                                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded">
                                    {item.category}
                                  </span>
                                )}
                                {isLowStock && (
                                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded">
                                    LOW STOCK
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                {item.brand && <div>Brand: <span className="font-medium">{item.brand}</span></div>}
                                {item.sku && <div>SKU: <span className="font-medium">{item.sku}</span></div>}
                                {item.unit && <div>Unit: <span className="font-medium">{item.unit}</span></div>}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className={`text-3xl font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                                {item.currentStock}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Min: {item.minStock}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-gray-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openStockForm(item, "IN");
                              }}
                              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            >
                              Stock In
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openStockForm(item, "OUT");
                              }}
                              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                            >
                              Stock Out
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditItem(item);
                              }}
                              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteItem(item);
                              }}
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

            {/* Stock Transactions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Stock Movements
              </h3>

              {!selectedItem ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-2">No item selected</div>
                  <div className="text-sm text-gray-500">Click an item to view movements</div>
                </div>
              ) : loadingTxs ? (
                <div className="text-center py-12 text-gray-500">Loading...</div>
              ) : stockTxs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-2">No movements yet</div>
                  <div className="text-sm text-gray-500">for {selectedItem.name}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {stockTxs.map((tx) => (
                    <div
                      key={tx.id}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                              tx.type === "IN"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}>
                              {tx.type === "IN" ? "IN +" : "OUT -"}{tx.quantity}
                            </span>
                            {tx.unitPrice && (
                              <span className="text-xs text-gray-600">
                                @ ₹{tx.unitPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {tx.reason && (
                            <div className="text-xs text-gray-600">{tx.reason}</div>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          {formatDate(tx.date)}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteStockTx(tx)}
                        className="w-full mt-2 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {editingItem ? "Edit Item" : "Add New Item"}
            </h3>

            <form onSubmit={saveItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Item Name *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={itemSku}
                    onChange={(e) => setItemSku(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={itemBrand}
                    onChange={(e) => setItemBrand(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                  >
                    <option value="">Select unit</option>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Stock Level
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={itemMinStock}
                    onChange={(e) => setItemMinStock(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={savingItem}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingItem ? "Saving..." : editingItem ? "Update Item" : "Add Item"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowItemForm(false)}
                  className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockForm && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Stock {stockType === "IN" ? "In" : "Out"}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              for <span className="font-semibold">{selectedItem.name}</span>
            </p>

            <form onSubmit={saveStockTx} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Price (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={stockUnitPrice}
                  onChange={(e) => setStockUnitPrice(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={stockDate}
                  onChange={(e) => setStockDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="e.g., Purchase, Sale, Damage"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={savingStock}
                  className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors ${
                    stockType === "IN"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-orange-600 hover:bg-orange-700"
                  }`}
                >
                  {savingStock ? "Saving..." : `Record Stock ${stockType === "IN" ? "In" : "Out"}`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStockForm(false)}
                  className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;