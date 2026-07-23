import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  User,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
} from 'lucide-react';
import registrationApi from '../../api/registrationApi';
import { fetchCsrfToken } from '../../api/client';
import ServiceSelectionStep from '../../components/registration/ServiceSelectionStep';

export default function RegistrationPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'onboarding'
  const [colleges, setColleges] = useState([]);
  const [isLoadingColleges, setIsLoadingColleges] = useState(true);

  // General feedback messages
  const [globalMessage, setGlobalMessage] = useState({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FLOW A: Student Form State
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    collegeId: '',
    studentId: '',
    department: '',
    phone: '',
    termsAccepted: false,
  });

  // Flow A OTP Verification Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');

  // FLOW B: Tenant Onboarding Wizard State (Steps 1, 2, 3)
  const [wizardStep, setWizardStep] = useState(1);
  const [tenantForm, setTenantForm] = useState({
    // Step 1: Institution Details
    legalName: '',
    shortName: '',
    institutionType: 'college',
    domain: '',
    street: '',
    city: '',
    state: '',
    country: 'United States',
    postalCode: '',
    contactPhone: '',

    // Step 2: Admin Applicant Details
    adminName: '',
    adminEmail: '',
    designation: 'Librarian',
    password: '',
    confirmPassword: '',
    adminPhone: '',

    // Step 3: Service Selection
    selectedServices: ['catalog', 'loans', 'patron-card', 'fines', 'e-resources', 'reading-lists'],

    // Step 4: Verification & Submission
    desiredSlug: '',
    proofDocument: null,
    termsAccepted: false,
  });

  // Fetch active colleges on load
  useEffect(() => {
    fetchCsrfToken();
    const loadColleges = async () => {
      try {
        const data = await registrationApi.getActiveColleges();
        setColleges(data || []);
      } catch (err) {
        console.error('Failed to load active colleges list:', err);
        setGlobalMessage({
          type: 'error',
          text: 'Unable to load active colleges. Please refresh.',
        });
      } finally {
        setIsLoadingColleges(false);
      }
    };
    loadColleges();
  }, []);

  // Handle Flow A Submit
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalMessage({ type: '', text: '' });
    setIsSubmitting(true);

    try {
      const response = await registrationApi.registerStudent(studentForm);
      setOtpEmail(response.data?.email || studentForm.email);
      setShowOtpModal(true);
      setGlobalMessage({
        type: 'success',
        text: 'Registration code sent! Please check your email inbox.',
      });
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.errors && typeof resp.errors === 'object') {
        setFieldErrors(resp.errors);
      } else {
        setGlobalMessage({
          type: 'error',
          text: resp?.message || 'Failed to submit registration. Please check fields.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Student OTP Verification
  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setGlobalMessage({ type: '', text: '' });

    try {
      await registrationApi.verifyStudentEmail({
        email: otpEmail,
        otp: otpCode,
      });
      setGlobalMessage({
        type: 'success',
        text: 'Account verified successfully! Redirecting to login...',
      });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setGlobalMessage({
        type: 'error',
        text: err.response?.data?.message || 'Invalid or expired OTP code.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Flow B Wizard Step Navigation & Submission
  const handleNextWizardStep = (e) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalMessage({ type: '', text: '' });

    if (wizardStep === 1) {
      if (!tenantForm.legalName || !tenantForm.domain || !tenantForm.city) {
        setGlobalMessage({
          type: 'error',
          text: 'Please fill in mandatory institution details before proceeding.',
        });
        return;
      }
    } else if (wizardStep === 2) {
      if (!tenantForm.adminName || !tenantForm.adminEmail || !tenantForm.password) {
        setGlobalMessage({
          type: 'error',
          text: 'Please fill in mandatory admin details before proceeding.',
        });
        return;
      }
      if (tenantForm.password !== tenantForm.confirmPassword) {
        setGlobalMessage({ type: 'error', text: 'Passwords do not match.' });
        return;
      }
    }

    setWizardStep((prev) => Math.min(prev + 1, 3));
  };

  const handleFlowBSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalMessage({ type: '', text: '' });
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('legalName', tenantForm.legalName);
      formData.append('shortName', tenantForm.shortName);
      formData.append('institutionType', tenantForm.institutionType);
      formData.append('domain', tenantForm.domain);
      formData.append(
        'address',
        JSON.stringify({
          street: tenantForm.street,
          city: tenantForm.city,
          state: tenantForm.state,
          country: tenantForm.country,
          postalCode: tenantForm.postalCode,
        })
      );
      formData.append('contactPhone', tenantForm.contactPhone);

      formData.append('adminName', tenantForm.adminName);
      formData.append('adminEmail', tenantForm.adminEmail);
      formData.append('designation', tenantForm.designation);
      formData.append('password', tenantForm.password);
      formData.append('confirmPassword', tenantForm.confirmPassword);
      formData.append('adminPhone', tenantForm.adminPhone);

      formData.append('selectedServices', JSON.stringify(tenantForm.selectedServices || []));
      formData.append('desiredSlug', tenantForm.desiredSlug);
      formData.append('termsAccepted', tenantForm.termsAccepted);

      if (tenantForm.proofDocument) {
        formData.append('proofDocument', tenantForm.proofDocument);
      }

      await registrationApi.submitTenantOnboarding(formData);
      setGlobalMessage({
        type: 'success',
        text: 'Onboarding application submitted! Your request is pending Super Admin review.',
      });
      setWizardStep(5); // Submitted success state
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.errors && typeof resp.errors === 'object') {
        setFieldErrors(resp.errors);
      } else {
        setGlobalMessage({
          type: 'error',
          text: resp?.message || 'Failed to submit tenant onboarding application.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selected college object for Flow A
  const selectedCollegeObj = colleges.find((c) => c._id === studentForm.collegeId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-2 mb-3">
            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg">
              <BookOpen className="w-8 h-8" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              BookBuddy
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            Join the Multi-Tenant Digital Library Platform
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Choose your account type below to get started.
          </p>
        </div>

        {/* Dual Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-200 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-2 shadow-inner max-w-md w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab('student');
                setGlobalMessage({ type: '', text: '' });
                setFieldErrors({});
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'student'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Student Signup
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('onboarding');
                setGlobalMessage({ type: '', text: '' });
                setFieldErrors({});
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'onboarding'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              College Onboarding
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {globalMessage.text && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm font-medium ${
              globalMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {globalMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <span>{globalMessage.text}</span>
          </div>
        )}

        {/* TAB 1: STUDENT SELF-REGISTRATION (FLOW A) */}
        {activeTab === 'student' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700 p-6 sm:p-10">
            <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Student Member Registration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Register against your institution's active library portal.
              </p>
            </div>

            <form onSubmit={handleStudentSubmit} className="space-y-6">
              {/* Active College Select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  Select Active Institution <span className="text-rose-500">*</span>
                </label>
                {isLoadingColleges ? (
                  <div className="py-2.5 text-sm text-slate-400 animate-pulse">
                    Loading active colleges...
                  </div>
                ) : (
                  <select
                    value={studentForm.collegeId}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, collegeId: e.target.value, department: '' })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                  >
                    <option value="">-- Choose your College --</option>
                    {colleges.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.code}) {c.domain ? `- @${c.domain}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedCollegeObj?.domain && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1.5 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    This college requires an institutional email ending in @{selectedCollegeObj.domain}
                  </p>
                )}
                {fieldErrors.collegeId && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.collegeId}</p>
                )}
              </div>

              {/* Student ID & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-rose-500 mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                    Student / Roll ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={studentForm.studentId}
                    onChange={(e) => setStudentForm({ ...studentForm, studentId: e.target.value })}
                    placeholder="e.g. CS2026042"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                  />
                  {fieldErrors.studentId && (
                    <p className="text-xs text-rose-500 mt-1">{fieldErrors.studentId}</p>
                  )}
                </div>
              </div>

              {/* Email & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      placeholder={
                        selectedCollegeObj?.domain
                          ? `you@${selectedCollegeObj.domain}`
                          : 'student@example.edu'
                      }
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      required
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs text-rose-500 mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                    Department / Course
                  </label>
                  {selectedCollegeObj?.configuredDepartments?.length > 0 ? (
                    <select
                      value={studentForm.department}
                      onChange={(e) =>
                        setStudentForm({ ...studentForm, department: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    >
                      <option value="">-- Select Department --</option>
                      {selectedCollegeObj.configuredDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={studentForm.department}
                      onChange={(e) =>
                        setStudentForm({ ...studentForm, department: e.target.value })
                      }
                      placeholder="e.g. Computer Science"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  )}
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="password"
                      value={studentForm.password}
                      onChange={(e) =>
                        setStudentForm({ ...studentForm, password: e.target.value })
                      }
                      placeholder="Min 8 chars, 1 Upper, 1 Special"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      required
                    />
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-rose-500 mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="password"
                      value={studentForm.confirmPassword}
                      onChange={(e) =>
                        setStudentForm({ ...studentForm, confirmPassword: e.target.value })
                      }
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      required
                    />
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-rose-500 mt-1">{fieldErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Terms Acceptance */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="studentTerms"
                  checked={studentForm.termsAccepted}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, termsAccepted: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded border-slate-300"
                  required
                />
                <label htmlFor="studentTerms" className="text-xs text-slate-600 dark:text-slate-400">
                  I agree to the BookBuddy Terms of Service and Privacy Policy. I confirm I am an active student at the selected institution.
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <span>Submit & Get Verification OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: COLLEGE ADMIN TENANT ONBOARDING WIZARD (FLOW B) */}
        {activeTab === 'onboarding' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700 p-6 sm:p-10">
            {/* Wizard Header & Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Tenant Onboarding Wizard
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Register a new college tenant and provision its primary admin account.
                  </p>
                </div>
                {wizardStep <= 4 && (
                  <span className="text-xs font-extrabold uppercase px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-200 dark:border-indigo-800">
                    Step {wizardStep} of 4
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {wizardStep <= 4 && (
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((stepNum) => (
                    <div
                      key={stepNum}
                      className={`h-2 flex-1 rounded-full transition-all ${
                        wizardStep >= stepNum
                          ? 'bg-indigo-600 dark:bg-indigo-500'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* STEP 1: INSTITUTION DETAILS */}
            {wizardStep === 1 && (
              <form onSubmit={handleNextWizardStep} className="space-y-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> 1. Institution Metadata
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Legal Institution Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tenantForm.legalName}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, legalName: e.target.value })
                      }
                      placeholder="e.g. Stanford University"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Short Name / Display Abbreviation
                    </label>
                    <input
                      type="text"
                      value={tenantForm.shortName}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, shortName: e.target.value })
                      }
                      placeholder="e.g. Stanford"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Institution Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={tenantForm.institutionType}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, institutionType: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    >
                      <option value="university">University</option>
                      <option value="college">College</option>
                      <option value="school">School</option>
                      <option value="training_institute">Training Institute</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Official Website Domain <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tenantForm.domain}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, domain: e.target.value })
                      }
                      placeholder="e.g. stanford.edu"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Future student signups will be domain-checked against this website domain.
                    </p>
                  </div>
                </div>

                {/* Address & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tenantForm.city}
                      onChange={(e) => setTenantForm({ ...tenantForm, city: e.target.value })}
                      placeholder="e.g. Stanford"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      State / Province
                    </label>
                    <input
                      type="text"
                      value={tenantForm.state}
                      onChange={(e) => setTenantForm({ ...tenantForm, state: e.target.value })}
                      placeholder="e.g. California"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tenantForm.contactPhone}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, contactPhone: e.target.value })
                      }
                      placeholder="+1 (650) 723-2300"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md flex items-center gap-2"
                  >
                    <span>Proceed to Admin Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: ADMIN APPLICANT DETAILS */}
            {wizardStep === 2 && (
              <form onSubmit={handleNextWizardStep} className="space-y-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> 2. Primary College Admin Applicant
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Admin Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tenantForm.adminName}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, adminName: e.target.value })
                      }
                      placeholder="e.g. Dr. Arthur Miller"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Official Institutional Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={tenantForm.adminEmail}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, adminEmail: e.target.value })
                      }
                      placeholder={`admin@${tenantForm.domain || 'college.edu'}`}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Must use the institution domain (@{tenantForm.domain || 'college.edu'}).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Designation / Role <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tenantForm.designation}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, designation: e.target.value })
                      }
                      placeholder="e.g. Head Librarian / IT Director"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Admin Direct Phone
                    </label>
                    <input
                      type="text"
                      value={tenantForm.adminPhone}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, adminPhone: e.target.value })
                      }
                      placeholder="+1 (650) 555-0199"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>
                </div>

                {/* Passwords */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Admin Account Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={tenantForm.password}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, password: e.target.value })
                      }
                      placeholder="Min 8 chars, 1 Upper, 1 Special"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm Admin Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={tenantForm.confirmPassword}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, confirmPassword: e.target.value })
                      }
                      placeholder="Repeat admin password"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="py-3 px-5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-sm flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md flex items-center gap-2"
                  >
                    <span>Proceed to Service Selection</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: SERVICE SELECTION */}
            {wizardStep === 3 && (
              <ServiceSelectionStep
                selectedServices={tenantForm.selectedServices}
                onChangeSelectedServices={(services) =>
                  setTenantForm({ ...tenantForm, selectedServices: services })
                }
                onNext={() => setWizardStep(4)}
                onBack={() => setWizardStep(2)}
              />
            )}

            {/* STEP 4: VERIFICATION & FINAL SUBMISSION */}
            {wizardStep === 4 && (
              <form onSubmit={handleFlowBSubmit} className="space-y-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> 4. Verification & Proof Upload
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Desired Tenant Slug / Subdomain <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tenantForm.desiredSlug}
                      onChange={(e) =>
                        setTenantForm({
                          ...tenantForm,
                          desiredSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                        })
                      }
                      placeholder="e.g. stanford-edu"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                      required
                    />
                    <span className="text-xs font-mono text-slate-500">.bookbuddy.app</span>
                  </div>
                  {fieldErrors.desiredSlug && (
                    <p className="text-xs text-rose-500 mt-1">{fieldErrors.desiredSlug}</p>
                  )}
                </div>

                {/* Upload Proof Document */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Upload Accreditation / Authorization Document (PDF, JPG, PNG)
                  </label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-6 text-center hover:border-indigo-500 transition-colors">
                    <UploadCloud className="w-8 h-8 mx-auto text-indigo-500 mb-2" />
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        setTenantForm({
                          ...tenantForm,
                          proofDocument: e.target.files[0] || null,
                        })
                      }
                      className="hidden"
                      id="proofDocumentInput"
                    />
                    <label
                      htmlFor="proofDocumentInput"
                      className="cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {tenantForm.proofDocument
                        ? tenantForm.proofDocument.name
                        : 'Click to select verification document'}
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Max file size: 10MB (Official letterhead, business registration, or charter)
                    </p>
                  </div>
                </div>

                {/* Terms Acceptance */}
                <div className="flex items-start gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="tenantTerms"
                    checked={tenantForm.termsAccepted}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, termsAccepted: e.target.checked })
                    }
                    className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded border-slate-300"
                    required
                  />
                  <label htmlFor="tenantTerms" className="text-xs text-slate-600 dark:text-slate-400">
                    I represent the institution legally and accept the BookBuddy Enterprise Data Processing Agreement and Terms of Service.
                  </label>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="py-3 px-5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-sm flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-3.5 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting Application...' : 'Submit Onboarding Request'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: SUBMITTED SUCCESS VIEW */}
            {wizardStep === 4 && (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Application Submitted for Review!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Your tenant onboarding request for{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {tenantForm.legalName}
                  </strong>{' '}
                  is now in <span className="font-semibold text-amber-600">Pending Review</span> status.
                </p>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl max-w-md mx-auto text-xs text-slate-500 text-left space-y-1 border border-slate-200 dark:border-slate-700">
                  <p>
                    • We sent a domain verification link to{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {tenantForm.adminEmail}
                    </strong>
                    .
                  </p>
                  <p>• A Super Admin will review your verification documents shortly.</p>
                  <p>• Once approved, your tenant account and initial admin login will be activated.</p>
                </div>
                <div className="pt-4">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all"
                  >
                    <span>Return to Login</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OTP VERIFICATION MODAL FOR STUDENT SIGNUP (FLOW A) */}
        {showOtpModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Enter Email Verification OTP
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  We sent a 6-digit verification code to <strong>{otpEmail}</strong>.
                </p>
              </div>

              <form onSubmit={handleOtpVerify} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full text-center tracking-widest text-2xl font-mono px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    maxLength={6}
                    required
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.length < 4}
                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Already have an active account?{' '}
          <Link to="/login" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
