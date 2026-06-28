export type TrendChartData = {
  years: string[];
  pubs: number[];
  cumCits: number[];
  maxPub: number;
  maxCit: number;
};

export default function TrendChart({ data }: { data: TrendChartData }) {
  const W = 660;
  const H = 250;
  const padL = 20;
  const padR = 20;
  const padTop = 46;
  const padBot = 40;
  const base = H - padBot;
  const n = data.years.length;
  const slot = (W - padL - padR) / n;
  const x = (i: number) => padL + slot * (i + 0.5);
  const barW = Math.min(54, slot * 0.5);
  const barH = (v: number) => ((base - padTop) * v) / data.maxPub;
  const yCit = (v: number) => base - ((base - padTop) * v) / data.maxCit;
  const peak = data.pubs.indexOf(data.maxPub);
  const pts = data.cumCits.map((v, i) => `${x(i)},${yCit(v)}`).join(' ');
  const last = n - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="researcher-trend__svg" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <line x1={padL} y1={base} x2={W - padR} y2={base} stroke="#E3F3FB" strokeWidth="1.5" />
      {data.pubs.map((v, i) => (
        <g key={data.years[i]}>
          <rect
            x={x(i) - barW / 2}
            y={base - barH(v)}
            width={barW}
            height={barH(v)}
            rx="5"
            fill={i === peak ? '#05607D' : '#087EA4'}
          />
          <text x={x(i)} y={base - barH(v) - 9} textAnchor="middle" fontSize="14" fontWeight="500" fill="#5D7280">
            {v}
          </text>
          <text x={x(i)} y={base + 26} textAnchor="middle" fontSize="14" fill="#5D7280">
            &apos;{data.years[i].slice(2)}
          </text>
        </g>
      ))}
      <polyline
        points={pts}
        fill="none"
        stroke="#0E7490"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.cumCits.map((v, i) => (
        <circle key={`cit-${data.years[i]}`} cx={x(i)} cy={yCit(v)} r="3.5" fill="#fff" stroke="#0E7490" strokeWidth="2" />
      ))}
      <text
        x={x(last)}
        y={yCit(data.cumCits[last]) - 10}
        textAnchor="end"
        fontSize="13"
        fontWeight="600"
        fill="#0E7490"
      >
        {data.cumCits[last].toLocaleString('es')}
      </text>
    </svg>
  );
}
