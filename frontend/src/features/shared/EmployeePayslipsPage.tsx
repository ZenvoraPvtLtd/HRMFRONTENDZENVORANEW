import { useState, useEffect, useMemo } from "react";
import { FileText, DollarSign, Calendar, CheckCircle2 } from "lucide-react";
import { mockPayslips, PayslipModal } from "./Dashboard";
import type { MockPayslip } from "./Dashboard";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

// ── Derived summary stats ──────────────────────────────────────────────────────
const totalNet = mockPayslips.reduce((sum, p) => sum + p.net, 0);
const lastPayslip = mockPayslips[0] ?? null;

export default function EmployeePayslipsPage() {
  const [selectedPayslip, setSelectedPayslip] = useState<MockPayslip | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleSearch = (event: Event) => {
      setSearch((event as CustomEvent<string>).detail || "");
    };
    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  const filteredPayslips = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mockPayslips;
    return mockPayslips.filter((p) =>
      [p.id, p.month, p.year, p.status, p.date].some((v) =>
        String(v).toLowerCase().includes(q)
      )
    );
  }, [search]);

  return (
    <div className="w-full animate-fade-in">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          My Payslips
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {mockPayslips.length} payslip{mockPayslips.length !== 1 ? "s" : ""} available
        </p>
      </div>

      {/* ── Summary stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Total payslips */}
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
          >
            <FileText size={18} />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {mockPayslips.length}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Total Payslips
            </p>
          </div>
        </div>

        {/* Total net earnings */}
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}
          >
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              ${totalNet.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Total Net Earnings
            </p>
          </div>
        </div>

        {/* Last payment */}
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {lastPayslip ? `${lastPayslip.month} ${lastPayslip.year}` : "—"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Last Payment
            </p>
          </div>
        </div>
      </div>

      {/* ── Payslip list ──────────────────────────────────────────────────────── */}
      {filteredPayslips.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-16 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
          >
            <FileText size={22} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {search.trim() ? "No payslips found." : "No payslips available"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {search.trim()
              ? "Try a different search term."
              : "Your payslips will appear here once they are generated"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPayslips.map((payslip) => (
            <div
              key={payslip.id}
              onClick={() => setSelectedPayslip(payslip)}
              className="rounded-2xl p-5 cursor-pointer transition-shadow hover:shadow-md"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: icon + payslip info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
                  >
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      Payslip — {payslip.month} {payslip.year}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {payslip.date} · {payslip.id}
                    </p>
                  </div>
                </div>

                {/* Right: amount + status */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      ${payslip.net.toLocaleString()}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Net Pay
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} style={{ color: "#10b981" }} />
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full uppercase"
                      style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
                    >
                      {payslip.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom divider + breakdown — visible at sm+ */}
              <div
                className="hidden sm:grid grid-cols-3 gap-4 mt-4 pt-4 text-xs"
                style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <div>
                  <span className="block uppercase tracking-wide mb-0.5" style={{ fontSize: "0.65rem" }}>
                    Basic
                  </span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    ${payslip.basic.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block uppercase tracking-wide mb-0.5" style={{ fontSize: "0.65rem" }}>
                    HRA + Allowances
                  </span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    ${(payslip.hra + payslip.allowance).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block uppercase tracking-wide mb-0.5" style={{ fontSize: "0.65rem" }}>
                    Deductions
                  </span>
                  <span className="font-semibold" style={{ color: "#ef4444" }}>
                    −${payslip.deductions.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPayslip && (
        <PayslipModal payslip={selectedPayslip} onClose={() => setSelectedPayslip(null)} />
      )}
    </div>
  );
}
