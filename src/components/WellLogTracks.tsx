import React from 'react';
import { LASSummary } from '../types';

interface WellLogTracksProps {
  las: LASSummary;
  topDepth: number;
  baseDepth: number;
  phiCurve?: string;
  swCurve?: string;
  grCurve?: string;
  rtCurve?: string;
}

export const WellLogTracks: React.FC<WellLogTracksProps> = ({
  las,
  topDepth,
  baseDepth,
  phiCurve = 'PHIF',
  swCurve = 'SW',
  grCurve = 'GR',
  rtCurve = 'RT',
}) => {
  const depthArr = las.data[las.depthCurve] || [];
  const n = depthArr.length;
  if (n === 0) return null;

  const minD = las.depthMin;
  const maxD = las.depthMax;
  const depthSpan = Math.max(1, maxD - minD);

  const grArr = las.data[grCurve] || [];
  const phiArr = las.data[phiCurve] || [];
  const swArr = las.data[swCurve] || [];
  const rtArr = las.data[rtCurve] || [];

  const svgWidth = 640;
  const svgHeight = 440;
  const padTop = 35;
  const padBottom = 20;
  const plotH = svgHeight - padTop - padBottom;

  // Track layout: Depth Col (40px) + Track 1 (140px) + Track 2 (140px) + Track 3 (140px) + Track 4 (140px)
  const trackW = 135;
  const depthColW = 50;

  const getNormY = (d: number) => padTop + ((d - minD) / depthSpan) * plotH;

  // Generate track path
  const makePath = (arr: number[], minVal: number, maxVal: number, trackLeft: number, isLog: boolean = false) => {
    const span = Math.max(1e-5, maxVal - minVal);
    let path = '';
    const step = Math.max(1, Math.floor(n / 350));

    for (let i = 0; i < n; i += step) {
      const d = depthArr[i];
      const val = arr[i];
      if (isNaN(d) || isNaN(val)) continue;

      let normX = 0;
      if (isLog) {
        const logMin = Math.log10(Math.max(0.1, minVal));
        const logMax = Math.log10(Math.max(1, maxVal));
        const logVal = Math.log10(Math.max(0.1, val));
        normX = (logVal - logMin) / (logMax - logMin);
      } else {
        normX = (val - minVal) / span;
      }
      normX = Math.max(0, Math.min(1, normX));

      const x = trackLeft + normX * trackW;
      const y = getNormY(d);

      if (path === '') path += `M ${x} ${y}`;
      else path += ` L ${x} ${y}`;
    }
    return path;
  };

  // Top & Base Reservoir Zone Shading
  const topY = getNormY(topDepth);
  const baseY = getNormY(baseDepth);
  const zoneH = Math.max(2, baseY - topY);

  return (
    <div className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-3 shadow-xl overflow-x-auto">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="font-semibold text-[#e8f4f8]">
          Well: <b className="text-[#f0a500]">{las.wellName}</b> &nbsp;|&nbsp; Depth Range: {minD.toFixed(0)}m – {maxD.toFixed(0)}m
        </span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-[#2ecc71]/20 border border-[#2ecc71] rounded-sm inline-block" />
          <span className="text-xs text-[#2ecc71]">Reservoir Pay Zone ({topDepth.toFixed(0)}m – {baseDepth.toFixed(0)}m)</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[580px]">
        {/* Reservoir Zone Overlay across all tracks */}
        <rect
          x={depthColW}
          y={topY}
          width={trackW * 4 + 10}
          height={zoneH}
          fill="rgba(46, 204, 113, 0.12)"
          stroke="#2ecc71"
          strokeWidth="1"
          strokeDasharray="4,4"
        />

        {/* Depth Column */}
        <g>
          <rect x={0} y={padTop} width={depthColW} height={plotH} fill="#0d2138" stroke="rgba(42,155,176,0.3)" />
          <text x={depthColW / 2} y={20} fill="#8aafc0" fontSize="9" fontWeight="bold" textAnchor="middle">
            DEPTH (m)
          </text>
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const d = minD + frac * depthSpan;
            const y = padTop + frac * plotH;
            return (
              <text key={idx} x={depthColW / 2} y={y + 3} fill="#8aafc0" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
                {d.toFixed(0)}
              </text>
            );
          })}
        </g>

        {/* Track 1: Gamma Ray (0 - 150 API) */}
        <g transform={`translate(${depthColW}, 0)`}>
          <rect x={0} y={padTop} width={trackW} height={plotH} fill="#081524" stroke="rgba(42,155,176,0.3)" />
          <text x={trackW / 2} y={15} fill="#2ecc71" fontSize="9" fontWeight="bold" textAnchor="middle">
            GAMMA RAY (gAPI)
          </text>
          <text x={4} y={27} fill="#8aafc0" fontSize="7.5">0</text>
          <text x={trackW - 18} y={27} fill="#8aafc0" fontSize="7.5">150</text>
          <path d={makePath(grArr, 0, 150, 0)} fill="none" stroke="#2ecc71" strokeWidth="1.2" />
        </g>

        {/* Track 2: Porosity (0.0 - 0.40) */}
        <g transform={`translate(${depthColW + trackW}, 0)`}>
          <rect x={0} y={padTop} width={trackW} height={plotH} fill="#081524" stroke="rgba(42,155,176,0.3)" />
          <text x={trackW / 2} y={15} fill="#2a9bb0" fontSize="9" fontWeight="bold" textAnchor="middle">
            POROSITY (V/V)
          </text>
          <text x={4} y={27} fill="#8aafc0" fontSize="7.5">0.0</text>
          <text x={trackW - 20} y={27} fill="#8aafc0" fontSize="7.5">0.40</text>
          <path d={makePath(phiArr, 0, 0.4, 0)} fill="none" stroke="#2a9bb0" strokeWidth="1.2" />
        </g>

        {/* Track 3: Water Saturation (0.0 - 1.0) */}
        <g transform={`translate(${depthColW + trackW * 2}, 0)`}>
          <rect x={0} y={padTop} width={trackW} height={plotH} fill="#081524" stroke="rgba(42,155,176,0.3)" />
          <text x={trackW / 2} y={15} fill="#3498db" fontSize="9" fontWeight="bold" textAnchor="middle">
            WATER SAT (Sw)
          </text>
          <text x={4} y={27} fill="#8aafc0" fontSize="7.5">0.0</text>
          <text x={trackW - 18} y={27} fill="#8aafc0" fontSize="7.5">1.0</text>
          <path d={makePath(swArr, 0, 1.0, 0)} fill="none" stroke="#3498db" strokeWidth="1.2" />
        </g>

        {/* Track 4: Resistivity (0.2 - 200 ohm.m) */}
        <g transform={`translate(${depthColW + trackW * 3}, 0)`}>
          <rect x={0} y={padTop} width={trackW} height={plotH} fill="#081524" stroke="rgba(42,155,176,0.3)" />
          <text x={trackW / 2} y={15} fill="#f0a500" fontSize="9" fontWeight="bold" textAnchor="middle">
            RESISTIVITY (Ω.m)
          </text>
          <text x={4} y={27} fill="#8aafc0" fontSize="7.5">0.2</text>
          <text x={trackW - 22} y={27} fill="#8aafc0" fontSize="7.5">200</text>
          <path d={makePath(rtArr, 0.2, 200, 0, true)} fill="none" stroke="#f0a500" strokeWidth="1.2" />
        </g>
      </svg>
    </div>
  );
};
