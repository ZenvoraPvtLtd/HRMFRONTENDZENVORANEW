import { TriangleAlert, CalendarDays, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  card,
  getStatusStyle,
  hrPageWrap,
  tableHead,
  textPrimary,
  textSecondary,
} from "../HRdashboard/hrTheme";

type PIPRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  issue_description: string;
  expectations: string;
  timeline_days: number;
  start_date: string;
  end_date: string;
  warning_message: string;
  status: string;
};

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getEmployeeIdentity() {
  const userId = localStorage.getItem("userId") || "";
  const employeeId = localStorage.getItem("employeeId") || "";
  const userName = localStorage.getItem("userName") || "";
  const userEmail = localStorage.getItem("userEmail") || "";

  return {
    ids: [userId, employeeId].filter(Boolean).map(normalize),
    names: [userName, userEmail].filter(Boolean).map(normalize),
  };
}

function daysLeft(endDate?: string) {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function MyPIPPage() {
  const [search] = useTopHeaderSearch();
  const [records, setRecords] = useState<PIPRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchPips() {
      try {
        setIsLoading(true);
        const response = await api.get("/api/pip");
        if (isMounted) setRecords(response.data.pips || []);
      } catch (error) {
        console.error("Failed to fetch employee PIP records", error);
        if (isMounted) setRecords([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPips();
    return () => {
      isMounted = false;
    };
  }, []);

  const employeeRecords = useMemo(() => {
    const identity = getEmployeeIdentity();
    const query = normalize(search);

    return records
      .filter((record) => {
        const recordEmployeeId = normalize(record.employee_id);
        const recordEmployeeName = normalize(record.employee_name);

        const matchesId =
          Boolean(recordEmployeeId) &&
          identity.ids.some((id) => id === recordEmployeeId);
        const matchesName =
          Boolean(recordEmployeeName) &&
          identity.names.some((name) => recordEmployeeName === name || recordEmployeeName.includes(name));

        return matchesId || matchesName;
      })
      .filter((record) => {
        if (!query) return true;
        return [
          record.employee_id,
          record.employee_name,
          record.issue_description,
          record.expectations,
          record.warning_message,
          record.status,
          record.start_date,
          record.end_date,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [records, search]);

  return (
    <div className={`${hrPageWrap} max-w-[1280px] mx-auto`}>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard label="Assigned PIPs" value={employeeRecords.length.toString()} />
        <SummaryCard
          label="Active"
          value={employeeRecords.filter((record) => record.status === "Active").length.toString()}
        />
        <SummaryCard
          label="Closed"
          value={employeeRecords.filter((record) => record.status === "Closed" || record.status === "Improved").length.toString()}
        />
      </div>

      <div className="rounded-2xl p-4" style={card}>
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
          >
            <TriangleAlert size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={textPrimary}>
              My Performance Improvement Plans
            </h2>
          </div>
        </div>

        <div className="hidden overflow-x-auto rounded-lg lg:block" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full min-w-[980px] text-sm">
            <thead style={tableHead}>
              <tr>
                <th className="px-5 py-4 text-left font-semibold">Issue</th>
                <th className="px-5 py-4 text-left font-semibold">Expectations</th>
                <th className="px-5 py-4 text-left font-semibold">Timeline</th>
                <th className="px-5 py-4 text-left font-semibold">Start</th>
                <th className="px-5 py-4 text-left font-semibold">End</th>
                <th className="px-5 py-4 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm" style={textSecondary}>
                    Loading PIP records...
                  </td>
                </tr>
              )}

              {!isLoading &&
                employeeRecords.map((record) => (
                  <tr key={record.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-4 max-w-[260px]" style={textPrimary}>
                      {record.issue_description}
                    </td>
                    <td className="px-5 py-4 max-w-[280px]" style={textSecondary}>
                      {record.expectations}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {record.timeline_days} days
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {record.start_date}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {record.end_date}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full px-3 py-1 text-xs font-semibold" style={getStatusStyle(record.status)}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}

              {!isLoading && employeeRecords.length === 0 && (
                <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm" style={textSecondary}>
                    No PIP assigned
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:hidden">
          {isLoading && (
            <div className="rounded-xl p-5 text-center text-sm" style={{ ...card, ...textSecondary }}>
              Loading PIP records...
            </div>
          )}

          {!isLoading &&
            employeeRecords.map((record) => {
              const remainingDays = daysLeft(record.end_date);
              return (
                <article key={record.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold" style={textPrimary}>
                        {record.issue_description}
                      </h3>
                      <p className="mt-1 text-xs" style={textSecondary}>
                        {record.start_date} to {record.end_date}
                      </p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-semibold" style={getStatusStyle(record.status)}>
                      {record.status}
                    </span>
                  </div>

                  <InfoBlock label="Expectations" value={record.expectations} />
                  <InfoBlock label="Message" value={record.warning_message} />

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MiniMetric icon={<Clock3 size={15} />} label="Timeline" value={`${record.timeline_days} days`} />
                    <MiniMetric
                      icon={<CalendarDays size={15} />}
                      label="Days Left"
                      value={remainingDays === null ? "-" : remainingDays < 0 ? "Ended" : `${remainingDays} days`}
                    />
                  </div>
                </article>
              );
            })}

          {!isLoading && employeeRecords.length === 0 && (
            <div className="rounded-xl p-8 text-center text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              No PIP assigned
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-4" style={card}>
      <p className="text-2xl font-bold" style={textPrimary}>
        {value}
      </p>
      <p className="mt-1 text-sm" style={textSecondary}>
        {label}
      </p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold" style={textPrimary}>
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed" style={textSecondary}>
        {value || "-"}
      </p>
    </div>
  );
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-hover)" }}>
      <div className="flex items-center gap-2 text-xs" style={textSecondary}>
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold" style={textPrimary}>
        {value}
      </p>
    </div>
  );
}
