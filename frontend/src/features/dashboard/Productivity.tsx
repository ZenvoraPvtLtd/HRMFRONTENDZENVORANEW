import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, BarChart3, BrainCircuit, CheckCircle2, Clock3, ListChecks, Timer } from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import RefreshButton from "../../components/button/RefreshButton";
import { fetchManagerProductivity, fetchProductivityPredictions } from "../../services/productivityApi";
import type { ManagerProductivityResponse, ProductivityEntry, ProductivityPrediction } from "../../services/productivityApi";
import {
  btnSecondary,
  card,
  hrPageWrap,
  input,
  inputMuted,
  textSecondary,
} from "../HRdashboard/hrTheme";

type RangeOption = "Today" | "This Week" | "This Month" | "Day" | "Range";

const rangeOptions: RangeOption[] = ["Today", "This Week", "This Month", "Day", "Range"];
const allTeamsLabel = "All Teams";
const allUsersLabel = "All Users";

function toIsoDate(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().split("T")[0];
}

function getDateRange(range: RangeOption) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (range === "This Week") {
    const day = today.getDay() || 7;
    start.setDate(today.getDate() - day + 1);
    end.setDate(start.getDate() + 6);
  }

  if (range === "This Month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function statusColor(status: string) {
  if (status === "Excellent") return "#10b981";
  if (status === "Good") return "#3b82f6";
  if (status === "Average") return "#f59e0b";
  return "#ef4444";
}

