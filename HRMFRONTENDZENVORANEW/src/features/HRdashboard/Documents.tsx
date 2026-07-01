import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Pencil, Save, Trash2, Upload, X } from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  btnPrimary,
  card,
  getStatusStyle,
  hrPageWrap,
  inputMuted,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";

type DocumentStatus = "Pending For Review" | "Approved" | "Rejected" | "Expired";

type DocumentRecord = {
  id: number | string;
  employeeId?: string;
  employee: string;
  email: string;
  documentType: string;
  fileName: string;
  fileUrl?: string;
  status: DocumentStatus;
  expiryDate: string;
  uploadedDate: string;
};

const initialDocuments: DocumentRecord[] = [
  {
    id: 1,
    employee: "Shubham Kushwaha",
    email: "shubham.kushwaha@vectedtech.com",
    documentType: "Id Proof",
    fileName: "IMG_20231126_09215...",
    status: "Pending For Review",
    expiryDate: "-",
    uploadedDate: "06/02/2026",
  },
  {
    id: 2,
    employee: "Shubham Kushwaha",
    email: "shubham.kushwaha@vectedtech.com",
    documentType: "Bank Details",
    fileName: "IMG_20231126_09301...",
    status: "Pending For Review",
    expiryDate: "-",
    uploadedDate: "06/02/2026",
  },
  {
    id: 3,
    employee: "Mayank Vishwakarma",
    email: "mayank.vishwakarma@vectedtech.com",
    documentType: "Id Proof",
    fileName: "IMAGE_WO_17623251...",
    status: "Pending For Review",
    expiryDate: "-",
    uploadedDate: "06/02/2026",
  },
  {
    id: 4,
    employee: "Aanchal Malviya",
    email: "aanchal@vectedtech.com",
    documentType: "Offer Letter",
    fileName: "offer_letter_aanchal.pdf",
    status: "Approved",
    expiryDate: "-",
    uploadedDate: "02/02/2026",
  },
];

const documentTypes = [
  "Offer Letter",
  "Appointment Letter",
  "Confirmation Letter",
  "Increment Letter",
  "Relieving Letter",
  "Experience Letter issued by company",
];

