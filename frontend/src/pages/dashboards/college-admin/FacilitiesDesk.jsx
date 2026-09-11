import { useState, useEffect } from "react";
import {
  Monitor,
  Calendar,
  Plus,
  Wrench,
  Armchair,
  Layers,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";
import { useSocket } from "../../../hooks/useSocket";

export default function FacilitiesDesk() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [activeTypeTab, setActiveTypeTab] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalMode, setModalMode] = useState("bulk"); // 'single' | 'bulk'
  const [bookingSearch, setBookingSearch] = useState("");
  const [selectedSeatForMaintenance, setSelectedSeatForMaintenance] =
    useState(null);

  // Single seat form state
  const [singleForm, setSingleForm] = useState({
    labName: "Main Computer Lab",
    seatNumber: "PC-01",
    resourceType: "workstation",
    zoneName: "Floor 1 - Quiet Zone",
    specs: "Core i7 / 16GB RAM / Dual Monitor",
  });

  // Bulk generator form state
  const [bulkForm, setBulkForm] = useState({
    labName: "Computer Lab A",
    prefix: "PC-",
    startNum: 1,
    count: 12,
    resourceType: "workstation",
    zoneName: "Floor 2 - Tech Wing",
    specs: "Workstation PC",
  });

  // Fetch lab seats
  const { data: seatsData, isLoading: isLoadingSeats } = useQuery({
    queryKey: ["labSeats"],
    queryFn: () => collegeAdminApi.getLabSeats(),
  });

  // Fetch lab bookings
  const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["labBookings"],
    queryFn: () => collegeAdminApi.getLabBookings(),
  });

  // Real-time live occupancy updates with strict cleanup to prevent listener leaks
  useEffect(() => {
    if (!socket) return;

    const handleSync = () => {
      queryClient.invalidateQueries(["labSeats"]);
      queryClient.invalidateQueries(["labBookings"]);
    };

    socket.on("facility:slot_booked", handleSync);
    socket.on("facility:slot_released", handleSync);
    socket.on("facility:slot_checked_in", handleSync);
    socket.on("facility:slot_cancelled", handleSync);
    socket.on("facility:resource_status_changed", handleSync);

    return () => {
      socket.off("facility:slot_booked", handleSync);
      socket.off("facility:slot_released", handleSync);
      socket.off("facility:slot_checked_in", handleSync);
      socket.off("facility:slot_cancelled", handleSync);
      socket.off("facility:resource_status_changed", handleSync);
    };
  }, [socket, queryClient]);

  // Mutations
  const createSeatMutation = useMutation({
    mutationFn: (data) => collegeAdminApi.createLabSeat(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["labSeats"]);
      setShowAddModal(false);
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (data) => collegeAdminApi.bulkCreateLabSeats(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["labSeats"]);
      setShowAddModal(false);
    },
  });

  const updateSeatMutation = useMutation({
    mutationFn: ({ id, payload }) => collegeAdminApi.updateLabSeat(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["labSeats"]);
      queryClient.invalidateQueries(["labBookings"]);
      setSelectedSeatForMaintenance(null);
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (id) => collegeAdminApi.cancelLabBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["labBookings"]);
    },
  });

  const seats = seatsData?.data || [];
  const bookings = bookingsData?.data || [];

  // Filter seats by resource type
  const filteredSeats = seats.filter((s) => {
    if (activeTypeTab === "all") return true;
    return s.resourceType === activeTypeTab;
  });

  // Summary Metrics
  const totalSeats = seats.length;
  const operationalCount = seats.filter(
    (s) => s.maintenanceStatus === "operational" || s.status === "available",
  ).length;
  const maintenanceCount = seats.filter(
    (s) => s.maintenanceStatus === "maintenance",
  ).length;
  const activeBookingsCount = bookings.filter(
    (b) => b.status === "booked",
  ).length;

  // Filtered Bookings by search query
  const filteredBookings = bookings.filter((b) => {
    if (!bookingSearch.trim()) return true;
    const q = bookingSearch.toLowerCase();
    const studentName = b.userId?.name?.toLowerCase() || "";
    const seatNum = (b.seatNumber || b.seatId?.seatNumber || "").toLowerCase();
    const studentId = (b.userId?.studentId || "").toLowerCase();
    return (
      studentName.includes(q) || seatNum.includes(q) || studentId.includes(q)
    );
  });

  const handleCreateSingle = (e) => {
    e.preventDefault();
    createSeatMutation.mutate(singleForm);
  };

  const handleCreateBulk = (e) => {
    e.preventDefault();
    bulkCreateMutation.mutate({
      ...bulkForm,
      startNum: parseInt(bulkForm.startNum, 10),
      count: parseInt(bulkForm.count, 10),
    });
  };

  const handleMaintenanceToggle = (seat, newStatus) => {
    updateSeatMutation.mutate({
      id: seat._id,
      payload: { maintenanceStatus: newStatus },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      {/* Header Banner */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
            Facilities & Space Allocation
          </span>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Workstations & Quiet Seating Desk
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage lab computers, quiet study pods, maintenance statuses, and
            student slot reservations.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus size={18} />
          Add Workstations
        </button>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Monitor size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{totalSeats}</div>
            <div className="text-xs text-slate-400">Total Resources</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {operationalCount}
            </div>
            <div className="text-xs text-slate-400">Operational</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Wrench size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">
              {maintenanceCount}
            </div>
            <div className="text-xs text-slate-400">Under Maintenance</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Calendar size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-sky-400">
              {activeBookingsCount}
            </div>
            <div className="text-xs text-slate-400">Active Bookings</div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Workstation Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="text-indigo-400" size={20} />
                Facility Resource Grid ({filteredSeats.length})
              </h3>

              {/* Resource Type Tabs */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {[
                  { id: "all", label: "All" },
                  { id: "workstation", label: "Workstations" },
                  { id: "quiet_seat", label: "Quiet Seats" },
                  { id: "study_pod", label: "Study Pods" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTypeTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeTypeTab === t.id
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingSeats ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="animate-spin text-indigo-400" size={24} />
                <span>Loading workstations & seating topology...</span>
              </div>
            ) : filteredSeats.length === 0 ? (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                <Armchair size={32} className="mx-auto text-slate-600" />
                <p className="text-sm font-medium">
                  No resources found for this category.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-xs text-indigo-400 underline hover:text-indigo-300"
                >
                  Configure new workstations now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredSeats.map((seat) => {
                  const isMaintenance =
                    seat.maintenanceStatus === "maintenance";
                  const isRetired = seat.maintenanceStatus === "retired";

                  return (
                    <div
                      key={seat._id}
                      className={`p-3.5 rounded-2xl border transition-all relative group flex flex-col justify-between ${
                        isMaintenance
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                          : isRetired
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-300 opacity-60"
                            : "bg-slate-950/80 border-slate-800 hover:border-indigo-500/40 text-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {seat.seatNumber}
                          </span>
                          <span className="text-[10px] capitalize px-1.5 py-0.5 rounded font-mono bg-slate-900 border border-slate-800">
                            {seat.resourceType
                              ? seat.resourceType.replace("_", " ")
                              : "PC"}
                          </span>
                        </div>
                        <div className="text-[11px] font-medium text-slate-300 truncate">
                          {seat.labName || "Computer Lab"}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {seat.zoneName || "Main Hall"}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
                            isMaintenance
                              ? "text-amber-400"
                              : isRetired
                                ? "text-rose-400"
                                : "text-emerald-400"
                          }`}
                        >
                          {isMaintenance ? (
                            <Wrench size={10} />
                          ) : (
                            <CheckCircle size={10} />
                          )}
                          {seat.maintenanceStatus || "operational"}
                        </span>

                        <button
                          onClick={() => setSelectedSeatForMaintenance(seat)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono bg-indigo-500/10 px-2 py-0.5 rounded hover:bg-indigo-500/20 transition-colors"
                        >
                          Status
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Active Reservations Log */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="text-sky-400" size={20} />
                Active Reservations
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                {filteredBookings.length} Logged
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search patron or seat..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {isLoadingBookings ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Loading reservation logs...
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No active workstation bookings match your query.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredBookings.map((b) => (
                  <div
                    key={b._id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex justify-between items-center gap-2 group hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {b.userId?.name || "Student"}
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          ({b.userId?.studentId || "N/A"})
                        </span>
                      </div>
                      <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                        Seat #{b.seatId?.seatNumber || b.seatNumber || "N/A"}{" "}
                        <span className="text-indigo-400 font-sans">
                          •{" "}
                          {b.resourceType
                            ? b.resourceType.replace("_", " ")
                            : "workstation"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        {b.checkedInAt || b.status === "completed" ? (
                          <span className="inline-flex items-center text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 gap-1">
                            <CheckCircle size={10} /> Checked In{" "}
                            {b.checkedInAt
                              ? `(${new Date(b.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
                              : ""}
                          </span>
                        ) : b.status === "no_show" ? (
                          <span className="inline-flex items-center text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 gap-1">
                            <AlertTriangle size={10} /> No-Show
                          </span>
                        ) : b.status === "cancelled" ? (
                          <span className="inline-flex items-center text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                            Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 gap-1">
                            <Clock size={10} /> Pending Check-in
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-indigo-300 font-semibold text-[11px]">
                        {new Date(b.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(b.startTime).toLocaleDateString()}
                      </div>

                      {b.status === "booked" && (
                        <button
                          onClick={() => cancelBookingMutation.mutate(b._id)}
                          className="mt-1 text-[10px] text-rose-400 hover:text-rose-300 underline font-mono"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Status Modal */}
      {selectedSeatForMaintenance && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="text-amber-400" size={20} />
              Update Seat #{selectedSeatForMaintenance.seatNumber}
            </h3>
            <p className="text-xs text-slate-400">
              Toggling a workstation to{" "}
              <strong className="text-amber-400">Maintenance</strong> or{" "}
              <strong className="text-rose-400">Retired</strong> will
              automatically cancel any upcoming active student reservations for
              this station.
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() =>
                  handleMaintenanceToggle(
                    selectedSeatForMaintenance,
                    "operational",
                  )
                }
                className="w-full text-left p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center justify-between"
              >
                <span>Operational (Ready for Booking)</span>
                <CheckCircle size={16} />
              </button>

              <button
                onClick={() =>
                  handleMaintenanceToggle(
                    selectedSeatForMaintenance,
                    "maintenance",
                  )
                }
                className="w-full text-left p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center justify-between"
              >
                <span>Maintenance (Auto-cancel future holds)</span>
                <Wrench size={16} />
              </button>

              <button
                onClick={() =>
                  handleMaintenanceToggle(selectedSeatForMaintenance, "retired")
                }
                className="w-full text-left p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center justify-between"
              >
                <span>Retired (Decommissioned)</span>
                <XCircle size={16} />
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSeatForMaintenance(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Generator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="text-indigo-400" size={20} />
                Configure Workstations & Seating
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setModalMode("bulk")}
                className={`flex-1 py-1.5 rounded-lg font-medium text-center transition-all ${
                  modalMode === "bulk"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Bulk Generator (e.g. PC-01 to 20)
              </button>
              <button
                onClick={() => setModalMode("single")}
                className={`flex-1 py-1.5 rounded-lg font-medium text-center transition-all ${
                  modalMode === "single"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Single Station
              </button>
            </div>

            {modalMode === "bulk" ? (
              <form onSubmit={handleCreateBulk} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Lab / Room Name
                  </label>
                  <input
                    type="text"
                    required
                    value={bulkForm.labName}
                    onChange={(e) =>
                      setBulkForm({ ...bulkForm, labName: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Resource Type
                    </label>
                    <select
                      value={bulkForm.resourceType}
                      onChange={(e) =>
                        setBulkForm({
                          ...bulkForm,
                          resourceType: e.target.value,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="workstation">PC Workstation</option>
                      <option value="quiet_seat">Quiet Study Seat</option>
                      <option value="study_pod">Study Pod</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Zone / Floor
                    </label>
                    <input
                      type="text"
                      value={bulkForm.zoneName}
                      onChange={(e) =>
                        setBulkForm({ ...bulkForm, zoneName: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Prefix
                    </label>
                    <input
                      type="text"
                      value={bulkForm.prefix}
                      onChange={(e) =>
                        setBulkForm({ ...bulkForm, prefix: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Start Number
                    </label>
                    <input
                      type="number"
                      value={bulkForm.startNum}
                      onChange={(e) =>
                        setBulkForm({ ...bulkForm, startNum: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Count
                    </label>
                    <input
                      type="number"
                      max="100"
                      value={bulkForm.count}
                      onChange={(e) =>
                        setBulkForm({ ...bulkForm, count: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bulkCreateMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20"
                  >
                    {bulkCreateMutation.isPending
                      ? "Generating..."
                      : `Generate ${bulkForm.count} Stations`}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateSingle} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Lab / Room Name
                  </label>
                  <input
                    type="text"
                    required
                    value={singleForm.labName}
                    onChange={(e) =>
                      setSingleForm({ ...singleForm, labName: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Seat Identifier
                    </label>
                    <input
                      type="text"
                      required
                      value={singleForm.seatNumber}
                      onChange={(e) =>
                        setSingleForm({
                          ...singleForm,
                          seatNumber: e.target.value,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Resource Type
                    </label>
                    <select
                      value={singleForm.resourceType}
                      onChange={(e) =>
                        setSingleForm({
                          ...singleForm,
                          resourceType: e.target.value,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="workstation">PC Workstation</option>
                      <option value="quiet_seat">Quiet Study Seat</option>
                      <option value="study_pod">Study Pod</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Hardware / Zone Specs
                  </label>
                  <input
                    type="text"
                    value={singleForm.specs}
                    onChange={(e) =>
                      setSingleForm({ ...singleForm, specs: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSeatMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20"
                  >
                    {createSeatMutation.isPending
                      ? "Creating..."
                      : "Create Station"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
