import React, { useState, useRef } from "react";
import type { CSSProperties } from "react";
import {
  Sparkles,
  Loader2,
  CheckCircle,
  ChevronLeft,
} from "lucide-react";

import Button from "../../../components/button/Button";
import ConstrainedDropdown from "../../../components/ConstrainedDropdown";
import { getApiBaseUrl } from "../../../config/apiConfig";

export interface JobFormData {
  title: string;
  description: string;
  department: string;
  location: string;
  jobType: string;
  experienceLevel: string;
  salaryMin: string;
  salaryMax: string;
  skills: string;
  responsibilities: string;
  qualifications: string;
  openings: string;
  status: string;
  applicationDeadline: string;
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  outline: "none",
};

const AI_FIELDS = [
  "description",
  "responsibilities",
  "qualifications",
] as const;

const processField = async (
  text: string
): Promise<{ result: string; changes: string[] }> => {
  if (!text.trim()) return { result: text, changes: [] };

  try {
    const backendUrl = getApiBaseUrl();

    const res = await fetch(
      `${backendUrl}/api/ai/fix_description`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!res.ok) {
      throw new Error("API request failed");
    }

    const data = await res.json();

    if (data.success && data.fixed_text) {
      return {
        result: data.fixed_text,
        changes:
          data.fixed_text !== text
            ? ["Enhanced by AI"]
            : [],
      };
    }
  } catch (error) {
    console.error(error);
  }

  return { result: text, changes: [] };
};

