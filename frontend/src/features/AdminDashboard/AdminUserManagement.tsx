import { useEffect, useState } from "react";
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Filter, 
  Loader2, 
  X, 
  Lock, 
  AlertTriangle,
  CheckCircle,
  ShieldAlert
} from "lucide-react";
import api from "../../utils/axiosInstance";
import Button from "../../components/button/Button";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("employee");
  const [formStatus, setFormStatus] = useState("Active");
  const [formPassword, setFormPassword] = useState("");

  const [formErrors, setFormErrors] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/admin/users");
      setUsers(response.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load user directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchUsers);
  }, []);

  useEffect(() => {
    const handleHeaderSearch = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setSearchTerm(customEvent.detail ?? "");
    };
    window.addEventListener(SEARCH_EVENT, handleHeaderSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleHeaderSearch);
  }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedUser(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole("employee");
    setFormStatus("Active");
    setFormPassword("");
    setFormErrors(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setModalMode("edit");
    setSelectedUser(user);
    setFormName(user.fullName || "");
    setFormEmail(user.email || "");
    setFormPhone(user.phoneNumber || "");
    setFormRole(user.role || "employee");
    setFormStatus(user.status || "Active");
    setFormPassword("");
    setFormErrors(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${user.fullName || ""}"?`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      setSuccessMsg(`Successfully deleted user ${user.email}`);
      fetchUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
      setError("Failed to delete user.");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors(null);
    
    // Validations
    if (!formName || !formEmail || !formPhone) {
      setFormErrors("Name, Email, and Phone number are required.");
      return;
    }

    if (modalMode === "create" && !formPassword) {
      setFormErrors("Password is required for new users.");
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === "create") {
        await api.post("/api/admin/users", {
          fullName: formName,
          email: formEmail,
          phoneNumber: formPhone,
          role: formRole,
          password: formPassword,
          status: formStatus
        });
        setSuccessMsg(`User ${formEmail} created successfully.`);
      } else {
        await api.put(`/api/admin/users/${selectedUser?.id}`, {
          fullName: formName,
          email: formEmail,
          phoneNumber: formPhone,
          role: formRole,
          status: formStatus,
          password: formPassword || undefined
        });
        setSuccessMsg(`User ${formEmail} updated successfully.`);
      }
      setIsModalOpen(false);
      fetchUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      console.error(err);
      let errorMessage = "An error occurred while saving the user.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { data?: { detail?: string } } }).response;
        errorMessage = response?.data?.detail || errorMessage;
      }
      setFormErrors(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Search logic - Protected from null/undefined checks
  const filteredUsers = users.filter((u) => {
    const fullName = u.fullName || "";
    const email = u.email || "";
    const phoneNumber = u.phoneNumber || "";
    const term = searchTerm.toLowerCase();
    
    const matchesSearch = 
      fullName.toLowerCase().includes(term) ||
      email.toLowerCase().includes(term) ||
      phoneNumber.includes(searchTerm);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            User & Role Management
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Create accounts, edit user roles, or suspend/delete records globally.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-850 dark:hover:bg-zinc-200 text-white dark:text-black rounded-xl font-semibold text-sm transition cursor-pointer border border-zinc-800 dark:border-zinc-200"
        >
          <UserPlus className="w-4 h-4" /> Add New User
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm animate-fade-in font-medium">
          <CheckCircle className="w-4 h-4" />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm animate-fade-in font-medium">
          <ShieldAlert className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex justify-end">
        {/* Role Filter */}
        <div className="flex items-center gap-2.5">
          <Filter className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="py-2.5 pl-3 pr-8 rounded-xl border outline-none text-sm cursor-pointer"
            style={{ 
              borderColor: "var(--border)", 
              background: "var(--bg-secondary)", 
              color: "var(--text-primary)" 
            }}
          >
            <option value="all">All Roles</option>
            <option value="admin">Administrators</option>
            <option value="hr">HR Managers</option>
            <option value="manager">Team Managers</option>
            <option value="employee">Employees</option>
            <option value="candidate">Candidates</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-zinc-900 dark:text-zinc-100 animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 border rounded-2xl" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <Users className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-secondary)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No users found matching filters.</p>
        </div>
      ) : (
        <div className="border rounded-2xl overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg-hover)" }}>
                  <th className="p-4 font-bold" style={{ color: "var(--text-primary)" }}>User Info</th>
                  <th className="p-4 font-bold" style={{ color: "var(--text-primary)" }}>Role</th>
                  <th className="p-4 font-bold" style={{ color: "var(--text-primary)" }}>Phone</th>
                  <th className="p-4 font-bold" style={{ color: "var(--text-primary)" }}>Status</th>
                  <th className="p-4 font-bold text-right" style={{ color: "var(--text-primary)" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition">
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{user.fullName}</p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{user.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                        user.role === "admin" 
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-950 dark:border-zinc-50" 
                          : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4" style={{ color: "var(--text-secondary)" }}>
                      {user.phoneNumber || "—"}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        user.status === "Suspended" 
                          ? "bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border-zinc-200/50 dark:border-zinc-800" 
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700"
                      }`}>
                        {user.status || "Active"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2.5">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 border rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                          title="Edit user details"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-2 border rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div 
            className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-scale-in"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {modalMode === "create" ? "Add New User Account" : "Edit User Account"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition cursor-pointer"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formErrors && (
                <div className="flex items-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {formErrors}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Full Name</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 outline-none text-sm transition"
                  style={{ borderColor: "var(--border)", background: "var(--bg-hover)", color: "var(--text-primary)" }}
                  required
                />
              </div>

              {/* Email & Phone grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Email Address</label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full border rounded-xl px-4 py-2.5 outline-none text-sm transition"
                    style={{ borderColor: "var(--border)", background: "var(--bg-hover)", color: "var(--text-primary)" }}
                    required
                    disabled={modalMode === "edit"}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full border rounded-xl px-4 py-2.5 outline-none text-sm transition"
                    style={{ borderColor: "var(--border)", background: "var(--bg-hover)", color: "var(--text-primary)" }}
                    required
                  />
                </div>
              </div>

              {/* Role & Status grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>System Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full border rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer"
                    style={{ borderColor: "var(--border)", background: "var(--bg-hover)", color: "var(--text-primary)" }}
                  >
                    <option value="admin">Administrator</option>
                    <option value="hr">HR Manager</option>
                    <option value="manager">Team Manager</option>
                    <option value="employee">Employee</option>
                    <option value="candidate">Candidate</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Account Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full border rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer"
                    style={{ borderColor: "var(--border)", background: "var(--bg-hover)", color: "var(--text-primary)" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                  {modalMode === "create" ? "Sign In Password" : "Reset Password (leave blank if unchanged)"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                  <input
                    type="password"
                    placeholder={modalMode === "create" ? "Minimum 6 characters" : "Enter new password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full border rounded-xl pl-10 pr-4 py-2.5 outline-none text-sm transition"
                    style={{ borderColor: "var(--border)", background: "var(--bg-hover)", color: "var(--text-primary)" }}
                    required={modalMode === "create"}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  loading={submitting}
                  loadingText="Saving Account..."
                  style={{ 
                    width: "auto", 
                    padding: "0.5rem 1.5rem", 
                    background: "var(--text-primary)", 
                    color: "var(--bg-secondary)" 
                  }}
                >
                  Save User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
