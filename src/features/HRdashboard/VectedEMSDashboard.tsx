import {
  Users,
  Clock3,
  Briefcase,
  Activity,
  TrendingUp,
  Bell,
  ArrowUpRight,
  CheckCircle2,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";

import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTheme } from "../../context/ThemeContext";

import {
  hrPageWrap,
  card,
  cardInner,
  textPrimary,
  textSecondary,
  btnSecondary,
  btnPrimary,
  tableHead,
  getStatusStyle,
  rowHover,
} from "./hrTheme";

type ActivityItem = {
  id: string;
  title: string;
  desc?: string;
  time?: string;
  user?: string;
};

type Project = {
  title: string;
  members: number;
  progress: number;
};

type Employee = {
  name: string;
  dept: string;
  status: "Active" | "On Leave" | string;
  score: string; // e.g. "85%"
};

const recentActivities: ActivityItem[] = [];
const projects: Project[] = [];

export default function VectedEMSDashboard() {
  const { isDark } = useTheme();

  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    fetch("/api/employees").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setEmployees(data.slice(0, 5));
    }).catch(() => {});
  }, []);

  const [showModal, setShowModal] =
    useState(false);

  const [newEmployee, setNewEmployee] =
    useState<Employee>({
      name: "",
      dept: "",
      status: "Active",
      score: "",
    });

  const handleAddEmployee = () => {
    if (
      !newEmployee.name ||
      !newEmployee.dept ||
      !newEmployee.score
    )
      return;

    setEmployees((prev) => [
      ...prev,
      newEmployee,
    ]);

    setNewEmployee({
      name: "",
      dept: "",
      status: "Active",
      score: "",
    });

    setShowModal(false);
  };

  const handleGenerateReport = () => {
    const totalEmployees =
      employees.length;

    const activeEmployees =
      employees.filter(
        (emp) => emp.status === "Active"
      ).length;

    const onLeaveEmployees =
      employees.filter(
        (emp) => emp.status === "On Leave"
      ).length;

    const averagePerformance =
      employees.reduce((acc, emp) => {
        return (
          acc +
          Number(
            emp.score.replace("%", "")
          )
        );
      }, 0) / totalEmployees;

    const report = `
VECTED EMS REPORT


Total Employees: ${totalEmployees}

Active Employees: ${activeEmployees}

Employees On Leave: ${onLeaveEmployees}

Average Performance: ${averagePerformance.toFixed(
      1
    )}%

PROJECT STATUS

${projects
  .map(
    (project) =>
      `${project.title} - ${project.progress}% Complete`
  )
  .join("\n")}

EMPLOYEE DETAILS

${employees
  .map(
    (emp) =>
      `${emp.name} | ${emp.dept} | ${emp.status} | ${emp.score}`
  )
  .join("\n")}
`;

    const blob = new Blob([report], {
      type: "text/plain;charset=utf-8",
    });

    const link =
      document.createElement("a");

    link.href =
      URL.createObjectURL(blob);

    link.download =
      "vected-ems-report.txt";

    link.click();
  };

  return (
    <div className={`${hrPageWrap} px-4 lg:px-6`}>

      {/* HERO */}
      <div
        className="relative overflow-hidden rounded-[24px] p-5 lg:p-6 mb-6 border"
        style={{
          background: isDark
            ? "#111827"
            : "#ffffff",
          borderColor:
            "var(--border)",
        }}
      >
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="max-w-2xl">
            <h2
              className="text-2xl lg:text-3xl font-bold mb-3 leading-tight"
              style={textPrimary}
            >
              Workforce Performance
            </h2>

            <p
              className="text-sm lg:text-base leading-relaxed"
              style={textSecondary}
            >
              Monitor employee
              productivity, attendance,
              onboarding, recruitment,
              and analytics from one
              intelligent dashboard.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-5">
              <button
                onClick={
                  handleGenerateReport
                }
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition"
                style={btnPrimary}
              >
                Generate Report
              </button>

              <button
                className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={btnSecondary}
              >
                View Analytics
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full xl:max-w-[340px]">
            {[
              {
                label: "Employees",
                value: "248",
              },
              {
                label: "Attendance",
                value: "94%",
              },
              {
                label: "Open Jobs",
                value: "16",
              },
              {
                label: "Productivity",
                value: "89%",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="rounded-2xl p-4 border"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "#f8fafc",
                  borderColor:
                    "var(--border)",
                }}
              >
                <p
                  className="text-xs"
                  style={textSecondary}
                >
                  {item.label}
                </p>

                <h3
                  className="text-2xl font-bold mt-1"
                  style={textPrimary}
                >
                  {item.value}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          {
            title: "Total Employees",
            value: "248",
            icon: <Users size={18} />,
          },
          {
            title: "Avg Working Hours",
            value: "8.5h",
            icon: <Clock3 size={18} />,
          },
          {
            title: "Active Projects",
            value: "18",
            icon: (
              <Briefcase size={18} />
            ),
          },
          {
            title: "Performance Rate",
            value: "91%",
            icon: (
              <TrendingUp size={18} />
            ),
          },
        ].map((kpi, index) => (
          <div
            key={index}
            className="rounded-2xl p-4 border"
            style={{
              ...card,
              borderColor:
                "var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "#f1f5f9",
                  color:
                    "var(--accent)",
                }}
              >
                {kpi.icon}
              </div>

              <ArrowUpRight
                size={16}
                style={textSecondary}
              />
            </div>

            <h2
              className="text-2xl lg:text-3xl font-bold"
              style={textPrimary}
            >
              {kpi.value}
            </h2>

            <p
              className="text-sm mt-1"
              style={textSecondary}
            >
              {kpi.title}
            </p>
          </div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* LEFT */}
        <div className="xl:col-span-2 space-y-5">
          {/* PROJECTS */}
          <div
            className="rounded-2xl p-5 border"
            style={{
              ...card,
              borderColor:
                "var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2
                  className="text-xl font-bold"
                  style={textPrimary}
                >
                  Active Projects
                </h2>

                <p
                  className="text-sm mt-1"
                  style={textSecondary}
                >
                  Team performance &
                  project progress
                </p>
              </div>

              <button
                className="px-3 py-2 rounded-xl text-sm font-medium"
                style={btnSecondary}
              >
                View All
              </button>
            </div>

            <div className="space-y-4">
              {projects.map(
                (project, index) => (
                  <div
                    key={index}
                    className="rounded-2xl p-4 border"
                    style={{
                      ...cardInner,
                      borderColor:
                        "var(--border)",
                    }}
                    {...rowHover}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3
                          className="font-semibold text-sm lg:text-base"
                          style={
                            textPrimary
                          }
                        >
                          {
                            project.title
                          }
                        </h3>

                        <p
                          className="text-xs mt-1"
                          style={
                            textSecondary
                          }
                        >
                          {
                            project.members
                          }{" "}
                          Team Members
                        </p>
                      </div>

                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background:
                            isDark
                              ? "rgba(255,255,255,0.05)"
                              : "#eff6ff",
                          color:
                            "var(--accent)",
                        }}
                      >
                        <Activity
                          size={18}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <p
                        className="text-xs"
                        style={
                          textSecondary
                        }
                      >
                        Progress
                      </p>

                      <p
                        className="text-xs font-semibold"
                        style={
                          textPrimary
                        }
                      >
                        {
                          project.progress
                        }
                        %
                      </p>
                    </div>

                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{
                        background:
                          "var(--chart-bg)",
                      }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${project.progress}%`,
                          background:
                            "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* EMPLOYEES */}
          <div
            className="rounded-2xl w-274  p-5 overflow-x-auto border"
            style={{
              ...card,
              borderColor:
                "var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2
                  className="text-xl font-bold"
                  style={textPrimary}
                >
                  Employee Overview
                </h2>

                <p
                  className="text-sm mt-1"
                  style={textSecondary}
                >
                  Recent employee
                  activity
                </p>
              </div>

              <button
                onClick={() =>
                  setShowModal(true)
                }
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={btnPrimary}
              >
                Add Employee
              </button>
            </div>

            <table
              className="w-full min-w-[620px]"
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead>
                <tr
                  style={{
                    ...tableHead,
                    background: "transparent",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {[
                    "Employee",
                    "Department",
                    "Status",
                    "Performance",
                    "Action",
                  ].map((col, index, columns) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-xs font-semibold text-left"
                      style={{
                        ...textSecondary,
                        background: "var(--table-head-bg)",
                        color: "var(--table-head-text)",
                        borderTopLeftRadius: index === 0 ? "0.75rem" : 0,
                        borderBottomLeftRadius: index === 0 ? "0.75rem" : 0,
                        borderTopRightRadius: index === columns.length - 1 ? "0.75rem" : 0,
                        borderBottomRightRadius: index === columns.length - 1 ? "0.75rem" : 0,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {employees.map(
                  (emp, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom:
                          "1px solid var(--border)",
                      }}
                      {...rowHover}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={`https://i.pravatar.cc/100?img=${
                              index +
                              20
                            }`}
                            className="w-10 h-10 rounded-xl"
                            alt={
                              emp.name
                            }
                          />

                          <div>
                            <h4
                              className="font-medium text-sm"
                              style={
                                textPrimary
                              }
                            >
                              {
                                emp.name
                              }
                            </h4>

                            <p
                              className="text-xs"
                              style={
                                textSecondary
                              }
                            >
                              ID:
                              EMP-20
                              {index}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td
                        className="py-4 text-sm"
                        style={
                          textSecondary
                        }
                      >
                        {emp.dept}
                      </td>

                      <td className="py-4">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={getStatusStyle(
                            emp.status
                          )}
                        >
                          {
                            emp.status
                          }
                        </span>
                      </td>

                      <td
                        className="py-4 text-sm font-semibold"
                        style={
                          textPrimary
                        }
                      >
                        {emp.score}
                      </td>

                      <td className="py-4">
                        <button
                          className="px-3 py-2 rounded-lg text-xs font-medium"
                          style={
                            btnSecondary
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">
          {/* QUICK ACTIONS */}
         

          {/* RECENT ACTIVITY */}
          <div
            className="rounded-2xl p-5 border"
            style={{
              ...card,
              borderColor:
                "var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xl font-bold"
                style={textPrimary}
              >
                Recent Activity
              </h2>

              <Bell
                size={16}
                style={textSecondary}
              />
            </div>

            <div className="space-y-4">
              {recentActivities.map(
                (item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background:
                          isDark
                            ? "rgba(255,255,255,0.05)"
                            : "#ecfdf5",
                        color:
                          "#10b981",
                      }}
                    >
                      <CheckCircle2
                        size={16}
                      />
                    </div>

                    <div>
                      <h4
                        className="text-sm font-semibold"
                        style={
                          textPrimary
                        }
                      >
                        {
                          item.title
                        }
                      </h4>

                      <p
                        className="text-xs mt-1 leading-relaxed"
                        style={
                          textSecondary
                        }
                      >
                        {item.desc}
                      </p>

                      <p
                        className="text-[11px] mt-2"
                        style={
                          textSecondary
                        }
                      >
                        {item.time}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-md rounded-2xl p-5 border"
            style={{
              ...card,
              borderColor:
                "var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xl font-bold"
                style={textPrimary}
              >
                Add Employee
              </h2>

              <button
                onClick={() =>
                  setShowModal(false)
                }
              >
                <X
                  size={18}
                  style={
                    textSecondary
                  }
                />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Employee Name"
                value={
                  newEmployee.name
                }
                onChange={(e) =>
                  setNewEmployee({
                    ...newEmployee,
                    name:
                      e.target.value,
                  })
                }
                className="w-full p-3 rounded-xl border outline-none bg-transparent text-sm"
              />

              <input
                type="text"
                placeholder="Department"
                value={
                  newEmployee.dept
                }
                onChange={(e) =>
                  setNewEmployee({
                    ...newEmployee,
                    dept:
                      e.target.value,
                  })
                }
                className="w-full p-3 rounded-xl border outline-none bg-transparent text-sm"
              />

              <input
                type="text"
                placeholder="Performance Score"
                value={
                  newEmployee.score
                }
                onChange={(e) =>
                  setNewEmployee({
                    ...newEmployee,
                    score:
                      e.target.value,
                  })
                }
                className="w-full p-3 rounded-xl border outline-none bg-transparent text-sm"
              />

              <ConstrainedDropdown
                value={
                  newEmployee.status
                }
                onChange={(value) =>
                  setNewEmployee({
                    ...newEmployee,
                    status:
                      value,
                  })
                }
                options={["Active", "On Leave"]}
                buttonStyle={{
                  height: "auto",
                  padding: "0.75rem",
                  borderRadius: "0.75rem",
                  background: "transparent",
                }}
              />

              <button
                onClick={
                  handleAddEmployee
                }
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={btnPrimary}
              >
                Save Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
