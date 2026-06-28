import React, { useState, useEffect } from "react";
import { profileApi } from "../../services/profileApi";
import { getProfileFields } from "../../types/profile";
import { Download, Edit2, Eye, EyeOff, FileText, Plus, RefreshCw, Save, Trash2, Upload, X, Mail, Phone, User, Briefcase } from "lucide-react";
import type { UserProfile, ProfileUpdateRequest, ProfileFieldKey } from "../../types/profile";
import api from "../../utils/axiosInstance";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { storeAuthUser } from "../../utils/auth";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

type DocumentStatus = "Pending For Review" | "Approved" | "Rejected" | "Expired";

type UploadedDocument = {
  id: string;
  employee_id: string;
  employee_name: string;
  email: string;
  document_type: string;
  file_name: string;
  file_url: string;
  status: DocumentStatus;
  expiry_date: string;
  uploaded_at?: string;
};

function syncProfileStorage(profile: UserProfile) {
  storeAuthUser(profile);
  const role = String(profile.role || "").toLowerCase();
  if (role === "hr" || role === "manager" || role === "admin") {
    localStorage.setItem("hr_userRole", role);
    if (profile.name) localStorage.setItem("hr_userName", profile.name);
    if (profile.email) localStorage.setItem("hr_userEmail", profile.email);
  }
}

const documentTypes = [
  "Id Proof",
  "Bank Details",
  "Address Proof",
  "Education Certificate",
  "Experience Letter",
  "Offer Letter",
];

/**
 * Field component props
 * Handles rendering of individual profile fields with optional edit capability
 */
interface FieldProps {
  label: string;
  fieldKey: ProfileFieldKey;
  value: string | number | undefined;
  icon: React.ReactNode;
}

/**
 * Reusable Field Component
 * 
 * Displays a profile field in read-only display mode.
 */
const Field: React.FC<FieldProps> = ({
  label,
  value,
  icon,
}) => {
  return (
    <div
      className="flex items-center gap-3 py-4 transition-colors"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Icon */}
      <span className="shrink-0" style={{ color: "var(--accent)" }}>
        {icon}
      </span>

      {/* Label and Value */}
      <div className="flex-1 min-w-0">
        <div
          className="text-xs uppercase tracking-wider mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </div>

        <div
          className="text-sm font-semibold truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {value || <span>&mdash;</span>}
        </div>
      </div>
    </div>
  );
};

/**
 * ProfilePage Component
 * 
 * Main component that handles:
 * - Fetching user profile from API
 * - Managing edit state
 * - Saving profile updates
 * - Dynamic role-based field rendering
 * - Loading and error states
 */
