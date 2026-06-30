import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

type RefreshButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  loading?: boolean;
  compact?: boolean;
};

export default function RefreshButton({
  label = "Refresh",
  loading = false,
  compact = false,
  disabled,
  className = "",
  style,
  children,
  type = "button",
  onClick,
  ...props
}: RefreshButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading || internalLoading;

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;

    try {
      const result = onClick?.(event);
      setInternalLoading(true);
      await Promise.resolve(result);
    } finally {
      window.setTimeout(() => setInternalLoading(false), 350);
    }
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={handleClick}
      aria-label={props["aria-label"] ?? label}
      title={props.title ?? label}
      className={`inline-flex items-center justify-center rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? "h-9 w-9" : "h-10 w-10"
      } ${className}`}
      style={{
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        ...style,
      }}
      {...props}
    >
      <RefreshCw size={compact ? 14 : 15} className={isLoading ? "animate-spin" : undefined} />
      {children}
    </button>
  );
}