function Productivity() {
  const initialRange = useMemo(() => getDateRange("This Week"), []);
  const [selectedRange, setSelectedRange] = useState<RangeOption>("This Week");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [team, setTeam] = useState(allTeamsLabel);
  const [assignee, setAssignee] = useState(allUsersLabel);
  const [data, setData] = useState<ManagerProductivityResponse | null>(null);
  const [predictions, setPredictions] = useState<Record<string, ProductivityPrediction>>({});
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedMember = data?.members.find((member) => member.name === assignee);
  const selectedEmployeeId = assignee === allUsersLabel ? undefined : selectedMember?.id;

  const loadProductivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchManagerProductivity({
        startDate,
        endDate,
        employeeId: selectedEmployeeId,
        teamName: team === allTeamsLabel ? undefined : team,
      });
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Unable to load productivity");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployeeId, team]);

  async function loadPredictions() {
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      const result = await fetchProductivityPredictions({
        startDate,
        endDate,
        employeeId: selectedEmployeeId,
        teamName: team === allTeamsLabel ? undefined : team,
      });
      setPredictions(Object.fromEntries(result.predictions.map((prediction) => [prediction.employee_id, prediction])));
      setShowPredictions(true);
    } catch (err) {
      setPredictionError(err instanceof Error ? err.message : "Unable to load predictions");
    } finally {
      setPredictionLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProductivity();
    }, 0);
    return () => clearTimeout(t);
  }, [startDate, endDate, team, assignee, selectedEmployeeId, loadProductivity]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPredictions({});
      setShowPredictions(false);
      setPredictionError(null);
    }, 0);
    return () => clearTimeout(t);
  }, [startDate, endDate, team, assignee]);

  function handleRangeSelect(value: string) {
    const nextRange = value as RangeOption;
    setSelectedRange(nextRange);
    if (nextRange !== "Range") {
      const range = getDateRange(nextRange);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  }

  function handleStartDate(value: string) {
    setStartDate(value);
    setSelectedRange(value === endDate ? "Day" : "Range");
  }

  function handleEndDate(value: string) {
    setEndDate(value);
    setSelectedRange(startDate === value ? "Day" : "Range");
  }

  const teamOptions = [allTeamsLabel, ...(data?.teams ?? [])];
  const assigneeOptions = [allUsersLabel, ...(data?.members.map((member) => member.name) ?? [])];
  const summary = data?.summary;
  const entries = data?.entries ?? [];

  return (
    <div className={`${hrPageWrap} max-w-[1280px] mx-auto`}>
      <div className="mb-3 flex justify-end">
        <RefreshButton
          label=""
          onClick={loadProductivity}
          compact
          style={btnSecondary}
          aria-label="Refresh productivity"
        />
      </div>

      <section className="rounded-lg p-3 sm:p-4" style={card}>
        <div className="mb-4 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <div className="p-3">
            <RangeTabs selectedRange={selectedRange} onSelect={handleRangeSelect} showPredictions={showPredictions} onPredict={loadPredictions} predictionLoading={predictionLoading} loading={loading} entriesCount={entries.length} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DateField label="Start Date" value={startDate} onChange={handleStartDate} />
          <DateField label="End Date" value={endDate} onChange={handleEndDate} />
          <LabeledSelect label="Team" value={team} options={teamOptions} onChange={setTeam} />
          <LabeledSelect label="Assignee" value={assignee} options={assigneeOptions} onChange={setAssignee} />
        </div>

        {predictionError && (
          <p className="mt-3 text-xs font-semibold" style={{ color: "#ef4444" }}>
            {cleanError(predictionError)}
          </p>
        )}

        {summary && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<BarChart3 size={17} />} label="Avg Productivity" value={`${summary.avg_productivity}%`} />
            <Metric icon={<CheckCircle2 size={17} />} label="Completion Rate" value={`${summary.completion_rate}%`} />
            <Metric icon={<ListChecks size={17} />} label="Entries" value={String(summary.total_entries)} />
            <Metric icon={<Timer size={17} />} label="Idle Time" value={formatMinutes(summary.total_idle_minutes)} />
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
          {loading ? (
            <LoadingRows />
          ) : error ? (
            <EmptyState title="Unable to load productivity" message={cleanError(error)} />
          ) : entries.length === 0 ? (
            <EmptyState title="No productivity entries" message="No productivity entries for the selected filters." />
          ) : (
            <ProductivityTable entries={entries} predictions={predictions} showPredictions={showPredictions} />
          )}
        </div>
      </section>
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
    <div className="rounded-lg p-4" style={{ ...card, border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold" style={textSecondary}>
          {label}
        </span>
        <span className="rounded-md p-2" style={inputMuted}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="h-11 animate-pulse rounded-md" style={{ background: "var(--bg-hover)" }} />
      ))}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-[320px] px-4 py-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ border: "1px solid var(--border)" }}>
        <Activity size={28} style={textSecondary} />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-[520px] text-sm" style={textSecondary}>
        {message}
      </p>
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
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {(showPredictions ? predictionHeadings : headings).map((heading) => (
              <th key={heading} className="px-4 py-3 text-left text-xs font-semibold" style={textSecondary}>
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
                  <td className="px-4 py-3 text-sm font-semibold">{entry.employee_name}</td>
                  <PredictionCell value={prediction?.burnout_risk} level={prediction?.burnout_level} />
                  <PredictionCell value={prediction?.resignation_probability} level={prediction?.resignation_level} />
                  <PredictionCell value={prediction?.performance_drop} level={prediction?.performance_drop_level} />
                </tr>
              );
            }

            return (
              <tr key={`${entry.employee_id}-${entry.activity_date}-${index}`} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-3 text-sm font-semibold">{entry.employee_name}</td>
                <td className="px-4 py-3 text-sm" style={textSecondary}>{entry.team_name}</td>
                <td className="px-4 py-3 text-sm" style={textSecondary}>{entry.activity_date}</td>
                <td className="px-4 py-3 text-sm font-semibold">{entry.tasks_completed}/{entry.tasks_assigned}</td>
                <td className="px-4 py-3 text-sm" style={textSecondary}>{formatMinutes(entry.idle_minutes)}</td>
                <td className="px-4 py-3 text-sm" style={textSecondary}>{formatMinutes(entry.overtime_minutes)}</td>
                <td className="px-4 py-3 text-sm font-semibold" style={{ color: statusColor(entry.status) }}>{entry.productivity_score}%</td>
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
    return <td className="px-4 py-3 text-sm" style={textSecondary}>-</td>;
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

function RangeTabs({
  selectedRange,
  onSelect,
  showPredictions,
  onPredict,
  predictionLoading,
  loading,
  entriesCount,
}: {
  selectedRange: string;
  onSelect: (value: string) => void;
  showPredictions: boolean;
  onPredict: () => void;
  predictionLoading: boolean;
  loading: boolean;
  entriesCount: number;
}) {
  return (
    <div className="inline-flex min-w-max overflow-hidden rounded-md" style={{ border: "1px solid var(--border)" }}>
      {rangeOptions.map((option) => {
        const isActive = option === selectedRange;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className="h-9 px-4 text-xs sm:text-sm font-semibold transition"
            style={{
              ...(isActive ? inputMuted : btnSecondary),
              border: "none",
              borderRight: "1px solid var(--border)",
              borderRadius: 0,
            }}
          >
            {option}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onPredict}
        disabled={predictionLoading || loading || entriesCount === 0}
        className="h-9 px-4 text-xs sm:text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          ...(showPredictions ? inputMuted : btnSecondary),
          border: "none",
          borderRadius: 0,
        }}
      >
        <BrainCircuit size={15} className={predictionLoading ? "animate-pulse inline mr-2" : "inline mr-2"} />
        {predictionLoading ? "Predicting" : "Predict"}
      </button>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-semibold" style={textSecondary}>
        <Clock3 size={12} />
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md px-2 text-xs font-semibold outline-none"
        style={input}
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <ConstrainedDropdown
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      buttonStyle={{ ...input, height: "2.25rem", fontSize: "0.75rem", fontWeight: 600 }}
      labelStyle={textSecondary}
    />
  );
}

export default Productivity;
// Lightweight fallback for React's useCallback when this file is used in isolation/tests.
// Returns the callback as-is. Keeps the same runtime behavior used in this component.
function useCallback<T extends (...args: unknown[]) => unknown>(fn: T, _deps: unknown[]): T {
  void _deps;
  return fn;
}

