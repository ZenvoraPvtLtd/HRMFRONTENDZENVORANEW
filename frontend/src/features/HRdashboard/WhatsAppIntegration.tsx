import React, { useState, useEffect } from "react";
import type { FormEvent } from "react";
import * as whatsappApi from "../../services/whatsappApi";
import {
  MessageCircle,
  RefreshCw,
  Send,
  Database,
  Smartphone,
  Info,
  ShieldCheck,
  Eye,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: string;
  text: string;
}

interface ScheduleJob {
  _id: string;
  recipient_name: string;
  phone: string;
  notification_type: string;
  scheduled_time: string;
  status: "pending" | "sent" | "cancelled" | string;
}

const initialTemplates: Template[] = [
  {
    id: "tpl_1",
    name: "Interview Scheduling",
    category: "Recruitment",
    text: "Hello {{name}},\nYour interview has been scheduled for tomorrow at {{time}}.",
  },
  {
    id: "tpl_2",
    name: "Project Deadlines",
    category: "Task Management",
    text: "Task deadline reminder:\nProject submission due in {{time}}.",
  },
  {
    id: "tpl_3",
    name: "Attendance Alerts",
    category: "HR Operations",
    text: "Hello {{name}},\nYou have not clocked in for today yet. Please mark your attendance.",
  },
  {
    id: "tpl_4",
    name: "Leave Approval/Rejection",
    category: "HR Operations",
    text: "Hello {{name}},\nYour leave request from {{time}} has been APPROVED by your manager.",
  },
  {
    id: "tpl_5",
    name: "Task Assignments",
    category: "Operations",
    text: "Hi {{name}},\nA new task '{{title}}' has been assigned to you. Deadline: {{time}}.",
  },
  {
    id: "tpl_6",
    name: "Offer Letters",
    category: "Recruitment",
    text: "Congratulations {{name}}!\nZenvora has extended an offer for the {{title}} role. Please check your email.",
  },
  {
    id: "tpl_7",
    name: "Salary Notifications",
    category: "Finance",
    text: "Hi {{name}},\nYour salary for the month of {{time}} has been credited successfully.",
  },
  {
    id: "tpl_8",
    name: "Meeting Reminders",
    category: "Operations",
    text: "Friendly reminder:\nThe {{title}} meeting is starting in 15 minutes. Join link: {{link}}",
  },
  {
    id: "tpl_9",
    name: "Candidate Shortlisting",
    category: "Recruitment",
    text: "Great news {{name}}!\nYou have been shortlisted for the {{title}} role at Zenvora.",
  },
  {
    id: "tpl_10",
    name: "Employee Announcements",
    category: "General",
    text: "Announcement: {{title}}\nDear Zenvora team, {{body}}.",
  },
];

const initialLogs = [
  {
    time: "Just now",
    phone: "+91 98765 43210",
    name: "Prince",
    type: "Interview Scheduling",
    status: "Delivered",
    message:
      "Hello Prince, Your interview has been scheduled for tomorrow at 11:00 AM.",
  },
  {
    time: "2 mins ago",
    phone: "+91 99988 87776",
    name: "Sarah Jenkins",
    type: "Project Deadlines",
    status: "Delivered",
    message: "Task deadline reminder: Project submission due in 2 hours.",
  },
  {
    time: "1 hour ago",
    phone: "+91 90123 45678",
    name: "John Doe",
    type: "Attendance Alerts",
    status: "Delivered",
    message:
      "Hello John Doe, You have not clocked in for today yet. Please mark your attendance.",
  },
  {
    time: "3 hours ago",
    phone: "+91 88877 76665",
    name: "Anugrah Prasetya",
    type: "Leave Approval/Rejection",
    status: "Delivered",
    message:
      "Hello Anugrah Prasetya, Your leave request from 20 May has been APPROVED by your manager.",
  },
];

