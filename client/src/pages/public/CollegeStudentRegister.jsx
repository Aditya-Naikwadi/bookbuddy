import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  KeyRound,
} from "lucide-react";
import { registrationApi } from "../../api/registrationApi";

export default function CollegeStudentRegister() {
  const { collegeSlug } = useParams();

  const [collegeData, setCollegeData] = useState({
    _id: null,
    name: "Stanford University",
    slug: collegeSlug || "stanford-univ",
    domain: "stanford.edu",
    configuredDepartments: [
      "Computer Science",
      "Electrical Engineering",
      "Law",
      "Business",
    ],
  });

  const [studentForm, setStudentForm] = useState({
    firstName: "",
    lastName: "",
    rollNumber: "",
    phone: "",
    email: "",
    department: "",
    password: "",
    confirmPassword: "",
  });

  // Step state: 'form' | 'otp' | 'success'
  const [step, setStep] = useState("form");
  const [otpCode, setOtpCode] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [devOtpHint, setDevOtpHint] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    async function loadColleges() {
      try {
        const colleges = await registrationApi.getActiveColleges();
        if (colleges && colleges.length > 0) {
          const match =
            colleges.find(
              (c) =>
                c.shortName?.toLowerCase() === collegeSlug?.toLowerCase() ||
                c.code?.toLowerCase() === collegeSlug?.toLowerCase() ||
                c.name?.toLowerCase().includes(collegeSlug?.toLowerCase()),
            ) || colleges[0];
          setCollegeData((prev) => ({
            ...prev,
            _id: match._id,
            name: match.name,
            domain: match.domain || prev.domain,
            configuredDepartments:
              match.configuredDepartments?.length > 0
                ? match.configuredDepartments
                : prev.configuredDepartments,
          }));
        }
      } catch (err) {
        console.error("Failed to load active colleges:", err);
      }
    }
    loadColleges();
  }, [collegeSlug]);

  // Step 1: Submit Student Registration Details
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");

    if (studentForm.password !== studentForm.confirmPassword) {
      setGlobalError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fullName =
        `${studentForm.firstName} ${studentForm.lastName}`.trim();
      const res = await registrationApi.registerStudent({
        name: fullName,
        email: studentForm.email,
        password: studentForm.password,
        confirmPassword: studentForm.confirmPassword,
        collegeId: collegeData._id,
        studentId:
          studentForm.rollNumber || `STU-${Date.now().toString().slice(-4)}`,
        department: studentForm.department,
        phone: studentForm.phone,
        termsAccepted: true,
      });

      setRegisteredEmail(studentForm.email.toLowerCase().trim());
      if (res?.data?.devOtp) {
        setDevOtpHint(res.data.devOtp);
      }
      setIsSubmitting(false);
      setStep("otp");
    } catch (err) {
      setIsSubmitting(false);
      setGlobalError(
        err.response?.data?.message ||
          "Registration failed. Please check your information and try again.",
      );
    }
  };

  // Step 2: Submit OTP Verification Code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setGlobalError("");

    if (!otpCode || otpCode.trim().length !== 6) {
      setGlobalError("Please enter the 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registrationApi.verifyStudentEmail({
        email: registeredEmail,
        otp: otpCode.trim(),
      });
      setIsSubmitting(false);
      setStep("success");
    } catch (err) {
      setIsSubmitting(false);
      setGlobalError(
        err.response?.data?.message ||
          "Invalid verification code or email. Please check and try again.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Institutional Identity Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
          <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            {collegeData.name}
          </h1>
          <p className="text-xs font-mono text-indigo-400 mt-1 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official Student Library Self-Registration</span>
          </p>
        </div>

        {/* Global Error Alert */}
        {globalError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* STEP 1: Registration Form */}
        {step === "form" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="student-first-name"
                    className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1"
                  >
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="student-first-name"
                    name="firstName"
                    type="text"
                    value={studentForm.firstName}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        firstName: e.target.value,
                      })
                    }
                    placeholder="Alex"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="student-last-name"
                    className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1"
                  >
                    Last Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="student-last-name"
                    name="lastName"
                    type="text"
                    value={studentForm.lastName}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        lastName: e.target.value,
                      })
                    }
                    placeholder="Morgan"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Roll Number & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="student-roll-number"
                    className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1"
                  >
                    Roll / Student ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="student-roll-number"
                    name="rollNumber"
                    type="text"
                    value={studentForm.rollNumber}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        rollNumber: e.target.value,
                      })
                    }
                    placeholder="CS-2026-089"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-indigo-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="student-phone"
                    className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1"
                  >
                    Phone Number
                  </label>
                  <input
                    id="student-phone"
                    name="phone"
                    type="tel"
                    value={studentForm.phone}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, phone: e.target.value })
                    }
                    placeholder="+15550000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="student-email"
                  className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1"
                >
                  Institutional Email <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    id="student-email"
                    name="email"
                    type="email"
                    value={studentForm.email}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, email: e.target.value })
                    }
                    placeholder={`student@${collegeData.domain}`}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Department */}
              <div>
                <label
                  htmlFor="student-department"
                  className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1"
                >
                  Department / Course
                </label>
                <select
                  id="student-department"
                  name="department"
                  value={studentForm.department}
                  onChange={(e) =>
                    setStudentForm({
                      ...studentForm,
                      department: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- Select Department --</option>
                  {collegeData.configuredDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="student-password"
                    className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1"
                  >
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="student-password"
                    name="password"
                    type="password"
                    value={studentForm.password}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        password: e.target.value,
                      })
                    }
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="student-confirm-password"
                    className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1"
                  >
                    Confirm Pass <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="student-confirm-password"
                    name="confirmPassword"
                    type="password"
                    value={studentForm.confirmPassword}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4 cursor-pointer"
              >
                {isSubmitting
                  ? "Registering Account..."
                  : "Next: Verify Email OTP"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: OTP Verification Form */}
        {step === "otp" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Verify Your Email Address
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Enter the 6-digit verification code sent to{" "}
                <strong className="text-indigo-300 font-mono">
                  {registeredEmail}
                </strong>
              </p>
              {devOtpHint && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
                  ⚡ <strong>Development OTP Hint:</strong> {devOtpHint}
                </div>
              )}
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="otp-code"
                  className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1 text-center"
                >
                  6-Digit Verification Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] text-lg font-mono px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otpCode.length !== 6}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Verifying Code..." : "Verify & Create Account"}
                <CheckCircle2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setStep("form")}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                ← Back to Edit Details
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: Success Screen */}
        {step === "success" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Account Activated & Saved!
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Your email has been verified and your student account at{" "}
              <strong>{collegeData.name}</strong> is now stored in the database.
            </p>
            <Link
              to="/auth/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
            >
              <span>Sign In to Student Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