const ProfilePage: React.FC = () => {
  // â"€â"€ State Management â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Global edit mode (single Edit Profile button) ──────────────────
  const [isEditingAll, setIsEditingAll] = useState(false);
  const [editAllValues, setEditAllValues] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState(documentTypes[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [replacingDocumentId, setReplacingDocumentId] = useState<string | null>(null);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "personal" | "emergency" | "finance" | "documents" | "skills" | "security" | "onboarding"
  >("personal");
  const [skillsInput, setSkillsInput] = useState("");
  const [skillDraft, setSkillDraft] = useState("");
  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [onboardingChecklist, setOnboardingChecklist] = useState<
    Array<{ id: string; title: string; status: string; completedAt?: string | null }>
  >([]);
  const [onboardingStats, setOnboardingStats] = useState({ total: 0, completed: 0, percent: 0 });
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    bankAccountDetails: "",
    uanNumber: "",
    dateOfBirth: "",
    reportingTime: "09:00 AM",
    workingHoursPerDay: "8",
  });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail || "");
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  // â"€â"€ Fetch Profile on Component Mount â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  /**
   * useEffect hook to fetch user profile when component loads
   * Makes GET /api/profile/me request
   */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch profile from API
        const profileData = await profileApi.fetchProfile();
        syncProfileStorage(profileData);
        setProfile(profileData);
        setProfileForm({
          address: profileData.address || "",
          emergencyContactName: profileData.emergencyContactName || "",
          emergencyContactPhone: profileData.emergencyContactPhone || "",
          bankAccountDetails: profileData.bankAccountDetails || "",
          uanNumber: profileData.uanNumber || "",
          dateOfBirth: profileData.dateOfBirth?.slice(0, 10) || "",
          reportingTime: profileData.reportingTime || "09:00 AM",
          workingHoursPerDay: String(profileData.workingHoursPerDay || 8),
        });
        setSkillsInput((profileData.skills || []).join(", "));
        setSkillsList(profileData.skills || []);
      } catch (err: unknown) {
        // Handle error
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err) || "Failed to load profile");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!profile) return;

      try {
        setDocumentsLoading(true);
        const response = await api.get<UploadedDocument[]>("/api/documents/my");
        setDocuments(response.data);
      } catch (err) {
        console.error("Failed to fetch documents", err);
      } finally {
        setDocumentsLoading(false);
      }
    };

    fetchDocuments();
  }, [profile]);

  useEffect(() => {
    const fetchOnboarding = async () => {
      if (!profile || activeTab !== "onboarding") return;
      try {
        setOnboardingLoading(true);
        const response = await api.get<{
          checklist: Array<{ id: string; title: string; status: string; completedAt?: string | null }>;
          stats: { total: number; completed: number; percent: number };
        }>("/api/profile/me/onboarding-checklist");
        setOnboardingChecklist(response.data.checklist || []);
        setOnboardingStats(response.data.stats || { total: 0, completed: 0, percent: 0 });
      } catch (err) {
        console.error("Failed to fetch onboarding checklist", err);
      } finally {
        setOnboardingLoading(false);
      }
    };

    fetchOnboarding();
  }, [profile, activeTab]);


  const uploadDocument = async () => {
    if (!profile || !selectedFile) {
      setDocumentMessage("Please choose a file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append(
      "employee_id",
      "employeeId" in profile && profile.employeeId ? profile.employeeId : profile._id,
    );
    formData.append("employee_name", profile.name);
    formData.append("email", profile.email);
    formData.append("document_type", selectedDocumentType);
    formData.append("expiry_date", expiryDate || "-");
    formData.append("file", selectedFile);

    try {
      setUploadingDocument(true);
      setDocumentMessage(null);
      const response = await api.post<UploadedDocument>("/api/documents", formData);
      setDocuments((prev) => [response.data, ...prev]);
      setSelectedFile(null);
      setExpiryDate("");
      setSelectedDocumentType(documentTypes[0]);
      setDocumentMessage("Document uploaded successfully. HR can review it now.");
    } catch (err) {
      console.error("Failed to upload document", err);
      setDocumentMessage("Document upload failed. Please try again.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const replaceDocument = async (documentId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      setReplacingDocumentId(documentId);
      setDocumentMessage(null);
      const response = await api.patch<UploadedDocument>(`/api/documents/${documentId}`, formData);
      setDocuments((prev) =>
        prev.map((document) => (document.id === documentId ? response.data : document)),
      );
      setDocumentMessage("Document replaced successfully. HR can review the new file.");
    } catch (err) {
      console.error("Failed to replace document", err);
      setDocumentMessage("Document replace failed. Please try again.");
    } finally {
      setReplacingDocumentId(null);
    }
  };

  const saveProfileSection = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updatedProfile = await profileApi.updateProfile({
        address: profileForm.address,
        emergencyContactName: profileForm.emergencyContactName,
        emergencyContactPhone: profileForm.emergencyContactPhone,
        bankAccountDetails: profileForm.bankAccountDetails,
        uanNumber: profileForm.uanNumber,
        dateOfBirth: profileForm.dateOfBirth || undefined,
        reportingTime: profileForm.reportingTime,
        workingHoursPerDay: Number(profileForm.workingHoursPerDay || 8),
        skills: skillsList.length ? skillsList : skillsInput
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
      });
      syncProfileStorage(updatedProfile);
      setProfile(updatedProfile);
      setSkillsInput((updatedProfile.skills || []).join(", "));
      setSkillsList(updatedProfile.skills || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const value = skillDraft.trim();
    if (!value || skillsList.includes(value)) return;
    setSkillsList((prev) => [...prev, value]);
    setSkillDraft("");
  };

  const removeSkill = (skill: string) => {
    setSkillsList((prev) => prev.filter((item) => item !== skill));
  };

  const updatePassword = async () => {
    const pw = passwordForm.newPassword;
    const isStrong =
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw);
    if (!isStrong) {
      setPasswordMessage(
        "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character."
      );
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage("New password and confirm password do not match");
      return;
    }
    setPasswordSaving(true);
    setPasswordMessage(null);
    try {
      const response = await api.post<{ message: string }>("/api/auth/change-password", passwordForm);
      setPasswordMessage(response.data.message || "Password updated successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update password";
      setPasswordMessage(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    const shouldDelete = window.confirm("Delete this document?");
    if (!shouldDelete) return;

    try {
      setDocumentMessage(null);
      await api.delete(`/api/documents/${documentId}`);
      setDocuments((prev) => prev.filter((document) => document.id !== documentId));
      setDocumentMessage("Document deleted successfully.");
    } catch (err) {
      console.error("Failed to delete document", err);
      setDocumentMessage("Document delete failed. Please try again.");
    }
  };

  // â"€â"€ Loading State â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  if (loading) {
    return (
      <div
        className="flex justify-center items-center h-screen w-full"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          style={{ color: "var(--text-primary)", fontSize: "16px" }}
          className="flex items-center gap-2"
        >
          <div
            className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)" }}
          />
          Loading profile...
        </div>
      </div>
    );
  }

  // â"€â"€ Error State â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  if (error || !profile) {
    return (
      <div
        className="flex justify-center items-center h-screen w-full"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          style={{ color: "#ef4444", fontSize: "16px" }}
          className="font-semibold"
        >
          {error || "No profile data"}
        </div>
      </div>
    );
  }

  const roleFields = getProfileFields(profile.role);

  const q = (search ?? "").trim().toLowerCase();

  const filteredRoleFields = q
    ? roleFields.filter((field) => {
        const rawValue = profile[field.key as keyof UserProfile];
        const value = (Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue ?? "")).toLowerCase();
        return field.label.toLowerCase().includes(q) || value.includes(q);
      })
    : roleFields;

  const filteredDocuments = q
    ? documents.filter((doc) =>
        [doc.file_name, doc.document_type, doc.status].some((v) =>
          (v ?? "").toLowerCase().includes(q)
        )
      )
    : documents;

  const filteredSkillsList = q
    ? skillsList.filter((skill) => skill.toLowerCase().includes(q))
    : skillsList;

  const isAdmin = String(profile.role || "").toLowerCase() === "admin";

  const TABS = (
    [
      { key: "personal", label: "Personal Info" },
      { key: "documents", label: "Documents" },
      { key: "skills", label: "Skills" },
      { key: "security", label: "Security" },
    ] as const
  ).filter((tab) => !isAdmin || (tab.key !== "documents" && tab.key !== "skills"));

  return (
    <div className="w-full animate-fade-in">
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "0.625rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: activeTab === tab.key ? "var(--text-primary)" : "var(--bg-secondary)",
              color: activeTab === tab.key ? "var(--bg-primary)" : "var(--text-secondary)",
              borderBottom: activeTab === tab.key ? "2px solid var(--text-primary)" : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "personal" && (
      <div
        className="rounded-2xl p-5 sm:p-6"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-base sm:text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Personal Information
          </h3>

          {/* Common Edit Profile button */}
          {!isEditingAll ? (
            <button
              onClick={() => {
                // Populate editAllValues with current profile values for editable fields
                const vals: Record<string, string> = {};
                roleFields.forEach((f) => {
                  if (f.editable) {
                    const raw = profile[f.key as keyof UserProfile];
                    vals[f.key] = Array.isArray(raw) ? raw.join(", ") : String(raw || "");
                  }
                });
                setEditAllValues(vals);
                setIsEditingAll(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-[0.85] active:opacity-[0.7] cursor-pointer"
              style={{ background: "var(--text-primary)", color: "var(--bg-primary)" }}
            >
              <Edit2 size={14} /> Edit Profile
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!profile) return;
                  setSaving(true);
                  try {
                    const updateData: ProfileUpdateRequest = {};
                    for (const [key, val] of Object.entries(editAllValues)) {
                      if (key === "teamSize" || key === "workingHoursPerDay") {
                        (updateData as any)[key] = Number(val || 0);
                      } else {
                        (updateData as any)[key] = val;
                      }
                    }
                    const updatedProfile = await profileApi.updateProfile(updateData);
                    syncProfileStorage(updatedProfile);
                    setProfile(updatedProfile);
                    setIsEditingAll(false);
                    setEditAllValues({});
                  } catch (err) {
                    if (err instanceof Error) setError(err.message);
                    else setError(String(err) || "Failed to update profile");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={14} /> {saving ? "Saving..." : "Save All"}
              </button>
              <button
                onClick={() => {
                  setIsEditingAll(false);
                  setEditAllValues({});
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition-colors cursor-pointer"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          )}
        </div>

        {/* Dynamic field rendering based on role */}
        <div className="flex flex-col">
          {filteredRoleFields.length === 0 && q ? (
            <p className="py-8 text-sm text-center" style={{ color: "var(--text-secondary)" }}>
              No fields match your search
            </p>
          ) : null}
          {filteredRoleFields.map((field) => {
            const rawValue = profile[field.key as keyof UserProfile];
            const fieldValue = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;

            // Determine icon for the field
            let icon = <User size={16} />;
            if (field.key === "email") icon = <Mail size={16} />;
            else if (field.key === "phoneNumber") icon = <Phone size={16} />;
            else if (field.key === "employeeId") icon = <FileText size={16} />;
            else if (
              field.key === "role" ||
              field.key === "designation" ||
              field.key === "department"
            )
              icon = <Briefcase size={16} />;

            // When isEditingAll is active, show inline inputs for editable fields
            if (isEditingAll && field.editable) {
              return (
                <div
                  key={field.key}
                  className="flex items-center gap-3 py-4 transition-colors"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <span className="shrink-0" style={{ color: "var(--accent)" }}>
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs uppercase tracking-wider mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {field.label}
                    </div>
                    <input
                      autoFocus={field.key === "name"}
                      value={editAllValues[field.key] || ""}
                      onChange={(e) =>
                        setEditAllValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 rounded-xl text-sm focus:outline-none transition-all duration-200"
                      style={{
                        background: "var(--bg-primary)",
                        border: "2px solid var(--accent)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
              );
            }

            return (
              <Field
                key={field.key}
                label={field.label}
                fieldKey={field.key}
                value={fieldValue}
                icon={icon}
              />
            );
          })}
        </div>
      </div>
      )}

      {activeTab === "emergency" && (
        <div className="rounded-2xl p-5 sm:p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-base sm:text-lg font-bold mb-4" style={{ color: "var(--accent)" }}>Emergency Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={profileForm.emergencyContactName} onChange={(e) => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })} placeholder="Emergency Contact Name" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <input value={profileForm.emergencyContactPhone} onChange={(e) => setProfileForm({ ...profileForm, emergencyContactPhone: e.target.value })} placeholder="Emergency Contact Phone" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <button type="button" onClick={saveProfileSection} disabled={saving} className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-[0.85] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--text-primary)", color: "var(--bg-primary)" }}>Save Changes</button>
        </div>
      )}

      {activeTab === "finance" && (
        <div className="rounded-2xl p-5 sm:p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-base sm:text-lg font-bold mb-4" style={{ color: "var(--accent)" }}>Finance</h3>
          <textarea value={profileForm.bankAccountDetails} onChange={(e) => setProfileForm({ ...profileForm, bankAccountDetails: e.target.value })} placeholder="Bank account details" rows={4} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button type="button" onClick={saveProfileSection} disabled={saving} className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-[0.85] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--text-primary)", color: "var(--bg-primary)" }}>Save Changes</button>
        </div>
      )}

      {activeTab === "skills" && !isAdmin && (
        <div className="rounded-2xl p-5 sm:p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-base sm:text-lg font-bold mb-2" style={{ color: "var(--accent)" }}>Technical Skills</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Add your technical skills — these will be visible to HR and your manager.</p>
          <div className="rounded-xl p-4 mb-4 min-h-[72px]" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
            {skillsList.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No skills added yet. Add your first skill below.</p>
            ) : filteredSkillsList.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No skills match your search.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredSkillsList.map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              placeholder="Add a skill (e.g. React, Python, Docker)"
              className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <button type="button" onClick={addSkill} className="px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <Plus size={14} /> Add
            </button>
          </div>
          <button type="button" onClick={saveProfileSection} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-[0.85] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--text-primary)", color: "var(--bg-primary)" }}>Save Changes</button>
        </div>
      )}

      {activeTab === "security" && (
        <div className="rounded-2xl p-5 sm:p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-base sm:text-lg font-bold mb-4" style={{ color: "var(--accent)" }}>Security Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <PasswordField
              label="Current Password"
              value={passwordForm.currentPassword}
              onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })}
              visible={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((prev) => !prev)}
            />
            <PasswordField
              label="New Password"
              value={passwordForm.newPassword}
              onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((prev) => !prev)}
            />
            <PasswordField
              label="Confirm New Password"
              value={passwordForm.confirmPassword}
              onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })}
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
            />
          </div>
          <p className="text-xs italic mt-3" style={{ color: "var(--text-secondary)" }}>
            Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character.
          </p>
          {passwordMessage && (
            <p className="text-sm mt-3" style={{ color: passwordMessage.includes("success") ? "#10b981" : "#ef4444" }}>
              {passwordMessage}
            </p>
          )}
          <button type="button" onClick={updatePassword} disabled={passwordSaving} className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-[0.85] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--text-primary)", color: "var(--bg-primary)" }}>
            {passwordSaving ? "Updating..." : "Update Password"}
          </button>
        </div>
      )}

      {activeTab === "onboarding" && (
        <div className="rounded-2xl p-5 sm:p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-base sm:text-lg font-bold mb-2" style={{ color: "var(--accent)" }}>Onboarding Checklist</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Progress: {onboardingStats.completed} of {onboardingStats.total} items completed ({onboardingStats.percent}%)
          </p>
          <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${onboardingStats.percent}%` }} />
          </div>
          {onboardingLoading ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading checklist...</p>
          ) : (
            <div className="space-y-2">
              {onboardingChecklist.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  style={{
                    background: task.status === "Completed" ? "rgba(16,185,129,0.08)" : "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                    {task.completedAt && (
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        Completed {new Date(task.completedAt).toLocaleDateString("en-IN")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(59,130,246,0.12)", color: "#2563eb" }}>
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && !isAdmin && (
        <div
          className="rounded-2xl p-5 sm:p-6"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h3
                className="text-base sm:text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                Documents
              </h3>
              <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Upload documents for HR verification.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <label className="block">
              <span className="block text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                Document Type
              </span>
              <ConstrainedDropdown
                value={selectedDocumentType}
                onChange={setSelectedDocumentType}
                options={documentTypes}
                buttonStyle={{
                  minHeight: "44px",
                  borderRadius: "0.75rem",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                Expiry Date
              </span>
              <input
                type="date"
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </label>

            <label className="block md:self-end">
              <span className="block text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                File
              </span>
              <input
                id="profile-document-file"
                type="file"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                className="sr-only"
              />
              <span
                className="w-full min-h-11 rounded-xl px-3 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer transition hover:opacity-85"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px dashed var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <FileText size={18} className="shrink-0" style={{ color: "var(--accent)" }} />
                <span className="min-w-0 flex-1 truncate">
                  {selectedFile ? selectedFile.name : "Choose file"}
                </span>
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={uploadDocument}
            disabled={uploadingDocument || !selectedFile}
            className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-[0.85] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--text-primary)", color: "var(--bg-primary)" }}
          >
            <Upload size={16} />
            {uploadingDocument ? "Uploading..." : "Upload Document"}
          </button>

          {documentMessage && (
            <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
              {documentMessage}
            </p>
          )}

          <div className="mt-5 divide-y" style={{ borderColor: "var(--border)" }}>
            {documentsLoading && (
              <p className="py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                Loading documents...
              </p>
            )}

            {!documentsLoading && documents.length === 0 && (
              <p className="py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                No documents uploaded yet.
              </p>
            )}

            {!documentsLoading && documents.length > 0 && filteredDocuments.length === 0 && (
              <p className="py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                No documents match your search.
              </p>
            )}

            {filteredDocuments.map((document) => (
              <div key={document.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="min-w-0 flex items-start gap-3">
                  <FileText size={18} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {document.file_name}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      {document.document_type} - {document.status}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {document.file_url && (
                    <a
                      href={document.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                      style={{
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Download size={14} />
                      Download
                    </a>
                  )}

                  <label
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) replaceDocument(document.id, file);
                        event.target.value = "";
                      }}
                    />
                    <RefreshCw size={14} />
                    {replacingDocumentId === document.id ? "Replacing..." : "Replace"}
                  </label>

                  <button
                    type="button"
                    onClick={() => deleteDocument(document.id)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{
                      border: "1px solid rgba(239,68,68,0.35)",
                      color: "#ef4444",
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter your ${label.toLowerCase()}`}
          className="w-full rounded-xl px-3 py-2.5 pr-10 text-sm outline-none"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

export default ProfilePage;