export default function WhatsAppIntegration() {
  const [activeTab, setActiveTab] = useState("rules");

  // Credentials Settings
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");
  const [wabaPhoneId, setWabaPhoneId] = useState("");
  const [wabaToken, setWabaToken] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaveMessage, setConfigSaveMessage] = useState<string>("");
  const [configSaving, setConfigSaving] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [templatesSaving, setTemplatesSaving] = useState(false);

  // Automation Rules Toggles
  const [rules, setRules] = useState({
    interview: true,
    attendance: false,
    leave: true,
    tasks: true,
    offers: true,
    salary: false,
    meetings: true,
    deadlines: true,
    shortlisting: true,
    announcements: true,
  });

  // Sandbox Test
  const [testPhone, setTestPhone] = useState("+91 ");
  const [testName, setTestName] = useState("Prince");
  const [testTime, setTestTime] = useState("tomorrow at 11:00 AM");
  const [testTemplate, setTestTemplate] = useState("tpl_1");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState(initialLogs);

  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All Employees");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Template Manager
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [selectedTplId, setSelectedTplId] = useState("tpl_1");
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [templateSaveMessage, setTemplateSaveMessage] = useState<string>("");
  const [rulesSaveMessage, setRulesSaveMessage] = useState<string>("");

  const activeTemplate =
    templates.find((t) => t.id === selectedTplId) || templates[0];

  const [queueStatus, setQueueStatus] = useState({
    pending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    scheduler_running: false,
    twilio_configured: false,
  });

  // Schedules Queue State
  const [schedules, setSchedules] = useState<ScheduleJob[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  const fetchWhatsAppConfig = async () => {
    setConfigError(null);
    try {
      const config = await whatsappApi.getWhatsAppConfig();
      setTwilioSid(config.twilioSid || "");
      setTwilioToken(config.twilioToken || "");
      setTwilioFrom(config.twilioFrom || "");
      setWabaPhoneId(config.wabaPhoneId || "");
      setWabaToken(config.wabaToken || "");
      setIsSaved(
        !!(
          config.twilioSid ||
          config.twilioToken ||
          config.twilioFrom ||
          config.wabaPhoneId ||
          config.wabaToken
        ),
      );
    } catch (error) {
      console.error("Failed to load WhatsApp config", error);
      setConfigError("Unable to load WhatsApp configuration.");
    }
  };

  const fetchWhatsAppRules = async () => {
    setRulesLoading(true);
    try {
      const rulesResponse = await whatsappApi.getWhatsAppRules();
      setRules(rulesResponse);
    } catch (error) {
      console.error("Failed to load WhatsApp rules", error);
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchWhatsAppTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const savedTemplates = await whatsappApi.getWhatsAppTemplates();
      if (savedTemplates.length > 0) {
        setTemplates(savedTemplates);
        setSelectedTplId(savedTemplates[0].id);
      }
    } catch (error) {
      console.error("Failed to load WhatsApp templates", error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const status = await whatsappApi.getQueueStatus();
      setQueueStatus(status);
    } catch (error) {
      console.error("Failed to fetch queue status", error);
    }
  };

  const fetchSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const data = await whatsappApi.getScheduledMessages();
      setSchedules(data || []);
    } catch (error) {
      console.error("Failed to fetch schedules", error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const cancelSchedule = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this scheduled message?")) return;
    try {
      const data = await whatsappApi.cancelScheduledMessage(id);
      if (data.success) {
        alert("Schedule cancelled successfully!");
        fetchSchedules(); // refresh
      } else {
        alert(`Failed to cancel: ${data.message}`);
      }
    } catch (error) {
      console.error("Failed to cancel schedule", error);
      alert("Error cancelling schedule.");
    }
  };

  const handleSaveRules = async () => {
    setRulesSaveMessage("");
    setRulesSaving(true);
    try {
      const data = await whatsappApi.saveWhatsAppRules(rules);
      if (data.success) {
        setRulesSaveMessage("Rules saved successfully.");
      } else {
        setRulesSaveMessage(data.message || "Unable to save rules.");
      }
    } catch (error) {
      console.error("Failed to save WhatsApp rules", error);
      setRulesSaveMessage("Failed to save rules.");
    } finally {
      setRulesSaving(false);
    }
  };

  const handleSaveTemplates = async () => {
    setTemplateSaveMessage("");
    setTemplatesSaving(true);
    try {
      const data = await whatsappApi.saveWhatsAppTemplates(templates);
      if (data.success) {
        setTemplateSaveMessage("Templates saved successfully.");
      } else {
        setTemplateSaveMessage(data.message || "Unable to save templates.");
      }
    } catch (error) {
      console.error("Failed to save WhatsApp templates", error);
      setTemplateSaveMessage("Failed to save templates.");
    } finally {
      setTemplatesSaving(false);
    }
  };

  const handleSaveCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfigError(null);
    setConfigSaveMessage("");
    setConfigSaving(true);
    try {
      const data = await whatsappApi.saveWhatsAppConfig({
        twilioSid,
        twilioToken,
        twilioFrom,
        wabaPhoneId,
        wabaToken,
      });

      if (data.success) {
        setIsSaved(true);
        setConfigSaveMessage("WhatsApp configuration saved successfully.");
      } else {
        setConfigSaveMessage(data.message || "Unable to save WhatsApp configuration.");
      }
    } catch (error) {
      console.error("Failed to save WhatsApp config", error);
      setConfigSaveMessage(error instanceof Error ? `Save failed: ${error.message}` : "Save failed.");
    } finally {
      setConfigSaving(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([
        fetchWhatsAppConfig(),
        fetchWhatsAppRules(),
        fetchWhatsAppTemplates(),
        fetchQueueStatus(),
      ]);
    };

    initialize();
  }, []);

  useEffect(() => {
    if (activeTab === "queue") {
      const timer = window.setTimeout(() => {
        fetchSchedules();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab]);

  const handleRuleToggle = (key: keyof typeof rules) => {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const simulateSend = async () => {
    if (!testPhone.trim() || testPhone === "+91 ") {
      return;
    }
    setSending(true);

    // Create replaced preview message
    const msg = activeTemplate.text
      .replace("{{name}}", testName)
      .replace("{{time}}", testTime)
      .replace("{{title}}", "Frontend Role Offer")
      .replace("{{link}}", "https://zenvora.com/join");

    try {
      const data = await whatsappApi.sendWhatsAppMessage(
        testPhone,
        msg,
        twilioSid,
        twilioToken,
        twilioFrom,
      );

      if (!data.success) {
        throw new Error(data.message || "Failed to dispatch via gateway");
      }

      const newLog = {
        time: "Just now",
        phone: testPhone,
        name: testName,
        type: activeTemplate.name,
        status: "Delivered",
        message: msg,
      };

      setLogs([newLog, ...logs]);
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert("Please enter both title and message for the broadcast.");
      return;
    }

    if (!window.confirm(`Are you sure you want to broadcast this message to ${selectedDepartment}?`)) {
      return;
    }

    setIsBroadcasting(true);
    try {
      const messagePayload = broadcastTitle.trim()
        ? `${broadcastTitle}\n\n${broadcastMessage}`
        : broadcastMessage;

      await whatsappApi.broadcastMessage(selectedDepartment, messagePayload);
      alert(`WhatsApp broadcast queued successfully! Messages will be sent to ${selectedDepartment}.`);
      setBroadcastTitle("");
      setBroadcastMessage("");
      setSelectedDepartment("All Employees");
      setActiveTab("queue");
      fetchSchedules();
    } catch (error) {
      console.error(error);
      alert(`Broadcast Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const getReplacedPreview = () => {
    return activeTemplate.text
      .replace("{{name}}", testName || "Prince")
      .replace("{{time}}", testTime || "tomorrow at 11:00 AM")
      .replace("{{title}}", "Frontend Development Project")
      .replace("{{body}}", "office will remain closed tomorrow due to weather")
      .replace("{{link}}", "https://zenvora.com/join");
  };

  return (
    <div
      className="animate-fade-in"
      style={{ padding: "0 0.5rem", maxWidth: "1100px", margin: "0 auto" }}
    >


      {/* KPI stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "Total Sent", value: "4,821", color: "var(--text-primary)" },
          { label: "Delivery Rate", value: "99.8%", color: "#10b981" },
          { label: "Active Rules", value: `${Object.values(rules).filter(Boolean).length} / 10`, color: "var(--accent)" },
          { label: "API Gateway", value: "Twilio + WABA", color: "var(--text-primary)" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "1rem",
              padding: "1rem 1.25rem",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <div style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              marginBottom: "0.375rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>
              {card.label}
            </div>
            <div
              style={{
                fontWeight: 700,
                color: card.color,
                fontSize: "1.5rem",
                lineHeight: 1.25,
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation tabs */}
      <div
        className="card whatsapp-tabs-card"
        style={{ padding: 0, marginBottom: "1.5rem", overflow: "hidden" }}
      >
        <div
          className="whatsapp-tabs-nav"
          style={{
            display: "flex",
            flexWrap: "nowrap",
            gap: "0 1.5rem",
            borderBottom: "1px solid var(--border)",
            padding: "0 2rem",
            overflowX: "auto",
            overflowY: "visible",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--border) transparent",
          }}
        >
          {[
            { key: "rules", label: "Automatic Rules" },
            { key: "broadcast", label: "Broadcast Message" },
            { key: "queue", label: "Queue Manager" },
            { key: "templates", label: "Template Builder" },
            { key: "sandbox", label: "Quick Send Sandbox" },
            { key: "meeting", label: "Meeting Reminders" },
            { key: "offer-letter", label: "Send Offer Letter" },
            { key: "salary-slip", label: "Send Salary Slip" },
            { key: "shortlist-report", label: "Send Shortlist Report" },
          ].map((t) => (
            <div
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "1.25rem 0",
                color:
                  activeTab === t.key ? "#10b981" : "var(--text-secondary)",
                borderBottom:
                  activeTab === t.key
                    ? "2px solid #10b981"
                    : "2px solid transparent",
                fontWeight: "600",
                fontSize: "0.875rem",
                cursor: "pointer",
                marginBottom: "-1px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div style={{ padding: "2rem" }}>

          {/* 0. QUEUE MANAGER TAB */}
          {activeTab === "queue" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>Pending & Historical Schedules</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>View, monitor, and cancel queued WhatsApp notifications before they are dispatched.</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
                    <div style={{ padding: "0.65rem 0.85rem", borderRadius: "0.75rem", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Pending</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{queueStatus.pending}</div>
                    </div>
                    <div style={{ padding: "0.65rem 0.85rem", borderRadius: "0.75rem", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Sent</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{queueStatus.sent}</div>
                    </div>
                    <div style={{ padding: "0.65rem 0.85rem", borderRadius: "0.75rem", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Failed</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{queueStatus.failed}</div>
                    </div>
                    <div style={{ padding: "0.65rem 0.85rem", borderRadius: "0.75rem", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Cancelled</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{queueStatus.cancelled}</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={fetchSchedules}
                  disabled={loadingSchedules}
                  style={{
                    background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)",
                    padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.75rem",
                    fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem"
                  }}
                >
                  <RefreshCw size={14} className={loadingSchedules ? "animate-spin" : ""} /> Refresh Queue
                </button>
              </div>

              {loadingSchedules ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading schedules...</div>
              ) : schedules.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  No scheduled messages found in the queue.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <th style={{ padding: "1rem", fontWeight: 600 }}>Recipient</th>
                        <th style={{ padding: "1rem", fontWeight: 600 }}>Type</th>
                        <th style={{ padding: "1rem", fontWeight: 600 }}>Scheduled For</th>
                        <th style={{ padding: "1rem", fontWeight: 600 }}>Status</th>
                        <th style={{ padding: "1rem", fontWeight: 600, textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map(job => (
                        <tr key={job._id} style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-primary)" }}>
                          <td style={{ padding: "1rem", color: "var(--text-primary)" }}>
                            <div style={{ fontWeight: 600 }}>{job.recipient_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{job.phone}</div>
                          </td>
                          <td style={{ padding: "1rem", color: "var(--text-primary)" }}>
                            {job.notification_type}
                          </td>
                          <td style={{ padding: "1rem", color: "var(--text-primary)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <Clock size={14} className="text-gray-400" />
                              {new Date(job.scheduled_time).toLocaleString()}
                            </div>
                          </td>
                          <td style={{ padding: "1rem" }}>
                            {job.status === "pending" && (
                              <span style={{ fontSize: "10px", padding: "0.2rem 0.5rem", borderRadius: "1rem", background: "rgba(234,179,8,0.1)", color: "#eab308", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <Clock size={10} /> Pending
                              </span>
                            )}
                            {job.status === "sent" && (
                              <span style={{ fontSize: "10px", padding: "0.2rem 0.5rem", borderRadius: "1rem", background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <CheckCircle size={10} /> Sent
                              </span>
                            )}
                            {job.status === "cancelled" && (
                              <span style={{ fontSize: "10px", padding: "0.2rem 0.5rem", borderRadius: "1rem", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <XCircle size={10} /> Cancelled
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "1rem", textAlign: "right" }}>
                            {job.status === "pending" && (
                              <button
                                onClick={() => cancelSchedule(job._id)}
                                style={{
                                  background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)",
                                  padding: "0.35rem 0.75rem", borderRadius: "0.35rem", fontSize: "0.75rem",
                                  fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.25rem"
                                }}
                              >
                                <Trash2 size={12} /> Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 1. AUTOMATIC RULES TAB */}
          {activeTab === "rules" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      margin: "0 0 0.25rem 0",
                    }}
                  >
                    Auto-Trigger Notification Rules
                  </h3>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    Configure automatic triggers that will immediately shoot
                    WhatsApp updates to candidates and employees.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rule Item */}
                {[
                  {
                    key: "interview",
                    title: "Interview Scheduling",
                    desc: "Sends full schedules & details to candidates when scheduled",
                    example:
                      "Hello Prince, Your interview has been scheduled for tomorrow at 11:00 AM.",
                  },
                  {
                    key: "deadlines",
                    title: "Project Deadlines",
                    desc: "Sends critical task warning reminders 2 hours before deadline",
                    example:
                      "Task deadline reminder: Project submission due in 2 hours.",
                  },
                  {
                    key: "attendance",
                    title: "Attendance Alerts",
                    desc: "Alerts employees immediately if they forgot to clock in by 10 AM",
                    example:
                      "Hello Prince, You have not clocked in for today yet.",
                  },
                  {
                    key: "leave",
                    title: "Leave Approval/Rejection",
                    desc: "Instantly alerts employee when manager signs off on leave request",
                    example:
                      "Hello Prince, Your leave request has been APPROVED.",
                  },
                  {
                    key: "tasks",
                    title: "Task Assignments",
                    desc: "Updates employees when new tasks/milestones are assigned to them",
                    example:
                      "Hi Prince, A new task 'Review RFP' has been assigned to you.",
                  },
                  {
                    key: "offers",
                    title: "Offer Letters",
                    desc: "Shoots high priority congratulatory letters with signable link to candidates",
                    example:
                      "Congratulations Prince! Zenvora has extended an offer to you.",
                  },
                  {
                    key: "salary",
                    title: "Salary & Payroll Notifications",
                    desc: "Alerts employee as soon as monthly salary is successfully credited",
                    example:
                      "Hi Prince, Your salary for May has been credited successfully.",
                  },
                  {
                    key: "meetings",
                    title: "Meeting Reminders",
                    desc: "Sends calendar reminders 15 minutes before global HR meets",
                    example:
                      "Friendly reminder: The Weekly Sync meeting is starting in 15 minutes.",
                  },
                  {
                    key: "shortlisting",
                    title: "Candidate Shortlisting",
                    desc: "Notifies candidates automatically when ATS moves them to shortlisted list",
                    example:
                      "Great news Prince! You have been shortlisted at Zenvora.",
                  },
                  {
                    key: "announcements",
                    title: "Employee Announcements",
                    desc: "Broadcasts critical HR updates & general office announcements",
                    example:
                      "Announcement: Dear Zenvora team, office will remain closed tomorrow.",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-5 rounded-2xl flex items-start gap-4 transition-all"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border)",
                      opacity: rules[item.key as keyof typeof rules] ? 1 : 0.75,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontSize: "0.9375rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {item.title}
                        </h4>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "1rem",
                            background: "rgba(139,92,246,0.1)",
                            color: "var(--accent)",
                            fontWeight: 600,
                          }}
                        >
                          Active
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "0 0 0.75rem 0",
                          fontSize: "0.8125rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {item.desc}
                      </p>
                      <div
                        className="p-2.5 rounded-lg border"
                        style={{
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border)",
                          fontStyle: "italic",
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        "{item.example}"
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        handleRuleToggle(item.key as keyof typeof rules)
                      }
                      style={{
                        position: "relative",
                        width: "40px",
                        height: "20px",
                        borderRadius: "10px",
                        background: rules[item.key as keyof typeof rules]
                          ? "#10b981"
                          : "rgba(255,255,255,0.1)",
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.3s",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: rules[item.key as keyof typeof rules]
                            ? "22px"
                            : "2px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.3s",
                        }}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: "1.5rem",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <button
                  onClick={handleSaveRules}
                  disabled={rulesSaving || rulesLoading}
                  style={{
                    background: rulesSaving || rulesLoading ? "rgba(255,255,255,0.05)" : "#10b981",
                    color: "white",
                    border: "none",
                    padding: "0.85rem 1.5rem",
                    borderRadius: "0.75rem",
                    fontWeight: 700,
                    cursor: rulesSaving || rulesLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {rulesLoading
                    ? "Loading rules..."
                    : rulesSaving
                      ? "Saving rules..."
                      : "Save rules"}
                </button>
                {rulesSaveMessage && (
                  <span
                    style={{
                      color: rulesSaveMessage.includes("Failed") ? "#ef4444" : "#10b981",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    {rulesSaveMessage}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 1.5 BROADCAST TAB */}
          {activeTab === "broadcast" && (
            <div className="space-y-6">
              <div>
                <h3
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: "0 0 0.25rem 0",
                  }}
                >
                  Broadcast Announcements
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Send important updates or announcements to the entire team at once via WhatsApp.
                </p>
              </div>

              <div
                className="p-6 rounded-2xl space-y-5"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  maxWidth: "600px",
                }}
              >
                <form onSubmit={handleBroadcast} className="space-y-4">
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Select Department *
                    </label>
                    <select
                      required
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="All Employees">All Employees</option>
                      <option value="Engineering">Engineering</option>
                      <option value="HR">HR</option>
                      <option value="Sales">Sales</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Announcement Title
                    </label>
                    <input
                      type="text"
                      required
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="e.g. Office Closed Tomorrow"
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Message Content
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="Type your message here..."
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isBroadcasting}
                    style={{
                      width: "100%",
                      padding: "0.875rem",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(to right, #10b981, #059669)",
                      color: "white",
                      border: "none",
                      fontWeight: 700,
                      cursor: isBroadcasting ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      marginTop: "1rem"
                    }}
                  >
                    {isBroadcasting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {isBroadcasting ? "Queueing Broadcast..." : "Send to All Employees"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 2. TEMPLATE BUILDER TAB */}
          {activeTab === "templates" && (
            templatesLoading ? (
              <div
                className="p-6 rounded-2xl border"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Loading templates...
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Template List & Editor */}
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <h3
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        margin: "0 0 0.25rem 0",
                      }}
                    >
                      WhatsApp Notification Templates
                    </h3>
                  </div>

                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTplId(t.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition"
                        style={{
                          background:
                            selectedTplId === t.id
                              ? "#10b981"
                              : "var(--bg-primary)",
                          color:
                            selectedTplId === t.id
                              ? "white"
                              : "var(--text-primary)",
                          border:
                            selectedTplId === t.id
                              ? "1px solid #10b981"
                              : "1px solid var(--border)",
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>

                  {/* Editor Card */}
                  <div
                    className="p-5 rounded-2xl"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "1rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        Editing Template: {activeTemplate.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Category: {activeTemplate.category}
                      </span>
                    </div>

                    <textarea
                      value={activeTemplate.text}
                      onChange={(e) => {
                        setTemplates(
                          templates.map((t) =>
                            t.id === selectedTplId
                              ? { ...t, text: e.target.value }
                              : t,
                          ),
                        );
                      }}
                      style={{
                        width: "100%",
                        height: "150px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "1rem",
                        borderRadius: "0.75rem",
                        outline: "none",
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                        resize: "none",
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "1.5rem",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Info size={12} />
                        <span>
                          Variables: <code>{"{{name}}"}</code>,{" "}
                          <code>{"{{time}}"}</code>, <code>{"{{title}}"}</code>
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        <button
                          onClick={() => {
                            setTestTemplate(activeTemplate.id);
                            setActiveTab("sandbox");
                          }}
                          style={{
                            background: "#10b981",
                            color: "white",
                            border: "none",
                            padding: "0.5rem 1rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          <Send size={12} /> Send Test Message
                        </button>
                        <button
                          onClick={handleSaveTemplates}
                          disabled={templatesSaving}
                          style={{
                            background: templatesSaving ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.08)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                            padding: "0.5rem 1rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: templatesSaving ? "not-allowed" : "pointer",
                          }}
                        >
                          {templatesSaving ? "Saving..." : "Save Template"}
                        </button>
                      </div>
                    </div>
                    {templateSaveMessage && (
                      <div
                        style={{
                          marginTop: "1rem",
                          color: templateSaveMessage.includes("Failed") ? "#ef4444" : "#10b981",
                          fontSize: "0.9rem",
                          fontWeight: 600,
                        }}
                      >
                        {templateSaveMessage}
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Mockup Column */}
                <div className="lg:col-span-1 flex flex-col items-center">
                  <h4
                    style={{
                      margin: "0 0 1rem 0",
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <Eye size={16} /> Live Phone Preview
                  </h4>

                  {/* Phone Shell */}
                  <div
                    className="rounded-3xl p-3 shadow-lg relative"
                    style={{
                      width: "250px",
                      height: "420px",
                      background: "#0b141a",
                      border: "8px solid #2d383f",
                    }}
                  >
                    {/* Phone Notch */}
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "80px",
                        height: "14px",
                        borderRadius: "10px",
                        background: "#000",
                        zIndex: 10,
                      }}
                    />

                    {/* WhatsApp Screen */}
                    <div
                      className="h-full rounded-2xl overflow-hidden flex flex-col relative"
                      style={{
                        background:
                          "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                        backgroundSize: "cover",
                      }}
                    >
                      {/* Header */}
                      <div
                        className="h-10 px-3 flex items-center gap-2"
                        style={{ background: "#075e54", color: "#fff" }}
                      >
                        <MessageCircle size={14} />
                        <div className="text-[10px] font-bold">
                          Zenvora Business
                        </div>
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 p-2 overflow-y-auto space-y-2">
                        <div
                          className="p-2.5 rounded-lg text-[9px] relative ml-auto shadow-sm"
                          style={{
                            background: "#dcf8c6",
                            color: "#333",
                            maxWidth: "85%",
                            borderBottomRightRadius: 0,
                          }}
                        >
                          <div
                            style={{
                              whiteSpace: "pre-line",
                              wordBreak: "break-word",
                            }}
                          >
                            {getReplacedPreview()}
                          </div>
                          <div
                            style={{
                              textAlign: "right",
                              fontSize: "7px",
                              color: "#666",
                              marginTop: "4px",
                            }}
                          >
                            11:38 AM â€¢ Sent
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* 3. QUICK SANDBOX TEST TAB */}
          {activeTab === "sandbox" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Config */}
              <div className="space-y-4">
                <div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      margin: "0 0 0.25rem 0",
                    }}
                  >
                    Test Send (Twilio Sandbox API)
                  </h3>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    Shoot a test WhatsApp notification to your personal number
                    directly from here. Twilio Sandbox will process it
                    instantly.
                  </p>
                </div>

                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Target Phone Number (with Country Code)
                    </label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="e.g., +91 98765 43210"
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        value={testName}
                        onChange={(e) => setTestName(e.target.value)}
                        style={{
                          width: "100%",
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border)",
                          color: "var(--text-primary)",
                          padding: "0.75rem",
                          borderRadius: "0.5rem",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Time Parameter
                      </label>
                      <input
                        type="text"
                        value={testTime}
                        onChange={(e) => setTestTime(e.target.value)}
                        style={{
                          width: "100%",
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border)",
                          color: "var(--text-primary)",
                          padding: "0.75rem",
                          borderRadius: "0.5rem",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Choose Template to Replicate
                    </label>
                    <select
                      value={testTemplate}
                      onChange={(e) => {
                        setTestTemplate(e.target.value);
                        setSelectedTplId(e.target.value);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={simulateSend}
                    disabled={sending}
                    style={{
                      width: "100%",
                      padding: "0.875rem",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(to right, #10b981, #059669)",
                      color: "white",
                      border: "none",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                    }}
                  >
                    {sending ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {sending
                      ? "Sending via Twilio..."
                      : "Send Test Notification"}
                  </button>
                </div>
              </div>

              {/* Logs */}
              <div className="space-y-4">
                <h4
                  style={{
                    margin: 0,
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <Database size={16} className="text-green-500" /> Twilio
                  Delivery Gateway Logs
                </h4>

                <div
                  className="space-y-3"
                  style={{ maxHeight: "330px", overflowY: "auto" }}
                >
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {log.name} ({log.phone})
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#10b981",
                            background: "rgba(16,185,129,0.1)",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "1rem",
                            fontWeight: 600,
                          }}
                        >
                          {log.status}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          margin: "0 0 0.5rem 0",
                        }}
                      >
                        {log.type} â€¢ {log.time}
                      </p>
                      <div
                        className="p-2 rounded style-mono"
                        style={{
                          background: "var(--bg-secondary)",
                          fontSize: "0.75rem",
                          color: "var(--text-primary)",
                        }}
                      >
                        "{log.message}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. API CONFIGURATION TAB */}
          {activeTab === "settings" && (
            <form onSubmit={handleSaveCredentials} className="space-y-6">
              <div>
                <h3
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: "0 0 0.25rem 0",
                  }}
                >
                  WhatsApp & Twilio Integration API Details
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Configure credentials for automatic message broadcasts &
                  triggers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Twilio Config Card */}
                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Smartphone size={18} className="text-blue-400" /> Twilio
                    Business API Settings
                  </h4>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Account SID
                    </label>
                    <input
                      type="text"
                      value={twilioSid}
                      onChange={(e) => {
                        setTwilioSid(e.target.value);
                        setIsSaved(false);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Auth Token
                    </label>
                    <input
                      type="password"
                      value={twilioToken}
                      onChange={(e) => {
                        setTwilioToken(e.target.value);
                        setIsSaved(false);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* WhatsApp Business Cloud API Settings */}
                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <ShieldCheck size={18} className="text-green-400" />{" "}
                    WhatsApp Business Cloud API Settings
                  </h4>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={wabaPhoneId}
                      onChange={(e) => {
                        setWabaPhoneId(e.target.value);
                        setIsSaved(false);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      System User Access Token
                    </label>
                    <input
                      type="password"
                      value={wabaToken}
                      onChange={(e) => {
                        setWabaToken(e.target.value);
                        setIsSaved(false);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", flexDirection: "column", gap: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={isSaved || configSaving}
                  style={{
                    padding: "0.75rem 2rem",
                    borderRadius: "0.5rem",
                    background: isSaved
                      ? "rgba(255,255,255,0.05)"
                      : "var(--accent)",
                    color: isSaved ? "var(--text-secondary)" : "white",
                    border: "none",
                    fontWeight: 700,
                    cursor: isSaved || configSaving ? "not-allowed" : "pointer",
                  }}
                >
                  {configSaving ? "Saving..." : isSaved ? "Saved & Connected" : "Save Configurations"}
                </button>
                {configSaveMessage && (
                  <div style={{ color: "#10b981", fontSize: "0.9rem", fontWeight: 600 }}>
                    {configSaveMessage}
                  </div>
                )}
                {configError && (
                  <div style={{ color: "#ef4444", fontSize: "0.9rem", fontWeight: 600 }}>
                    {configError}
                  </div>
                )}
              </div>
            </form>
          )}
          {activeTab === "meeting" && (
            <MeetingRemindersTab />
          )}
          {activeTab === "offer-letter" && (
            <OfferLetterTab />
          )}
          {activeTab === "salary-slip" && (
            <SalarySlipTab />
          )}
          {activeTab === "shortlist-report" && (
            <ShortlistReportTab />
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Meeting Reminders Tab ────────────────────────────────────────────────────
function MeetingRemindersTab() {
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [subject, setSubject] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [linkType, setLinkType] = useState<"google" | "zoom" | "teams" | "custom">("google");
  const [customLink, setCustomLink] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; link?: string } | null>(null);

  const linkPlaceholders: Record<string, string> = {
    google: "https://meet.google.com/xxx-xxxx-xxx",
    zoom: "https://zoom.us/j/xxxxxxxxxx",
    teams: "https://teams.microsoft.com/l/meetup-join/...",
    custom: "https://your-meeting-link.com",
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !phone || !subject || !meetingTime) return;

    console.debug("DEBUG MeetingRemindersTab.handleSend - button clicked", {
      recipientName,
      phone,
      subject,
      meetingTime,
      linkType,
      customLink,
    });

    setSending(true);
    setResult(null);

    try {
      // Auto-generate meeting link if empty
      let finalLink = customLink.trim();
      if (!finalLink) {

        if (linkType === "google") {
          // Google Meet — "new" always creates a fresh real room
          finalLink = "https://meet.google.com/new";
        } else if (linkType === "zoom") {
          // Zoom personal meeting — opens Zoom start page
          finalLink = "https://zoom.us/start/videomeeting";
        } else if (linkType === "teams") {
          // Teams — opens a new meeting
          finalLink = "https://teams.microsoft.com/l/meetup-join/new";
        } else {
          finalLink = "https://meet.jit.si/ZenvoraHRM-Interview";
        }
      }

      const requestPayload = {
        title: subject,
        description: `Reminder for ${subject}`,
        scheduled_at: new Date(meetingTime).toISOString(),
        attendees: [{ name: recipientName, phone }],
        meeting_link: finalLink,
        location: undefined,
        reminder_minutes_before: 30,
      };
      console.debug("DEBUG MeetingRemindersTab.handleSend - calling scheduleMeeting", requestPayload);

      const data = await whatsappApi.scheduleMeeting(
        subject,
        `Reminder for ${subject}`,
        new Date(meetingTime).toISOString(),
        [{ name: recipientName, phone }],
        finalLink,
        undefined,
        30
      );
      console.debug("DEBUG MeetingRemindersTab.handleSend - scheduleMeeting response", data);
      if (data.success) {
        const sentLink = data.data?.meeting_link || finalLink;
        setResult({
          ok: true,
          msg: `30-minute meeting reminder scheduled for ${recipientName}.`,
          link: sentLink || undefined,
        });
        setRecipientName(""); setPhone("+91"); setSubject(""); setMeetingTime(""); setCustomLink("");
      } else {
        setResult({ ok: false, msg: data.detail || data.message || "Failed to schedule" });
      }
    } catch {
      setResult({ ok: false, msg: "Network error - check backend connection" });
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.75rem", borderRadius: "0.5rem",
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.8rem", fontWeight: 600,
    color: "var(--text-secondary)", marginBottom: "0.4rem",
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>
        Meeting Reminders
      </h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 1.5rem 0" }}>
        Schedule a WhatsApp reminder 30 minutes before the meeting with the joining link.
      </p>

      <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label>
            <span style={labelStyle}>Recipient Name *</span>
            <input required value={recipientName} onChange={e => setRecipientName(e.target.value)}
              placeholder="e.g. Prince" style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>Phone (with country code) *</span>
            <input required value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+91 98765 43210" style={inputStyle} />
          </label>
        </div>

        <label>
          <span style={labelStyle}>Meeting Subject *</span>
          <input required value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Weekly Sync / Interview Round 2" style={inputStyle} />
        </label>

        <label>
          <span style={labelStyle}>Date & Time * <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>(10:00 AM – 7:00 PM)</span></span>
          <input
            required
            type="datetime-local"
            value={meetingTime}
            min={(() => {
              const now = new Date();
              now.setSeconds(0, 0);
              // Set minimum to next available 10 AM slot
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T10:00`;
            })()}
            onChange={e => {
              const val = e.target.value;
              if (val) {
                const hour = new Date(val).getHours();
                if (hour < 10) {
                  // Auto-correct to 10:00 AM same day
                  setMeetingTime(val.slice(0, 11) + "10:00");
                  return;
                }
                if (hour >= 19) {
                  // Auto-correct to 7:00 PM same day
                  setMeetingTime(val.slice(0, 11) + "19:00");
                  return;
                }
              }
              setMeetingTime(val);
            }}
            style={inputStyle}
          />
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "block" }}>
            Meetings can only be scheduled between 10:00 AM and 7:00 PM.
          </span>
        </label>

        {/* Link type selector */}
        <div>
          <span style={labelStyle}>Meeting Platform</span>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(["google", "zoom", "teams", "custom"] as const).map(t => (
              <button key={t} type="button" onClick={() => setLinkType(t)}
                style={{
                  padding: "0.4rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border)",
                  background: linkType === t ? "var(--accent)" : "var(--bg-secondary)",
                  color: linkType === t ? "var(--accent-text)" : "var(--text-primary)",
                  fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {t === "google" ? "Google Meet" : t === "zoom" ? "Zoom" : t === "teams" ? "MS Teams" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span style={labelStyle}>
            {linkType === "custom" ? "Custom Meeting Link" : `${linkType === "google" ? "Google Meet" : linkType === "zoom" ? "Zoom" : "Teams"} Link`}
          </span>
          <input
            value={customLink}
            onChange={e => setCustomLink(e.target.value)}
            placeholder={linkPlaceholders[linkType]}
            style={inputStyle}
          />
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "block" }}>
            Leave blank to generate a meeting link automatically.
          </span>
        </label>

        {result && (
          <div style={{
            padding: "0.75rem 1rem", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.85rem",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: result.ok ? "var(--text-primary)" : "#ef4444",
          }}>
            <div>{result.msg}</div>
            {result.link && (
              <a
                href={result.link}
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit", display: "block", marginTop: "0.35rem", wordBreak: "break-all" }}
              >
                {result.link}
              </a>
            )}
          </div>
        )}

        <button type="submit" disabled={sending} style={{
          padding: "0.875rem", borderRadius: "0.75rem", border: "none",
          background: "var(--accent)", color: "var(--accent-text)",
          fontSize: "0.95rem", fontWeight: 700, cursor: sending ? "not-allowed" : "pointer",
          opacity: sending ? 0.65 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
        }}>
          {sending ? "Sending…" : "📤 Send Meeting Link via WhatsApp"}
        </button>
      </form>
    </div>
  );
}

// ─── Offer Letter Tab ─────────────────────────────────────────────────────────
function OfferLetterTab() {
  const [candidates, setCandidates] = useState<Record<string, unknown>[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [position, setPosition] = useState("");
  const [salary, setSalary] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [department, setDepartment] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/candidates`);
        const data = await response.json();
        setCandidates(data.data || []);
      } catch (error) {
        console.error("Failed to fetch candidates", error);
      }
    };
    fetchCandidates();
  }, []);

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidate(candidateId);
    const candidate = candidates.find((c: Record<string, unknown>) => c._id === candidateId);
    if (candidate) {
      setCandidatePhone(String(candidate.phone) || "");
      setCandidateQuery(String(candidate.name || ""));
    }
  };

  const handleSend = async () => {
    if (!selectedCandidate || !position || !salary || !joiningDate || !department || !candidatePhone) {
      alert("Please fill all fields");
      return;
    }

    setSendingMessage(true);
    setResult(null);
    try {
      // Generate PDF on backend
      const pdfResponse = await fetch(`${getApiBaseUrl()}/api/offer-letters/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: selectedCandidate,
          position,
          salary,
          joining_date: joiningDate,
          department,
        }),
      });
      const pdfData = await pdfResponse.json();
      if (!pdfData.pdf_url) throw new Error("No PDF URL returned");

      // Send via WhatsApp with auto-generated caption
      const caption = `🎉 Congratulations!\n\nYour offer letter for the position of ${position} is attached. Please review and confirm your joining date of ${joiningDate}.\n\nSalary: ${salary}\nDepartment: ${department}`;
      await whatsappApi.sendMediaMessage(candidatePhone, pdfData.pdf_url, caption);

      setResult({ ok: true, msg: "Offer letter sent successfully via WhatsApp!" });
      setSelectedCandidate("");
      setPosition("");
      setSalary("");
      setJoiningDate("");
      setDepartment("");
      setCandidatePhone("");
    } catch (error) {
      setResult({ ok: false, msg: `Error: ${error instanceof Error ? error.message : "Unknown error"}` });
    } finally {
      setSendingMessage(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.75rem", borderRadius: "0.5rem",
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>
        Send Offer Letter
      </h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 1.5rem 0" }}>
        Generate and send offer letter PDF via WhatsApp with auto-formatted message.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
            Select Candidate *
          </label>
          <input
            type="text"
            value={candidateQuery}
            onChange={(e) => setCandidateQuery(e.target.value)}
            placeholder="Type candidate name or email..."
            style={inputStyle}
          />
          <div style={{ position: "relative", marginTop: "0.5rem" }}>
            <div style={{
              maxHeight: "200px",
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              background: "var(--bg-primary)",
            }}>
              {candidates
                .filter((c) => {
                  const name = String(c.name || "").toLowerCase();
                  return candidateQuery.trim() === "" || name.includes(candidateQuery.toLowerCase());
                })
                .slice(0, 10)
                .map((c) => (
                  <button
                    key={String(c._id)}
                    type="button"
                    onClick={() => handleCandidateSelect(String(c._id))}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.75rem 1rem",
                      background: selectedCandidate === String(c._id) ? "var(--bg-secondary)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-primary)",
                    }}
                  >
                    {String(c.name)}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Position *</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Senior Developer" style={inputStyle} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Salary *</label>
          <input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. ₹15,00,000" style={inputStyle} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Joining Date *</label>
          <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Department *</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Engineering" style={inputStyle} />
        </div>

        {result && (
          <div style={{
            padding: "0.75rem 1rem", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.85rem",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            color: result.ok ? "var(--text-primary)" : "#ef4444",
          }}>
            {result.msg}
          </div>
        )}

        <button onClick={handleSend} disabled={sendingMessage} style={{
          padding: "0.875rem", borderRadius: "0.75rem", border: "none",
          background: "var(--accent)", color: "var(--accent-text)",
          fontSize: "0.95rem", fontWeight: 700, cursor: sendingMessage ? "not-allowed" : "pointer",
          opacity: sendingMessage ? 0.65 : 1,
        }}>
          {sendingMessage ? "Sending…" : "📤 Generate & Send via WhatsApp"}
        </button>
      </div>
    </div>
  );
}

// ─── Salary Slip Tab ──────────────────────────────────────────────────────────
function SalarySlipTab() {
  const [employees, setEmployees] = useState<Record<string, unknown>[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [sendingMessage, setSendingMessage] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/employees`);
        const data = await response.json();
        setEmployees(data.data || []);
      } catch (error) {
        console.error("Failed to fetch employees", error);
      }
    };
    fetchEmployees();
  }, []);

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    const employee = employees.find((e: Record<string, unknown>) => e._id === employeeId);
    if (employee) {
      setEmployeePhone(String(employee.phone) || "");
    }
  };

  const handleSend = async () => {
    if (!selectedEmployee || !month || !year || !employeePhone) {
      alert("Please fill all fields");
      return;
    }

    setSendingMessage(true);
    setResult(null);
    try {
      // Generate payslip on backend
      const pdfResponse = await fetch(`${getApiBaseUrl()}/api/salary/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployee,
          month: parseInt(month),
          year: parseInt(year),
        }),
      });
      const pdfData = await pdfResponse.json();
      if (!pdfData.pdf_url) throw new Error("No PDF URL returned");

      // Send via WhatsApp
      const monthName = new Date(`${year}-${month}-01`).toLocaleString("en-US", { month: "long" });
      const caption = `💰 Your Salary Slip\n\nSalary for ${monthName} ${year} is attached.\n\nPlease review and contact HR if you have any questions.`;
      await whatsappApi.sendMediaMessage(employeePhone, pdfData.pdf_url, caption);

      setResult({ ok: true, msg: "Salary slip sent successfully via WhatsApp!" });
      setSelectedEmployee("");
      setMonth("");
      setYear(new Date().getFullYear().toString());
      setEmployeePhone("");
    } catch (error) {
      setResult({ ok: false, msg: `Error: ${error instanceof Error ? error.message : "Unknown error"}` });
    } finally {
      setSendingMessage(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.75rem", borderRadius: "0.5rem",
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>
        Send Salary Slip
      </h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 1.5rem 0" }}>
        Generate and send payslip PDF via WhatsApp with auto-formatted message.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
            Select Employee *
          </label>
          <select value={selectedEmployee} onChange={(e) => handleEmployeeSelect(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">Choose employee...</option>
            {employees.map((e: Record<string, unknown>) => <option key={String(e._id)} value={String(e._id)}>{String(e.name)}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Month *</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Select month...</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                  {new Date(2024, i).toLocaleString("en-US", { month: "long" })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Year *</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} min="2020" max={new Date().getFullYear() + 1} style={inputStyle} />
          </div>
        </div>

        {result && (
          <div style={{
            padding: "0.75rem 1rem", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.85rem",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            color: result.ok ? "var(--text-primary)" : "#ef4444",
          }}>
            {result.msg}
          </div>
        )}

        <button onClick={handleSend} disabled={sendingMessage} style={{
          padding: "0.875rem", borderRadius: "0.75rem", border: "none",
          background: "var(--accent)", color: "var(--accent-text)",
          fontSize: "0.95rem", fontWeight: 700, cursor: sendingMessage ? "not-allowed" : "pointer",
          opacity: sendingMessage ? 0.65 : 1,
        }}>
          {sendingMessage ? "Sending…" : "📤 Generate & Send via WhatsApp"}
        </button>
      </div>
    </div>
  );
}

// ─── Shortlist Report Tab ─────────────────────────────────────────────────────
function ShortlistReportTab() {
  const [hrUsers, setHrUsers] = useState<Record<string, unknown>[]>([]);
  const [selectedHrUser, setSelectedHrUser] = useState("");
  const [hrUserPhone, setHrUserPhone] = useState("");
  const [reportType, setReportType] = useState("all");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const fetchHrUsers = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/team-users`);
        const data = await response.json();
        setHrUsers(data.data || []);
      } catch (error) {
        console.error("Failed to fetch HR users", error);
      }
    };
    fetchHrUsers();
  }, []);

  const handleHrUserSelect = (userId: string) => {
    setSelectedHrUser(userId);
    const user = hrUsers.find((u: Record<string, unknown>) => u._id === userId);
    if (user) {
      setHrUserPhone(String(user.phone) || "");
    }
  };

  const handleSend = async () => {
    if (!selectedHrUser || !reportType || !hrUserPhone) {
      alert("Please fill all fields");
      return;
    }

    setSendingMessage(true);
    setResult(null);
    try {
      // Generate report on backend
      const reportResponse = await fetch(`${getApiBaseUrl()}/api/candidates/report/generate-shortlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: reportType,
          hr_user_id: selectedHrUser,
        }),
      });
      const reportData = await reportResponse.json();
      if (!reportData.pdf_url) throw new Error("No PDF URL returned");

      // Send via WhatsApp
      const typeLabel = reportType === "all" ? "All Candidates" : reportType === "shortlisted" ? "Shortlisted Candidates" : "Interview Progress";
      const caption = `📊 Candidate Shortlist Report\n\nReport Type: ${typeLabel}\n\nPlease review the attached report with all candidate details and next interview round information.`;
      await whatsappApi.sendMediaMessage(hrUserPhone, reportData.pdf_url, caption);

      setResult({ ok: true, msg: "Shortlist report sent successfully via WhatsApp!" });
      setSelectedHrUser("");
      setReportType("all");
      setHrUserPhone("");
    } catch (error) {
      setResult({ ok: false, msg: `Error: ${error instanceof Error ? error.message : "Unknown error"}` });
    } finally {
      setSendingMessage(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.75rem", borderRadius: "0.5rem",
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>
        Send Shortlist Report
      </h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 1.5rem 0" }}>
        Generate and send candidate shortlist report PDF via WhatsApp with auto-formatted message.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
            Select HR Manager *
          </label>
          <select value={selectedHrUser} onChange={(e) => handleHrUserSelect(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">Choose HR manager...</option>
            {hrUsers.map((u: Record<string, unknown>) => <option key={String(u._id)} value={String(u._id)}>{String(u.name)}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Report Type *</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="all">All Candidates</option>
            <option value="shortlisted">Shortlisted Candidates</option>
            <option value="interview_progress">Interview Progress</option>
          </select>
        </div>

        {result && (
          <div style={{
            padding: "0.75rem 1rem", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.85rem",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            color: result.ok ? "var(--text-primary)" : "#ef4444",
          }}>
            {result.msg}
          </div>
        )}

        <button onClick={handleSend} disabled={sendingMessage} style={{
          padding: "0.875rem", borderRadius: "0.75rem", border: "none",
          background: "var(--accent)", color: "var(--accent-text)",
          fontSize: "0.95rem", fontWeight: 700, cursor: sendingMessage ? "not-allowed" : "pointer",
          opacity: sendingMessage ? 0.65 : 1,
        }}>
          {sendingMessage ? "Sending…" : "📤 Generate & Send via WhatsApp"}
        </button>
      </div>
    </div>
  );
}

// Helper function to get API base URL
function getApiBaseUrl(): string {
  return typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : window.location.origin;
}

