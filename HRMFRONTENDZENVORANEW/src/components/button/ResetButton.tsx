import type { ButtonHTMLAttributes } from "react";
import { RefreshCcw } from "lucide-react";

type ResetButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  compact?: boolean;
};

export default function ResetButton({
  label = "Reset",
  compact = false,
  disabled,
  className = "",
  style,
  children,
  type = "button",
  ...props
}: ResetButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={props["aria-label"] ?? label}
      title={props.title ?? label}
      className={`inline-flex items-center justify-center rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? "h-9 w-19" : "h-10 w-10"
      } ${compact ? "" : "gap-2"} ${className}`}
      style={{
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        ...style,
      }}
      {...props}
    >
      <RefreshCcw size={compact ? 14 : 15} />
      {!compact && <span>{label}</span>}
      {children}
    </button>
  );
}
