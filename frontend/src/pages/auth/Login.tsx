import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "../../lib/axios";
import type { AxiosError } from "axios";
import { isAxiosError } from "axios";
import api from "../../lib/axios";
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import Button from "../../components/button/Button";
import { AuthLayout } from "../auth/AuthLayout";
import { clearAuthStorage, getDashboardPath, storeAuthUser } from "../../utils/auth";
import { getApiBaseUrl } from "../../config/apiConfig";



const Login = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite") === "1") {
      clearAuthStorage();
    }
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${getApiBaseUrl()}/api/oauth/google?origin=${encodeURIComponent(window.location.origin)}`;
  };


  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .matches(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, "Please enter a valid email address")
        .required("Email is required"),
      password: Yup.string().required("Password is required"),
    }),
    onSubmit: async (values, { setSubmitting }) => {
      setApiError(null);  
      try {
        const response = await api.post("/api/auth/login", {
          email: values.email,
          password: values.password,
        });
        const { accessToken, user } = response.data;

        // Standard/backwards-compatible keys
        localStorage.setItem("accessToken", accessToken);
        storeAuthUser({ ...user, name: user.fullName ?? user.name });
        // Store admin-specific keys if user is admin
        if (user.role === "admin") {
          localStorage.setItem("admin_accessToken", accessToken);
          localStorage.setItem("admin_userRole", user.role);
          if (user.fullName) localStorage.setItem("admin_userName", user.fullName);
        }

        // Store role-specific tokens so HR/manager/candidate dashboards find them
        const role = (user?.role || "").toLowerCase();
        if (role === "hr" || role === "admin") {
          localStorage.setItem("hr_accessToken", accessToken);
          localStorage.setItem("hr_userRole", role);
          if (user.fullName || user.name) localStorage.setItem("hr_userName", user.fullName || user.name || "");
          if (user.email) localStorage.setItem("hr_userEmail", user.email);
        } else if (role === "manager") {
          localStorage.setItem("manager_accessToken", accessToken);
          localStorage.setItem("manager_userRole", role);
          if (user.fullName || user.name) localStorage.setItem("manager_userName", user.fullName || user.name || "");
          if (user.email) localStorage.setItem("manager_userEmail", user.email);
        } else if (role === "candidate") {
          localStorage.setItem("candidate_accessToken", accessToken);
          localStorage.setItem("candidate_userRole", role);
          if (user.fullName || user.name) localStorage.setItem("candidate_userName", user.fullName || user.name || "");
          if (user.email) localStorage.setItem("candidate_userEmail", user.email);
        }

        navigate(getDashboardPath(user?.role), { replace: true });

      } catch (error) {
        if (isAxiosError(error)) {
          const data = error.response?.data;
          const message =
            (typeof data === "object" && data !== null && ("message" in data || "detail" in data)
              ? String((data as { message?: unknown; detail?: unknown }).message || (data as { detail?: unknown }).detail)
              : undefined) ||
            error.message ||
            "Login failed. Please try again.";
          setApiError(message);
        } else {
          setApiError(error instanceof Error ? error.message : "Login failed. Please try again.");
        }
      } finally {
        setSubmitting(false);
      }
    },
  });


  return (
    <AuthLayout>
      {/* Heading */}
      <div className="mb-8">
        <h2 className={`text-4xl font-bold mb-2 tracking-tight ${theme.heading}`}>
          Welcome Back!
        </h2>
        <p className={theme.subtext}>Login to continue to your account</p>
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
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
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

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`text-base font-semibold ${theme.label}`}>
              Password
            </label>
          </div>
          <div className="relative">
            <Lock
              size={18}
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`}
            />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={`w-full border rounded-xl px-12 py-3.5 outline-none transition-all text-base ${theme.input} ${
                formik.touched.password && formik.errors.password
                  ? "border-red-500 focus:ring-1 focus:ring-red-500"
                  : "focus:border-[var(--accent)]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer ${theme.eyeBtn}`}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {formik.touched.password && formik.errors.password && (
            <p className="text-red-400 text-xs mt-1">
              {formik.errors.password}
            </p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={formik.values.rememberMe}
              onChange={formik.handleChange}
              className="w-4 h-4 rounded"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className={`text-sm ${theme.checkLabel}`}>Remember me</span>
          </label>
          <Link
            to="/forgot-password"
            className={`text-sm font-medium ${theme.forgotLink}`}
          >
            Forgot Password?
          </Link>
        </div>

        {/* API error */}
        {apiError && (
          <div className="rounded-xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/30 text-red-400">
            {apiError}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          loading={formik.isSubmitting}
          loadingText="Signing In..."
        >
          Sign In
        </Button>
      </form>

      {/* Security Badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
        {["Secure Login", "Privacy Protected", "Data Encrypted"].map(
          (label) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 text-xs ${theme.badge}`}
            >
              <ShieldCheck size={14} className="text-green-500" />
              {label}
            </div>
          ),
        )}
      </div>

      {/* Footer */}
      <p className={`text-center mt-6 text-sm ${theme.footerText}`}>
        Don't have an account?{" "}
        <Link to="/register" className={`font-semibold ${theme.signupLink}`}>
          Sign up here
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;

