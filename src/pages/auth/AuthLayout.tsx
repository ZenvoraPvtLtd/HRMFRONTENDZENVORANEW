import { ShieldCheck, Cloud, Sun, Moon } from "lucide-react";

const ZIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 4 20 4 8 20 20 20" />
  </svg>
);
import { useTheme } from "../../context/ThemeContext";
import IconButton from "../../components/IconButton";
import HoverableCard from "../../components/HoverableCard";
import { featureCards } from "./constants";

interface Props {
  children: React.ReactNode;
}

export const AuthLayout = ({ children }: Props) => {
  const { theme, isDark, toggle } = useTheme();

  return (
    <div
      className={`min-h-screen ${theme.page} relative overflow-hidden flex items-center justify-center p-4 transition-colors duration-300`}
    >
      {/* Background blurs */}
      <div className={`absolute top-0 left-0 w-72 h-72 ${theme.blur1} blur-[120px] transition-colors duration-300`} />
      <div className={`absolute bottom-0 right-0 w-72 h-72 ${theme.blur2} blur-[120px] transition-colors duration-300`} />

      <div className="w-full max-w-xl relative z-10">
        {/* Card */}
        <div className={`backdrop-blur-xl ${theme.card} border rounded-3xl shadow-2xl p-8 transition-colors duration-300`}>
          {/* Logo + Theme Toggle */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <img
                  src="/zenvora-logo.jpeg"
                  alt="Zenvora"
                  className="w-8 h-8 rounded-lg"
                  style={{ objectFit: "cover" }}
                />
                <span className={`font-bold text-lg tracking-wide ${theme.logo}`}>ZENVORA</span>
              </div>
              <p className={`text-xs ${theme.tagline}`}>Innovate. Integrate. Elevate.</p>
            </div>

            <IconButton onClick={toggle} title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
          </div>

          <>{children}</>

          {/* Shield Illustration */}
          <div className="flex justify-center mt-8">
            <svg viewBox="0 0 120 120" className="w-32 h-32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="60" cy="60" rx="55" ry="20" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" opacity="0.2" />
              <ellipse cx="60" cy="60" rx="55" ry="20" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" opacity="0.2" transform="rotate(60 60 60)" />
              <ellipse cx="60" cy="60" rx="55" ry="20" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" opacity="0.2" transform="rotate(120 60 60)" />
              <path d="M60 18 L88 30 L88 58 C88 76 74 90 60 96 C46 90 32 76 32 58 L32 30 Z" fill="currentColor" opacity="0.85" />
              <rect x="50" y="56" width="20" height="15" rx="2" fill="var(--bg-secondary)" opacity="0.95" />
              <path d="M54 56 L54 51 C54 47.5 66 47.5 66 51 L66 56" stroke="var(--bg-secondary)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <circle cx="60" cy="63" r="2" fill="var(--bg-secondary)" opacity="0.7" />
              <circle cx="15" cy="60" r="3" fill="currentColor" opacity="0.3" />
              <circle cx="105" cy="45" r="2.5" fill="currentColor" opacity="0.3" />
              <circle cx="80" cy="102" r="2.5" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
        </div>

        {/* Bottom Feature Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {featureCards.map(({ icon, title, desc }) => (
            <HoverableCard key={title} icon={icon} title={title} description={desc} />
          ))}
        </div>

        {/* Bottom Bar */}
        <div className={`flex flex-wrap items-center justify-center gap-6 mt-6 text-xs ${theme.bottomBar}`}>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="auth-accent-icon" /> 256-bit SSL Encryption
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="auth-accent-icon" /> GDPR Compliant
          </span>
          <span className="flex items-center gap-1.5">
            <Cloud size={12} className="auth-accent-icon" /> Regular Backups
          </span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="auth-accent-icon">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Trusted by 10,000+ Users
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
