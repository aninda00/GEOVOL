import React, { useRef, useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { GRVData } from '../types';

interface IsochoreMapCanvasProps {
  isochoreMs: number[][];
  sampleRate: number;
  velocityMs: number;
  grvData: GRVData;
}

export const IsochoreMapCanvas: React.FC<IsochoreMapCanvasProps> = ({
  isochoreMs,
  sampleRate,
  velocityMs,
  grvData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverCoord, setHoverCoord] = useState<{
    x: number;
    y: number;
    il: number;
    xl: number;
    thickM: number;
    thickMs: number;
  } | null>(null);

  const nInlines = isochoreMs.length;
  const nCrosslines = isochoreMs[0]?.length || 0;

  // Compute maximum thickness in meters for colormap scale
  let maxThickM = grvData.maxThicknessM || 1;

  // Viridis-style colormap (Purple -> Teal -> Yellow)
  const getIsochoreColor = (t: number): [number, number, number] => {
    const clamped = Math.max(0, Math.min(1, t));
    let r = 0,
      g = 0,
      b = 0;

    if (clamped < 0.33) {
      const p = clamped / 0.33;
      r = Math.round(68 + p * 20);
      g = Math.round(1 + p * 120);
      b = Math.round(84 + p * 80);
    } else if (clamped < 0.66) {
      const p = (clamped - 0.33) / 0.33;
      r = Math.round(88 - p * 55);
      g = Math.round(121 + p * 70);
      b = Math.round(164 - p * 70);
    } else {
      const p = (clamped - 0.66) / 0.34;
      r = Math.round(33 + p * 220);
      g = Math.round(191 + p * 40);
      b = Math.round(94 - p * 60);
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

    const imgData = ctx.createImageData(nCrosslines, nInlines);
    const buf = imgData.data;

    for (let il = 0; il < nInlines; il++) {
      for (let xl = 0; xl < nCrosslines; xl++) {
        const ms = isochoreMs[il][xl];
        const thickM = (ms / 2000.0) * velocityMs;
        const t = maxThickM > 0 ? thickM / maxThickM : 0;

        const [r, g, b] = getIsochoreColor(t);
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
  }, [isochoreMs, sampleRate, velocityMs, maxThickM]);

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

    const ms = isochoreMs[ilIdx]?.[xlIdx] ?? 0;
    const thickM = (ms / 2000.0) * velocityMs;

    setHoverCoord({
      x,
      y,
      il: 100 + ilIdx,
      xl: 200 + xlIdx,
      thickM: Math.round(thickM * 10) / 10,
      thickMs: Math.round(ms * 10) / 10,
    });
  };

  return (
    <div className="relative w-full flex flex-col bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f243f] border-b border-[#2a9bb0]/20 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#f0a500]" />
          <span className="font-semibold text-[#e8f4f8]">Isochore (Reservoir Thickness) Map</span>
          <span className="bg-[#162d4c] px-2 py-0.5 rounded text-[#f0a500] font-mono text-[11px]">
            Avg: {grvData.avgThicknessM.toFixed(1)}m | Max: {grvData.maxThicknessM.toFixed(1)}m
          </span>
        </div>
      </div>

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
              className="absolute pointer-events-none z-20 bg-[#0a1829]/95 backdrop-blur border border-[#f0a500] rounded px-3 py-1.5 text-[11px] font-mono text-[#e8f4f8] shadow-2xl"
              style={{
                left: `${Math.min(hoverCoord.x + 15, 380)}px`,
                top: `${Math.max(10, hoverCoord.y - 45)}px`,
              }}
            >
              <span className="text-[#2a9bb0]">IL:</span> {hoverCoord.il} &nbsp;|&nbsp;{' '}
              <span className="text-[#2a9bb0]">XL:</span> {hoverCoord.xl}
              <br />
              <span className="text-[#f0a500]">Thickness:</span> {hoverCoord.thickM} m ({hoverCoord.thickMs} ms)
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 bg-[#0d2138] border-t border-[#2a9bb0]/20 flex items-center justify-between text-xs text-[#8aafc0]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-[#8aafc0]">0 m (Pinchout)</span>
          <div className="w-48 h-3 rounded bg-gradient-to-r from-[#440154] via-[#21908d] to-[#fde725] border border-[#2a9bb0]/40 shadow-sm" />
          <span className="font-mono text-[11px] text-[#f0a500]">{Math.round(maxThickM)} m</span>
        </div>

        <span className="font-mono text-[11px] text-[#e8f4f8]">
          Total Volume: <b className="text-[#2ecc71]">{Math.round(grvData.grvAcreFt).toLocaleString()} acre-ft</b>
        </span>
      </div>
    </div>
  );
};
