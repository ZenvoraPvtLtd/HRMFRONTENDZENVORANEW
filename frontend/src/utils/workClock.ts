export type WorkClockState = {
  userId: string;
  clockedIn: boolean;
  onBreak: boolean;
  currentBreakType: "lunch" | "short1" | "short2" | null;
  clockInTime: Date | null;
  breakStartTime: Date | null;
  breakAccumulatedMs: number;
  lunchAccumulatedMs: number;
  short1AccumulatedMs: number;
  short2AccumulatedMs: number;
  workMode: string;
};

export type LastWorkSession = {
  clockInTime: Date;
  clockOutTime: Date;
  workSeconds: number;
  breakSeconds: number;
  workMode: string;
};

export const WORK_CLOCK_EVENT = "zenvora-work-clock-updated";

export function getWorkClockUserId() {
  return (
    localStorage.getItem("userId") ||
    localStorage.getItem("userEmail") ||
    "employee"
  );
}

export function getWorkClockKeys(userId = getWorkClockUserId()) {
  return {
    clockKey: `clockInTime_${userId}`,
    clockedInKey: `clockedIn_${userId}`,
    onBreakKey: `onBreak_${userId}`,
    breakTypeKey: `breakType_${userId}`,
    breakStartKey: `breakStartTime_${userId}`,
    breakAccumulatedKey: `breakAccumulatedMs_${userId}`,
    lunchAccumulatedKey: `lunchAccumulatedMs_${userId}`,
    short1AccumulatedKey: `short1AccumulatedMs_${userId}`,
    short2AccumulatedKey: `short2AccumulatedMs_${userId}`,
    workModeKey: `workMode_${userId}`,
    lastSessionKey: `lastWorkSession_${userId}`,
  };
}

export function readWorkClock(defaultWorkMode = "Remote (WFH)"): WorkClockState {
  const userId = getWorkClockUserId();
  const {
    clockKey, clockedInKey, onBreakKey, breakTypeKey, breakStartKey,
    breakAccumulatedKey, lunchAccumulatedKey, short1AccumulatedKey,
    short2AccumulatedKey, workModeKey
  } = getWorkClockKeys(userId);
  const storedClockIn = localStorage.getItem(clockKey);
  const storedBreakStart = localStorage.getItem(breakStartKey);
  const storedBreakAccumulated = Number(localStorage.getItem(breakAccumulatedKey) || "0");
  const storedLunchAccumulated = Number(localStorage.getItem(lunchAccumulatedKey) || "0");
  const storedShort1Accumulated = Number(localStorage.getItem(short1AccumulatedKey) || "0");
  const storedShort2Accumulated = Number(localStorage.getItem(short2AccumulatedKey) || "0");
  const clockInTime = storedClockIn ? new Date(storedClockIn) : null;
  const breakStartTime = storedBreakStart ? new Date(storedBreakStart) : null;
  const validClockInTime =
    clockInTime && !Number.isNaN(clockInTime.getTime()) ? clockInTime : null;
  const validBreakStartTime =
    breakStartTime && !Number.isNaN(breakStartTime.getTime()) ? breakStartTime : null;

  return {
    userId,
    clockedIn: localStorage.getItem(clockedInKey) === "true" && Boolean(validClockInTime),
    onBreak: localStorage.getItem(onBreakKey) === "true",
    currentBreakType: localStorage.getItem(breakTypeKey) as "lunch" | "short1" | "short2" | null,
    clockInTime: validClockInTime,
    breakStartTime: validBreakStartTime,
    breakAccumulatedMs: Number.isFinite(storedBreakAccumulated) ? storedBreakAccumulated : 0,
    lunchAccumulatedMs: Number.isFinite(storedLunchAccumulated) ? storedLunchAccumulated : 0,
    short1AccumulatedMs: Number.isFinite(storedShort1Accumulated) ? storedShort1Accumulated : 0,
    short2AccumulatedMs: Number.isFinite(storedShort2Accumulated) ? storedShort2Accumulated : 0,
    workMode: localStorage.getItem(workModeKey) || defaultWorkMode,
  };
}

export function notifyWorkClockChanged() {
  window.dispatchEvent(new Event(WORK_CLOCK_EVENT));
}

