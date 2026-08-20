import React from 'react';
import { HorizonSuggestion } from '../types';

interface SpectrumChartProps {
  meanTrace: number[];
  envelope?: number[];
  sampleRate: number;
  suggestions?: HorizonSuggestion[];
  onSelectSuggestion?: (sug: HorizonSuggestion) => void;
}

export const SpectrumChart: React.FC<SpectrumChartProps> = ({
  meanTrace,
  envelope = [],
  sampleRate,
  suggestions = [],
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
    const e = envelope[i] || Math.abs(meanTrace[i]);
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

  // Step down points for SVG rendering
  const step = Math.max(1, Math.floor(n / 400));
  let meanPath = '';
  let envPath = '';

  for (let i = 0; i < n; i += step) {
    const x = padLeft + (i / (n - 1)) * plotW;
    const yMean = midY - (meanTrace[i] / peakScale) * (plotH / 2);
    const envVal = envelope[i] || Math.abs(meanTrace[i]);
    const yEnv = midY - (envVal / peakScale) * (plotH / 2);

    if (i === 0) {
      meanPath += `M ${x.toFixed(1)} ${yMean.toFixed(1)}`;
      envPath += `M ${x.toFixed(1)} ${yEnv.toFixed(1)}`;
    } else {
      meanPath += ` L ${x.toFixed(1)} ${yMean.toFixed(1)}`;
      envPath += ` L ${x.toFixed(1)} ${yEnv.toFixed(1)}`;
    }
  }

  return (
    <div className="bg-[#050c17] rounded-xl border border-[#2a9bb0]/30 p-3 shadow-inner">
      <div className="flex items-center justify-between text-xs text-[#8aafc0] px-2 mb-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-0.5 bg-[#00f0ff]"></span> Average Trace Amplitude
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-0.5 bg-[#ffd700] border-dashed"></span> Instantaneous Envelope
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#2a9bb0]">
          Total Time: {Math.round(totalTimeMs)} ms
        </span>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto text-[10px] font-mono text-[#8aafc0]"
      >
        {/* Background Grid */}
        <line
          x1={padLeft}
          y1={midY}
          x2={svgWidth - padRight}
          y2={midY}
          stroke="rgba(42, 155, 176, 0.25)"
          strokeWidth="1"
          strokeDasharray="4 2"
        />

        {/* Time Tick Marks */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
          const x = padLeft + frac * plotW;
          const time = Math.round(frac * totalTimeMs);
          return (
            <g key={idx}>
              <line
                x1={x}
                y1={padTop}
                x2={x}
                y2={padTop + plotH}
                stroke="rgba(42, 155, 176, 0.1)"
                strokeWidth="1"
              />
              <text x={x} y={svgHeight - 10} fill="#8aafc0" textAnchor="middle">
                {time}ms
              </text>
            </g>
          );
        })}

        {/* Amplitude Ticks */}
        <text x={padLeft - 8} y={padTop + 10} fill="#8aafc0" textAnchor="end">
          +{peakScale.toFixed(2)}
        </text>
        <text x={padLeft - 8} y={midY + 4} fill="#8aafc0" textAnchor="end">
          0.0
        </text>
        <text x={padLeft - 8} y={padTop + plotH} fill="#8aafc0" textAnchor="end">
          -{peakScale.toFixed(2)}
        </text>

        {/* Mean Trace Path */}
        <path d={meanPath} fill="none" stroke="#00f0ff" strokeWidth="1.5" />

        {/* Envelope Path */}
        <path
          d={envPath}
          fill="none"
          stroke="#ffd700"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity="0.8"
        />

        {/* Candidate Horizon Marker Pins */}
        {suggestions.map((sug, idx) => {
          const x = padLeft + (sug.sample / (n - 1)) * plotW;
          return (
            <g
              key={idx}
              className="cursor-pointer group"
              onClick={() => onSelectSuggestion && onSelectSuggestion(sug)}
            >
              <line
                x1={x}
                y1={padTop}
                x2={x}
                y2={padTop + plotH}
                stroke="#2ecc71"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle
                cx={x}
                cy={padTop + 8}
                r="4"
                fill="#2ecc71"
                className="group-hover:scale-125 transition-transform"
              />
              <text
                x={x}
                y={padTop - 4}
                fill="#2ecc71"
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
              >
                {sug.timeMs}ms
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
