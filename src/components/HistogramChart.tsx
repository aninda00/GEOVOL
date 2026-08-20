import React from 'react';
import { FluidMCResult } from '../types';

interface HistogramChartProps {
  fluidResult: FluidMCResult;
  fluidLabel: string;
  color?: string;
}

export const HistogramChart: React.FC<HistogramChartProps> = ({
  fluidResult,
  fluidLabel,
  color = '#2a9bb0',
}) => {
  const { raw, p10, p50, p90, mean, unit } = fluidResult;
  const n = raw.length;
  if (n === 0) return null;

  // Build histogram bins (40 bins)
  const nBins = 36;
  const sorted = [...raw].sort((a, b) => a - b);
  const minVal = sorted[0];
  const maxVal = sorted[n - 1];
  const span = Math.max(1e-4, maxVal - minVal);
  const binWidth = span / nBins;

  const bins = new Array(nBins).fill(0);
  for (let i = 0; i < n; i++) {
    const bIdx = Math.min(nBins - 1, Math.floor((raw[i] - minVal) / binWidth));
    bins[bIdx]++;
  }

  const maxFreq = Math.max(...bins, 1);

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 280;
  const padLeft = 45;
  const padRight = 35;
  const padTop = 25;
  const padBottom = 40;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const getX = (val: number) => padLeft + ((val - minVal) / span) * plotW;

  const xP10 = getX(p10);
  const xP50 = getX(p50);
  const xP90 = getX(p90);
  const xMean = getX(mean);

  // Cumulative distribution curve (CDF / S-curve)
  let cdfPath = '';
  let cumSum = 0;
  for (let b = 0; b < nBins; b++) {
    cumSum += bins[b];
    const cdfFrac = cumSum / n;
    const x = padLeft + ((b + 0.5) / nBins) * plotW;
    const y = padTop + (1 - cdfFrac) * plotH;
    if (b === 0) cdfPath += `M ${x} ${y}`;
    else cdfPath += ` L ${x} ${y}`;
  }

  return (
    <div className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-[#e8f4f8]">
            {fluidLabel} Probability Distribution ({unit})
          </span>
          <span className="text-[#8aafc0] text-[11px] font-mono">({n.toLocaleString()} runs)</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-[#e74c3c] rounded-xs" />
            <span className="text-[#e74c3c] font-mono">P10: {p10.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-[#2ecc71] rounded-xs" />
            <span className="text-[#2ecc71] font-mono">P50: {p50.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-[#f0a500] rounded-xs" />
            <span className="text-[#f0a500] font-mono">P90: {p90.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-[#00f0ff]" />
            <span className="text-[#00f0ff] font-mono">CDF</span>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[480px]">
          {/* Background Grid */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const y = padTop + frac * plotH;
            return (
              <line
                key={idx}
                x1={padLeft}
                y1={y}
                x2={padLeft + plotW}
                y2={y}
                stroke="rgba(42,155,176,0.15)"
                strokeDasharray="2,2"
              />
            );
          })}

          {/* Histogram Bars */}
          {bins.map((count, idx) => {
            const barW = (plotW / nBins) * 0.88;
            const barH = (count / maxFreq) * plotH;
            const x = padLeft + (idx / nBins) * plotW + (plotW / nBins) * 0.06;
            const y = padTop + plotH - barH;

            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={color}
                opacity={0.7}
                rx={1}
                className="hover:opacity-100 transition-opacity"
              />
            );
          })}

          {/* CDF S-Curve */}
          <path d={cdfPath} fill="none" stroke="#00f0ff" strokeWidth="2" strokeDasharray="3,3" opacity="0.85" />

          {/* Vertical P10 Line (Red) */}
          <line x1={xP10} y1={padTop} x2={xP10} y2={padTop + plotH} stroke="#e74c3c" strokeWidth="2" />
          <text x={xP10} y={padTop - 6} fill="#e74c3c" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="JetBrains Mono">
            P10
          </text>

          {/* Vertical P50 Line (Green) */}
          <line x1={xP50} y1={padTop} x2={xP50} y2={padTop + plotH} stroke="#2ecc71" strokeWidth="2.5" />
          <text x={xP50} y={padTop - 6} fill="#2ecc71" fontSize="9.5" fontWeight="bold" textAnchor="middle" fontFamily="JetBrains Mono">
            P50
          </text>

          {/* Vertical P90 Line (Amber) */}
          <line x1={xP90} y1={padTop} x2={xP90} y2={padTop + plotH} stroke="#f0a500" strokeWidth="2" />
          <text x={xP90} y={padTop - 6} fill="#f0a500" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="JetBrains Mono">
            P90
          </text>

          {/* X Axis Values */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const x = padLeft + frac * plotW;
            const val = minVal + frac * span;
            return (
              <g key={idx}>
                <line x1={x} y1={padTop + plotH} x2={x} y2={padTop + plotH + 4} stroke="#8aafc0" />
                <text x={x} y={svgHeight - 15} fill="#8aafc0" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          <text x={padLeft + plotW / 2} y={svgHeight - 2} fill="#8aafc0" fontSize="9.5" textAnchor="middle">
            {fluidLabel} ({unit})
          </text>
        </svg>
      </div>
    </div>
  );
};
