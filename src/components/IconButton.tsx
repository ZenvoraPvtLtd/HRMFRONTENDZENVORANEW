import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

const IconButton = ({ children, className = "", ...props }: IconButtonProps) => {
  const { theme } = useTheme();

  return (
    <button
      {...props}
      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-300 cursor-pointer ${theme.toggleBtn} ${className}`}
    >
      {children}
    </button>
  );
};

export default IconButton;
