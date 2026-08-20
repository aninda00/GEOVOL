import React, { useRef, useEffect, useState } from 'react';
import { Layers, Activity } from 'lucide-react';
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
  const is2D = nInlines <= 1;

  // Compute maximum thickness in meters for colormap scale
  let maxThickM = grvData.maxThicknessM || 1;

  // Viridis-style colormap (Purple -> Teal -> Yellow)
  const getIsochoreColor = (t: number): [number, number, number] => {
    const clamped = Math.max(0, Math.min(1, t));
    let r = 0, g = 0, b = 0;

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

    if (is2D) {
      // 2D ISOCHORE PROFILE
      const lineIsochore = isochoreMs[0];
      const nTraces = lineIsochore.length;

      ctx.fillStyle = '#081424';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(42, 155, 176, 0.15)';
      ctx.lineWidth = 1;
      for (let y = 30; y < height - 30; y += 35) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
      }

      // Plot thickness profile
      ctx.beginPath();
      for (let t = 0; t < nTraces; t++) {
        const ms = lineIsochore[t];
        const thickM = (ms / 2000.0) * velocityMs;
        const norm = maxThickM > 0 ? thickM / maxThickM : 0;
        const x = 40 + (t / (nTraces - 1)) * (width - 60);
        const y = height - 40 - norm * (height - 80);

        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Shaded fill to baseline
      ctx.lineTo(width - 20, height - 40);
      ctx.lineTo(40, height - 40);
      ctx.closePath();
      ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
      ctx.fill();

      // Axis labels
      ctx.fillStyle = '#8aafc0';
      ctx.font = '10px monospace';
      ctx.fillText(`Max: ${maxThickM.toFixed(1)} m`, 45, 25);
      ctx.fillText(`0 m (Baseline)`, 45, height - 25);
      ctx.fillText(`CMPs 1 to ${nTraces}`, width - 120, height - 25);
    } else {
      // 3D ISOCHORE MAP
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
    }
  }, [isochoreMs, sampleRate, velocityMs, maxThickM, is2D]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, x / canvas.width));
    const normY = Math.max(0, Math.min(1, y / canvas.height));

    const xl = Math.min(nCrosslines - 1, Math.floor(normX * nCrosslines));
    const il = Math.min(nInlines - 1, Math.floor(normY * nInlines));

    const thickMs = isochoreMs[il]?.[xl] || 0;
    const thickM = (thickMs / 2000.0) * velocityMs;

    setHoverCoord({
      x,
      y,
      il,
      xl,
      thickM: Math.round(thickM * 10) / 10,
      thickMs: Math.round(thickMs * 10) / 10,
    });
  };

  return (
    <div className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-4 shadow-xl space-y-3">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-[#e8f4f8] flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#2ecc71]"></span>
            Isochore Thickness Map & Distribution {is2D ? '(2D Profile)' : '(3D Map)'}
          </h4>
          <span className="text-xs text-[#8aafc0]">
            Avg Thickness: <strong className="text-[#2ecc71]">{grvData.avgThicknessM.toFixed(1)} m</strong> | Max:{' '}
            <strong className="text-[#00f0ff]">{grvData.maxThicknessM.toFixed(1)} m</strong>
          </span>
        </div>

        <div className="text-xs font-mono text-[#8aafc0] bg-[#071322] px-3 py-1.5 rounded-lg border border-[#2a9bb0]/20">
          GRV: <strong className="text-[#f0a500]">{(grvData.grvM3 / 1e6).toFixed(2)} Mm³</strong>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="relative bg-[#050c17] rounded-lg border border-[#2a9bb0]/20 p-2 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={320}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCoord(null)}
          className="w-full h-[320px] rounded cursor-crosshair object-fill"
        />

        {/* Live Hover Tooltip */}
        {hoverCoord && (
          <div className="absolute top-4 right-4 bg-[#071322]/90 border border-[#2a9bb0] rounded-lg px-3 py-1.5 font-mono text-xs text-[#e8f4f8] shadow-lg pointer-events-none backdrop-blur-sm space-y-0.5">
            <div className="text-[#2a9bb0] font-bold">
              {is2D ? `CMP / Trace: ${hoverCoord.xl + 1}` : `IL: ${hoverCoord.il + 100} | XL: ${hoverCoord.xl + 200}`}
            </div>
            <div>
              Thickness: <strong className="text-[#2ecc71]">{hoverCoord.thickM} m</strong> ({hoverCoord.thickMs} ms TWT)
            </div>
          </div>
        )}
      </div>

      {/* Viridis Colorbar */}
      <div className="flex items-center justify-between text-xs text-[#8aafc0] pt-1">
        <span className="font-mono text-[#8e44ad]">0 m (Pinchout)</span>
        <div className="flex-1 mx-4 h-2.5 rounded bg-gradient-to-r from-purple-900 via-teal-500 to-yellow-400 opacity-90"></div>
        <span className="font-mono text-[#f1c40f]">Max: {maxThickM.toFixed(1)} m</span>
      </div>
    </div>
  );
};
