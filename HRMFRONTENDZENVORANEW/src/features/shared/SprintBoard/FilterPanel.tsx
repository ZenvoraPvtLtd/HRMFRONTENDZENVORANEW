import { UserPlus, Flag, CalendarDays, LayoutList } from "lucide-react";
import ConstrainedDropdown from "../../../components/ConstrainedDropdown";
import { useTheme } from "../../../context/ThemeContext";

const chipStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.3rem",
  fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem",
  borderRadius: "9999px", background: "var(--accent)" + "18",
  color: "var(--accent)", border: "1px solid var(--accent)" + "30",
};

const chipX: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--accent)", fontSize: "0.85rem", lineHeight: 1, padding: 0,
};

interface Props {
  allAssignees: string[];
  filterAssignee: string;
  filterPriority: string;
  filterType: string;
  filterDateFrom: string;
  filterDateTo: string;
  onAssignee: (v: string) => void;
  onPriority: (v: string) => void;
  onType: (v: string) => void;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onClear: () => void;
}

export default function FilterPanel({
  allAssignees, filterAssignee, filterPriority, filterType, filterDateFrom, filterDateTo,
  onAssignee, onPriority, onType, onDateFrom, onDateTo, onClear,
}: Props) {
  const { isDark } = useTheme();
  const hasActive = filterAssignee !== "all" || filterPriority !== "all" || filterType !== "all" || filterDateFrom !== "" || filterDateTo !== "";

  const inputStyle: React.CSSProperties = {
    padding: "0.4rem 0.6rem", borderRadius: "0.5rem", border: "1px solid var(--border)",
    background: isDark ? "#000000" : "#ffffff",
    color: "var(--text-primary)", fontSize: "0.8rem", outline: "none", cursor: "pointer",
    colorScheme: isDark ? "dark" : "light",
  };

  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>Filters</span>
        <button onClick={onClear} style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        {/* Assignee */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", minWidth: 140 }}>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <UserPlus size={11} /> Assignee
          </label>
          <ConstrainedDropdown
            value={filterAssignee}
            onChange={onAssignee}
            options={[{ value: "all", label: "All assignees" }, ...allAssignees]}
            buttonStyle={inputStyle}
          />
        </div>

        {/* Priority */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", minWidth: 130 }}>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.3rem" }}><Flag size={11} /> Priority</label>
          <ConstrainedDropdown
            value={filterPriority}
            onChange={onPriority}
            options={[{ value: "all", label: "All priorities" }, "Low", "Medium", "High", "Critical"]}
            buttonStyle={inputStyle}
          />
        </div>

        {/* Type */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", minWidth: 120 }}>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.3rem" }}><LayoutList size={11} /> Type</label>
          <ConstrainedDropdown
            value={filterType}
            onChange={onType}
            options={[{ value: "all", label: "All tasks" }, "Task", "Bug", "Feature"]}
            buttonStyle={inputStyle}
          />
        </div>

        {/* Date range */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.3rem" }}><CalendarDays size={11} /> Date range</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input type="date" value={filterDateFrom} onChange={(e) => onDateFrom(e.target.value)} style={{ ...inputStyle, cursor: "default" }} />
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>–</span>
            <input type="date" value={filterDateTo} onChange={(e) => onDateTo(e.target.value)} style={{ ...inputStyle, cursor: "default" }} />
          </div>
        </div>
      </div>

      {/* Active chips */}
      {hasActive && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
          {filterAssignee !== "all" && <span style={chipStyle}>Assignee: {filterAssignee} <button onClick={() => onAssignee("all")} style={chipX}>×</button></span>}
          {filterPriority !== "all" && <span style={chipStyle}>Priority: {filterPriority} <button onClick={() => onPriority("all")} style={chipX}>×</button></span>}
          {filterType !== "all" && <span style={chipStyle}>Type: {filterType} <button onClick={() => onType("all")} style={chipX}>×</button></span>}
          {(filterDateFrom || filterDateTo) && <span style={chipStyle}>Due: {filterDateFrom || "…"} – {filterDateTo || "…"} <button onClick={() => { onDateFrom(""); onDateTo(""); }} style={chipX}>×</button></span>}
        </div>
      )}
    </div>
  );
}
