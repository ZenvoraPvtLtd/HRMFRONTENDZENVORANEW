import { MoreHorizontal } from "lucide-react";

export interface RecruitmentRow {
  name: string;
   dept: string;
  type: string;
   status: string;
  color: string;
}

export interface RecruitmentProgressTableProps {
   rows: RecruitmentRow[];
   title?: string;
}

export default function RecruitmentProgressTable({
  rows,
  title = "Recruitment progress",
}: RecruitmentProgressTableProps) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="text-base font-semibold mb-4 sm:mb-6 flex justify-between items-center"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
        <MoreHorizontal
          size={18}
          className="cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        />
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            overflow: "hidden",
            minWidth: 420,
          }}
        >
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              className="text-xs"
              style={{
                color: "var(--text-secondary)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <th style={{ padding: "0.625rem 1rem", fontWeight: 500 }}>Name</th>
              <th style={{ padding: "0.625rem 1rem", fontWeight: 500 }}>
                Department
              </th>
              <th style={{ padding: "0.625rem 1rem", fontWeight: 500 }}>
                Type
              </th>
              <th
                style={{
                  padding: "0.625rem 1rem",
                  fontWeight: 500,
                  textAlign: "right",
                }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td style={{ padding: "0.875rem 1rem" }}>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {row.name}
                  </span>
                </td>
                <td style={{ padding: "0.875rem 1rem" }}>
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.dept}
                  </span>
                </td>
                <td style={{ padding: "0.875rem 1rem" }}>
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.type}
                  </span>
                </td>
                <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                  <span
                    style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: "0.75rem",
                      fontSize: "0.75rem",
                      background: `${row.color}20`,
                      color: row.color,
                      fontWeight: 600,
                      display: "inline-block",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
