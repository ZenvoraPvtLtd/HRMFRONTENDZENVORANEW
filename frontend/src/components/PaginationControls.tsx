import ConstrainedDropdown from "./ConstrainedDropdown";

type PaginationControlsProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
};

export default function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = totalItems ? (safePage - 1) * pageSize + 1 : 0;
  const end = Math.min(safePage * pageSize, totalItems);

  if (totalItems === 0) return null;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 text-sm"
      style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}
    >
      <span>
        Showing {start} to {end} of {totalItems} {itemLabel}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className="px-3 py-1.5 rounded-xl text-sm font-semibold"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            cursor: safePage === 1 ? "not-allowed" : "pointer",
            opacity: safePage === 1 ? 0.5 : 1,
          }}
        >
          Previous
        </button>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className="min-w-9 px-3 py-1.5 rounded-xl text-sm font-semibold"
            style={{
              border: `1px solid ${page === safePage ? "var(--accent)" : "var(--border)"}`,
              background: page === safePage ? "var(--accent)" : "var(--bg-secondary)",
              color: page === safePage ? "var(--accent-text)" : "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === totalPages}
          className="px-3 py-1.5 rounded-xl text-sm font-semibold"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            cursor: safePage === totalPages ? "not-allowed" : "pointer",
            opacity: safePage === totalPages ? 0.5 : 1,
          }}
        >
          Next
        </button>

        {pageSizeOptions && onPageSizeChange && (
          <label className="flex items-center gap-2 ml-1">
            <span>Show</span>
            <ConstrainedDropdown
              value={String(pageSize)}
              onChange={(value) => onPageSizeChange(Number(value))}
              options={pageSizeOptions.map(String)}
              className="w-20"
              buttonStyle={{
                height: "2rem",
                borderRadius: "0.75rem",
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <span>{itemLabel}</span>
          </label>
        )}
      </div>
    </div>
  );
}
