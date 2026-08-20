import React, { useRef, useEffect, useState } from 'react';
import { Layers, ArrowUpDown, TrendingUp } from 'lucide-react';

interface HorizonMapCanvasProps {
  horizon: number[][]; // [nInlines][nCrosslines] sample index, or [1][nTraces] for 2D line
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
  const is2D = nInlines <= 1;

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
    let r = 0, g = 0, b = 0;

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

    if (is2D) {
      // 2D HORIZON PROFILE RENDERING
      const traces = horizon[0];
      const nTraces = traces.length;

      // Draw background grid
      ctx.fillStyle = '#081424';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(42, 155, 176, 0.15)';
      ctx.lineWidth = 1;
      for (let y = 40; y < height - 30; y += 40) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
      }

      // Draw horizon curve
      const strokeColor = horizonType === 'top' ? '#00f0ff' : '#f0a500';
      const fillColor = horizonType === 'top' ? 'rgba(0, 240, 255, 0.18)' : 'rgba(240, 165, 0, 0.18)';

      const getPlotY = (val: number) => {
        const norm = (val - minVal) / span; // 0 = shallow (top), 1 = deep (bottom)
        return 40 + norm * (height - 80);
      };

      ctx.beginPath();
      for (let t = 0; t < nTraces; t++) {
        const s = traces[t];
        const time = s * sampleRate;
        const depth = (time / 2000.0) * velocityMs;
        const val = unitMode === 'time' ? time : depth;
        const x = 40 + (t / (nTraces - 1)) * (width - 60);
        const y = getPlotY(val);

        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      // Stroke profile
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Shaded fill to bottom
      ctx.lineTo(width - 20, height - 30);
      ctx.lineTo(40, height - 30);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Axis labels
      ctx.fillStyle = '#8aafc0';
      ctx.font = '10px monospace';
      ctx.fillText(`Min: ${minVal.toFixed(0)} ${unitMode === 'time' ? 'ms' : 'm'}`, 45, 30);
      ctx.fillText(`Max: ${maxVal.toFixed(0)} ${unitMode === 'time' ? 'ms' : 'm'}`, 45, height - 12);
      ctx.fillText(`CMPs 1 to ${nTraces}`, width - 120, height - 12);
    } else {
      // 3D HORIZON SURFACE MAP
      const imgData = ctx.createImageData(nCrosslines, nInlines);
      const buf = imgData.data;

      for (let il = 0; il < nInlines; il++) {
        for (let xl = 0; xl < nCrosslines; xl++) {
          const s = horizon[il][xl];
          const time = s * sampleRate;
          const depth = (time / 2000.0) * velocityMs;
          const val = unitMode === 'time' ? time : depth;

          const norm = (val - minVal) / span;
          const [r, g, b] = getRainbowColor(norm);

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
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(offCanvas, 0, 0, width, height);
      }
    }
  }, [horizon, sampleRate, velocityMs, unitMode, minVal, maxVal, is2D, horizonType]);

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

    const sample = horizon[il]?.[xl] || 0;
    const timeMs = sample * sampleRate;
    const depthM = (timeMs / 2000.0) * velocityMs;

    setHoverCoord({
      x,
      y,
      il,
      xl,
      timeMs: Math.round(timeMs),
      depthM: Math.round(depthM),
    });
  };

  return (
    <div className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-4 shadow-xl space-y-3">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-[#e8f4f8] flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: horizonType === 'top' ? '#00f0ff' : '#f0a500' }}
            ></span>
            {title} {is2D ? '(2D Profile)' : '(3D Surface)'}
          </h4>
          <span className="text-xs text-[#8aafc0]">
            {is2D ? `${nCrosslines} continuous CMP stations` : `${nInlines} Inlines × ${nCrosslines} Crosslines`} | Mean:{' '}
            <strong className="text-[#00f0ff]">{meanVal.toFixed(1)} {unitMode === 'time' ? 'ms' : 'm'}</strong>
          </span>
        </div>

        {/* Unit Toggle */}
        <div className="flex items-center gap-2 bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/30 text-xs">
          <button
            onClick={() => setUnitMode('depth')}
            className={`px-3 py-1 rounded transition-colors ${
              unitMode === 'depth'
                ? 'bg-[#2a9bb0] text-[#0a1628] font-bold'
                : 'text-[#8aafc0] hover:text-[#e8f4f8]'
            }`}
          >
            True Depth (m)
          </button>
          <button
            onClick={() => setUnitMode('time')}
            className={`px-3 py-1 rounded transition-colors ${
              unitMode === 'time'
                ? 'bg-[#2a9bb0] text-[#0a1628] font-bold'
                : 'text-[#8aafc0] hover:text-[#e8f4f8]'
            }`}
          >
            TWT (ms)
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
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
              Depth: <strong className="text-[#2ecc71]">{hoverCoord.depthM} m</strong> ({hoverCoord.timeMs} ms)
            </div>
          </div>
        )}
      </div>

      {/* Colorbar / Scale Bar */}
      <div className="flex items-center justify-between text-xs text-[#8aafc0] pt-1">
        <span className="font-mono text-[#00f0ff]">
          Shallow: {minVal.toFixed(0)} {unitMode === 'time' ? 'ms' : 'm'}
        </span>
        <div className="flex-1 mx-4 h-2.5 rounded bg-gradient-to-r from-blue-500 via-cyan-400 via-green-400 via-yellow-400 to-red-500 opacity-90"></div>
        <span className="font-mono text-[#e74c3c]">
          Deep: {maxVal.toFixed(0)} {unitMode === 'time' ? 'ms' : 'm'}
        </span>
      </div>
    </div>
  );
};
