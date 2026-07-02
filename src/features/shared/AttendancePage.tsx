import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, QrCode, MapPin, UserCheck, UserPlus, CheckCircle, XCircle, Loader, AlertTriangle } from "lucide-react";
import QRCode from "react-qr-code";

import { getApiBaseUrl, getQrNetworkWarning, getQrFrontendOrigin, OFFICE_FRONTEND_ORIGIN } from "../../config/apiConfig";

// ── Geofence (same values as TimesheetPage) ───────────────────────────────────
const COMPANY_LAT  = 22.749070;
const COMPANY_LNG  = 75.895531;
const COMPANY_LABEL = "Zenvora Pvt Ltd, Indore";
const MAX_DISTANCE_M = 50000;        
const MIN_ACCURACY_M = 500;          

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type GeofenceOk  = { ok: true; lat: number; lng: number; accuracy: number };
type GeofenceFail = { ok: false; msg: string; distance?: number };
type GeofenceResult = GeofenceOk | GeofenceFail;

function runGeofenceCheck(): Promise<GeofenceResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, msg: "Geolocation is not supported by this browser." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > MIN_ACCURACY_M) {
          resolve({ ok: false, msg: `GPS accuracy too low (${Math.round(accuracy)} m). Move to an open area and retry.` });
          return;
        }
        const dist = haversineM(latitude, longitude, COMPANY_LAT, COMPANY_LNG);
        if (dist <= MAX_DISTANCE_M) {
          resolve({ ok: true, lat: latitude, lng: longitude, accuracy });
        } else {
          resolve({
            ok: false,
            msg: `You are ${Math.round(dist)} m away from ${COMPANY_LABEL}. Face check-in is only allowed within ${MAX_DISTANCE_M} m of the office.`,
            distance: Math.round(dist),
          });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED)
          resolve({ ok: false, msg: "Location permission is required for face check-in." });
        else if (err.code === err.POSITION_UNAVAILABLE)
          resolve({ ok: false, msg: "Please enable location services before checking in." });
        else
          resolve({ ok: false, msg: "Unable to fetch your current location. Please retry." });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

const API = getApiBaseUrl();
const QR_REFRESH_SECONDS = 30;

type Tab = "register" | "face" | "qr";
type Status = "idle" | "loading" | "success" | "error";

function getErrorMessage(error: unknown, fallback = "Error") {
  return error instanceof Error ? error.message : fallback;
}

function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    let activeStream: MediaStream | null = null;

    if (!active) {
      Promise.resolve().then(() => setStream(null));
      return;
    }

    // Clear any previous camera error on the next microtask instead of synchronously.
    Promise.resolve().then(() => setCameraError(null));
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then((s) => {
        if (!isCurrent) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = s;
        setStream(s);
      })
      .catch((error) => {
        if (isCurrent) {
          setCameraError(error instanceof Error ? error.message : "Camera is not available");
        }
      });

    return () => {
      isCurrent = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [active]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const waitForFrame = (video: HTMLVideoElement): Promise<void> =>
    new Promise((resolve, reject) => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }

      const timeout = window.setTimeout(() => {
        reject(new Error("Camera is still loading. Please try again in a moment."));
      }, 2500);

      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        video.play().catch(() => undefined);
        resolve();
      };
    });

  const capture = async (): Promise<File> => {
    const video = videoRef.current;
    if (!video) throw new Error("No video");

    await waitForFrame(video);

    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return reject("Capture failed");
        resolve(new File([blob], "face.jpg", { type: "image/jpeg" }));
      }, "image/jpeg");
    });
  };

  return { videoRef, capture, cameraError };
}

function useGeolocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeoError(err.message)
    );
  }, []);

  return { coords, geoError };
}

export const FACE_AUTO_CLOCK_IN_EVENT  = "face-auto-clock-in";
export const FACE_AUTO_CLOCK_OUT_EVENT = "face-auto-clock-out";

