import React, { useState, useEffect, useCallback } from "react";
import { Building2, Plus, CheckCircle2, Copy } from "lucide-react";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";
import OpsDataTable from "../../../components/ops/OpsDataTable";

export default function CollegeAdminManager() {
  const [colleges, setColleges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Operator Direct Onboarding Path
  const [formData, setFormData] = useState({
    name: "",
    shortName: "",
    domain: "",
    slug: "",
    adminName: "",
    adminEmail: "",
    password: "",
  });

  const [selectedServices, setSelectedServices] = useState([
    "catalog",
    "loans",
    "fines",
    "patron-card",
    "e-resources",
    "reading-lists",
  ]);

  const [reloadToken, setReloadToken] = useState(0);

  const fetchColleges = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let ignore = false;
    async function loadColleges() {
      try {
        setIsLoading(true);
        const data = await adminApi.listColleges();
        if (!ignore) setColleges(data || []);
      } catch (err) {
        console.error(err);
        if (!ignore) setError("Failed to load college institution records.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    loadColleges();
    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "name" && !prev.slug) {
        next.slug = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      }
      return next;
    });
  };

  const toggleService = (key) => {
    setSelectedServices((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (
      !formData.name ||
      !formData.domain ||
      !formData.adminEmail ||
      !formData.adminName
    ) {
      alert("Please fill all required institution and admin contact fields.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const generatedPassword =
        formData.password ||
        `Auth@${Math.random().toString(36).substring(2, 8)}`;

      const payload = {
        name: formData.name,
        shortName: formData.shortName || formData.name,
        domain: formData.domain.toLowerCase().trim(),
        slug: (formData.slug || formData.domain.split(".")[0])
          .toLowerCase()
          .trim(),
        code: (formData.slug || "TENANT").toUpperCase(),
        adminName: formData.adminName,
        adminEmail: formData.adminEmail.toLowerCase().trim(),
        password: generatedPassword,
        selectedServices,
      };

      const res = await adminApi.createCollege(payload);

      setCreatedReceipt({
        college: res.college || payload,
        adminUser: res.adminUser || {
          name: formData.adminName,
          email: formData.adminEmail,
        },
        tempPassword: generatedPassword,
        inviteUrl: `http://localhost:5173/auth/login?tenant=${payload.slug}`,
      });

      setIsCreatingTenant(false);
      fetchColleges();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Failed to direct-create college tenant.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const [editingCollege, setEditingCollege] = useState(null);
  const [editFeatures, setEditFeatures] = useState([]);

  const handleToggleCollegeStatus = async (collegeId, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    if (
      !window.confirm(
        `Are you sure you want to set institution status to ${nextStatus.toUpperCase()}?`,
      )
    ) {
      return;
    }

    try {
      await adminApi.updateCollegeStatus(collegeId, nextStatus);
      fetchColleges();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update tenant status.");
    }
  };

  const handleSaveCollegeFeatures = async (e) => {
    e.preventDefault();
    if (!editingCollege) return;

    try {
      await adminApi.updateCollege(editingCollege._id, {
        selectedServices: editFeatures,
        enabledFeatures: editFeatures,
      });
      alert(`Provisioned features updated for ${editingCollege.name}.`);
      setEditingCollege(null);
      fetchColleges();
    } catch (err) {
      alert(
        err.response?.data?.message || "Failed to update college features.",
      );
    }
  };

  const availableModules = [
    { key: "catalog", name: "Catalog & Discovery" },
    { key: "loans", name: "Circulation & Loans" },
    { key: "patron-card", name: "Digital Patron Pass" },
    { key: "fines", name: "Fines & Payments" },
    { key: "e-resources", name: "E-Resources Reader" },
    { key: "reading-lists", name: "Course Reading Lists" },
    { key: "recommendations", name: "AI Recommendations" },
    { key: "gamification", name: "Gamification & Badges" },
    { key: "facilities", name: "Facilities Lab Booking" },
    { key: "support", name: "Helpdesk Support" },
  ];

  const columns = [
    {
      header: "Institution Legal Name",
      key: "name",
      render: (val, row) => (
        <div>
          <div className="font-bold text-white text-xs">{val}</div>
          <div className="text-[10px] text-slate-500 font-mono">
            Slug: /{row.slug || "college"} | Code: {row.code || "COLLEGE"}
          </div>
        </div>
      ),
    },
    {
      header: "Domain Whitelist",
      key: "domain",
      render: (val) => (
        <span className="font-mono text-indigo-300 text-xs font-bold">
          @{val || "institution.edu"}
        </span>
      ),
    },
    {
      header: "Provisioned Features",
      key: "enabledFeatures",
      render: (val, row) => {
        const feats = val || row.selectedServices || [];
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-700/60 px-2 py-0.5 rounded">
              {feats.length} Active Modules
            </span>
            <button
              onClick={() => {
                setEditingCollege(row);
                setEditFeatures(feats);
              }}
              className="text-[10px] font-mono font-bold text-indigo-400 hover:underline border border-indigo-800 px-1.5 py-0.5 rounded bg-indigo-950/40"
            >
              EDIT
            </button>
          </div>
        );
      },
    },
    {
      header: "Tenant Status",
      key: "status",
      render: (val, row) => {
        const isAct = val === "active" || row.isActive;
        return (
          <OpsSeverityBadge
            status={isAct ? "active" : "suspended"}
            label={isAct ? "ACTIVE" : "SUSPENDED"}
            size="sm"
          />
        );
      },
    },
    {
      header: "Quick Actions",
      key: "actions",
      sortable: false,
      render: (_, row) => {
        const isAct = row.status === "active" || row.isActive;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                handleToggleCollegeStatus(
                  row._id,
                  isAct ? "active" : "suspended",
                )
              }
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                isAct
                  ? "bg-rose-950/60 border-rose-700/60 text-rose-300 hover:bg-rose-900"
                  : "bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900"
              }`}
            >
              {isAct ? "SUSPEND TENANT" : "ACTIVATE TENANT"}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <OpsHeader
        title="MODULE 02 // DIRECT COLLEGE TENANT PROVISIONING & MANAGEMENT"
        subtitle="Super Admin direct operator path for standing up institutional tenants and primary admin credentials"
        onRefresh={fetchColleges}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-950/60 border border-rose-700/60 p-3 rounded-lg text-rose-300 font-mono text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-rose-400 font-bold hover:underline"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Action Bar Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Onboarded College Tenants ({colleges.length})
            </h2>
          </div>

          <button
            onClick={() => {
              setIsCreatingTenant(true);
              setCreatedReceipt(null);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>DIRECT OPERATOR TENANT PROVISIONING</span>
          </button>
        </div>

        {/* Created Receipt Card Modal */}
        {createdReceipt && (
          <div className="bg-slate-900 border border-emerald-600/60 rounded-xl p-5 font-mono space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-300 uppercase">
                  TENANT & PRIMARY ADMIN PROVISIONED SUCCESSFULLY
                </span>
              </div>
              <button
                onClick={() => setCreatedReceipt(null)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                CLOSE RECEIPT
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold">
                  Institution Meta
                </span>
                <div>
                  Name:{" "}
                  <strong className="text-white">
                    {createdReceipt.college.name}
                  </strong>
                </div>
                <div>
                  Domain Whitelist:{" "}
                  <strong className="text-indigo-300">
                    @{createdReceipt.college.domain}
                  </strong>
                </div>
                <div>
                  Tenant Slug:{" "}
                  <strong className="text-slate-300">
                    /{createdReceipt.college.slug}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold">
                  Primary Admin Account
                </span>
                <div>
                  Name:{" "}
                  <strong className="text-white">
                    {createdReceipt.adminUser.name}
                  </strong>
                </div>
                <div>
                  Email:{" "}
                  <strong className="text-indigo-300">
                    {createdReceipt.adminUser.email}
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  Temporary Password:{" "}
                  <code className="bg-slate-900 px-2 py-0.5 rounded text-emerald-400 font-bold border border-slate-800">
                    {createdReceipt.tempPassword}
                  </code>
                </div>
              </div>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-700/50 p-3 rounded-lg flex items-center justify-between text-xs">
              <span className="text-indigo-200">
                An invitation email with setup link has been automatically
                dispatched to <strong>{createdReceipt.adminUser.email}</strong>.
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdReceipt.inviteUrl);
                  alert("Tenant login URL copied to clipboard!");
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[11px] flex items-center gap-1.5 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>COPY LOGIN URL</span>
              </button>
            </div>
          </div>
        )}

        {/* Operator Direct Tenant Creation Form */}
        {isCreatingTenant && (
          <form
            onSubmit={handleCreateTenant}
            className="bg-slate-900 border border-indigo-600/50 rounded-xl p-5 font-mono space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-bold text-white uppercase">
                  Direct Tenant Provisioning Form (Operator Path)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingTenant(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                CANCEL
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  College Legal Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Oxford University"
                  required
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  Institution Domain Whitelist *
                </label>
                <input
                  type="text"
                  name="domain"
                  value={formData.domain}
                  onChange={handleInputChange}
                  placeholder="e.g. ox.ac.uk"
                  required
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  Tenant Slug Identifier
                </label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  placeholder="e.g. oxford-univ"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  Primary Admin Full Name *
                </label>
                <input
                  type="text"
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleInputChange}
                  placeholder="e.g. Dr. Eleanor Vance"
                  required
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  Primary Admin Email *
                </label>
                <input
                  type="email"
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleInputChange}
                  placeholder="e.g. admin@ox.ac.uk"
                  required
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  Custom Admin Password (Optional)
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Leave empty to auto-generate"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Feature Selection Grid */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-[10px] text-slate-400 uppercase font-bold">
                Provisioned Module Configuration ({selectedServices.length}{" "}
                selected)
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {availableModules.map((mod) => {
                  const isChecked = selectedServices.includes(mod.key);
                  return (
                    <div
                      key={mod.key}
                      onClick={() => toggleService(mod.key)}
                      className={`p-2 rounded border cursor-pointer flex items-center gap-2 transition-all ${
                        isChecked
                          ? "bg-indigo-950/60 border-indigo-600 text-indigo-200 font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded accent-indigo-600"
                      />
                      <span className="text-[11px]">{mod.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingTenant(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded font-bold text-xs"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs shadow-lg"
              >
                {isSubmitting
                  ? "PROVISIONING..."
                  : "PROVISION TENANT & DISPATCH INVITE"}
              </button>
            </div>
          </form>
        )}

        {/* All Onboarded Colleges Data Table */}
        <OpsDataTable
          columns={columns}
          data={colleges}
          isLoading={isLoading}
          searchPlaceholder="Filter onboarded colleges by name, domain, slug..."
          emptyMessage="No onboarded college tenants found in database."
        />

        {/* EDIT COLLEGE FEATURES MODAL */}
        {editingCollege && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
            <form
              onSubmit={handleSaveCollegeFeatures}
              className="bg-slate-900 border border-indigo-600/60 rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-bold text-white uppercase">
                    PROVISIONED MODULE CONFIGURATION FOR {editingCollege.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCollege(null)}
                  className="text-slate-500 hover:text-slate-300 text-xs font-bold"
                >
                  CANCEL
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  Select Active Functional Modules ({editFeatures.length}{" "}
                  selected)
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {availableModules.map((mod) => {
                    const isChecked = editFeatures.includes(mod.key);
                    return (
                      <div
                        key={mod.key}
                        onClick={() => {
                          setEditFeatures((prev) =>
                            prev.includes(mod.key)
                              ? prev.filter((k) => k !== mod.key)
                              : [...prev, mod.key],
                          );
                        }}
                        className={`p-2.5 rounded border cursor-pointer flex items-center gap-2 transition-all ${
                          isChecked
                            ? "bg-indigo-950/60 border-indigo-600 text-indigo-200 font-bold"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded accent-indigo-600"
                        />
                        <span className="text-[11px]">{mod.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCollege(null)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded font-bold text-xs"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs shadow-lg"
                >
                  SAVE MODULE CONFIGURATION
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
