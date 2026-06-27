import { useEffect, useState } from "react";
import { MessageCircle, Send, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import useWhatsAppNotification from "../hooks/useWhatsAppNotification";

interface WhatsAppStatusDashboardProps {
    compact?: boolean;
    refreshInterval?: number;
}

export default function WhatsAppStatusDashboard({
    compact = false,
    refreshInterval = 10000,
}: WhatsAppStatusDashboardProps) {
    const [hasError, setHasError] = useState(false);

    const { queueStatus, loading, fetchQueueStatus } = useWhatsAppNotification({
        autoRefreshInterval: refreshInterval,
        onError: () => setHasError(true),
    });

    if (compact) {
        return (
            <div className="inline-flex items-center gap-4 px-4 py-2 rounded-lg" style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
            }}>
                <div className="flex items-center gap-2">
                    <MessageCircle size={16} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                        WhatsApp: {queueStatus.pending} pending
                    </span>
                </div>
                {!queueStatus.twilio_configured && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded" style={{
                        background: "rgba(239,68,68,0.1)",
                        color: "#ef4444",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                    }}>
                        <AlertCircle size={12} /> Not configured
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-2xl p-6" style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
        }}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 style={{
                        fontSize: "1.125rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        margin: "0 0 0.25rem 0",
                    }}>
                        WhatsApp Automation Status
                    </h3>
                    <p style={{
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                        margin: 0,
                    }}>
                        Real-time notification queue monitoring
                    </p>
                </div>
                <button
                    onClick={() => fetchQueueStatus()}
                    disabled={loading}
                    style={{
                        padding: "0.5rem 1rem",
                        borderRadius: "0.5rem",
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.2)",
                        color: "var(--accent)",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.5 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                    }}
                >
                    <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                    Refresh
                </button>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div style={{
                    padding: "1rem",
                    borderRadius: "1rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                        Pending
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {queueStatus.pending}
                    </div>
                </div>

                <div style={{
                    padding: "1rem",
                    borderRadius: "1rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                        Sent
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#10b981" }}>
                        {queueStatus.sent}
                    </div>
                </div>

                <div style={{
                    padding: "1rem",
                    borderRadius: "1rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                        Failed
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#ef4444" }}>
                        {queueStatus.failed}
                    </div>
                </div>

                <div style={{
                    padding: "1rem",
                    borderRadius: "1rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                        Cancelled
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                        {queueStatus.cancelled}
                    </div>
                </div>
            </div>

            {/* Configuration Status */}
            <div className="grid grid-cols-2 gap-4">
                <div style={{
                    padding: "1rem",
                    borderRadius: "0.75rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                }}>
                    {queueStatus.scheduler_running ? (
                        <>
                            <CheckCircle size={16} style={{ color: "#10b981" }} />
                            <span style={{ fontSize: "0.875rem", color: "#10b981", fontWeight: 600 }}>
                                Scheduler Running
                            </span>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={16} style={{ color: "#ef4444" }} />
                            <span style={{ fontSize: "0.875rem", color: "#ef4444", fontWeight: 600 }}>
                                Scheduler Stopped
                            </span>
                        </>
                    )}
                </div>

                <div style={{
                    padding: "1rem",
                    borderRadius: "0.75rem",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                }}>
                    {queueStatus.twilio_configured ? (
                        <>
                            <CheckCircle size={16} style={{ color: "#10b981" }} />
                            <span style={{ fontSize: "0.875rem", color: "#10b981", fontWeight: 600 }}>
                                Twilio Connected
                            </span>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={16} style={{ color: "#f59e0b" }} />
                            <span style={{ fontSize: "0.875rem", color: "#f59e0b", fontWeight: 600 }}>
                                Sandbox Mode
                            </span>
                        </>
                    )}
                </div>
            </div>

            {hasError && (
                <div style={{
                    marginTop: "1rem",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#ef4444",
                    fontSize: "0.875rem",
                }}>
                    ⚠️ Error loading status. Please refresh.
                </div>
            )}
        </div>
    );
}
