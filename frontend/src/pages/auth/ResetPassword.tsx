import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";

import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

import { useTheme } from "../../context/ThemeContext";
import Button from "../../components/button/Button";
import AuthLayout from "./AuthLayout";
import API_BASE_URL from "../../config/apiConfig";

const ResetPassword = () => {
  const location = useLocation();

  const email = location.state?.email;

  const navigate = useNavigate();

  const { theme } = useTheme();

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [apiError, setApiError] =
    useState<string | null>(null);

  const [apiSuccess, setApiSuccess] =
    useState<string | null>(null);

  const formik = useFormik({
    initialValues: {
      password: "",
      confirmPassword: "",
    },

    validationSchema: Yup.object({
      password: Yup.string()
        .min(
          8,
          "Password must contain uppercase, lowercase and special character"
        )
        .required("Password is required"),

      confirmPassword: Yup.string()
        .oneOf(
          [Yup.ref("password")],
          "Passwords must match"
        )
        .required(
          "Please confirm your password"
        ),
    }),

    onSubmit: async (
      values,
      { setSubmitting }
    ) => {
      setApiError(null);
      setApiSuccess(null);

      try {
        const response = await axios.put(
          `${API_BASE_URL}/api/auth/reset-password`,
          {
            email,
            password: values.password,
          }
        );

        setApiSuccess(
          response.data.message ||
            "Password reset successfully!"
        );

        // REDIRECT TO LOGIN
        setTimeout(() => {
          navigate("/login");
        }, 2000);

      } catch (error) {
        const message = axios.isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message
          : null;
        setApiError(message || "Failed to reset password");
      } finally {
        setSubmitting(false);
      }
    },
  });

  // EMAIL NOT FOUND
  if (!email) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h2
            className={`text-3xl font-bold mb-3 ${theme.heading}`}
          >
            Invalid Access
          </h2>

          <p className={theme.subtext}>
            Please verify OTP first.
          </p>

          <div className="mt-6">
            <Button
              onClick={() =>
                navigate("/forgot-password")
              }
            >
              Go Back
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {/* BACK BUTTON */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/login")}
          className={`inline-flex items-center gap-2 text-sm font-medium ${theme.link} hover:underline`}
        >
          <ArrowLeft size={16} />

          Back to Login
        </button>
      </div>

      {/* HEADING */}
      <div className="mb-8">
        <h2
          className={`text-4xl font-bold mb-2 ${theme.heading}`}
        >
          Reset Your Password 
        </h2>

        <p className={theme.subtext}>
          Enter your new password below.
        </p>
      </div>

      {/* SUCCESS */}
      {apiSuccess && (
        <div
          className="
            mb-6
            rounded-xl
            px-4
            py-3
            text-sm
            bg-green-500/10
            border
            border-green-500/30
            text-green-400
            flex
            items-center
            gap-2
          "
        >
          <CheckCircle size={16} />

          {apiSuccess}

          <span className="ml-auto text-xs">
            Redirecting...
          </span>
        </div>
      )}

      {/* FORM */}
      <form
        onSubmit={formik.handleSubmit}
        className="space-y-5"
      >
        {/* PASSWORD */}
        <div>
          <label
            className={`text-sm mb-2 block ${theme.label}`}
          >
            New Password
          </label>

          <div className="relative">
            <Lock
              size={18}
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.inputIcon}`}
            />

            <input
              id="password"
              name="password"
              autoComplete="new-password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter new password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={`w-full border rounded-xl px-12 py-3 outline-none transition-all ${theme.input}`}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme.eyeBtn}`}
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {formik.touched.password &&
            formik.errors.password && (
              <p className="text-red-400 text-xs mt-1">
                {formik.errors.password}
              </p>
            )}
        </div>

        {/* CONFIRM PASSWORD */}
        <div>
          <label
            className={`text-sm mb-2 block ${theme.label}`}
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
              autoComplete="new-password"
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              placeholder="Confirm password"
              value={
                formik.values.confirmPassword
              }
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={`w-full border rounded-xl px-12 py-3 outline-none transition-all ${theme.input}`}
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme.eyeBtn}`}
            >
              {showConfirmPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {formik.touched
            .confirmPassword &&
            formik.errors
              .confirmPassword && (
              <p className="text-red-400 text-xs mt-1">
                {
                  formik.errors
                    .confirmPassword
                }
              </p>
            )}
        </div>

        {/* API ERROR */}
        {apiError && (
          <div
            className="
              rounded-xl
              px-4
              py-3
              text-sm
              bg-red-500/10
              border
              border-red-500/30
              text-red-400
            "
          >
            {apiError}
          </div>
        )}

        {/* BUTTON */}
        <Button
          type="submit"
          loading={formik.isSubmitting}
          loadingText="Resetting..."
        >
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
