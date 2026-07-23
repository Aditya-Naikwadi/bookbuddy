import { useState, useEffect, useMemo } from 'react';
import featureApi from '../../api/featureApi';
import ServiceCard from './ServiceCard';
import ServiceBundlePicker from './ServiceBundlePicker';
import ServiceDependencyNotice from './ServiceDependencyNotice';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ServiceSelectionStep({
  selectedServices = [],
  onChangeSelectedServices,
  onNext,
  onBack,
}) {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dependencyNotices, setDependencyNotices] = useState([]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const data = await featureApi.getAvailableServices();
        setServices(data || []);
      } catch (err) {
        console.error('Failed to load available services:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadServices();
  }, []);

  useEffect(() => {
    if (services.length > 0 && selectedServices.length === 0) {
      const coreKeys = services
        .filter((s) => s.isCore || ['catalog', 'loans', 'patron-card', 'fines'].includes(s.key))
        .map((s) => s.key);
      onChangeSelectedServices(coreKeys);
    }
  }, [services, selectedServices.length, onChangeSelectedServices]);

  const handleToggleService = (key) => {
    const isCurrentlySelected = selectedServices.includes(key);
    let updated = isCurrentlySelected
      ? selectedServices.filter((k) => k !== key)
      : [...selectedServices, key];

    const targetService = services.find((s) => s.key === key);
    const newNotices = [];

    if (!isCurrentlySelected && targetService?.dependencies) {
      targetService.dependencies.forEach((depKey) => {
        if (!updated.includes(depKey)) {
          updated.push(depKey);
          const depService = services.find((s) => s.key === depKey);
          newNotices.push(
            `Enabling "${targetService.name}" automatically enabled required dependency "${depService?.name || depKey}".`
          );
        }
      });
    }

    setDependencyNotices(newNotices);
    onChangeSelectedServices(updated);
  };

  const handleSelectBundle = (keys) => {
    setDependencyNotices([]);
    onChangeSelectedServices(keys);
  };

  const categories = useMemo(() => {
    const grouped = {};
    services.forEach((service) => {
      const cat = service.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(service);
    });
    return grouped;
  }, [services]);

  const coreServicesSelected = useMemo(() => {
    const coreKeys = services.filter((s) => s.isCore).map((s) => s.key);
    return selectedServices.some((k) => coreKeys.includes(k) || ['catalog', 'loans'].includes(k));
  }, [services, selectedServices]);

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-slate-500">Loading service catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Step 3 of 4 — Tenant Provisioning
        </span>
        <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mt-1">
          Select College Service Modules
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Choose the modules your library will license. This configures the features available to your admins and students.
        </p>
      </div>

      <ServiceBundlePicker
        services={services}
        selectedKeys={selectedServices}
        onSelectBundle={handleSelectBundle}
      />

      <ServiceDependencyNotice notices={dependencyNotices} />

      <div className="space-y-8">
        {Object.entries(categories).map(([categoryName, categoryServices]) => (
          <div key={categoryName} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                {categoryName} Modules ({categoryServices.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryServices.map((service) => (
                <ServiceCard
                  key={service.key}
                  service={service}
                  isSelected={selectedServices.includes(service.key)}
                  onToggle={handleToggleService}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {!coreServicesSelected && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>
            At least one Core service (such as Catalog & Discovery or Circulation & Loans) must be selected to proceed with college provisioning.
          </span>
        </div>
      )}

      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span>
            <strong>{selectedServices.length}</strong> of {services.length} services enabled for this tenant.
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onBack}
            className="w-1/2 sm:w-auto px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-all"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!coreServicesSelected}
            className={`w-1/2 sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-sm ${
              coreServicesSelected
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            <span>Proceed to Step 4</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
