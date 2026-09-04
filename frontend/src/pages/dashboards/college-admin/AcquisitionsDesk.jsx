import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  XCircle,
  Trash2,
  DollarSign,
  Building2,
  FileSpreadsheet,
  Calendar,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import {
  getAcquisitionOrders,
  getAcquisitionStats,
  createAcquisitionOrder,
  updateAcquisitionStatus,
  deleteAcquisitionOrder,
} from "../../../api/acquisitionApi";
import socket from "../../../lib/socketClient";

export default function AcquisitionsDesk() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("orders"); // 'orders' | 'new-order' | 'vendors'
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Form state for creating new order
  const [vendorName, setVendorName] = useState("");
  const [budgetCode, setBudgetCode] = useState("LIBRARY-GEN-2026");
  const [priority, setPriority] = useState("medium");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([
    { title: "", author: "", isbn: "", quantity: 1, unitPrice: "" },
  ]);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Queries
  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: ["acquisitions", statusFilter, searchQuery],
    queryFn: () =>
      getAcquisitionOrders({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery || undefined,
      }),
  });

  const { data: statsData } = useQuery({
    queryKey: ["acquisitionStats"],
    queryFn: getAcquisitionStats,
  });

  // Real-time synchronization
  useEffect(() => {
    const handleSync = () => {
      queryClient.invalidateQueries({ queryKey: ["acquisitions"] });
      queryClient.invalidateQueries({ queryKey: ["acquisitionStats"] });
    };

    socket.on("acquisition:updated", handleSync);
    return () => {
      socket.off("acquisition:updated", handleSync);
    };
  }, [queryClient]);

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: createAcquisitionOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acquisitions"] });
      queryClient.invalidateQueries({ queryKey: ["acquisitionStats"] });
      setFormSuccess("Purchase order successfully created and recorded!");
      setFormError("");
      setVendorName("");
      setItems([
        { title: "", author: "", isbn: "", quantity: 1, unitPrice: "" },
      ]);
      setNotes("");
      setTimeout(() => {
        setFormSuccess("");
        setActiveTab("orders");
      }, 1500);
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.message || "Failed to create acquisition order.",
      );
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateAcquisitionStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acquisitions"] });
      queryClient.invalidateQueries({ queryKey: ["acquisitionStats"] });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: deleteAcquisitionOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acquisitions"] });
      queryClient.invalidateQueries({ queryKey: ["acquisitionStats"] });
      if (selectedOrder) setSelectedOrder(null);
    },
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      { title: "", author: "", isbn: "", quantity: 1, unitPrice: "" },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateFormTotal = () => {
    return items.reduce((sum, item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.unitPrice) || 0;
      return sum + q * p;
    }, 0);
  };

  const handleSubmitOrder = (e) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      setFormError("Vendor name is required.");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].title.trim()) {
        setFormError(`Item #${i + 1} must have a title.`);
        return;
      }
      if (!items[i].unitPrice || Number(items[i].unitPrice) < 0) {
        setFormError(
          `Item #${i + 1} must have a valid non-negative unit price.`,
        );
        return;
      }
    }

    createOrderMutation.mutate({
      vendorName,
      budgetCode,
      priority,
      notes,
      items: items.map((it) => ({
        ...it,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      })),
      status: "submitted",
    });
  };

  const orders = ordersData?.data || [];
  const stats = statsData?.data || {
    totalOrders: 0,
    totalSpent: 0,
    activeVendorsCount: 0,
    byStatus: {},
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "ordered":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "received":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "submitted":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "cancelled":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full">
              ILS MODULE 05 — ACQUISITIONS & SERIALS
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Real-time Budget Sync
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-serif mt-2">
            Acquisitions & Serials Procurement
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Centralized book procurement orders, vendor relations, budget
            allocation, and multi-copy catalog intake.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() =>
              setActiveTab(activeTab === "new-order" ? "orders" : "new-order")
            }
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
          >
            {activeTab === "new-order" ? (
              <>
                <ShoppingBag size={16} />
                <span>View Orders</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Create Purchase Order</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-bold font-mono">
            Total Orders
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {stats.totalOrders}
          </div>
          <div className="text-[10px] text-indigo-400 mt-1">
            Logged in Ledger
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-bold font-mono">
            Total Spent
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            ₹{(stats.totalSpent || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-1">
            Approved & Completed
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-bold font-mono">
            Pending Review
          </div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">
            {stats.byStatus?.submitted || 0}
          </div>
          <div className="text-[10px] text-amber-400/80 mt-1">
            Awaiting Approval
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-bold font-mono">
            Registered Vendors
          </div>
          <div className="text-2xl font-extrabold text-cyan-400 mt-1">
            {stats.activeVendorsCount || 0}
          </div>
          <div className="text-[10px] text-cyan-400/80 mt-1">
            Active Publishers & Booksellers
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("orders")}
          className={`pb-3 text-xs font-bold font-mono transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "orders"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShoppingBag size={14} />
          <span>Purchase Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("new-order")}
          className={`pb-3 text-xs font-bold font-mono transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "new-order"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Plus size={14} />
          <span>New Acquisition Order</span>
        </button>
      </div>

      {/* Tab 1: Orders List */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor, ISBN, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {[
                "all",
                "submitted",
                "approved",
                "ordered",
                "received",
                "cancelled",
              ].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table / Cards */}
          {isOrdersLoading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading acquisition purchase orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white">
                No Purchase Orders Found
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No orders match your filter criteria. Create your first
                acquisition order to begin procurement tracking.
              </p>
              <button
                onClick={() => setActiveTab("new-order")}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                Create First Order
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors shadow-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-indigo-400">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-white">
                            {order.vendorName}
                          </h3>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${getStatusBadge(
                              order.status,
                            )}`}
                          >
                            {order.status}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {order.priority} priority
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          Budget Code: {order.budgetCode} • Created:{" "}
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">
                          Order Value
                        </div>
                        <div className="text-lg font-mono font-extrabold text-emerald-400">
                          ₹{(order.totalAmount || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Status Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {order.status === "submitted" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: order._id,
                                status: "approved",
                              })
                            }
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold"
                          >
                            Approve
                          </button>
                        )}

                        {order.status === "approved" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: order._id,
                                status: "ordered",
                              })
                            }
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold"
                          >
                            Mark Ordered
                          </button>
                        )}

                        {order.status === "ordered" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: order._id,
                                status: "received",
                              })
                            }
                            className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-bold"
                          >
                            Receive Stock
                          </button>
                        )}

                        {["submitted", "draft"].includes(order.status) && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: order._id,
                                status: "cancelled",
                              })
                            }
                            className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold"
                            title="Cancel Order"
                          >
                            <XCircle size={14} />
                          </button>
                        )}

                        {["draft", "cancelled"].includes(order.status) && (
                          <button
                            onClick={() =>
                              deleteOrderMutation.mutate(order._id)
                            }
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete Order"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items List Breakdown */}
                  <div className="mt-3 pt-2">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Titles in this Order ({order.items?.length || 0})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {order.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-xs"
                        >
                          <p className="font-bold text-slate-200 truncate">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {item.author
                              ? `By ${item.author}`
                              : "Author unlisted"}{" "}
                            {item.isbn ? `• ISBN: ${item.isbn}` : ""}
                          </p>
                          <div className="mt-2 flex justify-between text-[11px] font-mono text-slate-300">
                            <span>Qty: {item.quantity}</span>
                            <span className="text-emerald-400">
                              ₹
                              {(
                                item.quantity * item.unitPrice
                              ).toLocaleString()}{" "}
                              (₹{item.unitPrice}/ea)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Create New Order Form */}
      {activeTab === "new-order" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white">
              Create New Purchase Order
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Procure new inventory copies with automatic PO numbering and
              budget code tracking.
            </p>
          </div>

          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmitOrder} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                  Vendor / Publisher Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Oxford University Press, Pearson"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                  Budget Code / Fund
                </label>
                <input
                  type="text"
                  value={budgetCode}
                  onChange={(e) => setBudgetCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Dynamic Items Array */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  Order Items ({items.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus size={14} /> Add Another Title
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Book Title *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Introduction to Algorithms"
                        value={item.title}
                        onChange={(e) =>
                          handleItemChange(idx, "title", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        required
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Author
                      </label>
                      <input
                        type="text"
                        placeholder="Author name"
                        value={item.author}
                        onChange={(e) =>
                          handleItemChange(idx, "author", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        ISBN
                      </label>
                      <input
                        type="text"
                        placeholder="ISBN-13"
                        value={item.isbn}
                        onChange={(e) =>
                          handleItemChange(idx, "isbn", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, "quantity", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white text-center"
                        required
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Unit Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleItemChange(idx, "unitPrice", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        required
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-center pb-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                        className="text-slate-500 hover:text-rose-400 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total calculation & submission bar */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400">
                  Estimated Total Order Value:
                </span>
                <span className="text-xl font-mono font-extrabold text-emerald-400 ml-2">
                  ₹{calculateFormTotal().toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Submit Purchase Order</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
