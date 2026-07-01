import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

type DropdownOption = string | { value: string; label: string };

type ConstrainedDropdownProps = {
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  buttonStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  disabled?: boolean;
  menuPlacement?: "auto" | "bottom";
};

export default function ConstrainedDropdown({
  label,
  value,
  options,
  onChange,
  className = "",
  buttonStyle,
  labelStyle,
  disabled = false,
  menuPlacement = "auto",
}: ConstrainedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  const selectedOption = normalizedOptions.find((option) => option.value === value);

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gap = 4;
    const maxMenuHeight = Math.min(180, window.innerHeight - 24);
    const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const openAbove = menuPlacement === "auto" && spaceBelow < 120 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(
      96,
      Math.min(maxMenuHeight, openAbove ? spaceAbove : spaceBelow),
    );

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      top: openAbove ? rect.top - availableHeight - gap : rect.bottom + gap,
      width: rect.width,
      maxHeight: availableHeight,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, value, options.length, menuPlacement]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && (
        <span className="mb-1 block text-xs font-semibold" style={labelStyle}>
          {label}
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen((open) => !open)}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm outline-none"
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          opacity: disabled ? 0.72 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          ...buttonStyle,
        }}
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown size={16} style={{ color: "var(--text-secondary)" }} />
      </button>

      {isOpen && !disabled && createPortal(
        <div
          ref={menuRef}
          className="overflow-y-auto rounded-lg border shadow-lg"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border)",
            ...menuStyle,
          }}
        >
          {normalizedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm"
              style={{
                background: option.value === value ? "var(--bg-hover)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
