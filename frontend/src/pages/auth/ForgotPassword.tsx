import { useRef, useState } from "react";
import axios from "axios";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import Button from "../../components/button/Button";
import { useTheme } from "../../context/ThemeContext";
import API_BASE_URL from "../../config/apiConfig";


const ForgotPassword = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message || fallback;
    }

    return fallback;
  };

  // STEP CONTROL
  const [step, setStep] = useState<"email" | "otp">(
    "email"
  );

  const [email, setEmail] = useState("");

  const [otp, setOtp] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const [loading, setLoading] = useState(false);

  const [apiError, setApiError] = useState<string | null>(
    null
  );

  const [apiSuccess, setApiSuccess] = useState<
    string | null
  >(null);

  const inputRefs = useRef<
    (HTMLInputElement | null)[]
  >([]);

  // SEND OTP
  const handleSendOtp = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setApiError(null);
    setApiSuccess(null);

    if (!email) {
      setApiError("Please enter your email");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/forgot-password`,
        { email }
      );

      setApiSuccess(
        response.data.message ||
          "OTP sent successfully!"
      );

      // SHOW OTP SECTION
      setStep("otp");

      // SAVE EMAIL
      localStorage.setItem("resetEmail", email);
    } catch (error) {
      setApiError(getErrorMessage(error, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  // OTP INPUT CHANGE
  const handleChange = (
    value: string,
    index: number
  ) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];

    newOtp[index] = value.slice(-1);

    setOtp(newOtp); 

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // BACKSPACE
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (
      e.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // PASTE OTP
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault();

    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    const otpArray = pastedData.split("");

    const newOtp = [...otp];

    otpArray.forEach((digit, index) => {
      newOtp[index] = digit;
    });

    setOtp(newOtp);
  };

  // VERIFY OTP
  const handleVerifyOtp = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setApiError(null);
    setApiSuccess(null);

    const otpValue = otp.join("");

    if (otpValue.length !== 6) {
      setApiError("Please enter complete OTP");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-otp`,
        {
          email,
          otp: otpValue,
        }
      );

      setApiSuccess(
        response.data.message ||
          "OTP verified successfully!"
      );


      // localStorage.removeItem("resetEmail");

      navigate("/reset-password", {
        state: { email },
      });
    } catch (error) {
      setApiError(getErrorMessage(error, "Invalid OTP"));
    } finally {
      setLoading(false);
    }
  };

  // RESEND OTP
  const handleResendOtp = async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/forgot-password`,
        { email }
      );

      setApiSuccess(
        response.data.message ||
          "OTP resent successfully!"
      );
    } catch (error) {
      setApiError(getErrorMessage(error, "Failed to resend OTP"));
    }
  };

return (
  <div
    className="
      min-h-screen
      flex items-center justify-center
      px-4 sm:px-6
      py-10
      bg-transparent
    "
  >
    <div
      className="
        w-full
        max-w-md sm:max-w-lg
        md:max-w-2xl
        rounded-3xl
        p-5 sm:p-8 md:p-10
        shadow-xl
      "
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
    >
      {/* BACK */}
      <div className="mb-6">
        <Link
          to="/login"
          className={`inline-flex items-center gap-2 text-sm font-medium ${theme.link}`}
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </div>

      {/* HEADING */}
      <div className="mb-8">
        <div className="flex items-start sm:items-center gap-3 mb-3">
          <div
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "var(--icon-accent-bg)",
              color: "var(--text-primary)",
            }}
          >
            <ShieldCheck size={24} className="sm:w-7 sm:h-7" />
          </div>

          <div>
            <h2
              className={`
                text-2xl sm:text-3xl md:text-4xl
                font-bold
                leading-tight
                ${theme.heading}
              `}
            >
              {step === "email"
                ? "Find Your Account"
                : "Verify OTP "}
            </h2>
          </div>
        </div>

        <p
          className={`
            text-sm sm:text-base
            leading-6 sm:leading-7
            ${theme.subtext}
          `}
        >
          {step === "email"
            ? "Enter your email address to receive a verification code."
            : `We've sent a 6-digit verification code to ${email}`}
        </p>
      </div>

      {/* SUCCESS */}
      {apiSuccess && (
        <div className="mb-6 rounded-2xl px-4 py-3 text-sm bg-green-500/10 border border-green-500/20 text-green-400 flex items-start gap-2">
          <CheckCircle size={18} className="mt-0.5 shrink-0" />
          <span>{apiSuccess}</span>
        </div>
      )}

      {/* ERROR */}
      {apiError && (
        <div className="mb-6 rounded-2xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/20 text-red-400">
          {apiError}
        </div>
      )}

      {/* EMAIL STEP */}
      {step === "email" && (
        <form onSubmit={handleSendOtp} className="space-y-5 sm:space-y-6">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`
              w-full
              h-12 sm:h-14
              px-4 sm:px-5
              text-sm sm:text-base
              rounded-2xl
              border
              outline-none
              ${theme.input}
            `}
          />

          <Button
            type="submit"
            loading={loading}
            loadingText="Sending..."
          >
            Continue
          </Button>
        </form>
      )}

      {/* OTP STEP */}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <div
            className="
              flex items-center justify-between
              gap-2 sm:gap-3
            "
          >
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) =>
                  handleChange(e.target.value, index)
                }
                onKeyDown={(e) =>
                  handleKeyDown(e, index)
                }
                onPaste={handlePaste}
                className={`
                  w-10 h-12
                  sm:w-12 sm:h-14
                  md:w-14 md:h-16
                  text-center
                  text-lg sm:text-xl md:text-2xl
                  font-bold
                  rounded-xl sm:rounded-2xl
                  border
                  outline-none
                  ${theme.input}
                `}
              />
            ))}
          </div>

          <Button
            type="submit"
            loading={loading}
            loadingText="Verifying..."
          >
            Verify OTP
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResendOtp}
              className={`font-semibold hover:underline text-sm sm:text-base ${theme.link}`}
            >
              Resend OTP
            </button>
          </div>
        </form>
      )}
    </div>
  </div>
);
};

export default ForgotPassword;
