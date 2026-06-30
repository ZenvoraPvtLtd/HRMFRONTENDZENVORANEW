import { useState } from "react";
import {
  Bot,
  Zap,
  Settings,
  Plus,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  FileText,
  ChevronRight,
} from "lucide-react";
import Button from "../../../components/button/Button";
import ConstrainedDropdown from "../../../components/ConstrainedDropdown";

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused";
  trigger: string;
  action: string;
  runs: number;
}

const initialWorkflows: Workflow[] = [
  {
    id: "1",
    name: "Auto-Shortlist High ATS",
    description:
      "Automatically moves candidates to Shortlisted if ATS score > 85%",
    status: "active",
    trigger: "New Application",
    action: "Update Status",
    runs: 142,
  },
  {
    id: "2",
    name: "Reject Unqualified",
    description: "Sends polite rejection if ATS score < 40%",
    status: "active",
    trigger: "New Application",
    action: "Send Email",
    runs: 328,
  },
  {
    id: "3",
    name: "Interview WhatsApp Reminder",
    description: "Sends WhatsApp message 24hrs before scheduled interview",
    status: "active",
    trigger: "Scheduled Interview",
    action: "Send WhatsApp",
    runs: 56,
  },
  {
    id: "4",
    name: "HR Notification: Offer Accepted",
    description: "Notifies HR channel when a candidate signs offer",
    status: "active",
    trigger: "Offer Signed",
    action: "Notify HR",
    runs: 12,
  },
  {
    id: "5",
    name: "Auto-Assign Onboarding",
    description: "Generates IT and HR tasks when hired",
    status: "paused",
    trigger: "Status = Hired",
    action: "Assign Tasks",
    runs: 0,
  },
];

const recentActivity = [
  {
    time: "10 mins ago",
    action: "Auto-rejected 12 candidates",
    workflow: "Reject Unqualified",
    icon: <Mail size={14} className="text-red-500" />,
  },
  {
    time: "1 hour ago",
    action: "Sent WhatsApp reminder to Anugrah Prasetya",
    workflow: "Interview WhatsApp Reminder",
    icon: <MessageCircle size={14} className="text-green-500" />,
  },
  {
    time: "2 hours ago",
    action: "Shortlisted Silvia Cintia Bakri (ATS: 92%)",
    workflow: "Auto-Shortlist High ATS",
    icon: <CheckCircle2 size={14} className="text-blue-500" />,
  },
  {
    time: "5 hours ago",
    action: "Assigned 5 onboarding tasks for new hire",
    workflow: "Auto-Assign Onboarding",
    icon: <FileText size={14} className="text-purple-500" />,
  },
];