export default function Documents() {
  const [search] = useTopHeaderSearch();
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments);
  const [showModal, setShowModal] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({
    employeeId: "",
    employee: "",
    email: "",
    documentType: "Offer Letter",
    status: "Pending For Review" as DocumentStatus,
    expiryDate: "",
    uploadedDate: "",
  });

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await api.get("/api/documents");
      setDocuments(response.data.map(mapDocumentFromApi));
    } catch {
      // API fail ho to koi message show nahi hoga.
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDocuments = async () => {
      if (isMounted) {
        await fetchDocuments();
      }
    };

    loadDocuments();

    const intervalId = window.setInterval(() => {
      if (isMounted) {
        fetchDocuments();
      }
    }, 30000);
    const handleFocus = () => {
      if (isMounted) {
        fetchDocuments();
      }
    };
    const handleVisibilityChange = () => {
      if (isMounted && !document.hidden) fetchDocuments();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchDocuments]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;

    return documents.filter((document) =>
      [
        document.employee,
        document.email,
        document.documentType,
        document.fileName,
        document.status,
        document.expiryDate,
        document.uploadedDate,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [documents, search]);

  const openCreateModal = () => {
    resetDraft();
    setEditingDocumentId(null);
    setShowModal(true);
  };

  const openEditModal = (document: DocumentRecord) => {
    setDraft({
      employeeId: document.employeeId || "",
      employee: document.employee,
      email: document.email,
      documentType: document.documentType,
      status: document.status,
      expiryDate: document.expiryDate === "-" ? "" : document.expiryDate,
      uploadedDate: document.uploadedDate === "-" ? "" : document.uploadedDate,
    });
    setSelectedFile(null);
    setEditingDocumentId(document.id);
    setShowModal(true);
  };

  const handleSaveDocument = async () => {
    if (!draft.employee.trim() || !draft.email.trim()) return;
    if (!editingDocumentId && !selectedFile) return;

    if (editingDocumentId) {
      const formData = new FormData();
      formData.append("employee_id", draft.employeeId.trim() || draft.email.trim());
      formData.append("employee_name", draft.employee);
      formData.append("email", draft.email);
      formData.append("document_type", draft.documentType);
      formData.append("expiry_date", draft.expiryDate || "-");

      try {
        const response = await api.patch(`/api/documents/${editingDocumentId}`, formData);
        setDocuments((prev) =>
          prev.map((document) =>
            document.id === editingDocumentId ? mapDocumentFromApi(response.data) : document,
          ),
        );
      } catch (error) {
        console.error("Failed to update document", error);
        setDocuments((prev) =>
          prev.map((document) =>
            document.id === editingDocumentId
              ? {
                  ...document,
                  employeeId: draft.employeeId,
                  employee: draft.employee,
                  email: draft.email,
                  documentType: draft.documentType,
                  expiryDate: draft.expiryDate || "-",
                }
              : document,
          ),
        );
      }

      resetDraft();
      setEditingDocumentId(null);
      setShowModal(false);
      return;
    }

    if (selectedFile) {
      const formData = new FormData();
      formData.append("employee_id", draft.employeeId.trim() || draft.email.trim());
      formData.append("employee_name", draft.employee);
      formData.append("email", draft.email);
      formData.append("document_type", draft.documentType);
      formData.append("expiry_date", draft.expiryDate || "-");
      formData.append("upload_source", "hr_documents");
      formData.append("file", selectedFile);

      try {
        const response = await api.post("/api/documents", formData);
        setDocuments((prev) => [mapDocumentFromApi(response.data), ...prev]);
      } catch (error) {
        console.error("Failed to upload document", error);
        return;
      }

      resetDraft();
      setShowModal(false);
      return;
    }

  };

  const handleDeleteDocument = async (documentId: string | number) => {
    const shouldDelete = window.confirm("Delete this document?");
    if (!shouldDelete) return;

    try {
      await api.delete(`/api/documents/${documentId}`);
    } catch (error) {
      console.error("Failed to delete document", error);
    }

    setDocuments((prev) => prev.filter((document) => document.id !== documentId));
  };

  const handleStatusChange = async (documentId: string | number, nextStatus: DocumentStatus) => {
    const previousDocuments = documents;
    setDocuments((prev) =>
      prev.map((document) =>
        document.id === documentId ? { ...document, status: nextStatus } : document,
      ),
    );

    const formData = new FormData();
    formData.append("status_value", nextStatus);

    try {
      const response = await api.patch(`/api/documents/${documentId}/status`, formData);
      setDocuments((prev) =>
        prev.map((document) =>
          document.id === documentId ? mapDocumentFromApi(response.data) : document,
        ),
      );
    } catch (error) {
      console.error("Failed to update document status", error);
      setDocuments(previousDocuments);
    }
  };

  const resetDraft = () => {
    setDraft({
      employeeId: "",
      employee: "",
      email: "",
      documentType: "Offer Letter",
      status: "Pending For Review",
      expiryDate: "",
      uploadedDate: "",
    });
    setSelectedFile(null);
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        <div className="flex justify-end mb-5">
          <button
            onClick={openCreateModal}
            className="h-10 px-4 rounded-lg font-semibold inline-flex items-center gap-2 hover:opacity-90 transition"
            style={btnPrimary}
          >
            <Upload size={16} />
            Upload Document
          </button>
        </div>

        <div className="rounded-lg p-4" style={card}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead style={tableHead}>
                <tr>
                  {[
                    "Employee",
                    "Document Type",
                    "File Name",
                    "Status",
                    "Expiry Date",
                    "Uploaded",
                    "Actions",
                  ].map((column, index, columns) => (
                    <th
                      key={column}
                      className={`px-4 py-4 text-xs font-semibold ${
                        index === columns.length - 1 ? "text-right" : "text-left"
                      }`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((document) => (
                  <tr key={document.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-6">
                      <p className="text-sm font-semibold" style={textPrimary}>
                        {document.employee}
                      </p>
                      <p className="text-xs mt-1" style={textSecondary}>
                        {document.email}
                      </p>
                    </td>
                    <td className="px-4 py-6 text-sm" style={textPrimary}>
                      {document.documentType}
                    </td>
                    <td className="px-4 py-6">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={15} style={textSecondary} />
                        <span className="text-sm truncate" style={textPrimary}>
                          {document.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-6 min-w-[190px]">
                      <ConstrainedDropdown
                        value={document.status}
                        onChange={(value) => handleStatusChange(document.id, value as DocumentStatus)}
                        options={["Pending For Review", "Approved", "Rejected", "Expired"]}
                        buttonStyle={{
                          ...getDocumentStatusStyle(document.status),
                          minHeight: "32px",
                          height: "32px",
                          border: "none",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      />
                    </td>
                    <td className="px-4 py-6 text-sm" style={textSecondary}>
                      {document.expiryDate}
                    </td>
                    <td className="px-4 py-6 text-sm" style={textSecondary}>
                      {document.uploadedDate}
                    </td>
                    <td className="px-4 py-6">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            if (document.fileUrl) window.open(document.fileUrl, "_blank", "noopener,noreferrer");
                          }}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                          style={getStatusStyle("In Progress")}
                          aria-label={`Download ${document.fileName}`}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => openEditModal(document)}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                          style={getStatusStyle("Approved")}
                          aria-label={`Edit ${document.fileName}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(document.id)}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                          style={getStatusStyle("Rejected")}
                          aria-label={`Delete ${document.fileName}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredDocuments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm" style={textSecondary}>
                      No documents found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-2xl rounded-lg shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
              style={card}
            >
              <div
                className="flex items-start justify-between gap-4 px-6 py-5 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <h2 className="text-lg font-bold" style={textPrimary}>
                    {editingDocumentId ? "Edit Document" : "Upload Document"}
                  </h2>
                  <p className="text-sm mt-1" style={textSecondary}>
                    {editingDocumentId
                      ? "Update document details and review status."
                      : "Add employee documents for HR verification and record keeping."}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
                  aria-label="Close modal"
                >
                  <X size={18} style={textSecondary} />
                </button>
              </div>

              <div className="px-6 py-6 space-y-5 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Employee ID">
                    <input
                      value={draft.employeeId}
                      onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}
                      placeholder="EMP001"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>

                  <FormField label="Employee Name" required>
                    <input
                      value={draft.employee}
                      onChange={(event) => setDraft({ ...draft, employee: event.target.value })}
                      placeholder="Shubham Kushwaha"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Employee Email" required>
                    <input
                      value={draft.email}
                      onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                      placeholder="employee@vectedtech.com"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>
                
                  <FormField label="Document Type">
                    <ConstrainedDropdown
                      value={draft.documentType}
                      onChange={(value) => setDraft({ ...draft, documentType: value })}
                      options={documentTypes}
                      buttonStyle={inputMuted}
                    />
                  </FormField>
                </div>

                {!editingDocumentId && (
                  <FormField label="Upload File" required>
                    <label
                      className="w-full min-h-11 rounded-lg px-4 py-3 inline-flex items-center gap-2 cursor-pointer transition hover:opacity-85"
                      style={{
                        ...inputMuted,
                        borderStyle: "dashed",
                      }}
                    >
                      <input
                        type="file"
                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        className="sr-only"
                      />
                      <FileText size={18} className="shrink-0" style={textSecondary} />
                      <span className="min-w-0 flex-1 truncate text-sm" style={textPrimary}>
                        {selectedFile ? selectedFile.name : "Choose file"}
                      </span>
                    </label>
                  </FormField>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Expiry Date">
                    <input
                      value={draft.expiryDate}
                      onChange={(event) => setDraft({ ...draft, expiryDate: event.target.value })}
                      placeholder="Optional"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>

                  <FormField label="Uploaded Date">
                    <input
                      value={draft.uploadedDate}
                      onChange={(event) => setDraft({ ...draft, uploadedDate: event.target.value })}
                      placeholder="06/02/2026"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>
                </div>

                <button
                  onClick={handleSaveDocument}
                  className="w-full rounded-lg py-3 font-semibold inline-flex justify-center items-center gap-2"
                  style={btnPrimary}
                >
                  <Save size={16} />
                  {editingDocumentId ? "Update Document" : "Save Document"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getDocumentStatusStyle(status: DocumentStatus) {
  if (status === "Approved") return getStatusStyle("Approved");
  if (status === "Rejected" || status === "Expired") return getStatusStyle("Rejected");
  return { background: "rgba(249,115,22,0.14)", color: "#f97316" };
}

function mapDocumentFromApi(document: {
  id: string;
  employee_id?: string;
  employee_name?: string;
  email?: string;
  document_type?: string;
  file_name?: string;
  file_url?: string;
  status?: DocumentStatus;
  expiry_date?: string;
  uploaded_at?: string;
}): DocumentRecord {
  return {
    id: document.id,
    employeeId: document.employee_id,
    employee: document.employee_name || "-",
    email: document.email || "-",
    documentType: document.document_type || "-",
    fileName: document.file_name || "-",
    fileUrl: document.file_url,
    status: document.status || "Pending For Review",
    expiryDate: document.expiry_date || "-",
    uploadedDate: document.uploaded_at
      ? new Date(document.uploaded_at).toLocaleDateString("en-GB")
      : "-",
  };
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-2" style={textPrimary}>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
