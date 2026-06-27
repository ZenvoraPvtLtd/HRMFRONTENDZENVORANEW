import { useEffect, useMemo, useRef, useState } from "react";

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  Coffee,
  X,
  Play,
  Square,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";

import { useTheme } from "../../context/ThemeContext";
import AttendancePage, {
  FACE_AUTO_CLOCK_IN_EVENT,
  FACE_AUTO_CLOCK_OUT_EVENT,
} from "./AttendancePage";
import API_BASE_URL from "../../config/apiConfig";
import { getAuthToken } from "../../utils/auth";
import {
  enrichAttendanceLocation,
  formatAttendanceLocation,
  needsLocationEnrichment,
  normalizeAttendanceLocation,
  type AttendanceLocation,
} from "../../utils/location";
import {
  getElapsedBreakSeconds,
  getElapsedWorkSeconds,
  getOvertimeSeconds,
  readWorkClock,
  saveWorkBreakState,
  saveWorkClockIn,
  saveWorkClockOut,
  WORK_CLOCK_EVENT,
  getWorkClockUserId,
} from "../../utils/workClock";

const COMPANY_LOCATION: AttendanceLocation = {
  label: "Zenvora Pvt Ltd, Indore",
  lat: 22.74907,
  lng: 75.895531,
  accuracy: 100,
};

const MAX_ALLOWED_DISTANCE_METERS = 100;

const MIN_GPS_ACCURACY_METERS = 500;

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type LocationErrorCode =
  | "PERMISSION_DENIED"
  | "GPS_OFF"
  | "FETCH_FAILED"
  | "POOR_ACCURACY"
  | "OUTSIDE_GEOFENCE";

type GeofenceResult =
  | { allowed: true; location: AttendanceLocation }
  | {
    allowed: false;
    code: LocationErrorCode;
    error: string;
    distance?: number;
  };

async function checkGeofence(): Promise<GeofenceResult> {
  // Guard: browser does not support Geolocation API at all
  if (!navigator.geolocation) {
    return {
      allowed: false,
      code: "FETCH_FAILED",
      error: "Unable to fetch your current location.",
    };
  }

  const attempt = (): Promise<GeofenceResult> =>
    new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;

          if (accuracy > MIN_GPS_ACCURACY_METERS) {
            console.warn(
              `[Geofence] GPS accuracy ${Math.round(accuracy)}m exceeds limit of ${MIN_GPS_ACCURACY_METERS}m — rejecting fix`,
            );
            resolve({
              allowed: false,
              code: "POOR_ACCURACY",
              error: `GPS accuracy is too low (${Math.round(accuracy)} m). Please move to an open area and try again.`,
            });
            return;
          }

          const distance = haversineDistance(
            latitude,
            longitude,
            COMPANY_LOCATION.lat!,
            COMPANY_LOCATION.lng!,
          );

          console.info(
            `[Geofence] lat=${latitude}, lng=${longitude}, accuracy=${Math.round(accuracy)}m, distance=${Math.round(distance)}m`,
          );

          if (distance <= MAX_ALLOWED_DISTANCE_METERS) {
            resolve({
              allowed: true,
              location: {
                label: COMPANY_LOCATION.label,
                lat: latitude,
                lng: longitude,
                accuracy,
              },
            });
          } else {
            resolve({
              allowed: false,
              code: "OUTSIDE_GEOFENCE",
              distance: Math.round(distance),
              error: `You are ${Math.round(distance)} m away from ${COMPANY_LOCATION.label}. Clock-in is only allowed within ${MAX_ALLOWED_DISTANCE_METERS} m of the office.`,
            });
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            resolve({
              allowed: false,
              code: "PERMISSION_DENIED",
              error: "Location permission is required to Clock In.",
            });
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            resolve({
              allowed: false,
              code: "GPS_OFF",
              error: "Please enable location services before Clock In.",
            });
          } else {
            resolve({
              allowed: false,
              code: "FETCH_FAILED",
              error: "Unable to fetch your current location.",
            });
          }
        },

        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });

  const first = await attempt();

  if (
    first.allowed === false &&
    (first.code === "FETCH_FAILED" || first.code === "POOR_ACCURACY")
  ) {
    console.info("[Geofence] First attempt failed — retrying once...");
    await new Promise((r) => setTimeout(r, 1500));
    return attempt();
  }

  return first;
}

type WorkMode = "Remote (WFH)" | "On-site" | "Hybrid";
type DayStatus =
  | "onTime"
  | "onsite"
  | "remote"
  | "leave"
  | "holiday"
  | "weekend"
  | "absent"
  | "late";

interface WorkSession {
  start: Date;
  end: Date | null;
}
interface BreakSession {
  start: Date;
  end: Date | null;
}
interface DayLog {
  date: string; // "YYYY-MM-DD"
  status: DayStatus;
  mode: WorkMode | null;
  clockIn: Date | null;
  clockOut: Date | null;
  sessions: WorkSession[];
  breaks: BreakSession[];
  location?: AttendanceLocation | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(d: Date | null) {
  if (!d) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDur(ms: number) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h > 0) return `${h}h ${rm}m`;
  return `${rm}m`;
}
function fmtDurWithSec(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m > 0) return `${m}m ${rs}s`;
  return `${rs}s`;
}
function fmtClock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<
  DayStatus,
  { label: string; color: string; bg: string }
