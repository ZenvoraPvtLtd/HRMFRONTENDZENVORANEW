import { useEffect, useState } from "react";
import { CheckCircle, Loader, QrCode, XCircle } from "lucide-react";

// Use relative paths to leverage Vite proxy, bypassing port 8000 firewall on phones
const API_PREFIX = "/api";
const QR_API = "/attendance/qr_attendance";

type Status = "idle" | "loading" | "success" | "error";

function getErrorMessage(error: unknown, fallback = "Unable to mark attendance.") {
  return error instanceof Error ? error.message : fallback;
}

function readScannedToken() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
  return (
    params.get("token") ||
    params.get("t") ||
    hashParams.get("token") ||
    hashParams.get("t") ||
    ""
  ).trim();
}

export default function QrAttendanceScanPage() {
  const [token, setToken] = useState(() => readScannedToken());
  const [employeeId, setEmployeeId] = useState(() => localStorage.getItem("employeeId") || "");
  const [employeeName, setEmployeeName] = useState(() => localStorage.getItem("userName") || "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const authToken =
      localStorage.getItem("accessToken") ||
      localStorage.getItem("hr_accessToken") ||
      localStorage.getItem("candidate_accessToken") ||
      "";

    if (!authToken) return;

    fetch(`${API_PREFIX}/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const user = data?.user;
        if (!user) return;

        const role = String(user.role || "").toLowerCase();
        if (role === "hr" || role === "admin") return;

        if (user.employeeId) {
          setEmployeeId(String(user.employeeId).trim());
        }
        const name = user.name || user.fullName;
        if (name) setEmployeeName(String(name).trim());
      })
      .catch(() => undefined);
  }, []);

  const markAttendance = async () => {
    const cleanToken = token.trim();
    const cleanEmployeeId = employeeId.trim();
    const cleanEmployeeName = employeeName.trim();

    if (!cleanToken) {
      setStatus("error");
      setMessage("QR token missing. Please scan the latest QR again.");
      return;
    }

    if (!cleanEmployeeId || !cleanEmployeeName) {
      setStatus("error");
      setMessage("Please enter employee ID and name.");
      return;
    }

    setStatus("loading");
    setMessage("Connecting to server...");
    try {
      const fd = new FormData();
      fd.append("employee_id", cleanEmployeeId);
      fd.append("employee_name", cleanEmployeeName);
      fd.append("token", cleanToken);

      const response = await fetch(QR_API, { method: "POST", body: fd });

      let data: Record<string, unknown> = {};
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server error (${response.status})`);
      }

      if (data.success) {
        localStorage.setItem("employeeId", cleanEmployeeId);
        localStorage.setItem("userName", cleanEmployeeName);
        setStatus("success");
        setMessage(String(data.message || "Attendance marked successfully."));
        return;
      }

      setStatus("error");
      setMessage(String(data.message || data.detail || "Invalid or expired QR token."));
    } catch (error: unknown) {
      setStatus("error");
      const msg = getErrorMessage(error, "Unable to reach server.");
      // Show proxy path so HR knows it is going through proxy
      setMessage(`${msg} (Proxy used)`);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem", background: "#f6f7fb" }}>
      <section style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem", boxShadow: "0 12px 30px rgba(15,23,42,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1rem" }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, display: "grid", placeItems: "center", background: "#eef2ff", color: "#4f46e5" }}>
            <QrCode size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, color: "#111827", fontSize: "1.15rem", fontWeight: 800 }}>QR Attendance</h1>
            <p style={{ margin: "0.15rem 0 0", color: "#6b7280", fontSize: "0.82rem" }}>Mark attendance using scanned token</p>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.8rem" }}>
          <Field label="Employee ID" value={employeeId} onChange={setEmployeeId} placeholder="EMP001" autoComplete="username" />
          <Field label="Employee Name" value={employeeName} onChange={setEmployeeName} placeholder="Full name" autoComplete="name" />
          <Field label="QR Token" value={token} onChange={setToken} placeholder="Scanned token" autoComplete="off" readOnly={Boolean(readScannedToken())} />
        </div>

        {status !== "idle" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginTop: "1rem", padding: "0.75rem", borderRadius: 8, background: status === "success" ? "#ecfdf5" : status === "loading" ? "#eff6ff" : "#fef2f2", color: status === "success" ? "#047857" : status === "loading" ? "#1d4ed8" : "#b91c1c", fontSize: "0.86rem", fontWeight: 700 }}>
            {status === "success" ? <CheckCircle size={18} /> : status === "loading" ? <Loader size={18} /> : <XCircle size={18} />}
            <span>{message || "Please wait..."}</span>
          </div>
        )}

        <button
          onClick={markAttendance}
          disabled={status === "loading"}
          style={{ width: "100%", marginTop: "1rem", border: "none", borderRadius: 8, padding: "0.85rem 1rem", background: "#111827", color: "#fff", fontWeight: 800, cursor: status === "loading" ? "not-allowed" : "pointer" }}
        >
          {status === "loading" ? "Marking..." : "Mark Attendance"}
        </button>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  readOnly?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: "0.3rem", color: "#374151", fontSize: "0.78rem", fontWeight: 700 }}>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        readOnly={readOnly}
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "0.72rem 0.8rem", color: "#111827", fontSize: "0.92rem", outline: "none" }}
      />
    </label>
  );
}
