import React from 'react';

interface TornadoChartProps {
  sensitivity?: Record<string, number>;
  fluidLabel: string;
  unit: string;
}

export const TornadoChart: React.FC<TornadoChartProps> = ({
  sensitivity,
  fluidLabel,
  unit,
}) => {
  if (!sensitivity) return null;
  const entries = Object.entries(sensitivity).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (entries.length === 0) return null;

  const svgWidth = 600;
  const barHeight = 26;
  const rowGap = 12;
  const padLeft = 170;
  const padRight = 80;
  const padTop = 30;
  const padBottom = 30;

  const svgHeight = padTop + entries.length * (barHeight + rowGap) + padBottom;
  const plotW = svgWidth - padLeft - padRight;
  const midX = padLeft + plotW / 2;

  return (
    <div className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="font-bold text-sm text-[#e8f4f8]">
          {fluidLabel} Sensitivity Analysis (Tornado Chart)
        </span>
        <span className="text-[#8aafc0] text-[11px]">Pearson Correlation Coefficient (r)</span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[480px]">
          {/* Center Zero Line */}
          <line x1={midX} y1={padTop - 10} x2={midX} y2={svgHeight - padBottom} stroke="#8aafc0" strokeWidth="1.5" strokeDasharray="3,3" />

          {/* X Axis Reference Lines */}
          {[-1, -0.5, 0, 0.5, 1].map((tickVal, idx) => {
            const x = midX + (tickVal / 1.0) * (plotW / 2);
            return (
              <g key={idx}>
                <line x1={x} y1={padTop} x2={x} y2={svgHeight - padBottom} stroke="rgba(42,155,176,0.12)" />
                <text x={x} y={svgHeight - padBottom + 16} fill="#8aafc0" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">
                  {tickVal > 0 ? `+${tickVal}` : tickVal}
                </text>
              </g>
            );
          })}

          {/* Tornado Bars */}
          {entries.map(([param, corr], idx) => {
            const y = padTop + idx * (barHeight + rowGap);
            const barLen = Math.abs(corr) * (plotW / 2);
            const isPositive = corr >= 0;
            const x = isPositive ? midX : midX - barLen;
            const barColor = isPositive ? '#2ecc71' : '#e74c3c';

            return (
              <g key={param}>
                {/* Parameter Label */}
                <text
                  x={padLeft - 10}
                  y={y + barHeight / 2 + 4}
                  fill="#e8f4f8"
                  fontSize="11"
                  fontWeight="500"
                  textAnchor="end"
                >
                  {param}
                </text>

                {/* Horizontal Bar */}
                <rect
                  x={x}
                  y={y}
                  width={Math.max(2, barLen)}
                  height={barHeight}
                  fill={barColor}
                  opacity={0.85}
                  rx={3}
                  className="hover:opacity-100 transition-opacity"
                />

                {/* Correlation Value Label */}
                <text
                  x={isPositive ? x + barLen + 8 : x - 8}
                  y={y + barHeight / 2 + 4}
                  fill={barColor}
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                  textAnchor={isPositive ? 'start' : 'end'}
                >
                  {corr > 0 ? `+${corr.toFixed(3)}` : corr.toFixed(3)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 text-[11px] text-[#8aafc0] bg-[#071322] p-2.5 rounded border border-[#2a9bb0]/20">
        💡 <b>Interpretation:</b> Right (Green) = Increasing this parameter directly increases hydrocarbon volumes. Left (Red) = Increasing this parameter decreases volumes (e.g. higher Water Saturation $S_w$ or Formation Volume Factor $B_o$ reduces reserves).
      </div>
    </div>
  );
};
