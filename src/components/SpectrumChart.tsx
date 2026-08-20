import React from 'react';
import { HorizonSuggestion } from '../types';

interface SpectrumChartProps {
  meanTrace: number[];
  envelope: number[];
  sampleRate: number;
  suggestions: HorizonSuggestion[];
  onSelectSuggestion?: (sug: HorizonSuggestion) => void;
}

export const SpectrumChart: React.FC<SpectrumChartProps> = ({
  meanTrace,
  envelope,
  sampleRate,
  suggestions,
  onSelectSuggestion,
}) => {
  const n = meanTrace.length;
  if (n === 0) return null;

  const totalTimeMs = (n - 1) * sampleRate;

  // Find max values for scaling
  let maxAmp = 0.001;
  let maxEnv = 0.001;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(meanTrace[i]);
    const e = envelope[i] || 0;
    if (a > maxAmp) maxAmp = a;
    if (e > maxEnv) maxEnv = e;
  }
  const peakScale = Math.max(maxAmp, maxEnv) * 1.1;

  // SVG dimensions
  const svgWidth = 700;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const midY = padTop + plotH / 2;

  // Generate Mean Trace Path
  const step = Math.max(1, Math.floor(n / 400));
  let tracePath = '';
  for (let i = 0; i < n; i += step) {
    const x = padLeft + (i / (n - 1)) * plotW;
    const y = midY - (meanTrace[i] / peakScale) * (plotH / 2);
    if (i === 0) tracePath += `M ${x} ${y}`;
    else tracePath += ` L ${x} ${y}`;
  }

  // Generate Envelope Path
  let envPath = '';
  for (let i = 0; i < n; i += step) {
    const x = padLeft + (i / (n - 1)) * plotW;
    const y = midY - (envelope[i] / peakScale) * (plotH / 2);
    if (i === 0) envPath += `M ${x} ${y}`;
    else envPath += ` L ${x} ${y}`;
  }

  return (
    <div className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-3 shadow-xl">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="font-semibold text-[#e8f4f8]">Mean Trace Amplitude & Hilbert Envelope Spectrum</span>
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-[#8aafc0]" />
            <span className="text-[#8aafc0]">Mean Amplitude</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-[#f0a500] rounded-sm" />
            <span className="text-[#f0a500]">Hilbert Envelope</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#2ecc71]" />
            <span className="text-[#2ecc71]">Horizon Candidate</span>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[500px]">
          {/* Background Grid */}
          <line x1={padLeft} y1={midY} x2={padLeft + plotW} y2={midY} stroke="rgba(42,155,176,0.3)" strokeDasharray="3,3" />
          
          {/* X Axis Time ticks */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const x = padLeft + frac * plotW;
            const tMs = Math.round(frac * totalTimeMs);
            return (
              <g key={idx}>
                <line x1={x} y1={padTop} x2={x} y2={padTop + plotH} stroke="rgba(42,155,176,0.15)" strokeDasharray="2,2" />
                <text x={x} y={svgHeight - 10} fill="#8aafc0" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono">
                  {tMs} ms
                </text>
              </g>
            );
          })}

          {/* Trace Curves */}
          <path d={tracePath} fill="none" stroke="#607d8b" strokeWidth="1.2" />
          <path d={envPath} fill="none" stroke="#f0a500" strokeWidth="2" opacity="0.85" />

          {/* Horizon Suggestions Peaks */}
          {suggestions.map((sug, idx) => {
            const x = padLeft + (sug.sample / (n - 1)) * plotW;
            const y = midY - (envelope[sug.sample] / peakScale) * (plotH / 2);
            return (
              <g
                key={idx}
                className="cursor-pointer group"
                onClick={() => onSelectSuggestion && onSelectSuggestion(sug)}
              >
                <line x1={x} y1={padTop} x2={x} y2={padTop + plotH} stroke="#2ecc71" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
                <circle cx={x} cy={y} r="4.5" fill="#2ecc71" stroke="#0a1628" strokeWidth="1.5" className="group-hover:r-6 transition-all" />
                <text
                  x={x}
                  y={y - 8}
                  fill="#e8f4f8"
                  fontSize="8.5"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono"
                  className="font-bold drop-shadow"
                >
                  {sug.timeMs}ms ({sug.confidence}%)
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