export function saveWorkClockIn(workMode = "Remote (WFH)") {
  const now = new Date();
  const {
    clockKey, clockedInKey, onBreakKey, breakTypeKey, breakStartKey,
    breakAccumulatedKey, lunchAccumulatedKey, short1AccumulatedKey,
    short2AccumulatedKey, workModeKey
  } = getWorkClockKeys();
  localStorage.setItem(clockKey, now.toISOString());
  localStorage.setItem(clockedInKey, "true");
  localStorage.setItem(onBreakKey, "false");
  localStorage.removeItem(breakTypeKey);
  localStorage.removeItem(breakStartKey);
  localStorage.setItem(breakAccumulatedKey, "0");
  localStorage.setItem(lunchAccumulatedKey, "0");
  localStorage.setItem(short1AccumulatedKey, "0");
  localStorage.setItem(short2AccumulatedKey, "0");
  localStorage.setItem(workModeKey, workMode);
  notifyWorkClockChanged();
  return now;
}

export function saveWorkClockOut() {
  const clock = readWorkClock();
  const clockOutTime = new Date();
  const {
    clockKey, clockedInKey, onBreakKey, breakTypeKey, breakStartKey,
    breakAccumulatedKey, lunchAccumulatedKey, short1AccumulatedKey,
    short2AccumulatedKey, lastSessionKey
  } = getWorkClockKeys();

  if (clock.clockInTime) {
    const session: LastWorkSession = {
      clockInTime: clock.clockInTime,
      clockOutTime,
      workSeconds: getElapsedWorkSeconds(clock.clockInTime),
      breakSeconds: getElapsedBreakSeconds(clock.workMode),
      workMode: clock.workMode,
    };
    localStorage.setItem(
      lastSessionKey,
      JSON.stringify({
        ...session,
        clockInTime: session.clockInTime.toISOString(),
        clockOutTime: session.clockOutTime.toISOString(),
      }),
    );
  }

  localStorage.removeItem(clockKey);
  localStorage.setItem(clockedInKey, "false");
  localStorage.setItem(onBreakKey, "false");
  localStorage.removeItem(breakTypeKey);
  localStorage.removeItem(breakStartKey);
  localStorage.removeItem(breakAccumulatedKey);
  localStorage.removeItem(lunchAccumulatedKey);
  localStorage.removeItem(short1AccumulatedKey);
  localStorage.removeItem(short2AccumulatedKey);
  notifyWorkClockChanged();
}

export function saveWorkBreakState(onBreak: boolean, breakType?: "lunch" | "short1" | "short2") {
  const {
    onBreakKey,
    breakTypeKey,
    breakStartKey,
    breakAccumulatedKey,
    lunchAccumulatedKey,
    short1AccumulatedKey,
    short2AccumulatedKey,
  } = getWorkClockKeys();
  const currentBreakStart = localStorage.getItem(breakStartKey);
  const currentBreakType = localStorage.getItem(breakTypeKey) as "lunch" | "short1" | "short2" | null;

  localStorage.setItem(onBreakKey, String(onBreak));

  if (onBreak) {
    const activeType = breakType || "lunch";
    localStorage.setItem(breakTypeKey, activeType);
    if (!currentBreakStart) {
      localStorage.setItem(breakStartKey, new Date().toISOString());
    }
  } else {
    const parsedBreakStart = currentBreakStart ? new Date(currentBreakStart) : null;
    if (parsedBreakStart && !Number.isNaN(parsedBreakStart.getTime())) {
      const breakMs = Math.max(0, Date.now() - parsedBreakStart.getTime());

      // Update total accumulated break
      const previousBreakMs = Number(localStorage.getItem(breakAccumulatedKey) || "0");
      const nextBreakMs = Math.max(0, Number.isFinite(previousBreakMs) ? previousBreakMs : 0) + breakMs;
      localStorage.setItem(breakAccumulatedKey, String(nextBreakMs));

      // Update specific break accumulated
      const activeType = breakType || currentBreakType || "lunch";
      if (activeType === "lunch") {
        const prev = Number(localStorage.getItem(lunchAccumulatedKey) || "0");
        localStorage.setItem(lunchAccumulatedKey, String(prev + breakMs));
      } else if (activeType === "short1") {
        const prev = Number(localStorage.getItem(short1AccumulatedKey) || "0");
        localStorage.setItem(short1AccumulatedKey, String(prev + breakMs));
      } else if (activeType === "short2") {
        const prev = Number(localStorage.getItem(short2AccumulatedKey) || "0");
        localStorage.setItem(short2AccumulatedKey, String(prev + breakMs));
      }
    }
    localStorage.removeItem(breakStartKey);
    localStorage.removeItem(breakTypeKey);
  }
  notifyWorkClockChanged();
}

