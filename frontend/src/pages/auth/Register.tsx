import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";
import api from "../../lib/axios";

import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";

import { useTheme } from "../../context/ThemeContext";
import Button from "../../components/button/Button";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import AuthLayout from "./AuthLayout";
import { getDashboardPath, storeAuthUser, type UserRole } from "../../utils/auth";
import { getApiBaseUrl } from "../../config/apiConfig";

function getPasswordStrength(password: string): {
  label: string;
  color: string;
  segments: [string, string, string];
} {
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);

  if (!password) {
    return {
      label: "",
      color: "",
      segments: ["bg-white/10", "bg-white/10", "bg-white/10"],
    };
  }

  if (password.length < 8) {
    return {
      label: "Weak",
      color: "text-red-400",
      segments: ["bg-red-500", "bg-white/10", "bg-white/10"],
    };
  }

  if (
    password.length >= 8 &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber &&
    hasSpecial
  ) {
    return {
      label: "Strong",
      color: "text-green-400",
      segments: ["bg-green-500", "bg-green-500", "bg-green-500"],
    };
  }

  return {
    label: "Medium",
    color: "text-yellow-400",
    segments: ["bg-yellow-400", "bg-yellow-400", "bg-white/10"],
  };
}

type ManagerOption = { id: string; name: string; email: string };

type InviteInfo = {
  email: string;
  role: string;
  department?: string;
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  hr: "HR",
  manager: "Manager",
  employee: "Employee",
};

