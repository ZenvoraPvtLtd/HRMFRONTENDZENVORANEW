import { useState, useEffect } from "react";
import { Download, Send, AlertCircle, CheckCircle, Loader, Users } from "lucide-react";
import { getApiBaseUrl } from "../../config/apiConfig";
import * as whatsappApi from "../../services/whatsappApi";

interface HRUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface ReportRequest {
  report_type: "all_shortlisted" | "recent_shortlisted";
  send_via_whatsapp?: boolean;
  hr_user_id?: string;
}

export default function ShortlistReportPage() {
  const [hrUsers, setHrUsers] = useState<HRUser[]>([]);
  const [selectedHR, setSelectedHR] = useState<HRUser | null>(null);
  const [reportType, setReportType] = useState<"all_shortlisted" | "recent_shortlisted">("recent_shortlisted");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; reportUrl?: string } | null>(null);
  const [generatedReportUrl, setGeneratedReportUrl] = useState<string | null>(null);

  // Fetch HR users
  useEffect(() => {
    const fetchHRUsers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${getApiBaseUrl()}/api/auth/team-users`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHrUsers(data.data || data || []);
        }
      } catch (error) {
        console.error("Failed to fetch HR users", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHRUsers();
  }, []);

  // Generate shortlist report
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHR) {
      setResult({ ok: false, msg: "Please select an HR manager" });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/candidates/report/generate-shortlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          report_type: reportType,
          hr_user_id: selectedHR.id,
          send_via_whatsapp: false,
        } as ReportRequest),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedReportUrl(data.report_url);
        setResult({ ok: true, msg: "Shortlist report generated successfully", reportUrl: data.report_url });
      } else {
        const error = await res.json();
        setResult({ ok: false, msg: error.detail || "Failed to generate report" });
      }
    } catch {
      setResult({ ok: false, msg: "Network error - check backend connection" });
    } finally {
      setProcessing(false);
    }
  };

  // Send via WhatsApp
  const handleSendViaWhatsApp = async () => {
    if (!selectedHR?.phone || !generatedReportUrl) {
      setResult({ ok: false, msg: "Phone number or report URL missing" });
      return;
    }

    setProcessing(true);

    try {
      const reportTypeLabel = reportType === "all_shortlisted" ? "All Shortlisted Candidates" : "Recently Shortlisted Candidates";
      const caption = `Hi ${selectedHR.name},\n\n${reportTypeLabel} report is attached. This contains all the candidates who are currently in the shortlist. Please review and take further action as needed.`;

      const sendResult = await whatsappApi.sendMediaMessage(selectedHR.phone, generatedReportUrl, caption);

      if (sendResult.success || sendResult.message_sid) {
        setResult({ ok: true, msg: `Shortlist report sent to ${selectedHR.name} via WhatsApp!` });
      } else {
        setResult({ ok: false, msg: sendResult.detail || "Failed to send via WhatsApp" });
      }
    } catch {
      setResult({ ok: false, msg: "Failed to send message via WhatsApp" });
    } finally {
      setProcessing(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.75rem",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    color: "var(--text-primary)",
    background: "var(--bg-base)",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "0.75rem 1.5rem",
    borderRadius: "0.5rem",
    border: "none",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    transition: "all 0.2s",
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-primary)" }}>
        Send Candidate Shortlist Report
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Generate and send candidate shortlist reports to HR managers via WhatsApp
      </p>

      <div
        style={{
          background: "var(--bg-hover)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "2rem",
          maxWidth: "600px",
        }}
      >
        <form onSubmit={handleGenerateReport} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* HR Manager Selection */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
              Send to HR Manager *
            </label>
            {loading ? (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                <Loader size={20} style={{ margin: "0 auto", animation: "spin 1s linear infinite" }} />
              </div>
            ) : (
              <select
                value={selectedHR?.id || ""}
                onChange={(e) => {
                  const hr = hrUsers.find((h) => h.id === e.currentTarget.value);
                  if (hr) setSelectedHR(hr);
                }}
                style={{
                  ...inputStyle,
                  cursor: "pointer",
                }}
              >
                <option value="">-- Choose an HR manager --</option>
                {hrUsers.map((hr) => (
                  <option key={hr.id} value={hr.id}>
                    {hr.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Report Type */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
              Report Type *
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.currentTarget.value as "all_shortlisted" | "recent_shortlisted")}
              style={{
                ...inputStyle,
                cursor: "pointer",
              }}
            >
              <option value="recent_shortlisted">Recently Shortlisted (Last 7 days)</option>
              <option value="all_shortlisted">All Shortlisted Candidates</option>
            </select>
          </div>

          {/* HR Details */}
          {selectedHR && (
            <div style={{ padding: "1rem", background: "var(--bg-base)", borderRadius: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                <Users size={14} /> {selectedHR.name}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Email: {selectedHR.email}</div>
              {selectedHR.phone && (
                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Phone: {selectedHR.phone}</div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <button
            type="submit"
            disabled={processing || !selectedHR}
            style={{
              ...buttonStyle,
              background: processing || !selectedHR ? "var(--border)" : "var(--accent)",
              color: "white",
              opacity: processing || !selectedHR ? 0.6 : 1,
            }}
          >
            {processing ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={16} />}
            {processing ? "Generating..." : "Generate Report"}
          </button>
        </form>
      </div>

      {/* Result */}
      {result && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1.5rem",
            borderRadius: "0.75rem",
            border: `1px solid ${result.ok ? "#10b981" : "#ef4444"}`,
            background: result.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            color: result.ok ? "#10b981" : "#ef4444",
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div style={{ marginTop: "0.25rem" }}>
            {result.ok ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{result.msg}</div>
            {generatedReportUrl && selectedHR?.phone && (
              <button
                onClick={handleSendViaWhatsApp}
                disabled={processing}
                style={{
                  ...buttonStyle,
                  background: "var(--accent)",
                  color: "white",
                  marginTop: "0.75rem",
                  opacity: processing ? 0.6 : 1,
                }}
              >
                {processing ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                {processing ? "Sending..." : "Send via WhatsApp"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
