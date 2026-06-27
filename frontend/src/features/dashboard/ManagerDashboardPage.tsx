import { Users, ClipboardList, Clock3, BarChart3, CheckSquare, Calendar } from "lucide-react";

const cards = [
  { label: "Team Members", value: "12", icon: <Users size={22} />, color: "#3b82f6" },
  { label: "Pending Tasks", value: "8", icon: <ClipboardList size={22} />, color: "#f59e0b" },
  { label: "Leave Requests", value: "3", icon: <Clock3 size={22} />, color: "#ef4444" },
  { label: "Completed Tasks", value: "24", icon: <CheckSquare size={22} />, color: "#10b981" },
  { label: "Team Performance", value: "87%", icon: <BarChart3 size={22} />, color: "#8b5cf6" },
  { label: "Upcoming Reviews", value: "5", icon: <Calendar size={22} />, color: "#ec4899" },
];

export default function ManagerDashboardPage() {
  const name = localStorage.getItem("hr_userName") || localStorage.getItem("userName") || "Manager";

  return (
    <div style={{ padding: "2rem", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
          Welcome back, {name} 👋
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "0.4rem", fontSize: "0.95rem" }}>
          Here's what's happening with your team today.
        </p>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "0.5rem", background: card.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: card.color }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "1rem" }}>Quick Actions</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {["Approve Leaves", "Assign Tasks", "View Team", "Schedule Review", "Generate Report"].map((action) => (
            <button
              key={action}
              style={{
                padding: "0.5rem 1rem", borderRadius: "0.5rem",
                border: "1px solid var(--border)", background: "var(--bg-primary)",
                color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-primary)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
