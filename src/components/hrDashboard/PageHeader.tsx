import type { ReactNode } from "react";
import { Sun, Moon, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  userName?: string;
  avatarLetter?: string;
  isDark?: boolean;
  onToggleTheme?: () => void;
  searchPlaceholder?: string;
  showBack?: boolean;
  minimal?: boolean;
}

export default function PageHeader({
  icon,
  title,
  isDark,
  onToggleTheme,
  showBack = false,
  minimal = false,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div
      className="flex items-center justify-between gap-2 mb-4 sm:mb-8 rounded-2xl p-3 sm:p-4"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Left: Back button + Icon + Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            title="Go back"
            className="hidden sm:flex w-8 h-8 rounded-xl items-center justify-center shrink-0 transition-colors"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--icon-accent-bg)", border: "1px solid var(--border)" }}
        >
          {icon}
        </div>
        <h1
          className="text-base sm:text-2xl font-bold tracking-tight truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
      </div>

      {/* Right: theme toggle only */}
      {!minimal && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleTheme}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}