export default function AttendancePage() {
  const [tab, setTab] = useState<Tab>("register");

  return (
    <div style={{ padding: "1.5rem 0 0 0" }}>
      {/* Tabs */}
      <div style={{
        display: "flex", gap: "0.375rem", marginBottom: "1.75rem",
        background: "var(--bg-secondary)", padding: "0.3rem",
        borderRadius: "0.875rem", border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        {([
          { key: "register", label: "Register Face", icon: <UserPlus size={15} /> },
          { key: "face",     label: "Face Check-In", icon: <Camera size={15} /> },
          { key: "qr",       label: "QR Check-In",   icon: <QrCode size={15} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem",
              padding: "0.65rem 0.5rem", borderRadius: "0.6rem", border: "none", cursor: "pointer",
              fontSize: "0.82rem", fontWeight: 600,
              background: tab === key ? "var(--accent)" : "transparent",
              color: tab === key ? "var(--accent-text, #fff)" : "var(--text-secondary)",
              boxShadow: tab === key ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
              transition: "all 0.18s ease",
            }}
          >
            {icon} <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === "register" && <FaceRegister />}
      {tab === "face"     && <FaceAttendance />}
      {tab === "qr"       && <QRAttendance />}
    </div>
  );
}

// ── Face Registration ─────────────────────────────────────────────────────────

function FaceRegister() {
  const [active, setActive] = useState(false);
  const { videoRef, capture, cameraError } = useCamera(active);
  const { coords, geoError } = useGeolocation();
  const [form, setForm] = useState({
    employee_id: localStorage.getItem("employeeId") || "",
    employee_name:
      localStorage.getItem("userName") ||
      localStorage.getItem("hr_userName") ||
      localStorage.getItem("candidate_userName") ||
      "",
    department: "",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");

  // Whether this employee already has a face registered
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [checkingRegistered, setCheckingRegistered] = useState(false);
  // Guard against double-submit
  const submittingRef = useRef(false);

  const checkRegistrationStatus = useCallback(async (empId: string) => {
    setCheckingRegistered(true);
    try {
      const res = await fetch(`${API}/check_face_registration?employee_id=${encodeURIComponent(empId)}`);
      if (res.ok) {
        const data = await res.json();
        setAlreadyRegistered(!!data.registered);
      } else {
        // Endpoint may not exist — fall back to allowing registration
        setAlreadyRegistered(false);
      }
    } catch {
      setAlreadyRegistered(false);
    } finally {
      setCheckingRegistered(false);
    }
  }, []);

  // Fetch current user profile & check registration status
  useEffect(() => {
    const authToken = localStorage.getItem("accessToken") || localStorage.getItem("hr_accessToken") || "";
    if (!authToken) return;

    fetch(`${API}/api/profile/me`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const user = data?.user;
        if (!user) return;

        const freshId = user.employeeId ? String(user.employeeId).trim() : "";
        const freshName = user.name || user.fullName || "";
        const freshDept = user.department || "";

        setForm((current) => {
          const updatedEmployeeId = freshId || current.employee_id;
          const updated = {
            ...current,
            employee_id: updatedEmployeeId,
            employee_name: freshName || current.employee_name,
            department: freshDept || current.department,
          };

          if (updatedEmployeeId) {
            checkRegistrationStatus(updatedEmployeeId);
          }

          return updated;
        });
      })
      .catch(() => undefined);
  }, [checkRegistrationStatus]);

  // Re-check whenever employee_id field changes
  useEffect(() => {
    const empId = form.employee_id.trim();
    if (empId) {
      const timer = setTimeout(() => checkRegistrationStatus(empId), 500);
      return () => clearTimeout(timer);
    }
  }, [form.employee_id, checkRegistrationStatus]);

  const handleSubmit = async () => {
    if (submittingRef.current) return;   // block double-click
    if (alreadyRegistered) {
      setStatus("error");
      setMsg("Face is already registered for this employee. Use the update option if you need to change it.");
      return;
    }

    const employeeId = form.employee_id.trim();
    const employeeName = form.employee_name.trim();
    const department = form.department.trim();

    if (!employeeId || !employeeName || !department) {
      setStatus("error"); setMsg("Please fill all fields"); return;
    }
    if (!active) {
      setStatus("error"); setMsg("Please start camera first"); return;
    }

    submittingRef.current = true;
    setStatus("loading");
    try {
      const file = await capture();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("employee_id", employeeId);
      fd.append("employee_name", employeeName);
      fd.append("department", department);
      const res = await fetch(`${API}/register_face`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMsg(
          data.message === "Face Updated Successfully"
            ? "Face updated successfully!"
            : "Face registered successfully!",
        );
        setAlreadyRegistered(true); 
        setActive(false);
      } else {
        setStatus("error"); setMsg(data.message || "Registration failed");
      }
    } catch (error: unknown) {
      setStatus("error"); setMsg(getErrorMessage(error));
    } finally {
      submittingRef.current = false;
    }
  };

  const isSubmitDisabled =
    status === "loading" ||
    checkingRegistered ||
    alreadyRegistered;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {alreadyRegistered && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.6rem",
          padding: "0.75rem 1rem", borderRadius: "0.75rem",
          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
          fontSize: "0.85rem", fontWeight: 600, color: "#10b981",
        }}>
          <CheckCircle size={16} />
          Face already registered for this employee.
          <button
            onClick={() => { setAlreadyRegistered(false); setStatus("idle"); setMsg(""); }}
            style={{
              marginLeft: "auto", fontSize: "0.78rem", fontWeight: 600,
              background: "transparent", border: "1px solid #10b981",
              color: "#10b981", borderRadius: "0.4rem", padding: "0.2rem 0.6rem", cursor: "pointer",
            }}
          >
            Update face
          </button>
        </div>
      )}

      <div style={{ background: "var(--bg-secondary)", borderRadius: "0.875rem", border: "1px solid var(--border)", padding: "1.25rem 1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.01em" }}>Employee Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
          {/* Employee ID */}
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Employee ID</label>
            <input
              value={form.employee_id}
              onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
              placeholder="EMP001"
              style={{ width: "100%", padding: "0.65rem 0.875rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>
          {/* Full Name */}
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Full Name</label>
            <input
              value={form.employee_name}
              onChange={(e) => setForm((f) => ({ ...f, employee_name: e.target.value }))}
              placeholder="John Doe"
              style={{ width: "100%", padding: "0.65rem 0.875rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>
          {/* Department — editable dropdown */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Department</label>
            <select
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              style={{ width: "100%", padding: "0.65rem 0.875rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: form.department ? "var(--text-primary)" : "var(--text-secondary)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", cursor: "pointer" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <option value="" disabled>Select department…</option>
              {["IT", "BPO", "Engineering", "Manager", "Admin", "HR", "Finance", "Sales", "Marketing", "Operations"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Camera */}
      <div style={{ background: "var(--bg-secondary)", borderRadius: "0.875rem", border: "1px solid var(--border)", padding: "1.25rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.01em" }}>Face Capture</h3>
          <button
            onClick={() => setActive(!active)}
            style={{ padding: "0.45rem 1rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, background: active ? "#ef4444" : "var(--accent)", color: active ? "#fff" : "var(--accent-text, #fff)", transition: "all 0.15s" }}
          >
            {active ? "Stop Camera" : "Start Camera"}
          </button>
        </div>
        <div style={{ position: "relative", borderRadius: "0.75rem", overflow: "hidden", background: "#000", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {active ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
          ) : (
            <div style={{ color: "#666", fontSize: "0.85rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <Camera size={40} opacity={0.4} />
              <span>Click "Start Camera" to begin</span>
            </div>
          )}
          {active && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ width: 180, height: 220, border: "2px dashed rgba(255,255,255,0.6)", borderRadius: "50%", boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)" }} />
            </div>
          )}
        </div>

        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          <MapPin size={13} style={{ color: coords ? "#10b981" : "#f59e0b" }} />
          {coords ? `Location: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : geoError ? `Location: ${geoError}` : "Getting location..."}
        </div>
      </div>

      {cameraError && (
        <StatusBanner status="error" msg={cameraError} onClose={() => setActive(false)} />
      )}
      {status !== "idle" && (
        <StatusBanner status={status} msg={msg} onClose={() => { setStatus("idle"); setMsg(""); }} />
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        title={alreadyRegistered ? "Face already registered — click 'Update face' above to re-register" : undefined}
        style={{
          padding: "0.875rem", borderRadius: "0.75rem", border: "none",
          background: isSubmitDisabled ? "var(--bg-secondary)" : "var(--accent)",
          color: isSubmitDisabled ? "var(--text-secondary)" : "var(--accent-text)",
          fontSize: "0.95rem", fontWeight: 700,
          cursor: isSubmitDisabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          opacity: isSubmitDisabled ? 0.6 : 1,
          transition: "all 0.15s",
        }}
      >
        {status === "loading" ? (
          <Loader size={18} className="spin" />
        ) : checkingRegistered ? (
          <Loader size={18} />
        ) : alreadyRegistered ? (
          <CheckCircle size={18} />
        ) : (
          <UserCheck size={18} />
        )}
        {status === "loading"
          ? "Registering…"
          : checkingRegistered
          ? "Checking…"
          : alreadyRegistered
          ? "Already Registered"
          : "Register Face"}
      </button>
    </div>
  );
}

// ── Face Attendance ───────────────────────────────────────────────────────────

function FaceAttendance() {
  const [active, setActive] = useState(false);
  const { videoRef, capture, cameraError } = useCamera(active);
  const { coords, geoError } = useGeolocation();
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");
  const [employee, setEmployee] = useState<{ name: string; id: string } | null>(null);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);
  const [geofenceLoading, setGeofenceLoading] = useState(false);

  const locationReady = !!coords;

  const locationLabel = coords
    ? COMPANY_LABEL
    : geoError
    ? `Location error: ${geoError}`
    : "Getting location…";

  const handleMark = async () => {
    if (!active) { setStatus("error"); setMsg("Please start the camera first."); return; }

    setGeofenceError(null);
    setGeofenceLoading(true);
    setStatus("idle");
    const geo = await runGeofenceCheck();
    setGeofenceLoading(false);

    if (geo.ok === false) {
      setGeofenceError(geo.msg);
      return;
    }

    setStatus("loading");
    try {
      const file = await capture();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("latitude",  String(geo.lat));
      fd.append("longitude", String(geo.lng));

      // Send logged-in employee ID so backend can validate the face match
      const loggedInEmployeeId =
        localStorage.getItem("employeeId") ||
        localStorage.getItem("hr_userEmail") ||
        localStorage.getItem("userEmail") ||
        "";
      if (loggedInEmployeeId) {
        fd.append("expected_employee_id", loggedInEmployeeId);
      }

      const res = await fetch(`${API}/mark_attendance`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMsg(data.message || "Attendance marked!");
        setEmployee({ name: data.employee_name, id: data.employee_id || "" });
        setActive(false);

        const isCheckOut = (data.message || "").toLowerCase().includes("check-out");
        const locationPayload = { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy, label: COMPANY_LABEL };

        if (isCheckOut) {
          window.dispatchEvent(
            new CustomEvent(FACE_AUTO_CLOCK_OUT_EVENT, {
              detail: { employeeName: data.employee_name, employeeId: data.employee_id, location: locationPayload },
            })
          );
        } else {
          window.dispatchEvent(
            new CustomEvent(FACE_AUTO_CLOCK_IN_EVENT, {
              detail: { employeeName: data.employee_name, employeeId: data.employee_id, location: locationPayload },
            })
          );
        }
      } else {
        setStatus("error");
        // If backend recognized a face but it didn't match logged-in user, show helpful message
        const hint = data.matched_employee ? ` (Recognized: ${data.matched_employee})` : "";
        setMsg((data.message || "Face not recognized") + hint);
      }
    } catch (error: unknown) {
      setStatus("error"); setMsg(getErrorMessage(error));
    }
  };

  const markDisabled = geofenceLoading || status === "loading";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{
        padding: "0.6rem 0.75rem", borderRadius: "0.5rem",
        background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
        display: "flex", alignItems: "flex-start", gap: "0.5rem",
        fontSize: "0.78rem", color: "var(--text-secondary)",
      }}>
        <MapPin size={14} style={{ color: "#3b82f6", flexShrink: 0, marginTop: "0.1rem" }} />
        <span>
          Face check-in requires <strong style={{ color: "var(--text-primary)" }}>live GPS location</strong>.
          You must be within <strong style={{ color: "var(--text-primary)" }}>{MAX_DISTANCE_M} m</strong> of{" "}
          <strong style={{ color: "var(--text-primary)" }}>{COMPANY_LABEL}</strong>.
        </span>
      </div>

      {!locationReady && (
        <div style={{
          padding: "0.7rem 1rem", borderRadius: "0.65rem",
          background: geoError ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
          border: `1px solid ${geoError ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.35)"}`,
          fontSize: "0.8rem", fontWeight: 600,
          color: geoError ? "#ef4444" : "#f59e0b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <MapPin size={14} style={{ flexShrink: 0 }} />
            <span>
              {geoError
                ? `Location access denied. Allow location permission and reload.`
                : "Waiting for GPS location… check-in will be verified once location is ready."}
            </span>
          </div>
          {geoError && (
            <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", paddingLeft: "1.4rem" }}>
              <button
                onClick={() => {
                  window.open(
                    `chrome://settings/content/siteDetails?site=${encodeURIComponent(window.location.origin)}`,
                    "_blank"
                  );
                }}
                style={{
                  padding: "0.3rem 0.7rem", borderRadius: "0.4rem",
                  border: "1px solid #ef4444", background: "transparent",
                  color: "#ef4444", cursor: "pointer",
                  fontSize: "0.75rem", fontWeight: 600,
                }}
              >
                Open Browser Settings
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "0.3rem 0.7rem", borderRadius: "0.4rem",
                  border: "1px solid #ef4444", background: "#ef4444",
                  color: "#fff", cursor: "pointer",
                  fontSize: "0.75rem", fontWeight: 600,
                }}
              >
                Reload Page
              </button>
            </div>
          )}
        </div>
      )}

      {geofenceError && (
        <div style={{
          padding: "0.75rem", borderRadius: "0.5rem",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
          fontSize: "0.8rem", color: "#ef4444",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
            <span>{geofenceError}</span>
          </div>
          {geofenceError.toLowerCase().includes("permission") ? (
            <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={() => window.open(`chrome://settings/content/siteDetails?site=${encodeURIComponent(window.location.origin)}`, "_blank")}
                style={{ padding: "0.3rem 0.7rem", borderRadius: "0.4rem", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}
              >
                Open Browser Settings
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: "0.3rem 0.7rem", borderRadius: "0.4rem", border: "1px solid #ef4444", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}
              >
                Reload Page
              </button>
            </div>
          ) : (
            <div style={{ marginTop: "0.6rem" }}>
              <button
                onClick={() => { setGeofenceError(null); handleMark(); }}
                disabled={markDisabled}
                style={{ padding: "0.3rem 0.7rem", borderRadius: "0.4rem", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ background: "var(--bg-secondary)", borderRadius: "0.875rem", border: "1px solid var(--border)", padding: "1.25rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.01em" }}>Face Verification</h3>
          <button
            onClick={() => setActive(!active)}
            style={{ padding: "0.45rem 1rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, background: active ? "#ef4444" : "var(--accent)", color: active ? "#fff" : "var(--accent-text, #fff)", transition: "all 0.15s" }}
          >
            {active ? "Stop" : "Start Camera"}
          </button>
        </div>

        <div style={{ position: "relative", borderRadius: "0.75rem", overflow: "hidden", background: "#000", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {active ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
          ) : (
            <div style={{ color: "#666", fontSize: "0.85rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <Camera size={40} opacity={0.4} />
              <span>Click "Start Camera"</span>
            </div>
          )}
          {active && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ width: 180, height: 220, border: "2px solid rgba(99,230,190,0.8)", borderRadius: "50%", boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)" }} />
            </div>
          )}
        </div>

        {/* Location row */}
        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem" }}>
          <MapPin size={13} style={{ color: locationReady ? "#10b981" : geoError ? "#ef4444" : "#f59e0b", flexShrink: 0 }} />
          <span style={{ color: locationReady ? "#10b981" : geoError ? "#ef4444" : "var(--text-secondary)", fontWeight: locationReady ? 600 : 500 }}>
            {locationLabel}
          </span>
        </div>
      </div>

      {cameraError && <StatusBanner status="error" msg={cameraError} onClose={() => setActive(false)} />}
      {status !== "idle" && <StatusBanner status={status} msg={msg} onClose={() => { setStatus("idle"); setMsg(""); setEmployee(null); }} />}

      {employee && status === "success" && (
        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "0.75rem", padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", fontWeight: 700, fontSize: "1.1rem" }}>
            {employee.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{employee.name}</div>
            <div style={{ fontSize: "0.78rem", color: "#10b981" }}>Attendance marked successfully</div>
            {coords && (
              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)", marginTop: "0.2rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <MapPin size={11} />
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleMark}
        disabled={markDisabled}
        title={
          geofenceLoading ? "Checking your location…" :
          !locationReady ? "Waiting for location" : undefined
        }
        style={{
          padding: "0.875rem", borderRadius: "0.75rem", border: "none",
          background: markDisabled ? "var(--bg-secondary)" : "var(--accent)",
          color: markDisabled ? "var(--text-secondary)" : "var(--accent-text)",
          fontSize: "0.95rem", fontWeight: 700,
          cursor: markDisabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          opacity: markDisabled ? 0.65 : 1,
          transition: "all 0.15s",
        }}
      >
        {geofenceLoading ? <><Loader size={18} className="spin" /> Checking Location…</> :
         status === "loading" ? <><Loader size={18} className="spin" /> Marking…</> :
         <><Camera size={18} /> Mark Attendance</>}
      </button>
    </div>
  );
}

// ── QR Attendance ─────────────────────────────────────────────────────────────

function QRAttendance() {
  const [token, setToken] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const tokenSecondsLeftRef = useRef(0);
  const qrRefreshBusyRef = useRef(false);
  const { coords } = useGeolocation();

  useEffect(() => {
    const authToken = localStorage.getItem("accessToken") || localStorage.getItem("hr_accessToken") || "";
    if (!authToken) return;

    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const user = data?.user;
        if (!user) return;

        const role = String(user.role || "").toLowerCase();
        const isHrOrAdmin = role === "hr" || role === "admin";
        if (isHrOrAdmin) {
          setEmployeeId("");
          setEmployeeName("");
          return;
        }

        if (user.employeeId) {
          const freshEmployeeId = String(user.employeeId).trim();
          localStorage.setItem("employeeId", freshEmployeeId);
          setEmployeeId(freshEmployeeId);
        }

        const freshName = user.name || user.fullName;
        if (freshName) {
          localStorage.setItem("userName", freshName);
          setEmployeeName(freshName);
        }
      })
      .catch(() => undefined);
  }, []);

  const fetchQR = useCallback(async (silent = false) => {
    if (qrRefreshBusyRef.current) return;
    if (!silent && isGenerating) return;

    qrRefreshBusyRef.current = true;
    if (!silent) {
      setIsGenerating(true);
      setGenerateSuccess(false);
      setStatus("idle");
      setMsg("");
    }

    try {
      const authToken = localStorage.getItem("hr_accessToken") || localStorage.getItem("accessToken") || "";
      const res = await fetch(`${API}/generate_qr`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error("Unable to generate QR token");
      const data = await res.json();
      if (!data.token) throw new Error("QR token missing");

      setQrToken(data.token);
      setToken(data.token);
      const origin = OFFICE_FRONTEND_ORIGIN || getQrFrontendOrigin();
      setQrLink(`${origin}/qr-attendance?token=${data.token}`);
      tokenSecondsLeftRef.current = Number(data.expiresIn) > 0 ? Number(data.expiresIn) : QR_REFRESH_SECONDS;
      setQrSessionActive(true);

      if (!silent) {
        setGenerateSuccess(true);
        setTimeout(() => setGenerateSuccess(false), 2500);
      }
    } catch {
      setQrToken(null);
      setQrLink(null);
      tokenSecondsLeftRef.current = 0;
      setQrSessionActive(false);
      setStatus("idle");
      setMsg("");
    } finally {
      qrRefreshBusyRef.current = false;
      if (!silent) setIsGenerating(false);
    }
  }, [isGenerating]);

  // No auto-refresh — token is valid for the full day

  const handleQRAttendance = async () => {
    const cleanToken = token.trim();
    const cleanEmployeeId = employeeId.trim();
    const cleanEmployeeName = employeeName.trim();
    if (!cleanToken || !cleanEmployeeId || !cleanEmployeeName) {
      setStatus("error"); setMsg("Please fill all fields"); return;
    }
    setStatus("loading");
    try {
      const fd = new FormData();
      fd.append("employee_id", cleanEmployeeId);
      fd.append("employee_name", cleanEmployeeName);
      fd.append("token", cleanToken);
      const res = await fetch(`${API}/qr_attendance`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) { setStatus("success"); setMsg(data.message || "Attendance marked!"); }
      else { setStatus("error"); setMsg(data.message || "Invalid QR token"); }
    } catch (error: unknown) {
      setStatus("error"); setMsg(getErrorMessage(error, "Unable to mark attendance."));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* QR Generator (HR/Admin) */}
      <div style={{ background: "var(--bg-secondary)", borderRadius: "0.875rem", border: "1px solid var(--border)", padding: "1.25rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.01em" }}>QR Token (HR/Admin)</h3>
          <button
            onClick={() => void fetchQR()}
            disabled={isGenerating}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "0.5rem",
              border: "none",
              cursor: isGenerating ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              background: generateSuccess ? "#10b981" : "var(--accent)",
              color: "var(--accent-text)",
              opacity: isGenerating ? 0.85 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "background 0.2s ease, opacity 0.2s ease",
              minWidth: 118,
              justifyContent: "center",
            }}
          >
            {isGenerating ? <Loader size={14} className="animate-spin" /> : generateSuccess ? <CheckCircle size={14} /> : <QrCode size={14} />}
            {isGenerating ? "Generating..." : generateSuccess ? "Generated!" : "Generate QR"}
          </button>
        </div>
        {isGenerating ? (
          <div style={{ background: "var(--bg-primary)", borderRadius: "0.75rem", padding: "2rem 1rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <Loader size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 600 }}>Generating QR token...</div>
          </div>
        ) : qrToken ? (
          <div style={{ background: "var(--bg-primary)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
            {qrLink && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.9rem" }}>
                <QRCodeBox value={qrLink} />
              </div>
            )}
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Valid for today — employees scan with phone camera to mark attendance
            </div>
            {getQrNetworkWarning() && (
              <div style={{ marginTop: "0.6rem", fontSize: "0.72rem", color: "#f59e0b", background: "rgba(245,158,11,0.1)", borderRadius: "0.5rem", padding: "0.4rem 0.7rem" }}>
                ⚠️ {getQrNetworkWarning()}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center", padding: "1rem 0" }}>Click &quot;Generate QR&quot; to get token</div>
        )}
      </div>

      {/* Employee QR Input */}
      <div style={{ background: "var(--bg-secondary)", borderRadius: "0.875rem", border: "1px solid var(--border)", padding: "1.25rem 1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.01em" }}>Mark Attendance with QR</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {[
            { key: "employeeId", label: "Employee ID", value: employeeId, set: setEmployeeId, placeholder: "EMP001" },
            { key: "employeeName", label: "Employee Name", value: employeeName, set: setEmployeeName, placeholder: "John Doe" },
            { key: "token", label: "QR Token", value: token, set: setToken, placeholder: "Enter token shown on screen" },
          ].map(({ key, label, value, set, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                style={{ width: "100%", padding: "0.65rem 0.875rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          <MapPin size={13} style={{ color: coords ? "#10b981" : "#f59e0b" }} />
          {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Getting location..."}
        </div>
      </div>

      {status !== "idle" && <StatusBanner status={status} msg={msg} onClose={() => { setStatus("idle"); setMsg(""); }} />}

      <button
        onClick={handleQRAttendance}
        disabled={status === "loading"}
        style={{ padding: "0.875rem", borderRadius: "0.75rem", border: "none", background: "var(--accent)", color: "var(--accent-text)", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
      >
        {status === "loading" ? <Loader size={18} /> : <QrCode size={18} />}
        Mark QR Attendance
      </button>
    </div>
  );
}

function QRCodeBox({ value }: { value: string }) {
  return (
    <div
      role="img"
      aria-label="Attendance QR code"
      style={{
        width: 220,
        maxWidth: "100%",
        background: "#fff",
        borderRadius: "0.5rem",
        padding: "1rem",
        display: "block",
        boxShadow: "0 0 0 1px rgba(15,23,42,0.08)",
      }}
    >
      <QRCode value={value} size={220} level="H" bgColor="#ffffff" fgColor="#000000" style={{ width: "100%", height: "auto", display: "block" }} />
    </div>
  );
}

// ── Status Banner ─────────────────────────────────────────────────────────────

function StatusBanner({ status, msg, onClose }: { status: Status; msg: string; onClose: () => void }) {
  const isSuccess = status === "success";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", borderRadius: "0.75rem", background: isSuccess ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${isSuccess ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}` }}>
      {isSuccess ? <CheckCircle size={18} style={{ color: "#10b981", flexShrink: 0 }} /> : <XCircle size={18} style={{ color: "#ef4444", flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 600 }}>{msg}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 0 }}>✕</button>
    </div>
  );
}
function setQrSessionActive(active: boolean) {
  if (typeof window === "undefined") return;

  try {
    const storageKey = "qrSessionActive";
    if (active) {
      window.sessionStorage.setItem(storageKey, "true");
    } else {
      window.sessionStorage.removeItem(storageKey);
    }

    window.dispatchEvent(
      new CustomEvent("qr-session-active", { detail: { active } }),
    );
  } catch (error) {
    console.error("Unable to update QR session state", error);
  }
}

