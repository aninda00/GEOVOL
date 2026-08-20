import React, { useRef, useEffect, useState, useMemo } from 'react';
import { SeismicDataset } from '../types';
import { getInlineSection, getCrosslineSection, getTimeSlice, getLineTraces } from '../modules/seismicEngine';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Eye,
  Sliders,
  Maximize2,
  Minimize2,
  TrendingUp,
  Activity,
} from 'lucide-react';

interface SeismicSectionCanvasProps {
  cube: SeismicDataset;
  sliceType: 'inline' | 'crossline' | 'timeslice' | '2d-line';
  sliceIndex: number;
  topHorizon?: number[][];
  baseHorizon?: number[][];
  showHorizons?: boolean;
  colorMap?: 'RdBu' | 'Gray' | 'Seismic' | 'Thermal' | 'Rainbow' | 'Viridis';
  gain?: number;
  displayMode?: 'density' | 'wiggle' | 'both';
  agcEnabled?: boolean;
  agcWindowMs?: number;
  traceRange?: [number, number]; // [startTraceIdx, endTraceIdx] for 2D zooming
  onPickPoint?: (traceIdx: number, sampleIdx: number) => void;
}

export const SeismicSectionCanvas: React.FC<SeismicSectionCanvasProps> = ({
  cube,
  sliceType,
  sliceIndex,
  topHorizon,
  baseHorizon,
  showHorizons = true,
  colorMap = 'RdBu',
  gain = 1.0,
  displayMode = 'density',
  agcEnabled = false,
  agcWindowMs = 250,
  traceRange,
  onPickPoint,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoverInfo, setHoverInfo] = useState<{
    traceIdx: number;
    traceLabel: string;
    traceVal: number;
    timeMs: number;
    sampleIdx: number;
    ampVal: number;
  } | null>(null);

  const [internalZoom, setInternalZoom] = useState<number>(1);
  const [internalGain, setInternalGain] = useState<number>(gain);
  const [internalDisplayMode, setInternalDisplayMode] = useState<'density' | 'wiggle' | 'both'>(displayMode);
  const [internalColorMap, setInternalColorMap] = useState<typeof colorMap>(colorMap);
  const [polarityInvert, setPolarityInvert] = useState<boolean>(false);

  // Extract slice data
  const sliceData = useMemo(() => {
    if (cube.type === '2d' || sliceType === '2d-line') {
      const allTraces = getLineTraces(cube);
      const totalTraces = allTraces.length;
      const startT = traceRange ? Math.max(0, traceRange[0]) : 0;
      const endT = traceRange ? Math.min(totalTraces, traceRange[1]) : totalTraces;
      const visibleTraces = allTraces.slice(startT, endT);

      return {
        type: '2d-traces' as const,
        traces: visibleTraces,
        nTraces: visibleTraces.length,
        totalTraces,
        startTraceIdx: startT,
        nSamples: cube.nSamples,
        traceLabel: 'CMP / Trace',
        cdpNumbers: cube.cdpNumbers?.slice(startT, endT),
        shotPoints: cube.shotPoints?.slice(startT, endT),
        traceStart: cube.cdpNumbers ? cube.cdpNumbers[startT] : startT + 1,
        depthLabel: 'TWT (ms)',
      };
    } else if (sliceType === 'inline') {
      const safeIdx = Math.max(0, Math.min(cube.nInlines - 1, sliceIndex));
      return {
        type: '2d-traces' as const,
        traces: getInlineSection(cube, safeIdx),
        nTraces: cube.nCrosslines,
        totalTraces: cube.nCrosslines,
        startTraceIdx: 0,
        nSamples: cube.nSamples,
        traceLabel: 'Crossline',
        traceStart: cube.xlines[0] || 200,
        depthLabel: 'TWT (ms)',
      };
    } else if (sliceType === 'crossline') {
      const safeIdx = Math.max(0, Math.min(cube.nCrosslines - 1, sliceIndex));
      return {
        type: '2d-traces' as const,
        traces: getCrosslineSection(cube, safeIdx),
        nTraces: cube.nInlines,
        totalTraces: cube.nInlines,
        startTraceIdx: 0,
        nSamples: cube.nSamples,
        traceLabel: 'Inline',
        traceStart: cube.ilines[0] || 100,
        depthLabel: 'TWT (ms)',
      };
    } else {
      const safeIdx = Math.max(0, Math.min(cube.nSamples - 1, sliceIndex));
      return {
        type: 'timeslice' as const,
        grid: getTimeSlice(cube, safeIdx),
        nInlines: cube.nInlines,
        nCrosslines: cube.nCrosslines,
      };
    }
  }, [cube, sliceType, sliceIndex, traceRange]);

  // Color mapping logic
  const getColor = (normVal: number): [number, number, number] => {
    let clamped = Math.max(-1, Math.min(1, normVal));
    if (polarityInvert) clamped = -clamped;

    if (internalColorMap === 'Gray') {
      const byte = Math.round(((clamped + 1) / 2) * 255);
      return [byte, byte, byte];
    }

    if (internalColorMap === 'Seismic') {
      // Classic Blue-White-Red (Peak Blue, Trough Red)
      if (clamped < 0) {
        const t = -clamped;
        return [Math.round(245 - t * 25), Math.round(245 - t * 180), Math.round(245 - t * 190)];
      } else {
        const t = clamped;
        return [Math.round(245 - t * 190), Math.round(245 - t * 150), Math.round(245 - t * 10)];
      }
    }

    if (internalColorMap === 'Thermal') {
      // Black -> Red -> Orange -> Yellow -> White
      const u = (clamped + 1) / 2; // 0 to 1
      if (u < 0.33) {
        const t = u / 0.33;
        return [Math.round(t * 180), 0, 0];
      } else if (u < 0.66) {
        const t = (u - 0.33) / 0.33;
        return [180 + Math.round(t * 75), Math.round(t * 160), 0];
      } else {
        const t = (u - 0.66) / 0.34;
        return [255, 160 + Math.round(t * 95), Math.round(t * 220)];
      }
    }

    if (internalColorMap === 'Rainbow') {
      // Standard Petrel rainbow spectrum
      const u = (clamped + 1) / 2; // 0 to 1
      const r = Math.round(Math.sin(u * Math.PI) * 255);
      const g = Math.round(Math.sin((u + 0.33) * Math.PI) * 255);
      const b = Math.round(Math.cos(u * Math.PI * 0.5) * 255);
      return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
    }

    // Default 'RdBu' (Red-White-Blue)
    if (clamped < 0) {
      const t = -clamped;
      return [Math.round(240 - t * 20), Math.round(240 - t * 180), Math.round(240 - t * 190)];
    } else {
      const t = clamped;
      return [Math.round(240 - t * 190), Math.round(240 - t * 150), Math.round(240 - t * 20)];
    }
  };

  // Render to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (sliceData.type === '2d-traces') {
      const { traces, nTraces, nSamples, startTraceIdx } = sliceData;
      if (nTraces === 0 || nSamples === 0) return;

      // Amplitude normalisation estimate
      let maxAmp = 0.0001;
      const step = Math.max(1, Math.floor(nTraces / 20));
      for (let t = 0; t < nTraces; t += step) {
        for (let s = 0; s < nSamples; s += 8) {
          const a = Math.abs(traces[t][s]);
          if (a > maxAmp) maxAmp = a;
        }
      }
      maxAmp = (maxAmp * 0.85 * (1 / Math.max(0.1, internalGain))) || 1.0;

      // 1. Draw Variable Density raster
      if (internalDisplayMode === 'density' || internalDisplayMode === 'both') {
        const imgData = ctx.createImageData(nTraces, nSamples);
        const buf = imgData.data;

        for (let s = 0; s < nSamples; s++) {
          for (let t = 0; t < nTraces; t++) {
            const val = traces[t][s] / maxAmp;
            const [r, g, b] = getColor(val);
            const idx = (s * nTraces + t) * 4;
            buf[idx] = r;
            buf[idx + 1] = g;
            buf[idx + 2] = b;
            buf[idx + 3] = 255;
          }
        }

        const offCanvas = document.createElement('canvas');
        offCanvas.width = nTraces;
        offCanvas.height = nSamples;
        const offCtx = offCanvas.getContext('2d');
        if (offCtx) {
          offCtx.putImageData(imgData, 0, 0);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(offCanvas, 0, 0, width, height);
        }
      } else {
        // Clear background for pure wiggle mode
        ctx.fillStyle = '#0a1628';
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Draw Wiggle Traces with positive fill
      if (internalDisplayMode === 'wiggle' || internalDisplayMode === 'both') {
        const traceSpacingPx = width / nTraces;
        // Limit wiggle density for performance if too many traces
        const traceStep = Math.max(1, Math.floor(nTraces / 80));

        ctx.lineWidth = 1;
        ctx.strokeStyle = internalDisplayMode === 'both' ? '#000000' : '#00f0ff';
        ctx.fillStyle = internalDisplayMode === 'both' ? 'rgba(0,0,0,0.65)' : 'rgba(0, 240, 255, 0.4)';

        for (let t = 0; t < nTraces; t += traceStep) {
          const centerX = (t + 0.5) * traceSpacingPx;
          const maxWiggleWidth = traceSpacingPx * 2.2;

          ctx.beginPath();
          ctx.moveTo(centerX, 0);

          for (let s = 0; s < nSamples; s += 2) {
            const y = (s / nSamples) * height;
            let amp = traces[t][s] / maxAmp;
            if (polarityInvert) amp = -amp;
            const dx = Math.max(-maxWiggleWidth, Math.min(maxWiggleWidth, amp * traceSpacingPx * 1.5));
            ctx.lineTo(centerX + dx, y);
          }
          ctx.stroke();

          // Positive lobe fill
          ctx.beginPath();
          ctx.moveTo(centerX, 0);
          for (let s = 0; s < nSamples; s += 2) {
            const y = (s / nSamples) * height;
            let amp = traces[t][s] / maxAmp;
            if (polarityInvert) amp = -amp;
            const dx = Math.max(0, Math.min(maxWiggleWidth, amp * traceSpacingPx * 1.5));
            ctx.lineTo(centerX + dx, y);
          }
          ctx.lineTo(centerX, height);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 3. Draw Overlaid Horizon Picks
      if (showHorizons) {
        const drawHorizon = (horizonGrid: number[][], color: string, label: string) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4;

          let first = true;
          for (let t = 0; t < nTraces; t++) {
            const globalTraceIdx = startTraceIdx + t;
            let sampleIdx = 0;

            if (cube.type === '2d') {
              sampleIdx = horizonGrid[0]?.[globalTraceIdx] ?? 0;
            } else if (sliceType === 'inline') {
              sampleIdx = horizonGrid[sliceIndex]?.[globalTraceIdx] ?? 0;
            } else if (sliceType === 'crossline') {
              sampleIdx = horizonGrid[globalTraceIdx]?.[sliceIndex] ?? 0;
            }

            const x = (t / (nTraces - 1)) * width;
            const y = (sampleIdx / nSamples) * height;

            if (first) {
              ctx.moveTo(x, y);
              first = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Label tag
          ctx.fillStyle = color;
          ctx.font = 'bold 10px monospace';
          ctx.fillText(label, 10, ((cube.type === '2d' ? horizonGrid[0]?.[startTraceIdx] : horizonGrid[sliceIndex]?.[startTraceIdx]) || 100) / nSamples * height - 6);
        };

        if (topHorizon) {
          drawHorizon(topHorizon, '#00f0ff', 'Top Reservoir');
        }
        if (baseHorizon) {
          drawHorizon(baseHorizon, '#f0a500', 'Base Reservoir');
        }
      }
    } else if (sliceData.type === 'timeslice') {
      const { grid, nInlines, nCrosslines } = sliceData;
      if (nInlines === 0 || nCrosslines === 0) return;

      let maxAmp = 0.0001;
      for (let il = 0; il < nInlines; il++) {
        for (let xl = 0; xl < nCrosslines; xl++) {
          const a = Math.abs(grid[il][xl]);
          if (a > maxAmp) maxAmp = a;
        }
      }
      maxAmp = (maxAmp * 0.85 * (1 / Math.max(0.1, internalGain))) || 1.0;

      const imgData = ctx.createImageData(nCrosslines, nInlines);
      const buf = imgData.data;

      for (let il = 0; il < nInlines; il++) {
        for (let xl = 0; xl < nCrosslines; xl++) {
          const val = grid[il][xl] / maxAmp;
          const [r, g, b] = getColor(val);
          const idx = (il * nCrosslines + xl) * 4;
          buf[idx] = r;
          buf[idx + 1] = g;
          buf[idx + 2] = b;
          buf[idx + 3] = 255;
        }
      }

      const offCanvas = document.createElement('canvas');
      offCanvas.width = nCrosslines;
      offCanvas.height = nInlines;
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        offCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offCanvas, 0, 0, width, height);
      }
    }
  }, [
    cube,
    sliceData,
    internalColorMap,
    internalGain,
    internalDisplayMode,
    polarityInvert,
    showHorizons,
    topHorizon,
    baseHorizon,
    sliceIndex,
    sliceType,
  ]);

  // Handle canvas mouse move for live inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || sliceData.type !== '2d-traces') return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { nTraces, nSamples, startTraceIdx, traces, cdpNumbers, shotPoints } = sliceData;
    const normX = Math.max(0, Math.min(1, x / canvas.width));
    const normY = Math.max(0, Math.min(1, y / canvas.height));

    const localTraceIdx = Math.min(nTraces - 1, Math.floor(normX * nTraces));
    const globalTraceIdx = startTraceIdx + localTraceIdx;
    const sampleIdx = Math.min(nSamples - 1, Math.floor(normY * nSamples));
    const timeMs = sampleIdx * cube.sampleRate;
    const ampVal = traces[localTraceIdx]?.[sampleIdx] || 0;

    let traceLabel = `Trace ${globalTraceIdx + 1}`;
    if (cdpNumbers && cdpNumbers[localTraceIdx]) {
      traceLabel = `CDP ${cdpNumbers[localTraceIdx]}`;
    } else if (shotPoints && shotPoints[localTraceIdx]) {
      traceLabel = `SP ${shotPoints[localTraceIdx]}`;
    }

    setHoverInfo({
      traceIdx: globalTraceIdx,
      traceLabel,
      traceVal: globalTraceIdx + 1,
      timeMs: Math.round(timeMs * 10) / 10,
      sampleIdx,
      ampVal: Math.round(ampVal * 1000) / 1000,
    });
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  const handleClick = () => {
    if (hoverInfo && onPickPoint) {
      onPickPoint(hoverInfo.traceIdx, hoverInfo.sampleIdx);
    }
  };

  return (
    <div className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Canvas Toolbar Controls */}
      <div className="px-4 py-2.5 bg-[#0f2139] border-b border-[#2a9bb0]/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#071322] px-2 py-1 rounded border border-[#2a9bb0]/30 font-mono text-[#00f0ff] font-bold">
            {cube.type === '2d' ? '📈 2D Line' : sliceType === 'inline' ? 'IL Slicing' : sliceType === 'crossline' ? 'XL Slicing' : 'TWT Slice'}
          </div>

          {/* Display Mode */}
          <div className="flex items-center gap-1 bg-[#071322] p-0.5 rounded border border-[#2a9bb0]/20">
            <button
              onClick={() => setInternalDisplayMode('density')}
              className={`px-2 py-1 rounded transition-colors ${
                internalDisplayMode === 'density' ? 'bg-[#2a9bb0] text-[#0a1628] font-bold' : 'text-[#8aafc0] hover:text-white'
              }`}
            >
              Density
            </button>
            <button
              onClick={() => setInternalDisplayMode('wiggle')}
              className={`px-2 py-1 rounded transition-colors ${
                internalDisplayMode === 'wiggle' ? 'bg-[#2a9bb0] text-[#0a1628] font-bold' : 'text-[#8aafc0] hover:text-white'
              }`}
            >
              Wiggle
            </button>
            <button
              onClick={() => setInternalDisplayMode('both')}
              className={`px-2 py-1 rounded transition-colors ${
                internalDisplayMode === 'both' ? 'bg-[#2a9bb0] text-[#0a1628] font-bold' : 'text-[#8aafc0] hover:text-white'
              }`}
            >
              Both
            </button>
          </div>

          {/* Colormap Selector */}
          <select
            value={internalColorMap}
            onChange={(e) => setInternalColorMap(e.target.value as any)}
            className="bg-[#071322] border border-[#2a9bb0]/30 text-[#e8f4f8] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#2a9bb0]"
          >
            <option value="RdBu">Colormap: Seismic (Blue-White-Red)</option>
            <option value="Seismic">Colormap: Standard Geophysics</option>
            <option value="Gray">Colormap: Grayscale (B&W)</option>
            <option value="Thermal">Colormap: Thermal Iron</option>
            <option value="Rainbow">Colormap: Petrel Rainbow</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          {/* Polarity Invert */}
          <button
            onClick={() => setPolarityInvert(!polarityInvert)}
            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
              polarityInvert ? 'bg-[#f0a500] text-[#0a1628] font-bold border-[#f0a500]' : 'bg-[#071322] text-[#8aafc0] border-[#2a9bb0]/30 hover:text-white'
            }`}
            title="Invert Seismic Polarity"
          >
            Polarity: {polarityInvert ? 'Reverse (-)' : 'Normal (+)'}
          </button>

          {/* Gain Slider */}
          <div className="flex items-center gap-1.5 bg-[#071322] px-2.5 py-1 rounded border border-[#2a9bb0]/20">
            <span className="text-[#8aafc0]">Gain:</span>
            <input
              type="range"
              min="0.2"
              max="4.0"
              step="0.1"
              value={internalGain}
              onChange={(e) => setInternalGain(parseFloat(e.target.value))}
              className="w-16 h-1 bg-[#1a3d54] rounded accent-[#2a9bb0]"
            />
            <span className="font-mono text-[#00f0ff] w-7 text-right">{internalGain.toFixed(1)}x</span>
          </div>
        </div>
      </div>

      {/* Main Canvas Area with Axis Guides */}
      <div ref={containerRef} className="relative flex-1 bg-[#050c17] flex flex-col p-3 overflow-hidden">
        {/* Top Horizontal Axis */}
        <div className="flex justify-between items-center text-[10px] font-mono text-[#8aafc0] px-8 pb-1 border-b border-[#2a9bb0]/20">
          <span>
            {sliceData.type === '2d-traces' ? `Start: ${sliceData.traceLabel} ${sliceData.traceStart}` : 'Crossline 0'}
          </span>
          <span className="text-[#2a9bb0] font-bold">
            {cube.type === '2d' ? `${cube.name} (2D Seismic Profile)` : sliceType.toUpperCase()}
          </span>
          <span>
            {sliceData.type === '2d-traces'
              ? `End: ${sliceData.traceLabel} ${sliceData.traceStart + sliceData.nTraces - 1}`
              : `Crossline ${sliceData.nCrosslines}`}
          </span>
        </div>

        {/* Canvas & Vertical Axis Container */}
        <div className="relative flex-1 flex my-2 min-h-[380px]">
          {/* Vertical Depth / Time Axis */}
          <div className="w-8 flex flex-col justify-between text-[9px] font-mono text-[#8aafc0] py-1 select-none pr-1 text-right">
            <span>0ms</span>
            <span>{Math.round(cube.totalTimeMs * 0.25)}</span>
            <span>{Math.round(cube.totalTimeMs * 0.5)}</span>
            <span>{Math.round(cube.totalTimeMs * 0.75)}</span>
            <span>{Math.round(cube.totalTimeMs)}ms</span>
          </div>

          {/* The Seismic Canvas */}
          <div className="relative flex-1 bg-black rounded border border-[#2a9bb0]/30 shadow-inner overflow-hidden flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={800}
              height={450}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              className="w-full h-full object-fill cursor-crosshair"
            />

            {/* Hover Inspector Box */}
            {hoverInfo && (
              <div className="absolute top-2 right-2 bg-[#071322]/90 border border-[#2a9bb0] rounded-lg px-3 py-1.5 font-mono text-xs text-[#e8f4f8] shadow-lg pointer-events-none backdrop-blur-sm flex items-center gap-3">
                <span className="text-[#00f0ff] font-bold">{hoverInfo.traceLabel}</span>
                <span className="text-[#8aafc0]">|</span>
                <span>TWT: <strong className="text-[#f0a500]">{hoverInfo.timeMs} ms</strong></span>
                <span className="text-[#8aafc0]">|</span>
                <span>Amp: <strong className={hoverInfo.ampVal >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}>{hoverInfo.ampVal}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Legend */}
        <div className="flex items-center justify-between text-[11px] text-[#8aafc0] pt-1 px-8">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff]"></span> Top Pick
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f0a500]"></span> Base Pick
            </span>
          </div>

          <div className="font-mono text-[10px]">
            Sampling dt: <strong className="text-[#e8f4f8]">{cube.sampleRate} ms</strong> | Trace count: <strong className="text-[#e8f4f8]">{sliceData.type === '2d-traces' ? sliceData.nTraces : cube.nTraces}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
