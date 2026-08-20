import React, { useRef, useEffect, useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Box, Sliders } from 'lucide-react';

interface ThreeDReservoirModelProps {
  topHorizon: number[][];
  baseHorizon: number[][];
  sampleRate: number;
  velocityMs: number;
}

export const ThreeDReservoirModel: React.FC<ThreeDReservoirModelProps> = ({
  topHorizon,
  baseHorizon,
  sampleRate,
  velocityMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Rotation and zoom state
  const [pitch, setPitch] = useState<number>(38); // degrees
  const [yaw, setYaw] = useState<number>(-45); // degrees
  const [zoom, setZoom] = useState<number>(1.1);
  const [vertExag, setVertExag] = useState<number>(2.5);
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const nInlines = topHorizon.length;
  const nCrosslines = topHorizon[0]?.length || 0;

  // Compute depth bounds
  let minDepth = Infinity;
  let maxDepth = -Infinity;

  for (let il = 0; il < nInlines; il++) {
    for (let xl = 0; xl < nCrosslines; xl++) {
      const topD = ((topHorizon[il][xl] * sampleRate) / 2000.0) * velocityMs;
      const baseD = ((baseHorizon[il][xl] * sampleRate) / 2000.0) * velocityMs;
      if (topD < minDepth) minDepth = topD;
      if (baseD > maxDepth) maxDepth = baseD;
    }
  }

  const depthSpan = Math.max(1, maxDepth - minDepth);

  // Rainbow colormap for top surface
  const getDepthColor = (d: number, alpha: number = 1.0): string => {
    const t = Math.max(0, Math.min(1, (d - minDepth) / depthSpan));
    let r = 0,
      g = 0,
      b = 0;

    if (t < 0.25) {
      const p = t / 0.25;
      r = 0;
      g = Math.round(p * 255);
      b = 255;
    } else if (t < 0.5) {
      const p = (t - 0.25) / 0.25;
      r = 0;
      g = 255;
      b = Math.round((1 - p) * 255);
    } else if (t < 0.75) {
      const p = (t - 0.5) / 0.25;
      r = Math.round(p * 255);
      g = 255;
      b = 0;
    } else {
      const p = (t - 0.75) / 0.25;
      r = 255;
      g = Math.round((1 - p) * 255);
      b = 0;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nInlines === 0 || nCrosslines === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // 3D Projection calculations
    const radPitch = (pitch * Math.PI) / 180;
    const radYaw = (yaw * Math.PI) / 180;

    const cosP = Math.cos(radPitch);
    const sinP = Math.sin(radPitch);
    const cosY = Math.cos(radYaw);
    const sinY = Math.sin(radYaw);

    const centerX = width / 2;
    const centerY = height / 2 + 20;
    const scale = (Math.min(width, height) / 3.4) * zoom;

    const project = (xNorm: number, yNorm: number, zNorm: number): { x: number; y: number; zDepth: number } => {
      // Centered coordinates: x in [-1, 1], y in [-1, 1], z in [-0.5, 0.5]
      const x = (xNorm - 0.5) * 2;
      const y = (yNorm - 0.5) * 2;
      const z = (zNorm - 0.5) * vertExag;

      // Yaw rotation (around Z axis)
      const xRot = x * cosY - y * sinY;
      const yRot = x * sinY + y * cosY;

      // Pitch rotation (around X axis)
      const yP = yRot * cosP - z * sinP;
      const zP = yRot * sinP + z * cosP;

      const px = centerX + xRot * scale;
      const py = centerY - yP * scale;

      return { x: px, y: py, zDepth: zP };
    };

    // Draw background grid bounding box
    ctx.strokeStyle = 'rgba(42, 155, 176, 0.2)';
    ctx.lineWidth = 1;

    const b000 = project(0, 0, 0);
    const b100 = project(1, 0, 0);
    const b110 = project(1, 1, 0);
    const b010 = project(0, 1, 0);

    const b001 = project(0, 0, 1);
    const b101 = project(1, 0, 1);
    const b111 = project(1, 1, 1);
    const b011 = project(0, 1, 1);

    // Box base
    ctx.beginPath();
    ctx.moveTo(b001.x, b001.y);
    ctx.lineTo(b101.x, b101.y);
    ctx.lineTo(b111.x, b111.y);
    ctx.lineTo(b011.x, b011.y);
    ctx.closePath();
    ctx.stroke();

    // Box pillars
    ctx.beginPath();
    ctx.moveTo(b000.x, b000.y); ctx.lineTo(b001.x, b001.y);
    ctx.moveTo(b100.x, b100.y); ctx.lineTo(b101.x, b101.y);
    ctx.moveTo(b110.x, b110.y); ctx.lineTo(b111.x, b111.y);
    ctx.moveTo(b010.x, b010.y); ctx.lineTo(b011.x, b011.y);
    ctx.stroke();

    // Collect 3D polygons for depth sorting (Painter's algorithm)
    interface Poly3D {
      pts: { x: number; y: number }[];
      avgZ: number;
      fill: string;
      stroke: string;
      isWall?: boolean;
    }
    const polygons: Poly3D[] = [];

    // Step size for mesh rendering performance
    const stepIL = Math.max(1, Math.floor(nInlines / 24));
    const stepXL = Math.max(1, Math.floor(nCrosslines / 24));

    // 1. Base Horizon Surface (Dark Amber / Subdued)
    for (let il = 0; il < nInlines - stepIL; il += stepIL) {
      for (let xl = 0; xl < nCrosslines - stepXL; xl += stepXL) {
        const ilNext = Math.min(nInlines - 1, il + stepIL);
        const xlNext = Math.min(nCrosslines - 1, xl + stepXL);

        const d00 = ((baseHorizon[il][xl] * sampleRate) / 2000.0) * velocityMs;
        const d10 = ((baseHorizon[ilNext][xl] * sampleRate) / 2000.0) * velocityMs;
        const d11 = ((baseHorizon[ilNext][xlNext] * sampleRate) / 2000.0) * velocityMs;
        const d01 = ((baseHorizon[il][xlNext] * sampleRate) / 2000.0) * velocityMs;

        const p00 = project(xl / nCrosslines, il / nInlines, (d00 - minDepth) / depthSpan);
        const p10 = project(xl / nCrosslines, ilNext / nInlines, (d10 - minDepth) / depthSpan);
        const p11 = project(xlNext / nCrosslines, ilNext / nInlines, (d11 - minDepth) / depthSpan);
        const p01 = project(xlNext / nCrosslines, il / nInlines, (d01 - minDepth) / depthSpan);

        const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;

        polygons.push({
          pts: [p00, p10, p11, p01],
          avgZ: avgZ - 0.05, // Render slightly behind top
          fill: isWireframe ? 'rgba(15, 33, 57, 0.4)' : 'rgba(120, 80, 20, 0.75)',
          stroke: 'rgba(240, 165, 0, 0.5)',
        });
      }
    }

    // 2. Top Horizon Surface (Full Petrel Depth Color)
    for (let il = 0; il < nInlines - stepIL; il += stepIL) {
      for (let xl = 0; xl < nCrosslines - stepXL; xl += stepXL) {
        const ilNext = Math.min(nInlines - 1, il + stepIL);
        const xlNext = Math.min(nCrosslines - 1, xl + stepXL);

        const d00 = ((topHorizon[il][xl] * sampleRate) / 2000.0) * velocityMs;
        const d10 = ((topHorizon[ilNext][xl] * sampleRate) / 2000.0) * velocityMs;
        const d11 = ((topHorizon[ilNext][xlNext] * sampleRate) / 2000.0) * velocityMs;
        const d01 = ((topHorizon[il][xlNext] * sampleRate) / 2000.0) * velocityMs;

        const p00 = project(xl / nCrosslines, il / nInlines, (d00 - minDepth) / depthSpan);
        const p10 = project(xl / nCrosslines, ilNext / nInlines, (d10 - minDepth) / depthSpan);
        const p11 = project(xlNext / nCrosslines, ilNext / nInlines, (d11 - minDepth) / depthSpan);
        const p01 = project(xlNext / nCrosslines, il / nInlines, (d01 - minDepth) / depthSpan);

        const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;
        const avgD = (d00 + d10 + d11 + d01) / 4;

        polygons.push({
          pts: [p00, p10, p11, p01],
          avgZ,
          fill: isWireframe ? 'rgba(10, 22, 40, 0.3)' : getDepthColor(avgD, 0.88),
          stroke: isWireframe ? 'rgba(0, 240, 255, 0.8)' : 'rgba(0, 0, 0, 0.25)',
        });
      }
    }

    // 3. Side Walls (Stratigraphic sandwich connecting Top & Base at perimeter)
    const addWallSegment = (xl1: number, il1: number, xl2: number, il2: number) => {
      const topD1 = ((topHorizon[il1][xl1] * sampleRate) / 2000.0) * velocityMs;
      const baseD1 = ((baseHorizon[il1][xl1] * sampleRate) / 2000.0) * velocityMs;
      const topD2 = ((topHorizon[il2][xl2] * sampleRate) / 2000.0) * velocityMs;
      const baseD2 = ((baseHorizon[il2][xl2] * sampleRate) / 2000.0) * velocityMs;

      const pTop1 = project(xl1 / nCrosslines, il1 / nInlines, (topD1 - minDepth) / depthSpan);
      const pBase1 = project(xl1 / nCrosslines, il1 / nInlines, (baseD1 - minDepth) / depthSpan);
      const pBase2 = project(xl2 / nCrosslines, il2 / nInlines, (baseD2 - minDepth) / depthSpan);
      const pTop2 = project(xl2 / nCrosslines, il2 / nInlines, (topD2 - minDepth) / depthSpan);

      const avgZ = (pTop1.zDepth + pBase1.zDepth + pBase2.zDepth + pTop2.zDepth) / 4;

      polygons.push({
        pts: [pTop1, pBase1, pBase2, pTop2],
        avgZ,
        fill: 'rgba(26, 107, 122, 0.7)',
        stroke: 'rgba(42, 155, 176, 0.6)',
        isWall: true,
      });
    };

    // Front/Back/Left/Right edges
    for (let xl = 0; xl < nCrosslines - stepXL; xl += stepXL) {
      addWallSegment(xl, 0, Math.min(nCrosslines - 1, xl + stepXL), 0);
      addWallSegment(xl, nInlines - 1, Math.min(nCrosslines - 1, xl + stepXL), nInlines - 1);
    }
    for (let il = 0; il < nInlines - stepIL; il += stepIL) {
      addWallSegment(0, il, 0, Math.min(nInlines - 1, il + stepIL));
      addWallSegment(nCrosslines - 1, il, nCrosslines - 1, Math.min(nInlines - 1, il + stepIL));
    }

    // Sort polygons back-to-front by depth
    polygons.sort((a, b) => a.avgZ - b.avgZ);

    // Draw polygons
    for (const poly of polygons) {
      ctx.beginPath();
      ctx.moveTo(poly.pts[0].x, poly.pts[0].y);
      for (let i = 1; i < poly.pts.length; i++) {
        ctx.lineTo(poly.pts[i].x, poly.pts[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = poly.fill;
      ctx.fill();

      ctx.strokeStyle = poly.stroke;
      ctx.lineWidth = poly.isWall ? 1.2 : 0.6;
      ctx.stroke();
    }

    // Draw Compass / Coordinate Axes Overlay
    const axisCenter = { x: 50, y: height - 50 };
    const axisLen = 30;
    const axX = { x: axisCenter.x + cosY * axisLen, y: axisCenter.y - sinY * sinP * axisLen };
    const axY = { x: axisCenter.x - sinY * axisLen, y: axisCenter.y - cosY * sinP * axisLen };
    const axZ = { x: axisCenter.x, y: axisCenter.y - cosP * axisLen };

    ctx.lineWidth = 2;
    // X Axis (Inline)
    ctx.strokeStyle = '#e74c3c';
    ctx.beginPath(); ctx.moveTo(axisCenter.x, axisCenter.y); ctx.lineTo(axX.x, axX.y); ctx.stroke();
    ctx.fillStyle = '#e74c3c'; ctx.font = '10px monospace'; ctx.fillText('IL', axX.x + 3, axX.y);

    // Y Axis (Crossline)
    ctx.strokeStyle = '#2ecc71';
    ctx.beginPath(); ctx.moveTo(axisCenter.x, axisCenter.y); ctx.lineTo(axY.x, axY.y); ctx.stroke();
    ctx.fillStyle = '#2ecc71'; ctx.font = '10px monospace'; ctx.fillText('XL', axY.x + 3, axY.y);

    // Z Axis (Depth)
    ctx.strokeStyle = '#2a9bb0';
    ctx.beginPath(); ctx.moveTo(axisCenter.x, axisCenter.y); ctx.lineTo(axZ.x, axZ.y); ctx.stroke();
    ctx.fillStyle = '#2a9bb0'; ctx.font = '10px monospace'; ctx.fillText('Z', axZ.x + 3, axZ.y - 2);

  }, [topHorizon, baseHorizon, sampleRate, velocityMs, pitch, yaw, zoom, vertExag, isWireframe, minDepth, depthSpan]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    setYaw((y) => (y + dx * 0.6) % 360);
    setPitch((p) => Math.max(5, Math.min(85, p + dy * 0.5)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative w-full flex flex-col bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f243f] border-b border-[#2a9bb0]/20 text-xs">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-[#2a9bb0]" />
          <span className="font-semibold text-[#e8f4f8]">Interactive 3D Reservoir Model</span>
          <span className="bg-[#162d4c] px-2 py-0.5 rounded text-[#2a9bb0] font-mono text-[11px]">
            Pitch: {Math.round(pitch)}° | Yaw: {Math.round(yaw)}°
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsWireframe(!isWireframe)}
            className={`px-2.5 py-1 rounded text-xs transition-colors border ${
              isWireframe
                ? 'bg-[#2a9bb0]/20 text-[#2a9bb0] border-[#2a9bb0]'
                : 'bg-[#162840] text-[#8aafc0] border-[#2a9bb0]/30 hover:text-[#e8f4f8]'
            }`}
          >
            {isWireframe ? 'Surface Solid' : 'Wireframe'}
          </button>

          <div className="flex items-center gap-1 bg-[#162840] px-2 py-0.5 rounded border border-[#2a9bb0]/30">
            <Sliders className="w-3.5 h-3.5 text-[#f0a500]" />
            <span className="text-[11px] text-[#8aafc0]">V.Exag:</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={vertExag}
              onChange={(e) => setVertExag(parseFloat(e.target.value))}
              className="w-16 h-1 accent-[#2a9bb0] cursor-pointer"
            />
            <span className="font-mono text-[11px] text-[#e8f4f8]">{vertExag}x</span>
          </div>

          <button
            onClick={() => {
              setPitch(38);
              setYaw(-45);
              setZoom(1.1);
              setVertExag(2.5);
            }}
            className="p-1.5 bg-[#162840] hover:bg-[#1f3757] text-[#8aafc0] hover:text-[#e8f4f8] rounded border border-[#2a9bb0]/30"
            title="Reset View"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative w-full flex flex-col items-center bg-[#071322] p-2 select-none">
        <canvas
          ref={canvasRef}
          width={640}
          height={420}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full max-w-[640px] h-auto object-contain rounded border border-[#2a9bb0]/20 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        />
        <div className="absolute top-4 right-4 bg-[#0a1829]/80 backdrop-blur px-2.5 py-1 rounded text-[10px] text-[#8aafc0] pointer-events-none border border-[#2a9bb0]/20">
          💡 Click & Drag to Orbit | Scroll to Zoom
        </div>
      </div>

      <div className="px-4 py-2 bg-[#0d2138] border-t border-[#2a9bb0]/20 flex items-center justify-between text-xs text-[#8aafc0]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#00f0ff]" />
            <span className="text-[11px]">Top Horizon (Petrel Colormap)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#ffd700]" />
            <span className="text-[11px]">Base Horizon</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#1a6b7a]" />
            <span className="text-[11px]">Reservoir Isochore Strata</span>
          </div>
        </div>

        <span className="font-mono text-[11px] text-[#2a9bb0]">
          Top: {Math.round(minDepth)}m | Base: {Math.round(maxDepth)}m
        </span>
      </div>
    </div>
  );
};
