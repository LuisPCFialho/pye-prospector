const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface Props {
  monthlyKwh: number[];
  totalKwh: number;
}

export default function SolarChart({ monthlyKwh, totalKwh }: Props) {
  const max = Math.max(...monthlyKwh, 1);
  const h = 80;
  const barW = 16;
  const gap = 4;
  const totalW = MONTHS.length * (barW + gap) - gap;

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-400">Geração mensal estimada</span>
        <span className="text-xs font-semibold text-brand-400">
          {totalKwh.toLocaleString("pt-PT", { maximumFractionDigits: 0 })} MWh/ano
        </span>
      </div>
      <svg viewBox={`0 0 ${totalW} ${h + 16}`} className="w-full overflow-visible">
        {monthlyKwh.map((v, i) => {
          const barH = Math.max(2, (v / max) * h);
          const x = i * (barW + gap);
          return (
            <g key={i}>
              <rect
                x={x} y={h - barH} width={barW} height={barH}
                fill="#f97316" rx="2" opacity="0.9"
              />
              <text
                x={x + barW / 2} y={h + 12}
                textAnchor="middle" fontSize="7" fill="#64748b"
              >
                {MONTHS[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
