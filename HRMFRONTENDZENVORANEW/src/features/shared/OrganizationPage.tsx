import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import PaginationControls from "../../components/PaginationControls";
import API_BASE_URL from "../../config/apiConfig";

const PAGE_SIZE = 8;

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeType = "ADMIN" | "MANAGER" | "EMPLOYEE" | "HR";

interface OrgMember {
  id: string;
  name: string;
  role: string;
  department: string;
  badge: BadgeType;
  reports?: OrgMember[];
}

interface EmployeeApi {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  role?: string;
  department?: string;
}

const orgTree: OrgMember = {
  id: "1",
  name: "Prince",
  role: "Lead Manager",
  department: "Tech Team",
  badge: "MANAGER",
  reports: [
    { id: "2", name: "Sahil",   role: "Developer", department: "Tech Team", badge: "EMPLOYEE" },
    { id: "3", name: "Nikita",  role: "Developer", department: "Tech Team", badge: "EMPLOYEE" },
    { id: "4", name: "Anushka", role: "Developer", department: "Tech Team", badge: "EMPLOYEE" },
    { id: "5", name: "Palak",   role: "Developer", department: "Tech Team", badge: "EMPLOYEE" },
    { id: "6", name: "Rohit",   role: "Developer", department: "Tech Team", badge: "EMPLOYEE" },
    { id: "7", name: "Raj",     role: "Developer", department: "Tech Team", badge: "EMPLOYEE" },
    { id: "8", name: "Pooja",   role: "Developer", department: "Tech Team", badge: "EMPLOYEE" },
    { id: "9", name: "Divya",   role: "Developer", department: "Tech Team", badge: "EMPLOYEE" },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function flattenTree(node: OrgMember, results: OrgMember[] = []): OrgMember[] {
  results.push(node);
  if (node.reports) node.reports.forEach((r) => flattenTree(r, results));
  return results;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const badgeMeta: Record<
  BadgeType,
  { label: string; style: React.CSSProperties }
> = {
  ADMIN: {
    label: "Admin",
    style: {
      background: "var(--bg-hover)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
    },
  },
  HR: {
    label: "HR",
    style: {
      background: "var(--bg-hover)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
    },
  },
  MANAGER: {
    label: "Manager",
    style: {
      background: "var(--bg-hover)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border)",
    },
  },
  EMPLOYEE: {
    label: "Employee",
    style: {
      background: "var(--bg-hover)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border)",
    },
  },
};

function Badge({ badge }: { badge: BadgeType }) {
  const { label, style } = badgeMeta[badge];
  return (
    <span
      style={{
        fontSize: "0.6rem",
        fontWeight: 700,
        letterSpacing: "0.05em",
        padding: "0.15rem 0.5rem",
        borderRadius: "999px",
        ...style,
      }}
    >
      {label}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const { isDark } = useTheme();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-primary)",
        fontWeight: 700,
        fontSize: size > 44 ? "0.95rem" : "0.78rem",
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Card (Cards view) ────────────────────────────────────────────────────────

function MemberCard({
  member,
  onClick,
  isRoot,
}: {
  member: OrgMember;
  onClick?: () => void;
  isRoot?: boolean;
}) {
  const { isDark } = useTheme();

  return (
    <div
      onClick={onClick}
      style={{
        background: isDark ? "var(--bg-secondary)" : "#fff",
        borderRadius: "0.75rem",
        padding: "1.1rem 0.875rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s ease",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 4px 18px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 1px 6px rgba(0,0,0,0.07)";
      }}
    >
      <Avatar name={member.name} size={isRoot ? 50 : 40} />

      <div
        style={{
          fontSize: isRoot ? "0.875rem" : "0.8rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          textAlign: "center",
          lineHeight: 1.3,
          marginTop: "0.1rem",
        }}
      >
        {member.name}
      </div>

      <div
        style={{
          fontSize: "0.7rem",
          color: "var(--text-secondary)",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {member.role}
      </div>

      <Badge badge={member.badge} />

      {(member.reports?.length ?? 0) > 0 && (
        <div
          style={{
            fontSize: "0.68rem",
            color: "var(--text-secondary)",
            marginTop: "0.1rem",
          }}
        >
          {member.reports!.length}{" "}
          {member.reports!.length === 1 ? "report" : "reports"}
        </div>
      )}
    </div>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function OrgRow({
  member,
  depth,
  query,
}: {
  member: OrgMember;
  depth: number;
  query: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = (member.reports?.length ?? 0) > 0;

  const selfMatches =
    !query ||
    member.name.toLowerCase().includes(query) ||
    member.role.toLowerCase().includes(query) ||
    member.department.toLowerCase().includes(query) ||
    badgeMeta[member.badge].label.toLowerCase().includes(query);

  if (!selfMatches && !hasChildren) return null;

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : "2.25rem" }}>
      <div
        onClick={() => hasChildren && setExpanded((p) => !p)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.55rem 0.75rem",
          borderRadius: "0.5rem",
          cursor: hasChildren ? "pointer" : "default",
          transition: "background 0.12s",
          marginBottom: "0.1rem",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background =
            "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        {/* Expand chevron */}
        <span
          style={{
            color: "var(--text-secondary)",
            display: "flex",
            width: 14,
            flexShrink: 0,
          }}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : null}
        </span>

        <Avatar name={member.name} size={34} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {member.name}
            </span>
            <Badge badge={member.badge} />
            <span
              style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}
            >
              {member.department}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              marginTop: "0.08rem",
            }}
          >
            {member.role}
          </div>
        </div>

        {hasChildren && (
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-secondary)",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {member.reports!.length}{" "}
            {member.reports!.length === 1 ? "report" : "reports"}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div
          style={{
            borderLeft: `1px solid var(--border)`,
            marginLeft: "1.45rem",
            paddingLeft: "0.5rem",
            marginBottom: "0.25rem",
          }}
        >
          {member.reports!.map((child) => (
            <OrgRow
              key={child.id}
              member={child}
              depth={depth + 1}
              query={query}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

void OrgRow;

type ViewMode = "list" | "cards";

export default function OrganizationPage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [selectedManager, setSelectedManager] = useState<OrgMember | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [employees, setEmployees] = useState<EmployeeApi[]>([]);
  const [loading, setLoading] = useState(true);

  // Load real employees from API
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/employees`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEmployees(data);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  // Listen to TopHeader search
  useEffect(() => {
    const handler = (e: Event) => {
      setQuery((e as CustomEvent<string>).detail.toLowerCase().trim());
      setCurrentPage(1);
    };
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  const dynamicOrgTree = useMemo(() => {
    if (employees.length === 0) return orgTree;

    // Map database employees to OrgMember — match by name to real team
    const nameRoleMap: Record<string, { role: string; badge: BadgeType }> = {
      prince:  { role: "Lead Manager", badge: "MANAGER"  },
      sahil:   { role: "Developer",    badge: "EMPLOYEE" },
      nikita:  { role: "Developer",    badge: "EMPLOYEE" },
      anushka: { role: "Developer",    badge: "EMPLOYEE" },
      palak:   { role: "Developer",    badge: "EMPLOYEE" },
      rohit:   { role: "Developer",    badge: "EMPLOYEE" },
      raj:     { role: "Developer",    badge: "EMPLOYEE" },
      pooja:   { role: "Developer",    badge: "EMPLOYEE" },
      divya:   { role: "Developer",    badge: "EMPLOYEE" },
    };

    const members: OrgMember[] = employees.map((emp, idx) => {
      const rawName = emp.name || emp.fullName || "Employee";
      const firstWord = rawName.split(/\s+/)[0].toLowerCase();
      const known = nameRoleMap[firstWord];
      return {
        id: emp.id ?? emp._id ?? `emp-${idx}`,
        name: rawName,
        role: known?.role ?? emp.role ?? "Employee",
        department: emp.department || "Tech Team",
        badge: known?.badge ?? "EMPLOYEE",
        reports: [],
      };
    });

    // Build tree: manager on top, everyone else reports to them
    const manager = members.find((m) => m.badge === "MANAGER") ?? members[0];
    if (!manager) return orgTree;
    const root: OrgMember = {
      ...manager,
      reports: members.filter((m) => m.id !== manager.id),
    };
    return root;
  }, [employees]);

  const allMembers = flattenTree(dynamicOrgTree);
  const totalDepts = new Set(allMembers.map((m) => m.department)).size;
  const totalEmployees = allMembers.length;

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
        Loading organization...
      </div>
    );
  }

  const cardMembers = (
    selectedManager
      ? [selectedManager, ...(selectedManager.reports ?? [])]
      : (dynamicOrgTree.reports ?? [])
  ).filter(
    (m) =>
      !query ||
      m.name.toLowerCase().includes(query) ||
      m.role.toLowerCase().includes(query) ||
      m.department.toLowerCase().includes(query) ||
      badgeMeta[m.badge].label.toLowerCase().includes(query),
  );

  const totalPages = Math.max(1, Math.ceil(cardMembers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCardMembers = cardMembers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // List view — flat paginated members
  const listMembers = allMembers.filter(
    (m) =>
      !query ||
      m.name.toLowerCase().includes(query) ||
      m.role.toLowerCase().includes(query) ||
      m.department.toLowerCase().includes(query) ||
      badgeMeta[m.badge].label.toLowerCase().includes(query),
  );
  const listTotalPages = Math.max(1, Math.ceil(listMembers.length / PAGE_SIZE));
  const listSafePage = Math.min(currentPage, listTotalPages);
  const pagedListMembers = listMembers.slice(
    (listSafePage - 1) * PAGE_SIZE,
    listSafePage * PAGE_SIZE,
  );

  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        minHeight: "100%",
        background: "var(--bg-primary)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          marginBottom: "1rem",
        }}
      >
        {/* View toggle */}
        <div
          style={{
            display: "flex",
            gap: "0.2rem",
            background: "var(--bg-secondary)",
            borderRadius: "0.5rem",
            padding: "0.2rem",
            border: "1px solid var(--border)",
          }}
        >
          {(["list", "cards"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setSelectedManager(null);
              }}
              style={{
                padding: "0.3rem 0.8rem",
                borderRadius: "0.35rem",
                border: "none",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 600,
                background: view === v ? "var(--text-primary)" : "transparent",
                color:
                  view === v ? "var(--bg-primary)" : "var(--text-secondary)",
                transition: "all 0.15s",
              }}
            >
              {v === "list" ? "List" : "Cards"}
            </button>
          ))}
        </div>

        {/* Dept / member info */}
        <span
          style={{
            fontSize: "0.78rem",
            color: "var(--text-secondary)",
            marginLeft: "0.25rem",
          }}
        >
          {totalDepts} departments · {totalEmployees} members
        </span>
      </div>

      {/* ── List view ── */}
      {view === "list" && (
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "0.75rem",
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {pagedListMembers.length === 0 ? (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
              }}
            >
              No members found
            </div>
          ) : (
            pagedListMembers.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.65rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "transparent";
                }}
              >
                <Avatar name={m.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {m.name}
                    </span>
                    <Badge badge={m.badge} />
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {m.department}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      marginTop: "0.05rem",
                    }}
                  >
                    {m.role}
                  </div>
                </div>
              </div>
            ))
          )}
          <PaginationControls
            currentPage={listSafePage}
            totalItems={listMembers.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="members"
          />
        </div>
      )}

      {/* ── Cards view ── */}
      {view === "cards" && (
        <div>
          {/* Breadcrumb */}
          {selectedManager && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                marginBottom: "1rem",
                fontSize: "0.82rem",
              }}
            >
              <button
                onClick={() => setSelectedManager(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  padding: 0,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                All Teams
              </button>
              <ChevronRight size={12} color="var(--text-secondary)" />
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {selectedManager.name}
              </span>
            </div>
          )}

          {/* Leadership card */}
          {!selectedManager && (
            <div style={{ marginBottom: "1.5rem" }}>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--text-secondary)",
                  marginBottom: "0.75rem",
                  textTransform: "uppercase",
                }}
              >
                Leadership
              </p>
              <div style={{ display: "inline-block", minWidth: 160 }}>
                <MemberCard member={dynamicOrgTree} isRoot />
              </div>
            </div>
          )}

          {/* Section label */}
          <p
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-secondary)",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            {selectedManager ? `${selectedManager.name}'s Team` : "Teams"}
          </p>

          {/* Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
              gap: "0.875rem",
            }}
          >
            {pagedCardMembers.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                onClick={
                  !selectedManager && m.reports && m.reports.length > 0
                    ? () => {
                        setSelectedManager(m);
                        setCurrentPage(1);
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {cardMembers.length > 0 && (
            <PaginationControls
              currentPage={safePage}
              totalItems={cardMembers.length}
              pageSize={PAGE_SIZE}
              itemLabel="members"
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