function storeAuthFromResponse(accessToken: string, user: { role?: string; name?: string; fullName?: string; email?: string }) {
  const role = user?.role?.toLowerCase();
  switch (role) {
    case "hr":
      localStorage.setItem("hr_accessToken", accessToken);
      localStorage.setItem("hr_userRole", role);
      if (user.fullName || user.name) localStorage.setItem("hr_userName", user.fullName || user.name || "");
      if (user.email) localStorage.setItem("hr_userEmail", user.email);
      break;
    case "manager":
      localStorage.setItem("manager_accessToken", accessToken);
      localStorage.setItem("manager_userRole", role);
      if (user.fullName || user.name) localStorage.setItem("manager_userName", user.fullName || user.name || "");
      if (user.email) localStorage.setItem("manager_userEmail", user.email);
      break;
    case "employee":
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("userRole", role);
      if (user.fullName || user.name) localStorage.setItem("userName", user.fullName || user.name || "");
      if (user.email) localStorage.setItem("userEmail", user.email);
      break;
    case "candidate":
      localStorage.setItem("candidate_accessToken", accessToken);
      localStorage.setItem("candidate_userRole", role);
      if (user.fullName || user.name) localStorage.setItem("candidate_userName", user.fullName || user.name || "");
      if (user.email) localStorage.setItem("candidate_userEmail", user.email);
      break;
    default:
      break;
  }
  localStorage.setItem("accessToken", accessToken);
  storeAuthUser({ ...user, role: user.role as UserRole | undefined });
}

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = (searchParams.get("token") || "").trim();
  const { theme, isDark } = useTheme();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) return;

    let cancelled = false;

    fetch(`${getApiBaseUrl()}/api/auth/invite/${encodeURIComponent(inviteToken)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || data?.detail || "Invalid or expired invite link");
        }
        if (!cancelled) {
          setInviteInfo({
            email: data.email,
            role: data.role,
            department: data.department,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setInviteError(err instanceof Error ? err.message : "Invalid or expired invite link");
        }
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const inviteFormik = useFormik({
    enableReinitialize: true,
    initialValues: {
      username: "",
      fullName: "",
      password: "",
      confirmPassword: "",
      agreeTerms: false,
    },
    validationSchema: Yup.object({
      username: Yup.string()
        .trim()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username cannot exceed 30 characters")
        .matches(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dot, dash and underscore")
        .required("Username is required"),
      fullName: Yup.string()
        .trim()
        .min(3, "Full name must be at least 3 characters")
        .max(50, "Full name cannot exceed 50 characters")
        .matches(/^[A-Za-z\s]+$/, "Numbers and special characters are not allowed")
        .required("Full name is required"),
      password: Yup.string()
        .min(8, "Password must be at least 8 characters")
        .max(20, "Password cannot exceed 20 characters")
        .required("Password is required"),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref("password")], "Passwords do not match")
        .required("Please confirm your password"),
      agreeTerms: Yup.boolean().oneOf([true], "You must agree to the terms"),
    }),
    
    onSubmit: async (values, { setSubmitting }) => {
      setApiError(null);
      setApiSuccess(null);

      try {
        const response = await api.post("/api/auth/complete-registration", {
          token: inviteToken,
          username: values.username.trim(),
          fullName: values.fullName.trim(),
          password: values.password,
        });

        const { accessToken, user } = response.data;
        storeAuthFromResponse(accessToken, user);
        setApiSuccess("Registration completed! Redirecting...");
        navigate(getDashboardPath(user?.role), { replace: true });
      } catch (error) {
        if (axios.isAxiosError(error)) {
          setApiError(error.response?.data?.message || error.response?.data?.detail || "Registration failed. Please try again.");
        } else {
          setApiError("Registration failed. Please try again.");
        }
      } finally {
        setSubmitting(false);
      }
    },
  });

const formik = useFormik({
  initialValues: {
    fullName: "",
    email: "",
    phoneNumber: "",
    role: "",
    manager_id: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  },

  validationSchema: Yup.object({
    fullName: Yup.string()
      .trim()
      .min(3, "Full name must be at least 3 characters")
      .max(50, "Full name cannot exceed 50 characters")
      .matches(
        /^[A-Za-z\s]+$/,
        "Numbers and special characters are not allowed"
      )
      .required("Full name is required"),

    email: Yup.string()
      .trim()
      .max(50, "Email cannot exceed 50 characters")
      .matches(
        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
        "Please enter a valid email address"
      )
      .required("Email is required"),

    phoneNumber: Yup.string()
      .matches(/^[0-9]{10}$/, "Phone number must be exactly 10 digits")
      .required("Phone number is required"),

    role: Yup.string().required("Please select a role"),

    password: Yup.string()
      .min(8, "Password must be at least 8 characters")
      .max(20, "Password cannot exceed 20 characters")
      .required("Password is required"),

    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password")], "Passwords do not match")
      .required("Please confirm your password"),

    agreeTerms: Yup.boolean().oneOf(
      [true],
      "You must agree to the terms"
    ),
  }),

  onSubmit: async (values, { resetForm, setSubmitting }) => {
    setApiError(null);
    setApiSuccess(null);

    try {
      const payload: Record<string, string> = {
        fullName: values.fullName.trim(),
        email: values.email.toLowerCase().trim(),
        phoneNumber: values.phoneNumber,
        role: values.role,
        password: values.password,
      };
      if (values.role === "employee" && values.manager_id) {
        payload.manager_id = values.manager_id;
      }

      const response = await api.post(
        "/api/auth/register",
        payload
      );

      const { accessToken, user } = response.data;

      storeAuthFromResponse(accessToken, user);

      setApiSuccess(
        "Account created successfully! Redirecting..."
      );

      resetForm();

      navigate(getDashboardPath(user?.role), {
        replace: true,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setApiError(
          error.response?.data?.message ||
            "Registration failed. Please try again."
        );
      } else {
        setApiError(
          "Registration failed. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  },
});

const strength = getPasswordStrength(formik.values.password);
const selectedRole = formik.values.role;
const [managersFetched, setManagersFetched] = useState(false);

useEffect(() => {
  if (selectedRole !== "employee" || managersFetched) return;

  let cancelled = false;

  api.get<{ data: ManagerOption[] }>("/api/auth/managers")
    .then((res) => {
      if (!cancelled) setManagers(res.data.data || []);
    })
    .catch(() => {
      if (!cancelled) setManagers([]);
    })
    .finally(() => {
      if (!cancelled) setManagersFetched(true);
    });

  return () => {
    cancelled = true;
  };
}, [selectedRole, managersFetched]);

  if (inviteToken) {
    const inviteStrength = getPasswordStrength(inviteFormik.values.password);

    return (
      <AuthLayout>
        <div className="mb-8">
          <h2 className={`text-4xl font-bold mb-2 tracking-tight ${theme.heading}`}>
            Complete Registration
          </h2>
          <p className={theme.subtext}>
            Set up your username, name, and password to join Zenvora
          </p>
        </div>

        {inviteLoading && (
          <div className={`rounded-xl px-4 py-3 text-sm ${theme.subtext}`}>Loading invite...</div>
        )}

        {!inviteLoading && inviteError && (
          <div className="rounded-xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/30 text-red-400 mb-4">
            {inviteError}
            <p className={`mt-2 text-sm ${theme.footerText}`}>
              Use the most recent invite email from HR. Older links stop working after a new invite is sent.
            </p>
          </div>
        )}

        {!inviteLoading && inviteInfo && (
          <>
            <div className={`rounded-xl px-4 py-3 text-sm mb-6 border ${theme.input}`}>
              <p className={theme.label}>
                Invited as: <strong>{roleLabels[inviteInfo.role] || inviteInfo.role}</strong>
              </p>
              <p className={`mt-1 ${theme.subtext}`}>Email: {inviteInfo.email}</p>
              {inviteInfo.department && (
                <p className={`mt-1 ${theme.subtext}`}>Department: {inviteInfo.department}</p>
              )}
            </div>

            <form onSubmit={inviteFormik.handleSubmit} className="space-y-5">
              <div>
                <label className={`text-base font-semibold mb-2 block ${theme.label}`}>Username</label>
                <div className="relative">
                  <User size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`} />
                  <input
                    name="username"
                    type="text"
                    placeholder="your.username"
                    value={inviteFormik.values.username}
                    onChange={(e) => inviteFormik.setFieldValue("username", e.target.value.toLowerCase())}
                    onBlur={inviteFormik.handleBlur}
                    className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                      inviteFormik.touched.username && inviteFormik.errors.username
                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                        : "focus:border-[var(--accent)]"
                    }`}
                  />
                </div>
                {inviteFormik.touched.username && inviteFormik.errors.username && (
                  <p className="text-red-400 text-xs mt-1">{inviteFormik.errors.username}</p>
                )}
              </div>

              <div>
                <label className={`text-base font-semibold mb-2 block ${theme.label}`}>Full Name</label>
                <div className="relative">
                  <User size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`} />
                  <input
                    name="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={inviteFormik.values.fullName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                      inviteFormik.setFieldValue("fullName", value);
                    }}
                    onBlur={inviteFormik.handleBlur}
                    className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                      inviteFormik.touched.fullName && inviteFormik.errors.fullName
                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                        : "focus:border-[var(--accent)]"
                    }`}
                  />
                </div>
                {inviteFormik.touched.fullName && inviteFormik.errors.fullName && (
                  <p className="text-red-400 text-xs mt-1">{inviteFormik.errors.fullName}</p>
                )}
              </div>

              <div>
                <label className={`text-base font-semibold mb-2 block ${theme.label}`}>Email Address</label>
                <div className="relative">
                  <Mail size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`} />
                  <input
                    type="email"
                    value={inviteInfo.email}
                    readOnly
                    disabled
                    className={`w-full border rounded-xl px-12 py-3.5 outline-none text-base opacity-80 ${theme.input}`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-base font-semibold mb-2 block ${theme.label}`}>Password</label>
                <div className="relative">
                  <Lock size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`} />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create strong password"
                    value={inviteFormik.values.password}
                    onChange={inviteFormik.handleChange}
                    onBlur={inviteFormik.handleBlur}
                    className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                      inviteFormik.touched.password && inviteFormik.errors.password
                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                        : "focus:border-[var(--accent)]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme.eyeBtn}`}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {inviteFormik.touched.password && inviteFormik.errors.password && (
                  <p className="text-red-400 text-xs mt-1">{inviteFormik.errors.password}</p>
                )}
                {inviteFormik.values.password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${theme.label}`}>Password strength:</span>
                      <span className={`text-xs font-medium ${inviteStrength.color}`}>{inviteStrength.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {inviteStrength.segments.map((seg, i) => (
                        <div key={i} className={`h-1 rounded-full ${seg}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={`text-base font-semibold mb-2 block ${theme.label}`}>Confirm Password</label>
                <div className="relative">
                  <Lock size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`} />
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={inviteFormik.values.confirmPassword}
                    onChange={inviteFormik.handleChange}
                    onBlur={inviteFormik.handleBlur}
                    className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                      inviteFormik.touched.confirmPassword && inviteFormik.errors.confirmPassword
                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                        : "focus:border-[var(--accent)]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme.eyeBtn}`}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {inviteFormik.touched.confirmPassword && inviteFormik.errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">{inviteFormik.errors.confirmPassword}</p>
                )}
              </div>

              <div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    name="agreeTerms"
                    type="checkbox"
                    checked={inviteFormik.values.agreeTerms}
                    onChange={inviteFormik.handleChange}
                    onBlur={inviteFormik.handleBlur}
                    className="mt-0.5 w-4 h-4 rounded shrink-0"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span className={`text-sm ${theme.termsText}`}>I agree to the Terms of Service and Privacy Policy</span>
                </label>
                {inviteFormik.touched.agreeTerms && inviteFormik.errors.agreeTerms && (
                  <p className="text-red-400 text-xs mt-1">{inviteFormik.errors.agreeTerms}</p>
                )}
              </div>

              {apiError && (
                <div className="rounded-xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/30 text-red-400">
                  {apiError}
                </div>
              )}

              {apiSuccess && (
                <div className="rounded-xl px-4 py-3 text-sm bg-green-500/10 border border-green-500/30 text-green-400">
                  {apiSuccess}
                </div>
              )}

              <Button type="submit" loading={inviteFormik.isSubmitting} loadingText="Completing Registration...">
                Complete Registration
              </Button>
            </form>
          </>
        )}

        <p className={`text-center mt-6 text-sm ${theme.footerText}`}>
          Already have an account?{" "}
          <Link to="/login" className={`font-semibold ${theme.signupLink}`}>
            Sign in here
          </Link>
        </p>
      </AuthLayout>
    );
  }

  // Fetch managers when employee role is selected
  if (selectedRole === "employee" && !managersFetched) {
    setManagersFetched(true);
    api.get<{ data: ManagerOption[] }>("/api/auth/managers")
      .then((res) => setManagers(res.data.data || []))
      .catch(() => setManagers([]));
  }

  const handleGoogleLogin = () => {
    window.location.href = `${getApiBaseUrl()}/api/oauth/google?origin=${encodeURIComponent(window.location.origin)}`;
  };

  return (
    <AuthLayout>
      {/* Heading */}
      <div className="mb-8">
        <h2
          className={`text-4xl font-bold mb-2 tracking-tight ${theme.heading}`}
        >
          Create Account
        </h2>
        <p className={theme.subtext}>Join Zenvora and start your journey</p>
      </div>

      {/* Social Buttons */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="bg-white text-black border border-gray-300 rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-all duration-200 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>

  

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`flex-1 h-px ${theme.dividerLine}`} />
        <span className={`text-sm ${theme.dividerText}`}>OR</span>
        <div className={`flex-1 h-px ${theme.dividerLine}`} />
      </div>
      

      {/* Form */}
      <form onSubmit={formik.handleSubmit} className="space-y-5">
        {/* Full Name */}
        <div>
          <label
            className={`text-base font-semibold mb-2 block ${theme.label}`}
          >
            Full Name
          </label>
          <div className="relative">
            <User
              size={18}
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`}
            />
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="John Doe"
              value={formik.values.fullName}
              onChange={(e) => {
                const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
                formik.setFieldValue("fullName", value);
              }}
              onBlur={formik.handleBlur}
              maxLength={50}
              className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                formik.touched.fullName && formik.errors.fullName
                  ? "border-red-500 focus:ring-1 focus:ring-red-500"
                  : "focus:border-[var(--accent)]"
              }`}
            />
          </div>
          {formik.touched.fullName && formik.errors.fullName && (
            <p className="text-red-400 text-xs mt-1">
              {formik.errors.fullName}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            className={`text-base font-semibold mb-2 block ${theme.label}`}
          >
            Email Address
          </label>

          <div className="relative">
            <Mail
              size={18}
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`}
            />
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formik.values.email}
              onChange={(e) => {
                formik.setFieldValue("email", e.target.value.toLowerCase());
              }}
              onBlur={formik.handleBlur}
              maxLength={50}
              className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                formik.touched.email && formik.errors.email
                  ? "border-red-500 focus:ring-1 focus:ring-red-500"
                  : "focus:border-[var(--accent)]"
              }`}
            />
          </div>
          {formik.touched.email && formik.errors.email && (
            <p className="text-red-400 text-xs mt-1">{formik.errors.email}</p>
          )}
        </div>

        {/* Phone Number */}
        <div>
          <label
            className={`text-base font-semibold mb-2 block ${theme.label}`}
          >
            Phone Number
          </label>
          <div className="relative">
            <Phone
              size={18}
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`}
            />
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              placeholder="9876543210"
              value={formik.values.phoneNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                if (value.length <= 10) {
                  formik.setFieldValue("phoneNumber", value);
                }
              }}
              onBlur={formik.handleBlur}
              maxLength={10}
              className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                formik.touched.phoneNumber && formik.errors.phoneNumber
                  ? "border-red-500 focus:ring-1 focus:ring-red-500"
                  : "focus:border-[var(--accent)]"
              }`}
            />
          </div>
          {formik.touched.phoneNumber && formik.errors.phoneNumber && (
            <p className="text-red-400 text-xs mt-1">
              {formik.errors.phoneNumber}
            </p>
          )}
        </div>

        {/* Role */}
        <div>
          <label
            className={`text-base font-semibold mb-2 block ${theme.label}`}
          >
            Role
          </label>
          <ConstrainedDropdown
            value={formik.values.role}
            onChange={(value) => formik.setFieldValue("role", value)}
            options={[
              { value: "", label: "Select your role" },
              { value: "admin", label: "Admin" },
              { value: "hr", label: "HR" },
              { value: "manager", label: "Manager" },
              { value: "employee", label: "Employee" },
            ]}
            buttonStyle={{ colorScheme: isDark ? "dark" : "light" }}
          />
          {formik.touched.role && formik.errors.role && (
            <p className="text-red-400 text-xs mt-1">{formik.errors.role}</p>
          )}
        </div>

        {/* Manager selection (employees only) */}
        {formik.values.role === "employee" && (
          <div>
            <label className={`text-base font-semibold mb-2 block ${theme.label}`}>
              Assign Manager <span className={`text-sm font-normal ${theme.subtext}`}>(optional)</span>
            </label>
            <div className="relative">
              <select
                name="manager_id"
                value={formik.values.manager_id}
                onChange={formik.handleChange}
                className={`w-full appearance-none border rounded-xl px-4 py-3 outline-none transition-all cursor-pointer ${theme.select}`}
                style={{ colorScheme: isDark ? "dark" : "light" }}
              >
                <option value="">— No manager assigned —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                ))}
              </select>
              <ChevronDown size={18} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${theme.inputIcon}`} />
            </div>
          </div>
        )}

        {/* Password */}
        <div>
          <label
            className={`text-base font-semibold mb-2 block ${theme.label}`}
          >
            Password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`}
            />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create strong password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              maxLength={20}
              className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                formik.touched.password && formik.errors.password
                  ? "border-red-500 focus:ring-1 focus:ring-red-500"
                  : "focus:border-[var(--accent)]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme.eyeBtn}`}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {formik.touched.password && formik.errors.password && (
            <p className="text-red-400 text-xs mt-1">
              {formik.errors.password}
            </p>
          )}
          {formik.values.password && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs ${theme.label}`}>
                  Password strength:
                </span>
                <span className={`text-xs font-medium ${strength.color}`}>
                  {strength.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {strength.segments.map((seg, i) => (
                  <div key={i} className={`h-1 rounded-full ${seg}`} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            className={`text-base font-semibold mb-2 block ${theme.label}`}
          >
            Confirm Password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`}
            />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              value={formik.values.confirmPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              maxLength={20}
              className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                formik.touched.confirmPassword && formik.errors.confirmPassword
                  ? "border-red-500 focus:ring-1 focus:ring-red-500"
                  : "focus:border-[var(--accent)]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme.eyeBtn}`}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {formik.touched.confirmPassword && formik.errors.confirmPassword && (
            <p className="text-red-400 text-xs mt-1">
              {formik.errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Terms */}
        <div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              id="agreeTerms"
              name="agreeTerms"
              type="checkbox"
              checked={formik.values.agreeTerms}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="mt-0.5 w-4 h-4 rounded shrink-0"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className={`text-sm ${theme.termsText}`}>
              I agree to the{" "}
              <span className={`cursor-pointer underline ${theme.link}`}>
                Terms of Service
              </span>{" "}
              and{" "}
              <span className={`cursor-pointer underline ${theme.link}`}>
                Privacy Policy
              </span>
            </span>
          </label>
          {formik.touched.agreeTerms && formik.errors.agreeTerms && (
            <p className="text-red-400 text-xs mt-1">
              {formik.errors.agreeTerms}
            </p>
          )}
        </div>

        {/* API Error */}
        {apiError && (
          <div className="rounded-xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/30 text-red-400">
            {apiError}
          </div>
        )}

        {/* API Success */}
        {apiSuccess && (
          <div className="rounded-xl px-4 py-3 text-sm bg-green-500/10 border border-green-500/30 text-green-400">
            {apiSuccess}
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          loading={formik.isSubmitting}
          loadingText="Creating Account..."
        >
          Create Account
        </Button>
      </form>

      {/* Footer */}
      <p className={`text-center mt-6 text-sm ${theme.footerText}`}>
        Already have an account?{" "}
        <Link to="/login" className={`font-semibold ${theme.signupLink}`}>
          Sign in here
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
