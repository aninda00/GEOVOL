import React, { useRef, useEffect, useState } from 'react';
import { Layers, ArrowUpDown } from 'lucide-react';

interface HorizonMapCanvasProps {
  horizon: number[][]; // [nInlines][nCrosslines] sample index
  sampleRate: number;
  velocityMs: number;
  title: string;
  horizonType: 'top' | 'base';
}

export const HorizonMapCanvas: React.FC<HorizonMapCanvasProps> = ({
  horizon,
  sampleRate,
  velocityMs,
  title,
  horizonType,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unitMode, setUnitMode] = useState<'time' | 'depth'>('depth');
  const [hoverCoord, setHoverCoord] = useState<{
    x: number;
    y: number;
    il: number;
    xl: number;
    timeMs: number;
    depthM: number;
  } | null>(null);

  const nInlines = horizon.length;
  const nCrosslines = horizon[0]?.length || 0;

  // Calculate statistics
  let minVal = Infinity;
  let maxVal = -Infinity;
  let sumVal = 0;
  let count = 0;

  for (let il = 0; il < nInlines; il++) {
    for (let xl = 0; xl < nCrosslines; xl++) {
      const s = horizon[il][xl];
      const time = s * sampleRate;
      const depth = (time / 2000.0) * velocityMs;
      const val = unitMode === 'time' ? time : depth;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
      sumVal += val;
      count++;
    }
  }

  const meanVal = count > 0 ? sumVal / count : 0;

  // Petrel Rainbow Colormap: Blue (Shallow) -> Cyan -> Green -> Yellow -> Red (Deep)
  const getRainbowColor = (t: number): [number, number, number] => {
    const clamped = Math.max(0, Math.min(1, t));
    let r = 0,
      g = 0,
      b = 0;

    if (clamped < 0.25) {
      const p = clamped / 0.25;
      r = 0;
      g = Math.round(p * 255);
      b = 255;
    } else if (clamped < 0.5) {
      const p = (clamped - 0.25) / 0.25;
      r = 0;
      g = 255;
      b = Math.round((1 - p) * 255);
    } else if (clamped < 0.75) {
      const p = (clamped - 0.5) / 0.25;
      r = Math.round(p * 255);
      g = 255;
      b = 0;
    } else {
      const p = (clamped - 0.75) / 0.25;
      r = 255;
      g = Math.round((1 - p) * 255);
      b = 0;
    }
    return [r, g, b];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nInlines === 0 || nCrosslines === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const span = Math.max(1, maxVal - minVal);
    const imgData = ctx.createImageData(nCrosslines, nInlines);
    const buf = imgData.data;

    for (let il = 0; il < nInlines; il++) {
      for (let xl = 0; xl < nCrosslines; xl++) {
        const s = horizon[il][xl];
        const time = s * sampleRate;
        const depth = (time / 2000.0) * velocityMs;
        const val = unitMode === 'time' ? time : depth;
        const t = (val - minVal) / span;

        const [r, g, b] = getRainbowColor(t);
        const idx = (il * nCrosslines + xl) * 4;
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = 255;
      }
    }

    // Render smoothed image
    const offCanvas = document.createElement('canvas');
    offCanvas.width = nCrosslines;
    offCanvas.height = nInlines;
    const offCtx = offCanvas.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(offCanvas, 0, 0, width, height);
    }

    // Draw contour isolines
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    const nContours = 8;
    const contourStep = span / nContours;

    for (let c = 1; c < nContours; c++) {
      const contourVal = minVal + c * contourStep;
      // Simple horizontal & vertical contour segment check
      for (let il = 0; il < nInlines - 1; il++) {
        for (let xl = 0; xl < nCrosslines - 1; xl++) {
          const v00 = unitMode === 'time' ? horizon[il][xl] * sampleRate : (horizon[il][xl] * sampleRate / 2000) * velocityMs;
          const v01 = unitMode === 'time' ? horizon[il][xl + 1] * sampleRate : (horizon[il][xl + 1] * sampleRate / 2000) * velocityMs;
          const v10 = unitMode === 'time' ? horizon[il + 1][xl] * sampleRate : (horizon[il + 1][xl] * sampleRate / 2000) * velocityMs;

          if ((v00 <= contourVal && v01 > contourVal) || (v00 > contourVal && v01 <= contourVal)) {
            const x = ((xl + 0.5) / nCrosslines) * width;
            const y = ((il + 0.5) / nInlines) * height;
            ctx.strokeRect(x, y, 1, 1);
          }
        }
      }
    }
  }, [horizon, sampleRate, velocityMs, unitMode, minVal, maxVal]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, x / rect.width));
    const normY = Math.max(0, Math.min(1, y / rect.height));

    const xlIdx = Math.floor(normX * nCrosslines);
    const ilIdx = Math.floor(normY * nInlines);

    const s = horizon[ilIdx]?.[xlIdx] ?? 0;
    const timeMs = s * sampleRate;
    const depthM = (timeMs / 2000.0) * velocityMs;

    setHoverCoord({
      x,
      y,
      il: 100 + ilIdx,
      xl: 200 + xlIdx,
      timeMs: Math.round(timeMs * 10) / 10,
      depthM: Math.round(depthM * 10) / 10,
    });
  };

  return (
    <div className="relative w-full flex flex-col bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl overflow-hidden shadow-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f243f] border-b border-[#2a9bb0]/20 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#2a9bb0]" />
          <span className="font-semibold text-[#e8f4f8]">{title}</span>
          <span className="bg-[#162d4c] px-2 py-0.5 rounded text-[#2a9bb0] font-mono text-[11px]">
            {nInlines} Inlines × {nCrosslines} Crosslines
          </span>
        </div>

        <button
          onClick={() => setUnitMode(unitMode === 'depth' ? 'time' : 'depth')}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#162840] hover:bg-[#1f3757] text-[#2a9bb0] hover:text-[#e8f4f8] border border-[#2a9bb0]/40 rounded text-xs transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          Unit: <b className="text-[#f0a500] uppercase">{unitMode === 'depth' ? 'Depth (m)' : 'TWT (ms)'}</b>
        </button>
      </div>

      {/* Map Canvas with Axes */}
      <div className="relative w-full flex flex-col items-center bg-[#071322] p-3 select-none">
        <div className="relative w-full flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={520}
            height={420}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverCoord(null)}
            className="w-full max-w-[560px] h-auto object-contain rounded cursor-crosshair border border-[#2a9bb0]/30 shadow-inner"
          />

          {hoverCoord && (
            <div
              className="absolute pointer-events-none z-20 bg-[#0a1829]/95 backdrop-blur border border-[#2a9bb0] rounded px-3 py-1.5 text-[11px] font-mono text-[#e8f4f8] shadow-2xl"
              style={{
                left: `${Math.min(hoverCoord.x + 15, 380)}px`,
                top: `${Math.max(10, hoverCoord.y - 45)}px`,
              }}
            >
              <span className="text-[#2a9bb0]">IL:</span> {hoverCoord.il} &nbsp;|&nbsp;{' '}
              <span className="text-[#2a9bb0]">XL:</span> {hoverCoord.xl}
              <br />
              <span className="text-[#f0a500]">TWT:</span> {hoverCoord.timeMs} ms &nbsp;|&nbsp;{' '}
              <span className="text-[#2ecc71]">Depth:</span> {hoverCoord.depthM} m
            </div>
          )}
        </div>
      </div>

      {/* Colorbar Scale */}
      <div className="px-4 py-2.5 bg-[#0d2138] border-t border-[#2a9bb0]/20 flex items-center justify-between text-xs text-[#8aafc0]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-[#2a9bb0]">
            Min: <b>{Math.round(minVal)} {unitMode === 'depth' ? 'm' : 'ms'}</b>
          </span>
          <div className="w-48 h-3 rounded bg-gradient-to-r from-blue-600 via-cyan-400 via-green-400 via-yellow-400 to-red-600 border border-[#2a9bb0]/40 shadow-sm" />
          <span className="font-mono text-[11px] text-[#f0a500]">
            Max: <b>{Math.round(maxVal)} {unitMode === 'depth' ? 'm' : 'ms'}</b>
          </span>
        </div>

        <span className="font-mono text-[11px] text-[#e8f4f8]">
          Mean: <b className="text-[#2ecc71]">{Math.round(meanVal)} {unitMode === 'depth' ? 'm' : 'ms'}</b>
        </span>
      </div>
    </div>
  );
};
