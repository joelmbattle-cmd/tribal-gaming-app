"use client";

import type { LicensingMetrics } from "@/lib/licensing-metrics";

export type ChartDatum = { label: string; value: number; color: string };

export function outcomeSeries(m: LicensingMetrics): ChartDatum[] {
  return [
    {
      label: "Licensed",
      value: m.statusCounts.licensed,
      color: "var(--verify)",
    },
    { label: "Denied", value: m.statusCounts.denied, color: "var(--alert)" },
    {
      label: "Withdrew",
      value: m.statusCounts.withdrawn,
      color: "var(--pending)",
    },
    {
      label: "Separated",
      value: m.statusCounts.separated,
      color: "var(--parchment-dim)",
    },
  ];
}

export function investigationSeries(m: LicensingMetrics): ChartDatum[] {
  return [
    {
      label: "Completed (total)",
      value: m.investigationsCompleted,
      color: "var(--seal)",
    },
    {
      label: "Vendor principals",
      value: m.duration.vendor.count,
      color: "var(--seal-dim)",
    },
    {
      label: "Regular licensees",
      value: m.duration.regular.count,
      color: "var(--pending)",
    },
  ];
}

const cardStyle: React.CSSProperties = { flex: "1 1 320px", minWidth: 280 };

function Legend({ data, total }: { data: ChartDatum[]; total?: number }) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: "12px 0 0",
        display: "grid",
        gap: 6,
        fontSize: 13,
      }}
    >
      {data.map((d) => (
        <li
          key={d.label}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: d.color,
              display: "inline-block",
            }}
          />
          <span style={{ flex: 1 }}>{d.label}</span>
          <span style={{ fontFamily: "var(--font-plex-mono)" }}>
            {d.value}
            {total ? ` (${Math.round((d.value / total) * 100)}%)` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OutcomesPieChart({
  data,
  periodLabel,
}: {
  data: ChartDatum[];
  periodLabel: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 70;
  const c = 90;
  const nonZero = data.filter((d) => d.value > 0);
  const slices = nonZero.map((d, i) => {
    const before = nonZero.slice(0, i).reduce((a, x) => a + x.value, 0);
    const sweep = (d.value / total) * Math.PI * 2;
    const start = -Math.PI / 2 + (before / total) * Math.PI * 2;
    const end = start + sweep;
    if (sweep >= Math.PI * 2 - 1e-9) return { d, path: null as string | null };
    const x1 = c + r * Math.cos(start);
    const y1 = c + r * Math.sin(start);
    const x2 = c + r * Math.cos(end);
    const y2 = c + r * Math.sin(end);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      d,
      path: `M ${c} ${c} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
    };
  });
  const desc = data.map((d) => `${d.label} ${d.value}`).join(", ");

  return (
    <div className="metric-card" style={cardStyle}>
      <div className="metric-label">Outcomes</div>
      {total === 0 ? (
        <div
          className="metric-sub"
          style={{ padding: "40px 0", textAlign: "center" }}
        >
          No outcomes recorded for {periodLabel}
        </div>
      ) : (
        <>
          <svg
            viewBox="0 0 180 180"
            width="180"
            height="180"
            role="img"
            aria-label={`Outcomes for ${periodLabel}: ${desc}`}
            style={{ display: "block", margin: "12px auto 0" }}
          >
            {slices.map(({ d, path }) =>
              path === null ? (
                <circle
                  key={d.label}
                  cx={c}
                  cy={c}
                  r={r}
                  fill={d.color}
                  stroke="var(--panel)"
                  strokeWidth={2}
                >
                  <title>{`${d.label}: ${d.value}`}</title>
                </circle>
              ) : (
                <path
                  key={d.label}
                  d={path}
                  fill={d.color}
                  stroke="var(--panel)"
                  strokeWidth={2}
                >
                  <title>{`${d.label}: ${d.value}`}</title>
                </path>
              ),
            )}
          </svg>
          <Legend data={data} total={total} />
        </>
      )}
    </div>
  );
}

export function InvestigationsColumnChart({
  data,
  periodLabel,
}: {
  data: ChartDatum[];
  periodLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 300;
  const h = 180;
  const base = h - 24;
  const plotH = base - 20;
  const colW = 56;
  const gap = (w - colW * data.length) / (data.length + 1);
  const desc = data.map((d) => `${d.label} ${d.value}`).join(", ");
  const empty = data.every((d) => d.value === 0);

  return (
    <div className="metric-card" style={cardStyle}>
      <div className="metric-label">Investigations</div>
      {empty ? (
        <div
          className="metric-sub"
          style={{ padding: "40px 0", textAlign: "center" }}
        >
          No investigations completed in {periodLabel}
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            width="100%"
            style={{ maxWidth: w, display: "block", margin: "12px auto 0" }}
            role="img"
            aria-label={`Investigations for ${periodLabel}: ${desc}`}
          >
            <line
              x1={0}
              x2={w}
              y1={base}
              y2={base}
              stroke="var(--hairline-strong)"
            />
            {data.map((d, i) => {
              const bh = (d.value / max) * plotH;
              const x = gap + i * (colW + gap);
              return (
                <g key={d.label}>
                  <rect
                    x={x}
                    y={base - bh}
                    width={colW}
                    height={bh}
                    fill={d.color}
                    rx={2}
                  >
                    <title>{`${d.label}: ${d.value}`}</title>
                  </rect>
                  <text
                    x={x + colW / 2}
                    y={base - bh - 5}
                    textAnchor="middle"
                    fontSize={12}
                    fill="var(--parchment)"
                    fontFamily="var(--font-plex-mono)"
                  >
                    {d.value}
                  </text>
                  <text
                    x={x + colW / 2}
                    y={base + 15}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--parchment-dim)"
                  >
                    {d.label.split(" ")[0]}
                  </text>
                </g>
              );
            })}
          </svg>
          <Legend data={data} />
        </>
      )}
    </div>
  );
}
