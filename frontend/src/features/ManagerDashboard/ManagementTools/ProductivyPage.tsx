import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Activity, BarChart3, BrainCircuit, CalendarDays, ChevronDown, Clock3, ListChecks, RefreshCw, Timer } from "lucide-react";
import ConstrainedDropdown from "../../../components/ConstrainedDropdown";
import { fetchManagerProductivity, fetchProductivityPredictions } from "../../../services/productivityApi";
import type { ManagerProductivityResponse, ProductivityEntry, ProductivityPrediction } from "../../../services/productivityApi";

type ProductivityTab = "Today" | "This Week" | "This Month" | "Day" | "Range";

const tabs: ProductivityTab[] = ["Today", "This Week", "This Month", "Day", "Range"];

function toIsoDate(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().split("T")[0];
}

function getDateRange(tab: ProductivityTab) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (tab === "This Week") {
    const day = today.getDay() || 7;
    start.setDate(today.getDate() - day + 1);
    end.setDate(start.getDate() + 6);
  }

  if (tab === "This Month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

function statusColor(status: string) {
  if (status === "Excellent") return "#10b981";
  if (status === "Good") return "#3b82f6";
  if (status === "Average") return "#f59e0b";
  return "#ef4444";
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function ProductivityPage() {
  const initialRange = useMemo(() => getDateRange("This Week"), []);
  const [activeTab, setActiveTab] = useState<ProductivityTab>("This Week");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [selectedTeamName, setSelectedTeamName] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [data, setData] = useState<ManagerProductivityResponse | null>(null);
  const [predictions, setPredictions] = useState<Record<string, ProductivityPrediction>>({});
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const dataRef = useRef<ManagerProductivityResponse | null>(null);

  const loadProductivity = useCallback(async (clearPredictions = false) => {
    await Promise.resolve();

    if (clearPredictions) {
      setPredictions({});
      setShowPredictions(false);
      setPredictionError(null);
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const hasData = dataRef.current !== null;

    if (hasData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetchManagerProductivity({
        startDate,
        endDate,
        employeeId: selectedEmployeeId || undefined,
        teamName: selectedTeamName || undefined,
      });
      if (requestId !== requestIdRef.current) return;
      dataRef.current = result;
      setData(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : "Unable to fetch manager productivity";
      setError(msg);
      if (!hasData) {
        dataRef.current = null;
        setData(null);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [endDate, selectedEmployeeId, selectedTeamName, startDate]);

  async function loadPredictions() {
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      const result = await fetchProductivityPredictions({
        startDate,
        endDate,
        employeeId: selectedEmployeeId || undefined,
        teamName: selectedTeamName || undefined,
      });
      setPredictions(Object.fromEntries(result.predictions.map((prediction) => [prediction.employee_id, prediction])));
      setShowPredictions(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to fetch productivity predictions";
      setPredictionError(msg);
    } finally {
      setPredictionLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadProductivity(true));
  }, [loadProductivity]);

  function handleTabChange(tab: ProductivityTab) {
    setActiveTab(tab);
    if (tab !== "Range") {
      const range = getDateRange(tab);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    setActiveTab(value === endDate ? "Day" : "Range");
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    setActiveTab(startDate === value ? "Day" : "Range");
  }

  const summary = data?.summary;
  const entries = data?.entries ?? [];
  const members = data?.members ?? [];

  return (
    <div className="min-h-screen overflow-x-hidden font-[Inter]" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <main className="w-full">
        <section className="px-4 py-5 sm:px-6 sm:py-6 lg:px-10">
          <div className="rounded-2xl p-4 sm:p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => handleTabChange(tab)}
                      className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition"
                      style={
                        activeTab === tab
                          ? { background: "var(--accent)", color: "var(--accent-text)" }
                          : { border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)" }
                      }
                    >
                      {tab}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={loadPredictions}
                    disabled={predictionLoading || loading || entries.length === 0}
                    className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={
                      showPredictions
                        ? { background: "var(--accent)", color: "var(--accent-text)" }
                        : { border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)" }
                    }
                  >
                    <BrainCircuit size={15} className={predictionLoading ? "animate-pulse inline mr-2" : "inline mr-2"} />
                    {predictionLoading ? "Predicting" : "Predict"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void loadProductivity()}
                  disabled={loading || refreshing}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  <RefreshCw size={15} className={loading || refreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <DateInput label="Start Date" value={startDate} onChange={handleStartDateChange} />
                <DateInput label="End Date" value={endDate} onChange={handleEndDateChange} />
                <TeamSelect value={selectedTeamName} onChange={setSelectedTeamName} teams={data?.teams ?? []} />
                <SelectBox value={selectedEmployeeId} onChange={setSelectedEmployeeId} members={members} />
              </div>

              {predictionError && (
                <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                  {cleanError(predictionError)}
                </p>
              )}
            </div>
          </div>

          {summary && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={<BarChart3 size={17} />} label="Avg Productivity" value={`${summary.avg_productivity}%`} />
              <Metric icon={<ListChecks size={17} />} label="Completion Rate" value={`${summary.completion_rate}%`} />
              <Metric icon={<Activity size={17} />} label="Entries" value={String(summary.total_entries)} />
              <Metric icon={<Timer size={17} />} label="Idle Time" value={formatMinutes(summary.total_idle_minutes)} />
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
            {loading && !data ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-12 rounded-lg" style={{ background: "var(--bg-hover)" }} />
                ))}
              </div>
            ) : error ? (
              <EmptyState title="Unable To Load Productivity" message={cleanError(error)} />
            ) : entries.length === 0 ? (
              <EmptyState title="No Productivity Entries" message="No productivity entries were found for the selected filters." />
            ) : (
              <ProductivityTable entries={entries} predictions={predictions} showPredictions={showPredictions} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function cleanError(error: string) {
  try {
    const parsed = JSON.parse(error);
    return parsed.detail || parsed.message || error;
  } catch {
    return error;
  }
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <span className="rounded-lg p-2" style={{ background: "var(--bg-hover)", color: "var(--accent)" }}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function ProductivityTable({
  entries,
  predictions,
  showPredictions,
}: {
  entries: ProductivityEntry[];
  predictions: Record<string, ProductivityPrediction>;
  showPredictions: boolean;
}) {
  const headings = ["Employee", "Team", "Date", "Tasks", "Idle", "Overtime", "Score", "Status"];
  const predictionHeadings = ["Employee", "Burnout Risk", "Resignation Probability", "Performance Drop"];

  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${showPredictions ? "min-w-[920px]" : "min-w-[920px]"}`}>
        <thead>
          <tr className="table-header-row" style={{ borderBottom: "1px solid var(--border)" }}>
            {(showPredictions ? predictionHeadings : headings).map((heading) => (
              <th key={heading} className="px-4 py-3 text-left text-xs font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const prediction = predictions[entry.employee_id];

            if (showPredictions) {
              return (
                <tr key={`${entry.employee_id}-${entry.activity_date}-${index}`} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {entry.employee_name}
                  </td>
                  <PredictionCell value={prediction?.burnout_risk} level={prediction?.burnout_level} />
                  <PredictionCell value={prediction?.resignation_probability} level={prediction?.resignation_level} />
                  <PredictionCell value={prediction?.performance_drop} level={prediction?.performance_drop_level} />
                </tr>
              );
            }

            return (
              <tr key={`${entry.employee_id}-${entry.activity_date}-${index}`} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {entry.employee_name}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {entry.team_name}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {entry.activity_date}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>
                  {entry.tasks_completed}/{entry.tasks_assigned}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {formatMinutes(entry.idle_minutes)}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {formatMinutes(entry.overtime_minutes)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold" style={{ color: statusColor(entry.status) }}>
                  {entry.productivity_score}%
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="rounded-md px-2.5 py-1 text-xs font-semibold" style={{ background: `${statusColor(entry.status)}22`, color: statusColor(entry.status) }}>
                    {entry.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function predictionColor(level?: string) {
  if (level === "High") return "#ef4444";
  if (level === "Medium") return "#f59e0b";
  return "#10b981";
}

function PredictionCell({ value, level }: { value?: number; level?: string }) {
  if (value === undefined || !level) {
    return <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>-</td>;
  }

  const color = predictionColor(level);
  return (
    <td className="px-4 py-3 text-sm">
      <span className="rounded-md px-2.5 py-1 text-xs font-semibold" style={{ background: `${color}22`, color }}>
        {value}% {level}
      </span>
    </td>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <Activity size={34} style={{ color: "var(--text-secondary)" }} />
      </div>
      <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <p className="mt-3 max-w-[500px] text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {message}
      </p>
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-xl px-4 py-3 transition" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
      <label className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <CalendarDays size={13} />
        {label}
      </label>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none" />
    </div>
  );
}

function TeamSelect({ value, onChange, teams }: { value: string; onChange: (value: string) => void; teams: string[] }) {
  const teamOptions = ["All Teams", ...teams];
  const displayValue = value || "All Teams";
  
  return (
    <div className="rounded-xl px-4 py-3 transition" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
      <label className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Clock3 size={13} />
        Team
      </label>
      <ConstrainedDropdown
        value={displayValue}
        onChange={(val) => onChange(val === "All Teams" ? "" : val)}
        options={teamOptions}
        buttonStyle={{ background: "transparent", border: "none", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}
        labelStyle={{ color: "var(--text-secondary)" }}
      />
    </div>
  );
}

function SelectBox({ value, onChange, members }: { value: string; onChange: (value: string) => void; members: { id: string; name: string }[] }) {
  return (
    <div className="rounded-xl px-4 py-3 transition" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
      <label className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Clock3 size={13} />
        Team Member
      </label>
      <div className="flex items-center justify-between gap-3">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none bg-transparent text-sm font-semibold outline-none">
          <option value="">All Users</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <ChevronDown size={16} />
      </div>
    </div>
  );
}
