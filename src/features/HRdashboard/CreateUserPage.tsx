import { useState, useEffect } from "react";
import {
  UserPlus,
  Mail,
  Phone,
  User,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
  Users,
  Shield,
} from "lucide-react";
import {
  hrPageWrap,
  card,
  cardInner,
  textPrimary,
  textSecondary,
  btnPrimary,
  btnSecondary,
  tableHead,
  rowHover,
  getStatusStyle,
} from "./hrTheme";
import { useTheme } from "../../context/ThemeContext";
import { getApiBaseUrl } from "../../config/apiConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CreatedUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  employeeId: string;
  createdAt: string;
  emailSent: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generatePassword(length = 12): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  let pwd =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

const DEPARTMENTS = [
  "General",
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
  "Finance",
  "HR",
  "Operations",
  "Product",
  "Legal",
  "Customer Support",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CreateUserPage() {
  const { isDark } = useTheme();

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"employee" | "manager">("employee");
  const [department, setDepartment] = useState("General");
  const [password, setPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    employeeId: string;
    email: string;
    password: string;
    role: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Recent users list
  const [recentUsers, setRecentUsers] = useState<CreatedUser[]>([]);

  // Load recent users from localStorage session storage
  useEffect(() => {
    const stored = sessionStorage.getItem("hr_created_users");
    if (stored) setRecentUsers(JSON.parse(stored));
  }, []);

  const handleAutoGenerate = () => {
    const pwd = generatePassword();
    setPassword(pwd);
  };

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);

    if (!fullName.trim()) return setError("Full name is required.");
    if (!email.trim()) return setError("Email is required.");

    // Strict email format validation
    const emailRegex = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(email.trim())) {
      return setError("Please enter a valid email address (e.g. john@company.com).");
    }

    if (phone.trim() && !/^[0-9]{10}$/.test(phone.trim())) {
      return setError("Phone number must be exactly 10 digits.");
    }

    if (!password.trim()) return setError("Password is required.");

    const token =
      localStorage.getItem("accessToken") ||
      localStorage.getItem("hr_accessToken");
    if (!token) return setError("Session expired. Please log in again.");

    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/create-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phoneNumber: phone.trim(),
          role,
          department,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.detail || "Failed to create user.");
        return;
      }

      // Show success credentials panel
      setSuccessInfo({
        employeeId: data.employeeId,
        email: data.email,
        password: data.temporaryPassword,
        role: data.role,
        emailSent: data.emailSent,
      });

      // Add to recent users list
      const newUser: CreatedUser = {
        id: Date.now().toString(),
        fullName: fullName.trim(),
        email: data.email,
        role: data.role,
        department,
        employeeId: data.employeeId,
        createdAt: new Date().toLocaleString(),
        emailSent: data.emailSent,
      };
      const updated = [newUser, ...recentUsers].slice(0, 20);
      setRecentUsers(updated);
      sessionStorage.setItem("hr_created_users", JSON.stringify(updated));

      // Reset form
      setFullName("");
      setEmail("");
      setPhone("");
      setRole("employee");
      setDepartment("General");
      setPassword(generatePassword());
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
  const inputStyle: React.CSSProperties = {
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: 10,
    padding: "10px 14px",
    width: "100%",
    fontSize: 14,
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    ...textSecondary,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    display: "block",
  };

  return (
    <div className={hrPageWrap} style={{ padding: "28px 24px", minHeight: "100vh" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UserPlus size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ ...textPrimary, fontSize: 22, fontWeight: 700, margin: 0 }}>
              Create User Account
            </h1>
            <p style={{ ...textSecondary, fontSize: 13, margin: 0 }}>
              Create Employee or Manager accounts — credentials are sent via email
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* ── Left: Form ── */}
        <div style={{ ...card, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
            <Shield size={17} style={{ color: "var(--accent)" }} />
            <span style={{ ...textPrimary, fontWeight: 700, fontSize: 15 }}>
              New Account Details
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Role selector */}
            <div>
              <label style={labelStyle}>Account Type</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["employee", "manager"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      padding: "10px 0",
                      borderRadius: 10,
                      border: "2px solid",
                      borderColor: role === r ? "var(--accent)" : "var(--border)",
                      background: role === r ? "var(--accent)" : "var(--bg-primary)",
                      color: role === r ? "#fff" : "var(--text-primary)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.2s",
                    }}
                  >
                    <Users size={15} />
                    {r === "employee" ? "Employee" : "Manager"}
                  </button>
                ))}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label style={labelStyle}>Full Name *</label>
              <div style={{ position: "relative" }}>
                <User
                  size={15}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-secondary)",
                  }}
                />
                <input
                  id="cu-fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  style={{ ...inputStyle, paddingLeft: 36 }}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email Address *</label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={15}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-secondary)",
                  }}
                />
                <input
                  id="cu-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="john@company.com"
                  style={{
                    ...inputStyle,
                    paddingLeft: 36,
                    borderColor:
                      email && !/^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i.test(email)
                        ? "#ef4444"
                        : "var(--border)",
                  }}
                  required
                />
              </div>
              {email && !/^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i.test(email) && (
                <p style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>
                  Please enter a valid email address (e.g. john@company.com)
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>Phone Number</label>
              <div style={{ position: "relative" }}>
                <Phone
                  size={15}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-secondary)",
                  }}
                />
                <input
                  id="cu-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    // Accept digits only, max 10
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(digits);
                  }}
                  placeholder="9876543210"
                  maxLength={10}
                  style={{
                    ...inputStyle,
                    paddingLeft: 36,
                    borderColor: phone && phone.length !== 10 ? "#ef4444" : "var(--border)",
                  }}
                />
              </div>
              {phone && phone.length !== 10 && (
                <p style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>
                  Phone number must be exactly 10 digits
                </p>
              )}
            </div>



            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Password *</label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoGenerate}
                    onChange={(e) => {
                      setAutoGenerate(e.target.checked);
                      if (e.target.checked) setPassword(generatePassword());
                    }}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  Auto-generate
                </label>
              </div>
              <div style={{ position: "relative" }}>
                <Lock
                  size={15}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-secondary)",
                  }}
                />
                <input
                  id="cu-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  readOnly={autoGenerate}
                  placeholder="Password"
                  style={{
                    ...inputStyle,
                    paddingLeft: 36,
                    paddingRight: 80,
                    opacity: autoGenerate ? 0.7 : 1,
                  }}
                  required
                />
                <div
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    gap: 4,
                  }}
                >
                  {autoGenerate && (
                    <button
                      type="button"
                      onClick={handleAutoGenerate}
                      title="Regenerate password"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--accent)",
                        padding: 4,
                        display: "flex",
                      }}
                    >
                      <RefreshCw size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      padding: 4,
                      display: "flex",
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="cu-submit"
              type="submit"
              disabled={loading}
              style={{
                ...btnPrimary,
                borderRadius: 10,
                padding: "12px 0",
                fontWeight: 700,
                fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "none",
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Create Account
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Right: Success Card + Recent Users ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Success credentials panel */}
          {successInfo && (
            <div
              style={{
                ...card,
                borderRadius: 16,
                padding: 24,
                borderColor: "rgba(16,185,129,0.3)",
                background: isDark ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <CheckCircle2 size={20} color="#10b981" />
                <span style={{ color: "#10b981", fontWeight: 700, fontSize: 15 }}>
                  Account Created Successfully!
                </span>
              </div>
              {successInfo.emailSent && (
                <div
                  style={{
                    background: "rgba(16,185,129,0.1)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 16,
                    fontSize: 12,
                    color: "#10b981",
                    fontWeight: 600,
                  }}
                >
                  ✅ Welcome email with credentials sent to {successInfo.email}
                </div>
              )}
              {!successInfo.emailSent && (
                <div
                  style={{
                    background: "rgba(245,158,11,0.1)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 16,
                    fontSize: 12,
                    color: "#f59e0b",
                    fontWeight: 600,
                  }}
                >
                  ⚠️ Email could not be sent — please share credentials manually
                </div>
              )}

              {/* Credentials table */}
              {[
                { label: "Employee ID", value: successInfo.employeeId },
                { label: "Email", value: successInfo.email },
                { label: "Role", value: successInfo.role.charAt(0).toUpperCase() + successInfo.role.slice(1) },
                { label: "Password", value: successInfo.password },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    ...cardInner,
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  } as React.CSSProperties}
                >
                  <div>
                    <div style={{ ...textSecondary, fontSize: 11, fontWeight: 600 }}>{label}</div>
                    <div
                      style={{
                        ...textPrimary,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: label === "Password" || label === "Employee ID" ? "monospace" : undefined,
                        wordBreak: "break-all",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(value, label)}
                    title="Copy"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: copied === label ? "#10b981" : "var(--text-secondary)",
                      padding: 4,
                      flexShrink: 0,
                    }}
                  >
                    {copied === label ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setSuccessInfo(null)}
                style={{
                  ...btnSecondary,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  marginTop: 6,
                  width: "100%",
                }}
              >
                Create Another User
              </button>
            </div>
          )}

          {/* Recent Users Table */}
          {recentUsers.length > 0 && (
            <div style={{ ...card, borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Users size={17} style={{ color: "var(--accent)" }} />
                <span style={{ ...textPrimary, fontWeight: 700, fontSize: 15 }}>
                  Recently Created ({recentUsers.length})
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={tableHead}>
                      {["Name", "Email", "Role", "Email Sent"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            fontWeight: 700,
                            fontSize: 11,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }} {...rowHover}>
                        <td style={{ padding: "9px 10px", ...textPrimary, fontWeight: 600 }}>
                          {u.fullName}
                          <div style={{ ...textSecondary, fontSize: 11, fontWeight: 400 }}>{u.employeeId}</div>
                        </td>
                        <td style={{ padding: "9px 10px", ...textSecondary }}>{u.email}</td>
                        <td style={{ padding: "9px 10px" }}>
                          <span
                            style={{
                              ...getStatusStyle(u.role === "manager" ? "In Progress" : "Active"),
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "capitalize",
                            }}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td style={{ padding: "9px 10px" }}>
                          {u.emailSent ? (
                            <CheckCircle2 size={15} color="#10b981" />
                          ) : (
                            <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Info card when no users created yet */}
          {recentUsers.length === 0 && !successInfo && (
            <div
              style={{
                ...card,
                borderRadius: 16,
                padding: 32,
                textAlign: "center",
              }}
            >
              <UserPlus size={36} style={{ color: "var(--accent)", marginBottom: 12 }} />
              <p style={{ ...textPrimary, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                Create your first user
              </p>
              <p style={{ ...textSecondary, fontSize: 13, lineHeight: 1.6 }}>
                Fill in the form to create an Employee or Manager account.
                Credentials will be emailed to them automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CSS keyframe for spinner */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
