import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTheme } from "../../context/ThemeContext";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

export default function Button({
  loading = false,
  loadingText,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { isDark } = useTheme();
  return (
    <button
      disabled={disabled || loading}
      style={{
        width: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "0.75rem 1rem",
        borderRadius: "0.75rem",
        fontWeight: 600,
        fontSize: "0.875rem",
        border: "none",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        background: "var(--accent)",
        color: "var(--accent-text)",
        transition: "background 0.2s, opacity 0.2s",
        ...style,
      }}
      {...props}
    >
      {loading && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