export default function WorkflowAutomationPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const [newWfName, setNewWfName] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [selectedAction, setSelectedAction] = useState("");

  const handleToggleStatus = (id: string) => {
    setWorkflows(
      workflows.map((wf) =>
        wf.id === id
          ? { ...wf, status: wf.status === "active" ? "paused" : "active" }
          : wf,
      ),
    );
  };

  const handleSaveWorkflow = () => {
    if (!newWfName || !selectedTrigger || !selectedAction) return;
    const newWf: Workflow = {
      id: Math.random().toString(36).substring(7),
      name: newWfName,
      description: `${selectedTrigger} → ${selectedCondition ? selectedCondition + " → " : ""}${selectedAction}`,
      status: "active",
      trigger: selectedTrigger,
      action: selectedAction,
      runs: 0,
    };
    setWorkflows([newWf, ...workflows]);
    setIsBuilderOpen(false);
    setNewWfName("");
    setSelectedTrigger("");
    setSelectedCondition("");
    setSelectedAction("");
  };

  return (
    <div
      className="animate-fade-in"
      style={{ padding: "0 0.5rem", maxWidth: "1200px", margin: "0 auto" }}
    >
    
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "1.5rem",
        }}
      >
        <Button
          onClick={() => setIsBuilderOpen(true)}
          style={{
            width: "auto",
            padding: "0.625rem 1.25rem",
            display: "inline-flex",
            gap: "0.5rem",
          }}
        >
          <Plus size={18} /> Create Workflow
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-sm mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Active Automations
          </div>
          <div className="flex items-end gap-3">
            <div
              className="text-4xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {workflows.filter((w) => w.status === "active").length}
            </div>
            <div className="text-sm font-medium text-green-500 mb-1 flex items-center">
              <Zap size={14} className="mr-1" /> Live
            </div>
          </div>
        </div>
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-sm mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Tasks Automated Today
          </div>
          <div className="flex items-end gap-3">
            <div
              className="text-4xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              1,432
            </div>
            <div className="text-sm font-medium text-green-500 mb-1">
              +12% vs yesterday
            </div>
          </div>
        </div>
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-sm mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Estimated Time Saved
          </div>
          <div className="flex items-end gap-3">
            <div
              className="text-4xl font-bold"
              style={{ color: "var(--accent)" }}
            >
              24<span className="text-2xl text-gray-500 ml-1">hrs</span>
            </div>
            <div className="text-sm font-medium text-gray-400 mb-1">
              This week
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Workflow List */}
        <div className="lg:col-span-2">
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            <div
              style={{
                padding: "1.5rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Configured Workflows
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {workflows.map((wf, idx) => (
                <div
                  key={wf.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1.5rem",
                    borderBottom:
                      idx !== workflows.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    background:
                      wf.status === "paused"
                        ? "rgba(0,0,0,0.02)"
                        : "transparent",
                    opacity: wf.status === "paused" ? 0.7 : 1,
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {wf.name}
                      </h4>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.125rem 0.5rem",
                          borderRadius: "1rem",
                          background:
                            wf.status === "active"
                              ? "rgba(16,185,129,0.1)"
                              : "var(--bg-hover)",
                          color:
                            wf.status === "active"
                              ? "#10b981"
                              : "var(--text-secondary)",
                        }}
                      >
                        {wf.status.toUpperCase()}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {wf.description}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        marginTop: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          background: "var(--bg-hover)",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <Zap size={12} /> {wf.trigger}
                      </div>
                      <ChevronRight size={14} className="text-gray-400" />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.75rem",
                          color: "var(--text-primary)",
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border)",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.5rem",
                        }}
                      >
                        {wf.action}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ color: "var(--text-primary)" }}>
                        {wf.runs}
                      </span>{" "}
                      runs
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleToggleStatus(wf.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: wf.status === "active" ? "#f59e0b" : "#10b981",
                          padding: "0.5rem",
                          borderRadius: "0.5rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title={
                          wf.status === "active"
                            ? "Pause Workflow"
                            : "Start Workflow"
                        }
                      >
                        {wf.status === "active" ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} />
                        )}
                      </button>
                      <button
                        style={{
                          background: "var(--bg-hover)",
                          border: "none",
                          color: "var(--text-secondary)",
                          padding: "0.5rem",
                          borderRadius: "0.5rem",
                          cursor: "pointer",
                        }}
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 1.5rem 0",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Clock size={18} className="text-blue-500" /> Automation Log
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              {recentActivity.map((log, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "1rem", position: "relative" }}
                >
                  {/* Line connector */}
                  {i !== recentActivity.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        left: "11px",
                        top: "24px",
                        bottom: "-24px",
                        width: "2px",
                        background: "var(--border)",
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      zIndex: 1,
                    }}
                  >
                    {log.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                        lineHeight: 1.4,
                      }}
                    >
                      {log.action}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      {log.workflow} • {log.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Builder Modal */}
      {isBuilderOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              width: "100%",
              maxWidth: "600px",
              borderRadius: "1.5rem",
              padding: "2rem",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                margin: "0 0 1.5rem 0",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Bot className="text-purple-500" /> Build Workflow
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                  placeholder="e.g., Auto-Reject Low Score"
                  style={{
                    width: "100%",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  padding: "1.5rem",
                  background: "var(--bg-primary)",
                  border: "1px dashed var(--border)",
                  borderRadius: "1rem",
                  position: "relative",
                }}
              >
                {/* Trigger */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <Zap size={16} className="text-yellow-500" /> When this
                    happens... (Trigger)
                  </label>
                  <ConstrainedDropdown
                    value={selectedTrigger}
                    onChange={setSelectedTrigger}
                    options={[
                      { value: "", label: "Select Trigger" },
                      "New Application Received",
                      "Candidate Stage Changed",
                      "Interview Scheduled",
                      "Interview Completed",
                    ]}
                    buttonStyle={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                    }}
                  />
                </div>

                {/* Condition (Optional) */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <AlertCircle size={16} className="text-blue-500" /> If...
                    (Condition - Optional)
                  </label>
                  <input
                    type="text"
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    placeholder="e.g., ATS Score < 40%"
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

                {/* Action */}
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <Play size={16} className="text-green-500" /> Then do
                    this... (Action)
                  </label>
                  <ConstrainedDropdown
                    value={selectedAction}
                    onChange={setSelectedAction}
                    options={[
                      { value: "", label: "Select Action" },
                      "Reject Candidate",
                      "Send Email",
                      "Send WhatsApp Message",
                      "Notify HR Team",
                      "Assign Onboarding Tasks",
                    ]}
                    buttonStyle={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <button
                onClick={() => setIsBuilderOpen(false)}
                style={{
                  flex: 1,
                  padding: "0.875rem",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  borderRadius: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <Button
                onClick={handleSaveWorkflow}
                disabled={!newWfName || !selectedTrigger || !selectedAction}
                style={{ flex: 1, padding: "0.875rem" }}
              >
                Save & Activate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