export const JobForm = ({
  newJob,
  setNewJob,
  handleCreateJob,
  setIsCreatingJob,
  isEditing = false,
}: {
  newJob: JobFormData;
  setNewJob: React.Dispatch<
    React.SetStateAction<JobFormData>
  >;
  handleCreateJob: (e: React.FormEvent) => void;
  setIsCreatingJob: (v: boolean) => void;
  isEditing?: boolean;
}) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [aiError, setAiError] = useState<string | null>(
    null
  );
  const [aiChanges, setAiChanges] = useState<Record<string, string[]>>({});

  const timerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const field =
    (key: keyof JobFormData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement |
        HTMLTextAreaElement |
        HTMLSelectElement
      >
    ) => {
      setNewJob((prev) => ({
        ...prev,
        [key]: e.target.value,
      }));
    };
  const setFieldValue = (key: keyof JobFormData) => (value: string) => {
    setNewJob((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAiFix = async () => {
    const hasContent = AI_FIELDS.some((f) =>
      newJob[f]?.trim()
    );

    if (!hasContent) {
      setAiError(
        "Please fill at least one AI field first."
      );
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiDone(false);
    setAiChanges({});

    try {
      const snapshots = AI_FIELDS.reduce<
        Record<string, string>
      >((acc, f) => {
        acc[f] = newJob[f] || "";
        return acc;
      }, {});

      const results = await Promise.all(
        AI_FIELDS.map(async (f) => {
          const { result, changes } =
            await processField(snapshots[f]);

          return {
            field: f,
            result,
            changes,
          };
        })
      );

      const patch: Partial<JobFormData> = {};
      const changes: Record<string, string[]> = {};

      results.forEach(({ field, result, changes: ch }) => {
        patch[field] = result;

        if (ch.length > 0) {
          changes[field] = ch;
        }
      });

      setNewJob((prev) => ({
        ...prev,
        ...patch,
      }));

      setAiChanges(changes);
      setAiDone(Object.keys(changes).length > 0);
      setAiChanges(changes);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setAiDone(false);
        setAiChanges({});
      }, 7000);
    } catch {
      setAiError("AI Fix failed.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: "0.5rem",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <div
        className="card"
        style={{
          padding: "2rem",
        }}
      >
        {/* Back */}
        <div
          role="button"
          onClick={() => setIsCreatingJob(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
            marginBottom: "1.5rem",
            color: "var(--text-secondary)",
          }}
        >
          <ChevronLeft size={18} />
          Back to Job Board
        </div>

        {/* Heading */}
        <h2
          style={{
            fontSize: "1.5rem",
            marginBottom: "0.5rem",
            color: "var(--text-primary)",
          }}
        >
          {isEditing
            ? "Edit Job Posting"
            : "Create New Job Posting"}
        </h2>

        <p
          style={{
            color: "var(--text-secondary)",
            marginBottom: "2rem",
          }}
        >
          Fill all details carefully.
        </p>

        {/* FORM */}
        <form
          onSubmit={handleCreateJob}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {/* Title + Department */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <input
              required
              type="text"
              placeholder="Job Title"
              value={newJob.title}
              onChange={field("title")}
              style={inputStyle}
            />

            <input
              required
              type="text"
              placeholder="Department"
              value={newJob.department}
              onChange={field("department")}
              style={inputStyle}
            />
          </div>

          <div className="profile-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Location</label>
              <input required type="text" value={newJob.location} onChange={e => setNewJob({ ...newJob, location: e.target.value })} placeholder="e.g. Remote / New York" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Job Type</label>
              <select required value={newJob.jobType} onChange={e => setNewJob({ ...newJob, jobType: e.target.value })} style={inputStyle}>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          {/* Location + Type */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <input
              required
              type="text"
              placeholder="Location"
              value={newJob.location}
              onChange={field("location")}
              style={inputStyle}
            />

            <ConstrainedDropdown
              value={newJob.jobType}
              onChange={setFieldValue("jobType")}
              options={["Full-time", "Part-time", "Internship", "Contract"]}
              buttonStyle={inputStyle}
            />
          </div>

          </div>

          {/* Experience + Openings */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <input
              required
              type="text"
              placeholder="Experience Level"
              value={newJob.experienceLevel}
              onChange={field("experienceLevel")}
              style={inputStyle}
            />

            <input
              type="number"
              placeholder="Openings"
              value={newJob.openings}
              onChange={field("openings")}
              style={inputStyle}
            />
          </div>

          {/* Salary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <input
              type="number"
              placeholder="Salary Min"
              value={newJob.salaryMin}
              onChange={field("salaryMin")}
              style={inputStyle}
            />

            <input
              type="number"
              placeholder="Salary Max"
              value={newJob.salaryMax}
              onChange={field("salaryMax")}
              style={inputStyle}
            />
          </div>

          {/* AI FIX */}
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
            }}
          >
            <button
              type="button"
              onClick={handleAiFix}
              disabled={aiLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.7rem 1rem",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                background: "var(--accent)",
                color: "white",
                fontWeight: 600,
              }}
            >
              {aiLoading ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Fixing...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  AI Fix
                </>
              )}
            </button>

            {aiDone && (
              <div
                style={{
                  marginTop: "1rem",
                  color: "#22c55e",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <CheckCircle size={16} />
                AI Fix Applied
              </div>
            )}

            {/* AI Changes would go here when implemented */}
            {/* 
            {Object.keys(aiChanges).length > 0 && (
              <div
                style={{
                  marginTop: "0.75rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                }}
              >
                {Object.entries(aiChanges).map(([fieldName, changes]) => (
                  <div key={fieldName}>
                    {fieldName}: {changes.join(", ")}
                  </div>
                ))}
              </div>
            )}
            */}

            {aiError && (
              <div
                style={{
                  marginTop: "1rem",
                  color: "#ef4444",
                }}
              >
                {aiError}
              </div>
            )}
          </div>

          {/* Description */}
          <textarea
            required
            placeholder="Job Description"
            value={newJob.description}
            onChange={field("description")}
            style={{
              ...inputStyle,
              minHeight: "120px",
              resize: "vertical",
            }}
          />

          {/* Responsibilities */}
          <textarea
            required
            placeholder="Responsibilities"
            value={newJob.responsibilities}
            onChange={field("responsibilities")}
            style={{
              ...inputStyle,
              minHeight: "120px",
              resize: "vertical",
            }}
          />

          {/* Qualifications */}
          <textarea
            required
            placeholder="Qualifications"
            value={newJob.qualifications}
            onChange={field("qualifications")}
            style={{
              ...inputStyle,
              minHeight: "120px",
              resize: "vertical",
            }}
          />

          {/* Skills */}
          <input
            required
            type="text"
            placeholder="Skills"
            value={newJob.skills}
            onChange={field("skills")}
            style={inputStyle}
          />

          {/* Status + Deadline */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <ConstrainedDropdown
              value={newJob.status}
              onChange={setFieldValue("status")}
              options={["Open", "Closed", "Paused"]}
              buttonStyle={inputStyle}
            />

            <input
              type="date"
              value={newJob.applicationDeadline}
              onChange={field(
                "applicationDeadline"
              )}
              style={inputStyle}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setIsCreatingJob(false)
              }
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                border:
                  "1px solid var(--border)",
                background: "transparent",
                cursor: "pointer",
                color: "var(--text-primary)",
              }}
            >
              Cancel
            </button>

            <Button
              type="submit"
              style={{
                width: "auto",
                padding: "0.75rem 2rem",
              }}
            >
              {isEditing
                ? "Save Changes"
                : "Create Job"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
