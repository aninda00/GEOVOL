import React, { useRef, useEffect, useState, useMemo } from 'react';
import { SeismicCube } from '../types';
import { getInlineSection, getCrosslineSection, getTimeSlice } from '../modules/seismicEngine';
import { ZoomIn, ZoomOut, RotateCcw, Layers, Eye, EyeOff } from 'lucide-react';

interface SeismicSectionCanvasProps {
  cube: SeismicCube;
  sliceType: 'inline' | 'crossline' | 'timeslice';
  sliceIndex: number;
  topHorizon?: number[][];
  baseHorizon?: number[][];
  showHorizons?: boolean;
  colorMap?: 'RdBu' | 'Gray' | 'Seismic';
}

export const SeismicSectionCanvas: React.FC<SeismicSectionCanvasProps> = ({
  cube,
  sliceType,
  sliceIndex,
  topHorizon,
  baseHorizon,
  showHorizons = true,
  colorMap = 'RdBu',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; trace: number; timeOrXl: number; val: number } | null>(null);
  const [displayHorizons, setDisplayHorizons] = useState(showHorizons);

  // Extract slice data
  const sliceData = useMemo(() => {
    if (sliceType === 'inline') {
      const safeIdx = Math.max(0, Math.min(cube.nInlines - 1, sliceIndex));
      return {
        type: '2d-traces' as const,
        traces: getInlineSection(cube, safeIdx),
        nTraces: cube.nCrosslines,
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
  }, [cube, sliceType, sliceIndex]);

  // Color mapping functions
  const getColor = (normVal: number): [number, number, number] => {
    // normVal is clamped between -1 and 1
    const clamped = Math.max(-1, Math.min(1, normVal));
    if (colorMap === 'Gray') {
      const byte = Math.round(((clamped + 1) / 2) * 255);
      return [byte, byte, byte];
    }

    if (colorMap === 'RdBu') {
      if (clamped < 0) {
        // Red negative trough
        const t = -clamped; // 0 to 1
        const r = Math.round(245 - t * 25);
        const g = Math.round(245 - t * 180);
        const b = Math.round(245 - t * 190);
        return [r, g, b];
      } else {
        // Blue positive peak
        const t = clamped; // 0 to 1
        const r = Math.round(245 - t * 190);
        const g = Math.round(245 - t * 150);
        const b = Math.round(245 - t * 10);
        return [r, g, b];
      }
    }

    // Seismic (Dark Red to Dark Blue)
    if (clamped < 0) {
      const t = -clamped;
      return [Math.round(220 * t + 30 * (1 - t)), Math.round(40 * (1 - t)), Math.round(50 * (1 - t))];
    } else {
      const t = clamped;
      return [Math.round(40 * (1 - t)), Math.round(120 * t + 40 * (1 - t)), Math.round(240 * t + 50 * (1 - t))];
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
      const { traces, nTraces, nSamples } = sliceData;
      if (nTraces === 0 || nSamples === 0) return;

      // Find amplitude normalization range (98th percentile)
      let maxAmp = 0.001;
      for (let t = 0; t < Math.min(nTraces, 10); t++) {
        for (let s = 0; s < nSamples; s += 5) {
          const a = Math.abs(traces[t][s]);
          if (a > maxAmp) maxAmp = a;
        }
      }
      maxAmp = maxAmp * 0.85 || 1.0;

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

      // Draw scaled image
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

      // Draw overlaid horizon lines
      if (displayHorizons) {
        const drawHorizonLine = (horizon: number[][], strokeColor: string, label: string) => {
          ctx.beginPath();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4;

          for (let t = 0; t < nTraces; t++) {
            let samplePos = 0;
            if (sliceType === 'inline') {
              const il = Math.max(0, Math.min(cube.nInlines - 1, sliceIndex));
              samplePos = horizon[il]?.[t] ?? 0;
            } else {
              const xl = Math.max(0, Math.min(cube.nCrosslines - 1, sliceIndex));
              samplePos = horizon[t]?.[xl] ?? 0;
            }

            const x = (t / (nTraces - 1)) * width;
            const y = (samplePos / (nSamples - 1)) * height;

            if (t === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        };

        if (topHorizon) drawHorizonLine(topHorizon, '#00f0ff', 'Top Reservoir');
        if (baseHorizon) drawHorizonLine(baseHorizon, '#ffd700', 'Base Reservoir');
      }
    } else {
      // Time slice rendering (nInlines x nCrosslines)
      const { grid, nInlines, nCrosslines } = sliceData;
      let maxAmp = 0.001;
      for (let il = 0; il < nInlines; il++) {
        for (let xl = 0; xl < nCrosslines; xl++) {
          const a = Math.abs(grid[il][xl]);
          if (a > maxAmp) maxAmp = a;
        }
      }
      maxAmp = maxAmp * 0.85 || 1.0;

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
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offCanvas, 0, 0, width, height);
      }
    }
  }, [sliceData, displayHorizons, topHorizon, baseHorizon, colorMap, zoom, sliceIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, x / rect.width));
    const normY = Math.max(0, Math.min(1, y / rect.height));

    if (sliceData.type === '2d-traces') {
      const traceIdx = Math.floor(normX * sliceData.nTraces);
      const sampleIdx = Math.floor(normY * sliceData.nSamples);
      const traceNum = sliceData.traceStart + traceIdx;
      const timeMs = sampleIdx * cube.sampleRate;
      const val = sliceData.traces[traceIdx]?.[sampleIdx] ?? 0;

      setHoverInfo({
        x,
        y,
        trace: traceNum,
        timeOrXl: timeMs,
        val: Math.round(val * 1000) / 1000,
      });
    } else {
      const ilIdx = Math.floor(normY * sliceData.nInlines);
      const xlIdx = Math.floor(normX * sliceData.nCrosslines);
      const ilNum = (cube.ilines[0] || 100) + ilIdx;
      const xlNum = (cube.xlines[0] || 200) + xlIdx;
      const val = sliceData.grid[ilIdx]?.[xlIdx] ?? 0;

      setHoverInfo({
        x,
        y,
        trace: ilNum,
        timeOrXl: xlNum,
        val: Math.round(val * 1000) / 1000,
      });
    }
  };

  return (
    <div className="relative w-full flex flex-col bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f243f] border-b border-[#2a9bb0]/20 text-xs text-[#8aafc0]">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[#e8f4f8]">
            {sliceType === 'inline' && `Inline ${cube.ilines[sliceIndex] || 100 + sliceIndex} Section`}
            {sliceType === 'crossline' && `Crossline ${cube.xlines[sliceIndex] || 200 + sliceIndex} Section`}
            {sliceType === 'timeslice' && `Time Slice @ ${Math.round(sliceIndex * cube.sampleRate)} ms TWT`}
          </span>
          <span className="bg-[#162d4c] px-2 py-0.5 rounded text-[#2a9bb0] border border-[#2a9bb0]/30 font-mono">
            {sliceType === 'timeslice' ? `${cube.nInlines} × ${cube.nCrosslines}` : `${sliceData.type === '2d-traces' ? sliceData.nTraces : 0} traces × ${cube.nSamples} samples`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(topHorizon || baseHorizon) && (
            <button
              onClick={() => setDisplayHorizons(!displayHorizons)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                displayHorizons
                  ? 'bg-[#2a9bb0]/20 text-[#2a9bb0] border border-[#2a9bb0]/40'
                  : 'bg-[#162840] text-[#8aafc0] hover:text-[#e8f4f8]'
              }`}
              title="Toggle Horizon Picks"
            >
              {displayHorizons ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Horizons
            </button>
          )}

          <div className="flex items-center bg-[#162840] rounded border border-[#2a9bb0]/30 overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
              className="p-1 text-[#8aafc0] hover:text-[#e8f4f8] hover:bg-[#1f3757] transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[10px] text-[#e8f4f8]">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              className="p-1 text-[#8aafc0] hover:text-[#e8f4f8] hover:bg-[#1f3757] transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1 text-[#8aafc0] hover:text-[#e8f4f8] hover:bg-[#1f3757] transition-colors border-l border-[#2a9bb0]/20"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area with Axes */}
      <div className="relative w-full flex bg-[#071322] p-2 select-none overflow-auto" style={{ minHeight: '380px', maxHeight: '520px' }}>
        {/* Y Axis Label */}
        <div className="w-12 flex flex-col justify-between text-[10px] font-mono text-[#8aafc0] py-4 pr-1 text-right border-r border-[#2a9bb0]/20">
          <span>0 ms</span>
          <span>{Math.round(cube.totalTimeMs * 0.25)} ms</span>
          <span>{Math.round(cube.totalTimeMs * 0.5)} ms</span>
          <span>{Math.round(cube.totalTimeMs * 0.75)} ms</span>
          <span>{Math.round(cube.totalTimeMs)} ms</span>
        </div>

        <div className="flex-1 relative flex flex-col items-center justify-center p-1">
          <canvas
            ref={canvasRef}
            width={640}
            height={440}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
            className="w-full h-auto max-h-[460px] object-contain rounded cursor-crosshair border border-[#2a9bb0]/20"
          />

          {/* Interactive Hover Tooltip */}
          {hoverInfo && (
            <div
              className="absolute pointer-events-none z-20 bg-[#0a1829]/90 backdrop-blur border border-[#2a9bb0] rounded px-2.5 py-1 text-[11px] font-mono text-[#e8f4f8] shadow-xl"
              style={{
                left: `${Math.min(hoverInfo.x + 20, 520)}px`,
                top: `${Math.max(10, hoverInfo.y - 35)}px`,
              }}
            >
              {sliceData.type === '2d-traces' ? (
                <>
                  <span className="text-[#2a9bb0]">{sliceData.traceLabel}:</span> {hoverInfo.trace} &nbsp;|&nbsp;{' '}
                  <span className="text-[#f0a500]">TWT:</span> {hoverInfo.timeOrXl.toFixed(0)} ms &nbsp;|&nbsp;{' '}
                  <span className="text-[#2ecc71]">Amp:</span> {hoverInfo.val}
                </>
              ) : (
                <>
                  <span className="text-[#2a9bb0]">IL:</span> {hoverInfo.trace} &nbsp;|&nbsp;{' '}
                  <span className="text-[#f0a500]">XL:</span> {hoverInfo.timeOrXl} &nbsp;|&nbsp;{' '}
                  <span className="text-[#2ecc71]">Amp:</span> {hoverInfo.val}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Colorbar Legend */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d2138] border-t border-[#2a9bb0]/20 text-[11px] text-[#8aafc0]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-medium">-Trough</span>
            <div className="w-24 h-2.5 rounded-sm bg-gradient-to-r from-red-600 via-slate-100 to-blue-600 border border-[#2a9bb0]/40" />
            <span className="text-blue-400 font-medium">+Peak</span>
          </div>

          {displayHorizons && (topHorizon || baseHorizon) && (
            <div className="flex items-center gap-3 pl-4 border-l border-[#2a9bb0]/30">
              {topHorizon && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-1 bg-[#00f0ff] rounded-sm" />
                  <span className="text-[#00f0ff] text-[10px]">Top Reservoir</span>
                </div>
              )}
              {baseHorizon && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-1 bg-[#ffd700] rounded-sm" />
                  <span className="text-[#ffd700] text-[10px]">Base Reservoir</span>
                </div>
              )}
            </div>
          )}
        </div>

        <span className="font-mono text-[10px]">Colormap: {colorMap}</span>
      </div>
    </div>
  );
};
