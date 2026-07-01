import { useState, useCallback, useEffect } from "react";
import { Download, Send, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { getApiBaseUrl } from "../../config/apiConfig";
import * as whatsappApi from "../../services/whatsappApi";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  company?: string;
  salary?: number;
}

interface OfferData {
  candidate_id: string;
  candidate_name: string;
  position: string;
  salary: number;
  joining_date: string;
  department?: string;
}

export default function OfferLetterPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [offerData, setOfferData] = useState<OfferData>({
    candidate_id: "",
    candidate_name: "",
    position: "",
    salary: 0,
    joining_date: "",
    department: "",
  });

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; pdfUrl?: string } | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);

  // Fetch candidates
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${getApiBaseUrl()}/api/candidates`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCandidates(data.data || data || []);
        }
      } catch (error) {
        console.error("Failed to fetch candidates", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  // Handle candidate selection
  const handleCandidateSelect = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setOfferData({
      ...offerData,
      candidate_id: candidate.id,
      candidate_name: candidate.name,
      position: candidate.position || "",
    });
    setResult(null);
    setGeneratedPdfUrl(null);
  };

  // Generate offer letter PDF
  const handleGenerateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerData.candidate_id || !offerData.position || !offerData.salary || !offerData.joining_date) {
      setResult({ ok: false, msg: "Please fill all required fields" });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/offer-letters/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(offerData),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedPdfUrl(data.pdf_url);
        setResult({ ok: true, msg: "Offer letter generated successfully", pdfUrl: data.pdf_url });
      } else {
        const error = await res.json();
        setResult({ ok: false, msg: error.detail || "Failed to generate offer letter" });
      }
    } catch (error) {
      setResult({ ok: false, msg: "Network error - check backend connection" });
    } finally {
      setSending(false);
    }
  };

  // Send offer via WhatsApp
  const handleSendViaWhatsApp = async () => {
    if (!selectedCandidate?.phone || !generatedPdfUrl) {
      setResult({ ok: false, msg: "Phone number or PDF URL missing" });
      return;
    }

    setSending(true);

    try {
      const caption = `Hi ${selectedCandidate.name},\n\nYour offer letter for the position of ${offerData.position} is attached. Please review and confirm your joining.`;
      const sendResult = await whatsappApi.sendMediaMessage(
        selectedCandidate.phone,
        generatedPdfUrl,
        caption
      );

      if (sendResult.success || sendResult.message_sid) {
        setResult({ ok: true, msg: `Offer letter sent to ${selectedCandidate.name} via WhatsApp!` });
      } else {
        setResult({ ok: false, msg: sendResult.detail || "Failed to send via WhatsApp" });
      }
    } catch (error) {
      setResult({ ok: false, msg: "Failed to send message via WhatsApp" });
    } finally {
      setSending(false);
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
        Send Offer Letter
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Generate and send offer letters to candidates via WhatsApp
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Candidates List */}
        <div
          style={{
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-primary)" }}>
            Select Candidate
          </h2>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
              <Loader size={24} style={{ margin: "0 auto", animation: "spin 1s linear infinite" }} />
            </div>
          ) : candidates.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No candidates found</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "400px", overflowY: "auto" }}>
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => handleCandidateSelect(candidate)}
                  style={{
                    padding: "1rem",
                    border: selectedCandidate?.id === candidate.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    background: selectedCandidate?.id === candidate.id ? "rgba(59, 130, 246, 0.1)" : "var(--bg-base)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{candidate.name}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{candidate.email}</div>
                  {candidate.phone && (
                    <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{candidate.phone}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Offer Form */}
        <div
          style={{
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-primary)" }}>
            Offer Details
          </h2>
          {selectedCandidate ? (
            <form onSubmit={handleGenerateOffer} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                  Candidate Name
                </label>
                <input
                  type="text"
                  value={offerData.candidate_name}
                  readOnly
                  style={{ ...inputStyle, color: "var(--text-secondary)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                  Position *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Senior Developer"
                  value={offerData.position}
                  onChange={(e) => setOfferData({ ...offerData, position: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                  Salary *
                </label>
                <input
                  type="number"
                  placeholder="e.g., 75000"
                  value={offerData.salary || ""}
                  onChange={(e) => setOfferData({ ...offerData, salary: Number(e.target.value) })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                  Joining Date *
                </label>
                <input
                  type="date"
                  value={offerData.joining_date}
                  onChange={(e) => setOfferData({ ...offerData, joining_date: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                  Department
                </label>
                <input
                  type="text"
                  placeholder="e.g., Engineering"
                  value={offerData.department}
                  onChange={(e) => setOfferData({ ...offerData, department: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                style={{
                  ...buttonStyle,
                  background: sending ? "var(--border)" : "var(--accent)",
                  color: "white",
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={16} />}
                {sending ? "Generating..." : "Generate Offer"}
              </button>
            </form>
          ) : (
            <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "2rem" }}>
              Select a candidate to fill offer details
            </p>
          )}
        </div>
      </div>

      {/* Result & PDF Preview */}
      {result && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            border: `1px solid ${result.ok ? "#10b981" : "#ef4444"}`,
            background: result.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            color: result.ok ? "#10b981" : "#ef4444",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {result.ok ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <div>
            <div style={{ fontWeight: 600 }}>{result.msg}</div>
            {generatedPdfUrl && selectedCandidate?.phone && (
              <button
                onClick={handleSendViaWhatsApp}
                disabled={sending}
                style={{
                  ...buttonStyle,
                  background: "var(--accent)",
                  color: "white",
                  marginTop: "0.75rem",
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                {sending ? "Sending..." : "Send via WhatsApp"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
