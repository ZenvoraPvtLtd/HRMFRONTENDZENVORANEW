import type { ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";

interface HoverableCardProps {
  title: string;
  icon?: ReactNode;
  description?: string;
}

const HoverableCard = ({ title, icon, description }: HoverableCardProps) => {
  const { theme } = useTheme();

  return (
    <div
      className={`${theme.featureCard} border rounded-2xl p-4 hover:-translate-y-0.5 transition-all duration-300`}
    >
      {icon && <div className="auth-accent-icon mb-2">{icon}</div>}
      <h3 className={`font-semibold text-sm ${theme.featureTitle}`}>{title}</h3>
      {description && (
        <p className={`text-xs ${theme.featureDesc}`}>{description}</p>
      )}
    </div>
  );
};

export default HoverableCard;
