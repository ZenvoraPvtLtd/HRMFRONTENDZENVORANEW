import { useState, useEffect } from "react";
import { Download, Send, AlertCircle, CheckCircle, Loader, Calendar } from "lucide-react";
import { getApiBaseUrl } from "../../config/apiConfig";
import * as whatsappApi from "../../services/whatsappApi";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  salary?: number;
  department?: string;
}

interface SalaryProcessRequest {
  employee_id: string;
  month: string;
  year: string;
  send_via_whatsapp?: boolean;
}

export default function SalarySlipPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [month, setMonth] = useState<string>(new Date().toISOString().split("T")[0].slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; pdfUrl?: string } | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${getApiBaseUrl()}/api/employees`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        });
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.data || data || []);
        }
      } catch (error) {
        console.error("Failed to fetch employees", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Generate salary slip
  const handleGenerateSalarySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !month) {
      setResult({ ok: false, msg: "Please select employee and month" });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const [year, monthNum] = month.split("-");
      const res = await fetch(`${getApiBaseUrl()}/api/salary/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          month: monthNum,
          year,
          send_via_whatsapp: false,
        } as SalaryProcessRequest),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedPdfUrl(data.payslip_url);
        setResult({ ok: true, msg: "Salary slip generated successfully", pdfUrl: data.payslip_url });
      } else {
        const error = await res.json();
        setResult({ ok: false, msg: error.detail || "Failed to generate salary slip" });
      }
    } catch {
      setResult({ ok: false, msg: "Network error - check backend connection" });
    } finally {
      setProcessing(false);
    }
  };

  // Send via WhatsApp
  const handleSendViaWhatsApp = async () => {
    if (!selectedEmployee?.phone || !generatedPdfUrl) {
      setResult({ ok: false, msg: "Phone number or PDF URL missing" });
      return;
    }

    setProcessing(true);

    try {
      const [year, monthNum] = month.split("-");
      const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      const caption = `Hi ${selectedEmployee.name},\n\nYour salary slip for ${monthName} is attached. Basic: $${selectedEmployee.salary || "N/A"}. Please review and contact HR if you have any questions.`;
      const sendResult = await whatsappApi.sendMediaMessage(selectedEmployee.phone, generatedPdfUrl, caption);

      if (sendResult.success || sendResult.message_sid) {
        setResult({ ok: true, msg: `Salary slip sent to ${selectedEmployee.name} via WhatsApp!` });
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
        Send Salary Slip
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Generate and send monthly salary slips to employees via WhatsApp
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
        <form onSubmit={handleGenerateSalarySlip} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Employee Selection */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
              Select Employee *
            </label>
            {loading ? (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                <Loader size={20} style={{ margin: "0 auto", animation: "spin 1s linear infinite" }} />
              </div>
            ) : (
              <select
                value={selectedEmployee?.id || ""}
                onChange={(event) => {
                  const emp = employees.find((employee) => employee.id === event.currentTarget.value);
                  if (emp) setSelectedEmployee(emp);
                }}
                style={{
                  ...inputStyle,
                  cursor: "pointer",
                }}
              >
                <option value="">-- Choose an employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.department || "N/A"})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Month Selection */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
              Month & Year *
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Calendar size={18} style={{ color: "var(--accent)" }} />
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Employee Details */}
          {selectedEmployee && (
            <div style={{ padding: "1rem", background: "var(--bg-base)", borderRadius: "0.5rem" }}>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Email: {selectedEmployee.email}</div>
              {selectedEmployee.phone && (
                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Phone: {selectedEmployee.phone}</div>
              )}
              {selectedEmployee.salary && (
                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Salary: ${selectedEmployee.salary}</div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <button
            type="submit"
            disabled={processing || !selectedEmployee}
            style={{
              ...buttonStyle,
              background: processing || !selectedEmployee ? "var(--border)" : "var(--accent)",
              color: "var(--accent-text)",
              opacity: processing || !selectedEmployee ? 0.6 : 1,
            }}
          >
            {processing ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={16} />}
            {processing ? "Generating..." : "Generate Salary Slip"}
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
            {generatedPdfUrl && selectedEmployee?.phone && (
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
