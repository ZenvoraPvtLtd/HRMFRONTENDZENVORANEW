export interface WelcomeBannerProps {
  userName: string;
  subtitle?: string;
}

export default function WelcomeBanner({
  userName,
  subtitle = "Here's an overview of your recruitment metrics.",
}: WelcomeBannerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border mb-4 sm:mb-8 p-5 sm:p-10"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Decorative blurs */}
      <div
        className="absolute top-0 left-0 w-56 h-56 pointer-events-none"
        style={{ background: "var(--icon-accent-bg)", filter: "blur(100px)" }}
      />
      <div
        className="absolute bottom-0 right-0 w-56 h-56 pointer-events-none"
        style={{ background: "var(--icon-accent-bg)", filter: "blur(100px)" }}
      />

      <div className="relative z-10">
        <h1
          className="text-xl sm:text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Welcome back,{" "}
          <span style={{ color: "var(--accent)" }}>{userName}</span>
        </h1>
        <p
          className="mt-1 text-xs sm:text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
