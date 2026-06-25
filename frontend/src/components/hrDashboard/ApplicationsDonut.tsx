export interface DonutSegment {
  label: string;
  value: number;
    percent: string;
  color: string;
}

export interface ApplicationsDonutProps {
   total: number;
   data: DonutSegment[];
    title?: string;
}


function buildConicGradient(data: DonutSegment[], total: number): string {
  let cursor = 0;
  const stops = data.map((seg) => {
    const start = cursor;
    const degrees = (seg.value / total) * 360;
    cursor += degrees;
    return `${seg.color} ${start}deg ${cursor}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export default function ApplicationsDonut({
  total,
  data,
  title = "Total Applications",
}: ApplicationsDonutProps) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-6 flex flex-col"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="text-base font-semibold mb-4 sm:mb-6"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 flex-1">
        {/* Donut ring */}
        <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: buildConicGradient(data, total),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              className="rounded-full flex flex-col items-center justify-center"
              style={{ width: 116, height: 116, background: "var(--bg-primary)" }}
            >
              <span
                className="text-2xl sm:text-3xl font-extrabold"
                style={{ color: "var(--text-primary)" }}
              >
                {total}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Total
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 w-full">
          {data.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: item.color,
                    flexShrink: 0,
                  }}
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {item.label}
                </span>
              </div>
              <div className="flex gap-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.value}
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  ({item.percent})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