> = {
  onTime: { label: "On Time", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  onsite: { label: "Onsite", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  remote: { label: "Remote", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  leave: { label: "Leave", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  holiday: { label: "Holiday", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  weekend: {
    label: "Rest Day",
    color: "var(--text-secondary)",
    bg: "transparent",
  },
  absent: { label: "Absent", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  late: { label: "Late", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const LATE_AFTER_HOUR = 9;
const LATE_AFTER_MINUTE = 45;

function getTimesheetStorageKey() {
  return `timesheetLogs_${getWorkClockUserId()}`;
}

function isSundayDate(date: Date) {
  return date.getDay() === 0;
}

function isPastDate(date: Date, today = new Date()) {
  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  return target < current;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isFutureDate(date: Date, today = new Date()) {
  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  return target > current;
}

function emptyDayLog(dateKey: string, status: DayStatus): DayLog {
  return {
    date: dateKey,
    status,
    mode: null,
    clockIn: null,
    clockOut: null,
    sessions: [],
    breaks: [],
    location: null,
  };
}

function statusFromClockIn(clockIn: Date, mode: WorkMode): DayStatus {
  void mode;
  const lateAt = new Date(clockIn);
  lateAt.setHours(LATE_AFTER_HOUR, LATE_AFTER_MINUTE, 0, 0);
  return clockIn.getTime() > lateAt.getTime() ? "late" : "onTime";
}

function attendanceLabel(status: DayStatus) {
  if (status === "onTime" || status === "remote" || status === "onsite")
    return "Present";
  return STATUS_META[status].label;
}

function getTodayAttendanceBadge(
  clockInAt: Date | null,
  workMode: WorkMode,
  log: DayLog | null,
  today: Date,
) {
  if (clockInAt || log?.clockIn) {
    const status =
      log?.status ?? statusFromClockIn(clockInAt ?? log!.clockIn!, workMode);
    const meta = STATUS_META[status];
    return { label: attendanceLabel(status), color: meta.color, bg: meta.bg };
  }
  if (isSundayDate(today)) {
    return {
      label: "Rest Day",
      color: "var(--text-secondary)",
      bg: "transparent",
    };
  }
  return {
    label: "Absent",
    color: STATUS_META.absent.color,
    bg: STATUS_META.absent.bg,
  };
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function syncWorkAttendance(
  action: "clock-in" | "clock-out",
  workMode: WorkMode,
  location: AttendanceLocation | null,
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/attendance/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ workMode, location }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error(
        `Unable to sync ${action} attendance`,
        body?.detail || response.statusText,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Unable to sync ${action} attendance`, error);
    return false;
  }
}

function serializeLogs(logs: Record<string, DayLog>) {
  const plain = Object.fromEntries(
    Object.entries(logs).map(([key, log]) => [
      key,
      {
        ...log,
        clockIn: log.clockIn?.toISOString() ?? null,
        clockOut: log.clockOut?.toISOString() ?? null,
        sessions: log.sessions.map((session) => ({
          start: session.start.toISOString(),
          end: session.end?.toISOString() ?? null,
        })),
        breaks: log.breaks.map((item) => ({
          start: item.start.toISOString(),
          end: item.end?.toISOString() ?? null,
        })),
      },
    ]),
  );

  return JSON.stringify(plain);
}

function parseDateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface RawTimeSession {
  start: unknown;
  end: unknown;
}
interface RawDayLog {
  date?: unknown;
  status?: unknown;
  mode?: unknown;
  clockIn?: unknown;
  clockOut?: unknown;
  location?: unknown;
  sessions?: unknown;
  breaks?: unknown;
  [key: string]: unknown;
}

function parseStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseDayStatus(value: unknown): DayStatus | null {
  if (
    value === "onTime" ||
    value === "onsite" ||
    value === "remote" ||
    value === "leave" ||
    value === "holiday" ||
    value === "weekend" ||
    value === "absent" ||
    value === "late"
  ) {
    return value;
  }
  return null;
}

function parseWorkMode(value: unknown): WorkMode | null {
  if (value === "Remote (WFH)" || value === "On-site" || value === "Hybrid") {
    return value;
  }
  return null;
}

function readSavedLogs(): Record<string, DayLog> {
  try {
    const raw = localStorage.getItem(getTimesheetStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RawDayLog>;

    return Object.fromEntries(
      Object.entries(parsed).map(([key, log]): [string, DayLog] => [
        key,
        {
          date: parseStringValue(log.date) ?? key,
          status: parseDayStatus(log.status) ?? "absent",
          mode: parseWorkMode(log.mode),
          clockIn: parseDateValue(log.clockIn),
          clockOut: parseDateValue(log.clockOut),
          location: normalizeAttendanceLocation(log.location),
          sessions: Array.isArray(log.sessions)
            ? (log.sessions as RawTimeSession[]).map((session) => ({
              start: parseDateValue(session.start) ?? new Date(),
              end: parseDateValue(session.end),
            }))
            : [],
          breaks: Array.isArray(log.breaks)
            ? (log.breaks as RawTimeSession[]).map((item) => ({
              start: parseDateValue(item.start) ?? new Date(),
              end: parseDateValue(item.end),
            }))
            : [],
        },
      ]),
    );
  } catch {
    return {};
  }
}

// ─── Mobile hook ─────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimesheetPage() {
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  const initialClock = readWorkClock("Remote (WFH)");

  // Clock state
  const [clockedIn, setClockedIn] = useState(initialClock.clockedIn);
  // clockedOut: true only if today's session is fully done (in+out).
  // Read from localStorage so a page reload preserves state.
  const [clockedOut, setClockedOut] = useState(() => {
    const userId = getWorkClockUserId();
    const todayKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return localStorage.getItem(`clockedOut_${userId}_${todayKey}`) === "true";
  });

  // Persist clockedOut changes to localStorage (scoped to today's date so it
  // automatically resets the next calendar day)
  const persistClockedOut = (value: boolean) => {
    const userId = getWorkClockUserId();
    const todayKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    if (value) {
      localStorage.setItem(`clockedOut_${userId}_${todayKey}`, "true");
    } else {
      localStorage.removeItem(`clockedOut_${userId}_${todayKey}`);
    }
    setClockedOut(value);
  };
  const [onBreak, setOnBreak] = useState(initialClock.onBreak);
  const [workSec, setWorkSec] = useState(() =>
    getElapsedWorkSeconds(initialClock.clockInTime),
  );
  const [overtimeSec, setOvertimeSec] = useState(() =>
    getOvertimeSeconds(initialClock.clockInTime),
  );
  const [breakSec, setBreakSec] = useState(() =>
    getElapsedBreakSeconds("Remote (WFH)"),
  );
  const [workMode, setWorkMode] = useState<WorkMode>(
    initialClock.workMode as WorkMode,
  );
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockInModalMode, setClockInModalMode] = useState<WorkMode>("Remote (WFH)");
  const [clockInDesc, setClockInDesc] = useState("");
  const regularSec = Math.max(0, workSec - overtimeSec);

  const [clockOutDesc, setClockOutDesc] = useState("");
  const todayKeyForRestore = toKey(new Date());
  const [clockInAt, setClockInAt] = useState<Date | null>(() => {
    if (initialClock.clockInTime) return initialClock.clockInTime;
    const savedLogs = readSavedLogs();
    const log = savedLogs[todayKeyForRestore];
    return log?.clockIn ?? null;
  });
  const [, setBreakStartAt] = useState<Date | null>(
    initialClock.breakStartTime,
  );
  const [attendanceLocation, setAttendanceLocation] =
    useState<AttendanceLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState("Location not captured");

  // ── Geofence state ──────────────────────────────────────────────────────────
  const [locationCheckLoading, setLocationCheckLoading] = useState(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getBreakUsed = (type: "lunch" | "short1" | "short2") => {
    const clock = readWorkClock(workMode);
    let acc = 0;
    if (type === "lunch") acc = clock.lunchAccumulatedMs;
    else if (type === "short1") acc = clock.short1AccumulatedMs;
    else if (type === "short2") acc = clock.short2AccumulatedMs;

    if (clock.onBreak && clock.currentBreakType === type && clock.breakStartTime) {
      acc += currentTime - clock.breakStartTime.getTime();
    }
    return acc;
  };

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calendar state
  const today = useMemo(() => new Date(), []);
  const [calTab, setCalTab] = useState<"today" | "weekly" | "monthly">("today");
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, DayLog>>(() =>
    readSavedLogs(),
  );

  // Timer
  useEffect(() => {
    if (clockedIn && !clockedOut) {
      const updateWorkTime = () => {
        const clock = readWorkClock(workMode);
        setWorkSec(getElapsedWorkSeconds(clock.clockInTime));
        setOvertimeSec(getOvertimeSeconds(clock.clockInTime));
      };

      updateWorkTime();
      timerRef.current = setInterval(updateWorkTime, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clockedIn, clockedOut, workMode]);

  useEffect(() => {
    if (!clockInAt) return;

    const key = toKey(clockInAt);
    const storedLocation = logs[key]?.location;
    if (!storedLocation) return;

    let cancelled = false;
    const pendingSync = window.setTimeout(() => {
      if (cancelled) return;
      setAttendanceLocation(storedLocation);
      setLocationStatus(formatAttendanceLocation(storedLocation));
    }, 0);

    if (!needsLocationEnrichment(storedLocation)) {
      return () => {
        cancelled = true;
        window.clearTimeout(pendingSync);
      };
    }

    enrichAttendanceLocation(storedLocation).then((enriched) => {
      if (cancelled) return;

      setAttendanceLocation(enriched);
      setLocationStatus(formatAttendanceLocation(enriched));
      setLogs((current) => {
        const existing = current[key];
        if (!existing) return current;
        return { ...current, [key]: { ...existing, location: enriched } };
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(pendingSync);
    };
  }, [clockInAt, logs]);

  useEffect(() => {
    const syncClock = () => {
      const clock = readWorkClock("Remote (WFH)");
      const now = new Date();
      setClockedIn(clock.clockedIn);
      persistClockedOut(false);
      setOnBreak(clock.onBreak);
      setWorkMode(clock.workMode as WorkMode);
      setClockInAt(clock.clockInTime);
      setBreakStartAt(clock.breakStartTime);
      setWorkSec(getElapsedWorkSeconds(clock.clockInTime));
      setOvertimeSec(getOvertimeSeconds(clock.clockInTime));
      setBreakSec(getElapsedBreakSeconds("Remote (WFH)"));

      setLogs((current) => {
        const activeDate = clock.breakStartTime || clock.clockInTime || now;
        const key = toKey(activeDate);
        const existing = current[key];
        if (!existing) return current;

        if (clock.onBreak && clock.breakStartTime) {
          const hasOpenBreak = existing.breaks.some((item) => !item.end);
          if (hasOpenBreak) return current;

          return {
            ...current,
            [key]: {
              ...existing,
              breaks: [
                ...existing.breaks,
                { start: clock.breakStartTime, end: null },
              ],
            },
          };
        }

        const hasOpenBreak = existing.breaks.some((item) => !item.end);
        if (!hasOpenBreak) return current;

        return {
          ...current,
          [key]: {
            ...existing,
            breaks: existing.breaks.map((item) =>
              !item.end ? { ...item, end: now } : item,
            ),
          },
        };
      });
    };

    window.addEventListener(WORK_CLOCK_EVENT, syncClock);
    window.addEventListener("storage", syncClock);
    return () => {
      window.removeEventListener(WORK_CLOCK_EVENT, syncClock);
      window.removeEventListener("storage", syncClock);
    };
  }, []);

  useEffect(() => {
    if (onBreak) {
      const updateBreakTime = () => {
        const clock = readWorkClock(workMode);
        setBreakStartAt(clock.breakStartTime);
        setBreakSec(getElapsedBreakSeconds(workMode));
      };
      updateBreakTime();
      breakTimerRef.current = setInterval(updateBreakTime, 1000);
    } else {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    }
    return () => {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, [onBreak, workMode]);

  // ── Face auto clock-in ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleFaceClockIn = async (e: Event) => {
      // Block only if already clocked in AND not yet clocked out
      if (clockedIn && !clockedOut) return;

      // Use the location that was already verified by the geofence check
      // in AttendancePage — no need to re-check geofence here.
      const detail = (e as CustomEvent).detail as
        | {
          employeeName?: string;
          employeeId?: string;
          location?: {
            lat: number;
            lng: number;
            accuracy?: number;
            label?: string;
          };
        }
        | undefined;

      const capturedLocation: AttendanceLocation = detail?.location
        ? {
          lat: detail.location.lat,
          lng: detail.location.lng,
          accuracy: detail.location.accuracy ?? 0,
          label: detail.location.label ?? "Office",
        }
        : { lat: 0, lng: 0, accuracy: 0, label: "Office" };

      setGeofenceError(null);
      setLocationStatus(formatAttendanceLocation(capturedLocation));

      const mode: WorkMode = clockInModalMode;
      const now = saveWorkClockIn(mode);
      const key = toKey(now);
      const nextLog: DayLog = {
        date: key,
        status: statusFromClockIn(now, mode),
        mode,
        clockIn: now,
        clockOut: null,
        sessions: [{ start: now, end: null }],
        breaks: [],
        location: capturedLocation,
      };
      setLogs((current) => ({ ...current, [key]: nextLog }));
      setClockInAt(now);
      setAttendanceLocation(capturedLocation);
      setLocationStatus(formatAttendanceLocation(capturedLocation));
      setWorkMode(mode);
      setClockedIn(true);
      persistClockedOut(false);
      setWorkSec(0);
      setOvertimeSec(0);
      setBreakSec(0);
      setBreakStartAt(null);
      setCalTab("today");
      await syncWorkAttendance("clock-in", mode, capturedLocation);
    };

    window.addEventListener(FACE_AUTO_CLOCK_IN_EVENT, handleFaceClockIn);
    return () => {
      window.removeEventListener(FACE_AUTO_CLOCK_IN_EVENT, handleFaceClockIn);
    };
  }, [clockedIn, clockedOut, clockInModalMode]);

  // ── Face auto clock-out ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleFaceClockOut = (e: Event) => {
      // Only act if actually clocked in
      if (!clockedIn || clockedOut) return;
      void e;

      const endedAt = new Date();
      const key = toKey(endedAt);

      saveWorkClockOut();

      setLogs((current) => {
        const existing = current[key];
        if (!existing) return current;

        const sessions = existing.sessions.length
          ? existing.sessions.map((session, index) =>
            index === existing.sessions.length - 1 && !session.end
              ? { ...session, end: endedAt }
              : session,
          )
          : [{ start: existing.clockIn || endedAt, end: endedAt }];

        return {
          ...current,
          [key]: {
            ...existing,
            clockOut: endedAt,
            sessions,
            breaks: existing.breaks.map((item) =>
              !item.end ? { ...item, end: endedAt } : item,
            ),
          },
        };
      });

      setClockedIn(false);
      persistClockedOut(true);
      setOnBreak(false);
      setBreakStartAt(null);
      setCalTab("today");
      // Sync to backend clock-out endpoint (no geofence needed for face)
      void syncWorkAttendance("clock-out", workMode, null);
    };

    window.addEventListener(FACE_AUTO_CLOCK_OUT_EVENT, handleFaceClockOut);
    return () => {
      window.removeEventListener(FACE_AUTO_CLOCK_OUT_EVENT, handleFaceClockOut);
    };
  }, [clockedIn, clockedOut, workMode]);

  useEffect(() => {
    localStorage.setItem(getTimesheetStorageKey(), serializeLogs(logs));
  }, [logs]);

  // Fetch backend attendance logs and merge with localStorage
  useEffect(() => {
    let cancelled = false;

    const monthStart = new Date(calYear, calMonth, 1);
    const monthEnd = new Date(calYear, calMonth + 1, 0);
    const startDate = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(monthStart.getDate()).padStart(2, "0")}`;
    const endDate = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

    const fetchBackendLogs = async () => {
      try {
        const token =
          localStorage.getItem("accessToken") ||
          localStorage.getItem("hr_accessToken") ||
          localStorage.getItem("manager_accessToken") ||
          "";
        if (!token) return;

        const res = await fetch(
          `${API_BASE_URL}/api/attendance/my-logs?start=${startDate}&end=${endDate}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok || cancelled) return;

        const json = await res.json();
        if (!json.success || !Array.isArray(json.data) || cancelled) return;

        setLogs((current) => {
          const merged = { ...current };
          for (const record of json.data as Array<{
            date: string;
            status: string;
            checkIn: string;
            checkOut: string;
            workMode: string;
          }>) {
            const key = record.date;
            if (!key) continue;
            if (merged[key] && merged[key].clockIn) continue;

            const parseTimeStr = (
              val: string,
              baseDate: string,
            ): Date | null => {
              if (!val) return null;
              try {
                if (val.includes("T")) return new Date(val);
                const [time, ampm] = val.split(" ");
                if (!time || !ampm) return null;
                const [h, m, s] = time.split(":").map(Number);
                let hour = h;
                if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
                if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
                const d = new Date(`${baseDate}T00:00:00`);
                d.setHours(hour, m || 0, s || 0, 0);
                return d;
              } catch {
                return null;
              }
            };

            const clockIn = parseTimeStr(record.checkIn, key);
            const clockOut = parseTimeStr(record.checkOut, key);
            const mode = (record.workMode || "On-site") as WorkMode;
            const status = (record.status || "onTime") as DayStatus;

            merged[key] = {
              date: key,
              status,
              mode,
              clockIn,
              clockOut,
              sessions: clockIn ? [{ start: clockIn, end: clockOut }] : [],
              breaks: [],
              location: null,
            };
          }
          return merged;
        });
      } catch {
        // silently ignore fetch failures
      }
    };

    fetchBackendLogs();
    return () => {
      cancelled = true;
    };
  }, [calMonth, calYear]);

  // ── Clock In ────────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setGeofenceError(null);
    setLocationCheckLoading(true);
    setLocationStatus("Checking your location...");

    // Skip strict geofence for Remote/WFH — just get coordinates
    if (clockInModalMode !== "On-site") {
      let capturedLocation: AttendanceLocation = { lat: 0, lng: 0, accuracy: 0, label: clockInModalMode };
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 })
        );
        capturedLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, label: clockInModalMode };
      } catch {
        // location optional for remote — proceed without it
      }
      setLocationCheckLoading(false);
      const now = saveWorkClockIn(clockInModalMode);
      const key = toKey(now);
      const nextLog: DayLog = {
        date: key,
        status: statusFromClockIn(now, clockInModalMode),
        mode: clockInModalMode,
        clockIn: now,
        clockOut: null,
        sessions: [{ start: now, end: null }],
        breaks: [],
        location: capturedLocation,
      };
      setLogs((current) => ({ ...current, [key]: nextLog }));
      setClockInAt(now);
      setAttendanceLocation(capturedLocation);
      setLocationStatus(formatAttendanceLocation(capturedLocation));
      setWorkMode(clockInModalMode);
      setClockedIn(true);
      persistClockedOut(false);
      setWorkSec(0);
      setOvertimeSec(0);
      setBreakSec(0);
      setBreakStartAt(null);
      setShowClockInModal(false);
      setClockInDesc("");
      setGeofenceError(null);
      setCalTab("today");
      await syncWorkAttendance("clock-in", clockInModalMode, capturedLocation);
      return;
    }

    const result = await checkGeofence();
    setLocationCheckLoading(false);

    if (result.allowed === false) {
      setLocationStatus("Location check failed");
      setGeofenceError(result.error);
      return; // Block Clock In — stay on modal
    }

    // ✅ Live coordinates confirmed — use them directly (never use COMPANY_LOCATION as fallback)
    const capturedLocation = result.location;
    const now = saveWorkClockIn(clockInModalMode);
    const key = toKey(now);
    const nextLog: DayLog = {
      date: key,
      status: statusFromClockIn(now, clockInModalMode),
      mode: clockInModalMode,
      clockIn: now,
      clockOut: null,
      sessions: [{ start: now, end: null }],
      breaks: [],
      location: capturedLocation,
    };

    setLogs((current) => ({ ...current, [key]: nextLog }));
    setClockInAt(now);
    setAttendanceLocation(capturedLocation);
    setLocationStatus(formatAttendanceLocation(capturedLocation));
    setWorkMode(clockInModalMode);
    setClockedIn(true);
    persistClockedOut(false);
    setWorkSec(0);
    setOvertimeSec(0);
    setBreakSec(0);
    setBreakStartAt(null);
    setShowClockInModal(false);
    setClockInDesc("");
    setGeofenceError(null);
    setCalTab("today");
    await syncWorkAttendance("clock-in", clockInModalMode, capturedLocation);
  };

  // ── Clock Out ───────────────────────────────────────────────────────────────
  const handleClockOut = async () => {
    setGeofenceError(null);
    setLocationCheckLoading(true);
    setLocationStatus("Checking your location...");

    const endedAt = new Date();
    const key = toKey(endedAt);

    const doClockOut = (clockOutLocation: AttendanceLocation | null) => {
      saveWorkClockOut();
      setLogs((current) => {
        const existing = current[key];
        if (!existing) return current;
        const sessions = existing.sessions.length
          ? existing.sessions.map((session, index) =>
            index === existing.sessions.length - 1 && !session.end
              ? { ...session, end: endedAt }
              : session,
          )
          : [{ start: existing.clockIn || endedAt, end: endedAt }];
        return {
          ...current,
          [key]: {
            ...existing,
            clockOut: endedAt,
            sessions,
            breaks: existing.breaks.map((item) =>
              !item.end ? { ...item, end: endedAt } : item,
            ),
          },
        };
      });
      setClockedIn(false);
      persistClockedOut(true);
      setOnBreak(false);
      setBreakStartAt(null);
      setShowClockOutModal(false);
      setClockOutDesc("");
      setGeofenceError(null);
      void syncWorkAttendance("clock-out", workMode, clockOutLocation);
    };

    // Skip strict geofence for Remote/WFH
    if (workMode !== "On-site") {
      setLocationCheckLoading(false);
      doClockOut(null);
      return;
    }

    const result = await checkGeofence();
    setLocationCheckLoading(false);

    if (result.allowed === false) {
      setLocationStatus("Location check failed");
      setGeofenceError(result.error);
      return; // Block Clock Out — stay on modal
    }

    // ✅ Live coordinates confirmed
    doClockOut(result.location);
  };

  const handleBreak = (type: "lunch" | "short1" | "short2") => {
    const startedAt = new Date();
    saveWorkBreakState(true, type);
    setBreakStartAt(startedAt);
    setBreakSec(getElapsedBreakSeconds(workMode));
    setOnBreak(true);
  };

  const handleResumeWork = () => {
    saveWorkBreakState(false);
    setBreakStartAt(null);
    setBreakSec(getElapsedBreakSeconds(workMode));
    setOnBreak(false);
  };

  // Build calendar cells
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const mondayOffset = (firstDow + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(mondayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Week cells (Mon–Sun of current week)
  const weekCells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const calendarLogs = useMemo(() => {
    const generated: Record<string, DayLog> = { ...logs };

    if (clockInAt) {
      const liveKey = toKey(clockInAt);
      const existing = generated[liveKey];
      generated[liveKey] = {
        date: liveKey,
        status: existing?.status ?? statusFromClockIn(clockInAt, workMode),
        mode: workMode,
        clockIn: clockInAt,
        clockOut: existing?.clockOut ?? null,
        sessions: existing?.sessions?.length
          ? existing.sessions
          : [{ start: clockInAt, end: existing?.clockOut ?? null }],
        breaks: existing?.breaks ?? [],
        location: existing?.location ?? attendanceLocation,
      };
    }

    const addDay = (date: Date) => {
      const key = toKey(date);
      if (generated[key]) return;

      if (isFutureDate(date, today)) return;

      if (isSundayDate(date)) {
        generated[key] = emptyDayLog(key, "weekend");
        return;
      }

      if (isPastDate(date, today) || isSameDay(date, today)) {
        generated[key] = emptyDayLog(key, "absent");
      }
    };

    for (let day = 1; day <= daysInMonth; day += 1) {
      addDay(new Date(calYear, calMonth, day));
    }

    weekCells.forEach(addDay);
    return generated;
  }, [
    attendanceLocation,
    calMonth,
    calYear,
    clockInAt,
    daysInMonth,
    logs,
    today,
    weekCells,
    workMode,
  ]);

  const selectedLog = selectedDay ? (calendarLogs[selectedDay] ?? null) : null;
  const todayKey = toKey(today);
  const todayLog = calendarLogs[todayKey] ?? null;
  const todayAttendance = getTodayAttendanceBadge(
    clockInAt,
    workMode,
    todayLog,
    today,
  );

  const accentBtn = {
    background: isDark ? "#ffffff" : "#000000",
    color: isDark ? "#000000" : "#ffffff",
    border: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="timesheet-root">
        {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
        <div className="timesheet-left">
          {/* Today's attendance status */}
          <div className="card" style={{ padding: "0.875rem" }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              Today&apos;s Attendance
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "999px",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: todayAttendance.color,
                background: todayAttendance.bg,
              }}
            >
              {todayAttendance.label}
              {clockInAt && (
                <span style={{ fontWeight: 500, opacity: 0.85 }}>
                  · {fmtTime(clockInAt)}
                </span>
              )}
            </div>
          </div>

          {/* Work Time */}
          <div className="card" style={{ padding: "0.875rem" }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              Work Time Today
            </div>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: clockedIn && !clockedOut ? "var(--accent)" : "var(--text-primary)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.01em",
              }}
            >
              {fmtClock(regularSec)}
              {overtimeSec > 0 && (
                <span
                  style={{
                    color: "#ff5722",
                    marginLeft: "0.5rem",
                    fontSize: "0.9rem",
                  }}
                >
                  (+{fmtClock(overtimeSec)} Overtime)
                </span>
              )}
            </div>

            {clockedIn && !clockedOut && (
              <div
                style={{
                  marginTop: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.75rem",
                }}
              >
                <MapPin size={12} style={{ color: "var(--accent)" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  {workMode}
                </span>
                {clockedOut ? (
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>
                    · Clocked Out
                  </span>
                ) : onBreak ? (
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>
                    · On Break
                  </span>
                ) : (
                  <span style={{ color: "#10b981", fontWeight: 700 }}>
                    · Active
                  </span>
                )}
              </div>
            )}
            <div
              style={{
                marginTop: "0.45rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.35rem",
                fontSize: "0.72rem",
                color: "var(--text-secondary)",
              }}
            >
              <MapPin
                size={12}
                style={{
                  color: "var(--accent)",
                  flexShrink: 0,
                  marginTop: "0.1rem",
                }}
              />
              <span
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  wordBreak: "break-word",
                  lineHeight: 1.4,
                }}
              >
                {locationStatus}
              </span>
            </div>
          </div>

          {/* Break Time */}
          <div
            className="card"
            style={{
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.75rem",
                textAlign: "center",
              }}
            >
              Break Tracker
            </div>

            {/* Active Break Banner */}
            {onBreak ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.15)",
                  borderRadius: "0.75rem",
                  padding: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "#f59e0b", fontWeight: 600 }}>
                  <span
                    className="animate-pulse"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#f59e0b",
                      display: "inline-block",
                    }}
                  />
                  Active: {
                    (() => {
                      const clock = readWorkClock(workMode);
                      if (clock.currentBreakType === "lunch") return "Lunch Break";
                      if (clock.currentBreakType === "short1") return "Short Break 1";
                      if (clock.currentBreakType === "short2") return "Short Break 2";
                      return "Break";
                    })()
                  }
                </div>
                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 800,
                    color: "#f59e0b",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                    marginTop: "0.25rem",
                  }}
                >
                  {fmtClock(breakSec)}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "var(--bg-hover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  padding: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                  Not on Break
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                    marginTop: "0.25rem",
                  }}
                >
                  {fmtClock(breakSec)}
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  Total break time today
                </div>
              </div>
            )}

            {/* Break Breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* Lunch Break */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Lunch Break</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {fmtDurWithSec(getBreakUsed("lunch"))} / 30m
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (getBreakUsed("lunch") / 1800000) * 100)}%`,
                      height: "100%",
                      background: getBreakUsed("lunch") >= 1800000 ? "#ef4444" : "#f59e0b",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* Short Break 1 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Short Break 1</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {fmtDurWithSec(getBreakUsed("short1"))} / 15m
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (getBreakUsed("short1") / 900000) * 100)}%`,
                      height: "100%",
                      background: getBreakUsed("short1") >= 900000 ? "#ef4444" : "#f59e0b",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* Short Break 2 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Short Break 2</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {fmtDurWithSec(getBreakUsed("short2"))} / 15m
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (getBreakUsed("short2") / 900000) * 100)}%`,
                      height: "100%",
                      background: getBreakUsed("short2") >= 900000 ? "#ef4444" : "#f59e0b",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Work Mode selector */}
          {!clockedIn && (
            <div className="card" style={{ padding: "1.25rem" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                Work Mode
              </div>
              <ConstrainedDropdown
                value={clockInModalMode}
                onChange={(value) => setClockInModalMode(value as WorkMode)}
                options={["On-site", "Remote (WFH)", "Hybrid"]}
                buttonStyle={{
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.5rem",
                }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {!clockedIn && (
              <button
                onClick={() => {
                  setGeofenceError(null);
                  setShowClockInModal(true);
                }}
                style={{
                  ...accentBtn,
                  padding: "0.875rem",
                  borderRadius: "0.75rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <LogIn size={18} /> Clock In
              </button>
            )}
            {/* Break Buttons with order enforcement */}
            {clockedIn && !clockedOut && !onBreak && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {/* Short Break 1 */}
                <button
                  onClick={() => handleBreak("short1")}
                  disabled={getBreakUsed("short1") >= 900000}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    cursor: getBreakUsed("short1") >= 900000 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(245,158,11,0.08)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245,158,11,0.2)",
                    opacity: getBreakUsed("short1") >= 900000 ? 0.5 : 1,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Coffee size={16} /> Short Break 1 (15m)
                  </span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.85 }}>
                    {fmtDurWithSec(Math.max(0, 900000 - getBreakUsed("short1")))} left
                  </span>
                </button>
                {/* Lunch Break */}
                <button
                  onClick={() => handleBreak("lunch")}
                  disabled={getBreakUsed("short1") < 900000 || getBreakUsed("lunch") >= 1800000}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    cursor:
                      getBreakUsed("short1") < 900000 || getBreakUsed("lunch") >= 1800000
                        ? "not-allowed"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(245,158,11,0.08)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245,158,11,0.2)",
                    opacity:
                      getBreakUsed("short1") < 900000 || getBreakUsed("lunch") >= 1800000
                        ? 0.5
                        : 1,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Coffee size={16} /> Lunch Break (30m)
                  </span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.85 }}>
                    {fmtDurWithSec(Math.max(0, 1800000 - getBreakUsed("lunch")))} left
                  </span>
                </button>
                {/* Short Break 2 */}
                <button
                  onClick={() => handleBreak("short2")}
                  disabled={getBreakUsed("lunch") < 1800000 || getBreakUsed("short2") >= 900000}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    cursor: getBreakUsed("lunch") < 1800000 || getBreakUsed("short2") >= 900000 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(245,158,11,0.08)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245,158,11,0.2)",
                    opacity: getBreakUsed("lunch") < 1800000 || getBreakUsed("short2") >= 900000 ? 0.5 : 1,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Coffee size={16} /> Short Break 2 (15m)
                  </span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.85 }}>
                    {fmtDurWithSec(Math.max(0, 900000 - getBreakUsed("short2")))} left
                  </span>
                </button>
              </div>
            )}
            {clockedIn && !clockedOut && onBreak && (
              <button
                onClick={handleResumeWork}
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  background: "rgba(16,185,129,0.12)",
                  color: "#10b981",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <Play size={16} /> Resume Work
              </button>
            )}
            {clockedIn && !clockedOut && (
              <button
                onClick={() => {
                  setGeofenceError(null);
                  setShowClockOutModal(true);
                }}
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  background: "rgba(239,68,68,0.1)",
                  color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <LogOut size={16} /> Clock Out
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
        <div className="timesheet-right">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Tabs */}
            <div
              className="timesheet-tabs"
              style={{
                display: "flex",
                gap: 0,
                borderBottom: "1px solid var(--border)",
                padding: "0 1.5rem",
              }}
            >
              {(["today", "weekly", "monthly"] as const).map((t) => (
                <button
                  key={t}
                  className="timesheet-tab-btn"
                  onClick={() => setCalTab(t)}
                  style={{
                    padding: "0.65rem 1.25rem",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    background: "transparent",
                    border: "none",
                    borderBottom:
                      calTab === t
                        ? "2px solid var(--accent)"
                        : "2px solid transparent",
                    color:
                      calTab === t ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                    marginBottom: -1,
                  }}
                >
                  {t === "today"
                    ? "Today"
                    : t === "weekly"
                      ? "Weekly"
                      : "Monthly"}
                </button>
              ))}
            </div>

            {/* ── TODAY TAB ── */}
            {calTab === "today" && (
              <TodayView
                today={today}
                todayLog={todayLog}
                workSec={workSec}
                breakSec={breakSec}
                clockedIn={clockedIn}
                clockedOut={clockedOut}
                onBreak={onBreak}
                workMode={workMode}
                isMobile={isMobile}
                clockInAt={clockInAt}
                location={attendanceLocation}
              />
            )}

            {/* ── WEEKLY TAB ── */}
            {calTab === "weekly" && (
              <WeeklyView
                weekCells={weekCells}
                logs={calendarLogs}
                today={today}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                setWeekStart={setWeekStart}
                isMobile={isMobile}
              />
            )}

            {/* ── MONTHLY TAB ── */}
            {calTab === "monthly" && (
              <MonthlyView
                calYear={calYear}
                calMonth={calMonth}
                calCells={calCells}
                logs={calendarLogs}
                today={today}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                isMobile={isMobile}
                prevMonth={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else setCalMonth((m) => m - 1);
                }}
                nextMonth={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear((y) => y + 1);
                  } else setCalMonth((m) => m + 1);
                }}
              />
            )}
          </div>

          {/* ── Day Detail Panel ── */}
          {selectedDay && (
            <DayDetailPanel
              log={selectedLog}
              dateStr={selectedDay}
              onClose={() => setSelectedDay(null)}
            />
          )}

          {/* ── Attendance (Face / QR) ── */}
          <AttendancePage />
        </div>

        {/* ── CLOCK IN MODAL ── */}
        {showClockInModal && (
          <Modal
            title="Clock In"
            icon={<LogIn size={18} style={{ color: "var(--text-primary)" }} />}
            onClose={() => {
              setShowClockInModal(false);
              setGeofenceError(null);
            }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Work Mode <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <ConstrainedDropdown
              value={clockInModalMode}
              onChange={(value) => setClockInModalMode(value as WorkMode)}
              options={["Remote (WFH)", "On-site", "Hybrid"]}
              className="mb-4"
              buttonStyle={{
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
              }}
            />
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "0.35rem",
                marginTop: "0.75rem",
              }}
            >
              Description (Optional)
            </label>
            <textarea
              value={clockInDesc}
              onChange={(e) => setClockInDesc(e.target.value)}
              placeholder="e.g., Daily standup, project work..."
              rows={3}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />

            {/* ── Location requirement notice ── */}
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.2)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
              }}
            >
              <MapPin
                size={14}
                style={{ color: "#3b82f6", flexShrink: 0, marginTop: "0.1rem" }}
              />
              <span>
                Clock-in requires{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  live GPS location
                </strong>
                . Ensure location services are enabled and permission is
                granted. You must be within{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {MAX_ALLOWED_DISTANCE_METERS} m
                </strong>{" "}
                of{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {COMPANY_LOCATION.label}
                </strong>
                .
              </span>
            </div>

            {/* ── Location / geofence error ── */}
            {geofenceError && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  fontSize: "0.8rem",
                  color: "#ef4444",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                  <span>{geofenceError}</span>
                </div>
                {geofenceError.toLowerCase().includes("permission") && (
                  <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        // Chrome/Edge: open site settings directly
                        window.open(
                          `chrome://settings/content/siteDetails?site=${encodeURIComponent(window.location.origin)}`,
                          "_blank"
                        );
                      }}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.4rem",
                        border: "1px solid #ef4444",
                        background: "transparent",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      Open Browser Settings
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.4rem",
                        border: "1px solid #ef4444",
                        background: "#ef4444",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      Reload Page
                    </button>
                  </div>
                )}
                {!geofenceError.toLowerCase().includes("permission") && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <button
                      onClick={() => { setGeofenceError(null); handleClockIn(); }}
                      disabled={locationCheckLoading}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.4rem",
                        border: "1px solid #ef4444",
                        background: "transparent",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                marginTop: "1.25rem",
              }}
            >
              <button
                onClick={() => {
                  setShowClockInModal(false);
                  setGeofenceError(null);
                }}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClockIn}
                disabled={locationCheckLoading}
                style={{
                  padding: "0.6rem 1.5rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  background: locationCheckLoading
                    ? "var(--bg-secondary)"
                    : "var(--bg-primary)",
                  color: locationCheckLoading
                    ? "var(--text-secondary)"
                    : "var(--text-primary)",
                  cursor: locationCheckLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {locationCheckLoading ? (
                  <>
                    <LoadingSpinner /> Checking Location...
                  </>
                ) : (
                  <>
                    <LogIn size={15} /> Clock In
                  </>
                )}
              </button>
            </div>
          </Modal>
        )}

        {/* ── CLOCK OUT MODAL ── */}
        {showClockOutModal && (
          <Modal
            title="Clock Out"
            icon={<Square size={18} style={{ color: "#ef4444" }} />}
            onClose={() => {
              setShowClockOutModal(false);
              setGeofenceError(null);
            }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Description (Optional)
            </label>
            <textarea
              value={clockOutDesc}
              onChange={(e) => setClockOutDesc(e.target.value)}
              placeholder="e.g., All tasks completed for the day..."
              rows={3}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />

            {/* ── Location requirement notice ── */}
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
              }}
            >
              <MapPin
                size={14}
                style={{ color: "#ef4444", flexShrink: 0, marginTop: "0.1rem" }}
              />
              <span>
                Clock-out requires{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  live GPS location
                </strong>
                . You must be within{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {MAX_ALLOWED_DISTANCE_METERS} m
                </strong>{" "}
                of{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {COMPANY_LOCATION.label}
                </strong>
                .
              </span>
            </div>

            {/* ── Location / geofence error ── */}
            {geofenceError && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  fontSize: "0.8rem",
                  color: "#ef4444",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                  <span>{geofenceError}</span>
                </div>
                {geofenceError.toLowerCase().includes("permission") && (
                  <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        window.open(
                          `chrome://settings/content/siteDetails?site=${encodeURIComponent(window.location.origin)}`,
                          "_blank"
                        );
                      }}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.4rem",
                        border: "1px solid #ef4444",
                        background: "transparent",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      Open Browser Settings
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.4rem",
                        border: "1px solid #ef4444",
                        background: "#ef4444",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      Reload Page
                    </button>
                  </div>
                )}
                {!geofenceError.toLowerCase().includes("permission") && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <button
                      onClick={() => { setGeofenceError(null); handleClockOut(); }}
                      disabled={locationCheckLoading}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.4rem",
                        border: "1px solid #ef4444",
                        background: "transparent",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                marginTop: "1.25rem",
              }}
            >
              <button
                onClick={() => {
                  setShowClockOutModal(false);
                  setGeofenceError(null);
                }}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClockOut}
                disabled={locationCheckLoading}
                style={{
                  padding: "0.6rem 1.5rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: locationCheckLoading ? "#fca5a5" : "#ef4444",
                  color: "#fff",
                  cursor: locationCheckLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {locationCheckLoading ? (
                  <>
                    <LoadingSpinner /> Checking Location...
                  </>
                ) : (
                  "Confirm Clock Out"
                )}
              </button>
            </div>
          </Modal>
        )}
      </div>

    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid rgba(255,255,255,0.4)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 460,
          padding: "1.5rem",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            marginBottom: "1.25rem",
          }}
        >
          {icon}
          <span
            style={{
              fontWeight: 700,
              fontSize: "1.05rem",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Today View ───────────────────────────────────────────────────────────────

function TodayView({
  today,
  todayLog,
  workSec,
  breakSec,
  clockedIn,
  clockedOut,
  onBreak,
  workMode,
  isMobile,
  clockInAt,
  location,
}: {
  today: Date;
  todayLog: DayLog | null;
  workSec: number;
  breakSec: number;
  clockedIn: boolean;
  clockedOut: boolean;
  onBreak: boolean;
  workMode: WorkMode;
  isMobile: boolean;
  clockInAt: Date | null;
  location: AttendanceLocation | null;
}) {
  const dateStr = today.toLocaleDateString("en-GB", {
    weekday: isMobile ? "short" : "long",
    day: "numeric",
    month: isMobile ? "short" : "long",
    year: "numeric",
  });
  const todayAttendance = getTodayAttendanceBadge(
    clockInAt,
    workMode,
    todayLog,
    today,
  );
  const attendanceStatus = clockInAt
    ? STATUS_META[statusFromClockIn(clockInAt, workMode)]
    : null;

  const arrivalTime = clockInAt ?? todayLog?.clockIn ?? null;
  // Departure: prefer log's clockOut (actual time), fall back to "now" only if actively clocked out
  const departureTime = todayLog?.clockOut ?? null;

  // Work ms: when clocked out use log sessions for accuracy; when live use workSec counter
  const logWorkMs = (() => {
    if (!todayLog) return 0;
    const sessions = todayLog.sessions ?? [];
    if (sessions.length > 0) {
      return sessions.reduce((total, s) => {
        const end = s.end ?? (clockedIn ? new Date() : null);
        return end ? total + (end.getTime() - s.start.getTime()) : total;
      }, 0);
    }
    if (todayLog.clockIn) {
      const end = todayLog.clockOut ?? (clockedIn ? new Date() : null);
      return end ? end.getTime() - todayLog.clockIn.getTime() : 0;
    }
    return 0;
  })();

  // Break ms from log
  const logBreakMs =
    todayLog?.breaks.reduce((a, b) => {
      const end = b.end ?? (onBreak ? new Date() : null);
      return end ? a + (end.getTime() - b.start.getTime()) : a;
    }, 0) ?? 0;

  const displayWorkMs = clockedOut
    ? Math.max(logWorkMs - logBreakMs, 0)
    : workSec * 1000;
  const displayBreakMs = clockedOut ? logBreakMs : breakSec * 1000;

  const hasSomething = clockedIn || clockedOut || arrivalTime !== null;

  return (
    <div style={{ padding: isMobile ? "1rem" : "1.5rem" }}>
      {/* Date + status badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: "1rem",
            color: "var(--text-primary)",
          }}
        >
          {dateStr}
        </div>
        <div
          style={{
            padding: "0.35rem 0.85rem",
            borderRadius: "999px",
            fontSize: "0.78rem",
            fontWeight: 700,
            color: todayAttendance.color,
            background: todayAttendance.bg,
          }}
        >
          {todayAttendance.label}
        </div>
      </div>

      {/* Stats grid — always visible once there's any data */}
      {hasSomething && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: isMobile ? "0.5rem" : "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            {
              label: "Base Work Time",
              value:
                displayWorkMs > 0
                  ? fmtDur(displayWorkMs)
                  : clockedIn
                    ? fmtDur(workSec * 1000)
                    : "--",
            },
            {
              label: "Overall Hours",
              value:
                displayWorkMs + displayBreakMs > 0
                  ? fmtDur(displayWorkMs + displayBreakMs)
                  : clockedIn
                    ? fmtDur(workSec * 1000)
                    : "--",
            },
            {
              label: "Arrival",
              value: arrivalTime ? fmtTime(arrivalTime) : "--",
            },
            {
              label: "Departure",
              value: departureTime
                ? fmtTime(departureTime)
                : clockedIn
                  ? "Active"
                  : "--",
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: "var(--bg-hover)",
                borderRadius: "0.75rem",
                padding: "0.875rem 1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.25rem",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions list — shown after clock-out */}
      {clockedOut && todayLog && (todayLog.sessions?.length ?? 0) > 0 && (
        <div
          style={{
            background: "var(--bg-hover)",
            borderRadius: "0.75rem",
            padding: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--text-secondary)",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 700,
            }}
          >
            Today's Sessions
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {todayLog.sessions.map((s, i) => {
              const sessionMs = s.end ? s.end.getTime() - s.start.getTime() : 0;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <span
                    style={{ color: "#10b981", fontWeight: 700, minWidth: 18 }}
                  >
                    {i + 1}.
                  </span>
                  <span
                    style={{ color: "var(--text-primary)", fontWeight: 600 }}
                  >
                    {fmtTime(s.start)} → {s.end ? fmtTime(s.end) : "Active"}
                  </span>
                  {sessionMs > 0 && (
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.78rem",
                      }}
                    >
                      ({fmtDur(sessionMs)})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Break summary */}
          {displayBreakMs > 0 && (
            <div
              style={{
                marginTop: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border)",
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
              }}
            >
              Break time:{" "}
              <span style={{ fontWeight: 700, color: "#f59e0b" }}>
                {fmtDur(displayBreakMs)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live status — only when clocked in */}
      {clockedIn && !clockedOut && (
        <div
          style={{
            background: "var(--bg-hover)",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--text-secondary)",
              marginBottom: "0.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 700,
            }}
          >
            Live Status
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Chip label="Work Time" value={fmtDur(displayWorkMs)} color="#10b981" />
            <Chip label="Break Time" value={fmtDur(breakSec * 1000)} color="#f59e0b" />
            <Chip label="Mode" value={workMode} color="#3b82f6" />
            {attendanceStatus && (
              <Chip
                label="Attendance"
                value={attendanceLabel(statusFromClockIn(clockInAt!, workMode))}
                color={attendanceStatus.color}
              />
            )}
            <Chip
              label="Status"
              value={onBreak ? "On Break" : "Active"}
              color={onBreak ? "#f59e0b" : "#10b981"}
            />
            <Chip
              label="Location"
              value={formatAttendanceLocation(location)}
              color="#6366f1"
            />
          </div>

        </div>
      )}

      {!hasSomething && (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            padding: "2rem 0",
            fontSize: "0.875rem",
          }}
        >
          Clock in to start tracking your work time today.
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: `${color}15`,
        borderRadius: "0.5rem",
        padding: "0.4rem 0.75rem",
        fontSize: "0.78rem",
        maxWidth: "100%",
      }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}: </span>
      <span style={{ fontWeight: 700, color, wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

// ─── Weekly View ──────────────────────────────────────────────────────────────

function WeeklyView({
  weekCells,
  logs,
  today,
  selectedDay,
  setSelectedDay,
  setWeekStart,
  isMobile,
}: {
  weekCells: Date[];
  logs: Record<string, DayLog>;
  today: Date;
  selectedDay: string | null;
  setSelectedDay: (d: string | null) => void;
  setWeekStart: (fn: (d: Date) => Date) => void;
  isMobile: boolean;
}) {
  const weekEnd = weekCells[6];
  const label = `${weekCells[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div style={{ padding: "1.25rem 1.5rem" }}>
      {/* Nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1.25rem",
        }}
      >
        <button
          onClick={() =>
            setWeekStart((d) => {
              const n = new Date(d);
              n.setDate(n.getDate() - 7);
              return n;
            })
          }
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "50%",
            width: 30,
            height: 30,
            cursor: "pointer",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={15} />
        </button>
        <span
          style={{
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "var(--text-primary)",
          }}
        >
          {label}
        </span>
        <button
          onClick={() =>
            setWeekStart((d) => {
              const n = new Date(d);
              n.setDate(n.getDate() + 7);
              return n;
            })
          }
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "50%",
            width: 30,
            height: 30,
            cursor: "pointer",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(7, 1fr)" : "repeat(7, 1fr)",
          gap: isMobile ? "0.25rem" : "0.5rem",
        }}
      >
        {weekCells.map((d) => {
          const key = toKey(d);
          const log = logs[key] ?? null;
          const meta = log ? STATUS_META[log.status] : null;
          const isToday = toKey(d) === toKey(today);
          const isSelected = selectedDay === key;
          const workMs =
            log?.clockIn && log?.clockOut
              ? log.clockOut.getTime() -
              log.clockIn.getTime() -
              log.breaks.reduce(
                (a, b) =>
                  a + (b.end ? b.end.getTime() - b.start.getTime() : 0),
                0,
              )
              : 0;
          const breakMs =
            log?.breaks.reduce(
              (a, b) => a + (b.end ? b.end.getTime() - b.start.getTime() : 0),
              0,
            ) ?? 0;

          return (
            <div
              key={key}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              style={{
                borderRadius: "0.75rem",
                border: isSelected
                  ? "2px solid var(--accent)"
                  : isToday
                    ? "2px solid var(--accent)"
                    : "1px solid var(--border)",
                background: isSelected
                  ? "var(--bg-hover)"
                  : "var(--bg-primary)",
                padding: isMobile ? "0.4rem 0.2rem" : "0.75rem 0.5rem",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.25rem",
                transition: "all 0.15s",
                minHeight: isMobile ? 72 : 110,
              }}
            >
              <div
                style={{
                  fontSize: isMobile ? "0.55rem" : "0.65rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {d.toLocaleDateString("en-GB", {
                  weekday: isMobile ? "narrow" : "short",
                })}
              </div>
              <div
                style={{
                  width: isMobile ? 22 : 30,
                  height: isMobile ? 22 : 30,
                  borderRadius: "50%",
                  background: isToday ? "var(--accent)" : "transparent",
                  color: isToday ? "var(--accent-text)" : "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: isToday ? 700 : 500,
                  fontSize: isMobile ? "0.72rem" : "0.85rem",
                }}
              >
                {d.getDate()}
              </div>
              {meta && log?.status !== "weekend" && (
                <div
                  style={{
                    fontSize: "0.5rem",
                    fontWeight: 700,
                    color: meta.color,
                    background: meta.bg,
                    borderRadius: "1rem",
                    padding: "0.08rem 0.3rem",
                    textTransform: "uppercase",
                  }}
                >
                  {isMobile
                    ? attendanceLabel(log.status).slice(0, 3)
                    : attendanceLabel(log.status)}
                </div>
              )}
              {!isMobile && workMs > 0 && (
                <div
                  style={{
                    fontSize: "0.62rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {fmtDur(workMs)}
                </div>
              )}
              {!isMobile && breakMs > 0 && (
                <div style={{ fontSize: "0.58rem", color: "#f59e0b" }}>
                  Brk {fmtDur(breakMs)}
                </div>
              )}
              {log?.status === "weekend" && (
                <div
                  style={{ fontSize: "0.5rem", color: "var(--text-secondary)" }}
                >
                  Rest
                </div>
              )}
              {log?.status === "holiday" && !log.clockIn && (
                <div
                  style={{
                    fontSize: "0.5rem",
                    fontWeight: 700,
                    color: STATUS_META.holiday.color,
                  }}
                >
                  Holiday
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <LegendRow />
    </div>
  );
}

// ─── Monthly View ─────────────────────────────────────────────────────────────

function MonthlyView({
  calYear,
  calMonth,
  calCells,
  logs,
  today,
  selectedDay,
  setSelectedDay,
  prevMonth,
  nextMonth,
  isMobile,
}: {
  calYear: number;
  calMonth: number;
  calCells: (number | null)[];
  logs: Record<string, DayLog>;
  today: Date;
  selectedDay: string | null;
  setSelectedDay: (d: string | null) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  isMobile: boolean;
}) {
  return (
    <div style={{ padding: isMobile ? "0.75rem" : "1.25rem 1.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        {!isMobile && (
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "0.6rem",
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={18} style={{ color: "var(--accent-text)" }} />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--text-primary)",
                }}
              >
                Timesheet Calendar
              </div>
              <div
                style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}
              >
                Click a date to view work log
              </div>
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginLeft: isMobile ? "auto" : undefined,
            width: isMobile ? "100%" : undefined,
            justifyContent: isMobile ? "space-between" : undefined,
          }}
        >
          {isMobile && (
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "var(--text-primary)",
              }}
            >
              Timesheet Calendar
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={prevMonth}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "50%",
                width: 30,
                height: 30,
                cursor: "pointer",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "var(--text-primary)",
                minWidth: isMobile ? 90 : 120,
                textAlign: "center",
              }}
            >
              {isMobile
                ? MONTH_NAMES[calMonth].slice(0, 3)
                : MONTH_NAMES[calMonth]}{" "}
              {calYear}
            </span>
            <button
              onClick={nextMonth}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "50%",
                width: 30,
                height: 30,
                cursor: "pointer",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Day labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          marginBottom: "0.25rem",
        }}
      >
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: isMobile ? "0.55rem" : "0.65rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              padding: "0.4rem 0",
              letterSpacing: "0.04em",
            }}
          >
            {isMobile ? d.slice(0, 1) : d}
          </div>
        ))}
      </div>
      <div
        style={{
          borderTop: "1px solid var(--border)",
          marginBottom: "0.25rem",
        }}
      />

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {calCells.map((day, idx) => {
          if (!day)
            return (
              <div
                key={`e-${idx}`}
                style={{
                  minHeight: isMobile ? 44 : 72,
                  borderBottom: "1px solid var(--border)",
                  borderRight:
                    idx % 7 !== 6 ? "1px solid var(--border)" : "none",
                }}
              />
            );
          const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const log = logs[key] ?? null;
          const meta = log ? STATUS_META[log.status] : null;
          const isToday =
            day === today.getDate() &&
            calMonth === today.getMonth() &&
            calYear === today.getFullYear();
          const isSelected = selectedDay === key;
          const isLastCol =
            (mondayOffset(calYear, calMonth) + day - 1) % 7 === 6;
          const workMs =
            log?.clockIn && log?.clockOut
              ? log.clockOut.getTime() -
              log.clockIn.getTime() -
              log.breaks.reduce(
                (a, b) =>
                  a + (b.end ? b.end.getTime() - b.start.getTime() : 0),
                0,
              )
              : 0;

          return (
            <div
              key={key}
              onClick={() =>
                log && log.status !== "weekend"
                  ? setSelectedDay(isSelected ? null : key)
                  : undefined
              }
              style={{
                minHeight: isMobile ? 44 : 72,
                padding: isMobile ? "0.25rem 0.1rem" : "0.4rem 0.3rem",
                borderBottom: "1px solid var(--border)",
                borderRight: isLastCol ? "none" : "1px solid var(--border)",
                background: isSelected
                  ? "var(--bg-hover)"
                  : log?.status === "weekend"
                    ? "var(--bg-hover)"
                    : "transparent",
                cursor: log && log.status !== "weekend" ? "pointer" : "default",
                transition: "background 0.12s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.15rem",
              }}
            >
              <div
                style={{
                  width: isMobile ? 20 : 26,
                  height: isMobile ? 20 : 26,
                  borderRadius: "50%",
                  background: isToday ? "var(--accent)" : "transparent",
                  color: isToday
                    ? "var(--accent-text)"
                    : log?.status === "weekend"
                      ? "var(--text-secondary)"
                      : "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: isToday ? 700 : 400,
                  fontSize: isMobile ? "0.65rem" : "0.78rem",
                  flexShrink: 0,
                }}
              >
                {day}
              </div>

              {meta && log?.status !== "weekend" && (
                <div
                  style={{
                    fontSize: isMobile ? "0.52rem" : "0.58rem",
                    fontWeight: 700,
                    color: meta.color,
                    background: meta.bg,
                    borderRadius: "1rem",
                    padding: isToday ? "0.1rem 0.35rem" : "0.06rem 0.25rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.01em",
                    lineHeight: 1.2,
                    textAlign: "center",
                    maxWidth: "100%",
                  }}
                >
                  {isMobile
                    ? attendanceLabel(log.status).slice(0, 3)
                    : attendanceLabel(log.status)}
                </div>
              )}
              {!isMobile && workMs > 0 && (
                <div
                  style={{
                    fontSize: "0.55rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {fmtDur(workMs)}
                </div>
              )}
              {log?.status === "weekend" && (
                <div
                  style={{
                    fontSize: isMobile ? "0.42rem" : "0.52rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {isMobile ? "—" : "Rest Day"}
                </div>
              )}
              {log?.status === "holiday" && !log.clockIn && (
                <div
                  style={{
                    fontSize: isMobile ? "0.42rem" : "0.52rem",
                    fontWeight: 700,
                    color: STATUS_META.holiday.color,
                  }}
                >
                  {isMobile ? "H" : "Holiday"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <LegendRow />
    </div>
  );
}

function mondayOffset(year: number, month: number) {
  const dow = new Date(year, month, 1).getDay();
  return (dow + 6) % 7;
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────

function DayDetailPanel({
  log,
  dateStr,
  onClose,
}: {
  log: DayLog | null;
  dateStr: string;
  onClose: () => void;
}) {
  const dateObj = new Date(`${dateStr}T00:00:00`);
  const dateLabel = dateObj.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const workMs =
    log?.clockIn && log?.clockOut
      ? log.clockOut.getTime() -
      log.clockIn.getTime() -
      log.breaks.reduce(
        (a, b) => a + (b.end ? b.end.getTime() - b.start.getTime() : 0),
        0,
      )
      : 0;
  const breakMs =
    log?.breaks.reduce(
      (a, b) => a + (b.end ? b.end.getTime() - b.start.getTime() : 0),
      0,
    ) ?? 0;

  return (
    <div className="card" style={{ marginTop: "1rem", padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "1rem",
              color: "var(--text-primary)",
            }}
          >
            {dateLabel}
          </div>
          {log && (
            <div
              style={{
                fontSize: "0.75rem",
                color: STATUS_META[log.status].color,
                fontWeight: 700,
                marginTop: "0.2rem",
              }}
            >
              {attendanceLabel(log.status)}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            display: "flex",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {!log ||
        log.status === "weekend" ||
        log.status === "absent" ||
        log.status === "leave" ||
        log.status === "holiday" ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            padding: "1.5rem 0",
            fontSize: "0.875rem",
          }}
        >
          {!log
            ? "No data available."
            : log.status === "weekend"
              ? "Rest day — no work logged."
              : log.status === "leave"
                ? "On leave this day."
                : log.status === "holiday"
                  ? "Public holiday."
                  : "Absent this day."}
        </div>
      ) : (
        <>
          {/* Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            {[
              {
                label: "Base Work Time",
                value: fmtDur(workMs),
                color: "#10b981",
              },
              {
                label: "Overall Hours",
                value: fmtDur(workMs + breakMs),
                color: "#3b82f6",
              },
              {
                label: "Arrival",
                value: fmtTime(log.clockIn),
                color: "var(--text-primary)",
              },
              {
                label: "Departure",
                value: fmtTime(log.clockOut),
                color: "var(--text-primary)",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "var(--bg-hover)",
                  borderRadius: "0.75rem",
                  padding: "0.75rem 1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-secondary)",
                    marginBottom: "0.2rem",
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Work Sessions */}
          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "0.6rem",
              }}
            >
              Work Sessions
            </div>
            {log.sessions.map((s, i) => {
              const dur = s.end ? s.end.getTime() - s.start.getTime() : 0;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#3b82f6",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                    }}
                  >
                    {fmtTime(s.start)} → {fmtTime(s.end)}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      marginLeft: "auto",
                    }}
                  >
                    {fmtDur(dur)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Breaks */}
          {log.breaks.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "0.6rem",
                }}
              >
                Breaks
              </div>
              {log.breaks.map((b, i) => {
                const dur = b.end ? b.end.getTime() - b.start.getTime() : 0;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#f59e0b",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {fmtTime(b.start)} → {fmtTime(b.end)}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#f59e0b",
                        marginLeft: "auto",
                        fontWeight: 600,
                      }}
                    >
                      {fmtDur(dur)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Work mode badge */}
          {log.mode && (
            <div
              style={{
                marginTop: "1rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "var(--bg-hover)",
                borderRadius: "0.5rem",
                padding: "0.4rem 0.75rem",
                fontSize: "0.78rem",
              }}
            >
              <MapPin size={13} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--text-secondary)" }}>Mode:</span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                {log.mode}
              </span>
            </div>
          )}
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
            }}
          >
            <MapPin size={13} style={{ color: "var(--accent)" }} />
            <span>Location:</span>
            <strong style={{ color: "var(--text-primary)" }}>
              {formatAttendanceLocation(log.location)}
            </strong>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Legend Row ───────────────────────────────────────────────────────────────

function LegendRow() {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        flexWrap: "wrap",
        marginTop: "1rem",
        paddingTop: "0.75rem",
        borderTop: "1px solid var(--border)",
      }}
    >
      {(["onTime", "late", "absent", "holiday"] as DayStatus[]).map((s) => (
        <div
          key={s}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            fontSize: "0.7rem",
            color: "var(--text-secondary)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: STATUS_META[s].color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {attendanceLabel(s)}
        </div>
      ))}
    </div>
  );
}