export function getSpecificBreakElapsedMs(type: "lunch" | "short1" | "short2"): number {
  const clock = readWorkClock();
  let accumulated = 0;
  if (type === "lunch") accumulated = clock.lunchAccumulatedMs;
  else if (type === "short1") accumulated = clock.short1AccumulatedMs;
  else if (type === "short2") accumulated = clock.short2AccumulatedMs;

  const isActive = clock.onBreak && clock.currentBreakType === type && clock.breakStartTime;
  const activeMs = isActive ? Math.max(0, Date.now() - clock.breakStartTime!.getTime()) : 0;

  return accumulated + activeMs;
}

export const OFFICE_END_HOUR = 19; // 7:00 PM cutoff for regular hours

/**
 * Calculate overtime seconds worked after the office end hour (7 PM).
 * Break time is subtracted from the total overtime duration.
 */
export function getOvertimeSeconds(clockInTime: Date | null): number {
  if (!clockInTime) return 0;
  const now = Date.now();
  const clock = readWorkClock();
  const activeBreakMs =
    clock.onBreak && clock.breakStartTime
      ? Math.max(0, now - clock.breakStartTime.getTime())
      : 0;
  // Determine cutoff time for the day of clock-in (7:00 PM)
  const cutoff = new Date(clockInTime);
  cutoff.setHours(OFFICE_END_HOUR, 0, 0, 0);
  const overtimeMs = Math.max(0, now - cutoff.getTime() - clock.breakAccumulatedMs - activeBreakMs);
  return Math.max(0, Math.floor(overtimeMs / 1000));
}

/**
 * Regular work seconds (excluding overtime) = total work seconds - overtime seconds.
 */
export function getRegularWorkSeconds(clockInTime: Date | null): number {
  const total = getElapsedWorkSeconds(clockInTime);
  const overtime = getOvertimeSeconds(clockInTime);
  return Math.max(0, total - overtime);
}
  export function getElapsedWorkSeconds(clockInTime: Date | null): number {
  if (!clockInTime) return 0;
  const clock = readWorkClock();
  const activeBreakMs =
    clock.onBreak && clock.breakStartTime
      ? Math.max(0, Date.now() - clock.breakStartTime.getTime())
      : 0;
  const elapsedMs =
    Date.now() - clockInTime.getTime() - clock.breakAccumulatedMs - activeBreakMs;
  return Math.max(0, Math.floor(elapsedMs / 1000));
}


export function getElapsedBreakSeconds(defaultWorkMode = "Remote (WFH)") {
  const clock = readWorkClock(defaultWorkMode);
  const activeBreakMs =
    clock.onBreak && clock.breakStartTime
      ? Math.max(0, Date.now() - clock.breakStartTime.getTime())
      : 0;
  return Math.max(0, Math.floor((clock.breakAccumulatedMs + activeBreakMs) / 1000));
}

export function getLastWorkSession(): LastWorkSession | null {
  try {
    const { lastSessionKey } = getWorkClockKeys();
    const raw = localStorage.getItem(lastSessionKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const clockInTime = new Date(parsed.clockInTime);
    const clockOutTime = new Date(parsed.clockOutTime);
    if (Number.isNaN(clockInTime.getTime()) || Number.isNaN(clockOutTime.getTime())) {
      return null;
    }

    return {
      clockInTime,
      clockOutTime,
      workSeconds: Math.max(0, Number(parsed.workSeconds || 0)),
      breakSeconds: Math.max(0, Number(parsed.breakSeconds || 0)),
      workMode: parsed.workMode || "On-site",
    };
  } catch {
    return null;
  }
}
