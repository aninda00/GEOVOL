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

  // If 2D line (nInlines = 1), extrude to 2 rows for 3D ribbon rendering
  const is2D = topHorizon.length <= 1;
  const activeTop = is2D && topHorizon.length === 1 ? [topHorizon[0], topHorizon[0]] : topHorizon;
  const activeBase = is2D && baseHorizon.length === 1 ? [baseHorizon[0], baseHorizon[0]] : baseHorizon;

  const nInlines = activeTop.length;
  const nCrosslines = activeTop[0]?.length || 0;

  // Compute depth bounds
  let minDepth = Infinity;
  let maxDepth = -Infinity;

  for (let il = 0; il < nInlines; il++) {
    for (let xl = 0; xl < nCrosslines; xl++) {
      const topD = ((activeTop[il][xl] * sampleRate) / 2000.0) * velocityMs;
      const baseD = ((activeBase[il][xl] * sampleRate) / 2000.0) * velocityMs;
      if (topD < minDepth) minDepth = topD;
      if (baseD > maxDepth) maxDepth = baseD;
    }
  }

  const depthSpan = Math.max(1, maxDepth - minDepth);

  // Rainbow colormap for top surface
  const getDepthColor = (d: number, alpha: number = 1.0): string => {
    const t = Math.max(0, Math.min(1, (d - minDepth) / depthSpan));
    let r = 0, g = 0, b = 0;

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
      const x = (xNorm - 0.5) * 2;
      const y = (yNorm - 0.5) * 2;
      const z = (zNorm - 0.5) * vertExag;

      const xRot = x * cosY - y * sinY;
      const yRot = x * sinY + y * cosY;

      const yP = yRot * cosP - z * sinP;
      const zP = yRot * sinP + z * cosP;

      const px = centerX + xRot * scale;
      const py = centerY - yP * scale;

      return { x: px, y: py, zDepth: zP };
    };

    // Draw bounding box
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

    ctx.beginPath();
    ctx.moveTo(b001.x, b001.y);
    ctx.lineTo(b101.x, b101.y);
    ctx.lineTo(b111.x, b111.y);
    ctx.lineTo(b011.x, b011.y);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(b000.x, b000.y); ctx.lineTo(b001.x, b001.y);
    ctx.moveTo(b100.x, b100.y); ctx.lineTo(b101.x, b101.y);
    ctx.moveTo(b110.x, b110.y); ctx.lineTo(b111.x, b111.y);
    ctx.moveTo(b010.x, b010.y); ctx.lineTo(b011.x, b011.y);
    ctx.stroke();

    interface Poly3D {
      pts: { x: number; y: number }[];
      avgZ: number;
      fill: string;
      stroke: string;
      isWall?: boolean;
    }
    const polygons: Poly3D[] = [];

    const stepIL = Math.max(1, Math.floor(nInlines / 24));
    const stepXL = Math.max(1, Math.floor(nCrosslines / 24));

    // 1. Base Horizon Surface
    for (let il = 0; il < nInlines - stepIL; il += stepIL) {
      for (let xl = 0; xl < nCrosslines - stepXL; xl += stepXL) {
        const ilNext = Math.min(nInlines - 1, il + stepIL);
        const xlNext = Math.min(nCrosslines - 1, xl + stepXL);

        const d00 = ((activeBase[il][xl] * sampleRate) / 2000.0) * velocityMs;
        const d10 = ((activeBase[ilNext][xl] * sampleRate) / 2000.0) * velocityMs;
        const d11 = ((activeBase[ilNext][xlNext] * sampleRate) / 2000.0) * velocityMs;
        const d01 = ((activeBase[il][xlNext] * sampleRate) / 2000.0) * velocityMs;

        const p00 = project(xl / nCrosslines, il / nInlines, (d00 - minDepth) / depthSpan);
        const p10 = project(xl / nCrosslines, ilNext / nInlines, (d10 - minDepth) / depthSpan);
        const p11 = project(xlNext / nCrosslines, ilNext / nInlines, (d11 - minDepth) / depthSpan);
        const p01 = project(xlNext / nCrosslines, il / nInlines, (d01 - minDepth) / depthSpan);

        const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;

        polygons.push({
          pts: [p00, p10, p11, p01],
          avgZ: avgZ - 0.05,
          fill: isWireframe ? 'rgba(15, 33, 57, 0.4)' : 'rgba(120, 80, 20, 0.75)',
          stroke: 'rgba(240, 165, 0, 0.5)',
        });
      }
    }

    // 2. Top Horizon Surface
    for (let il = 0; il < nInlines - stepIL; il += stepIL) {
      for (let xl = 0; xl < nCrosslines - stepXL; xl += stepXL) {
        const ilNext = Math.min(nInlines - 1, il + stepIL);
        const xlNext = Math.min(nCrosslines - 1, xl + stepXL);

        const d00 = ((activeTop[il][xl] * sampleRate) / 2000.0) * velocityMs;
        const d10 = ((activeTop[ilNext][xl] * sampleRate) / 2000.0) * velocityMs;
        const d11 = ((activeTop[ilNext][xlNext] * sampleRate) / 2000.0) * velocityMs;
        const d01 = ((activeTop[il][xlNext] * sampleRate) / 2000.0) * velocityMs;

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

    // 3. Side Walls
    const addWallSegment = (xl1: number, il1: number, xl2: number, il2: number) => {
      const topD1 = ((activeTop[il1][xl1] * sampleRate) / 2000.0) * velocityMs;
      const baseD1 = ((activeBase[il1][xl1] * sampleRate) / 2000.0) * velocityMs;
      const topD2 = ((activeTop[il2][xl2] * sampleRate) / 2000.0) * velocityMs;
      const baseD2 = ((activeBase[il2][xl2] * sampleRate) / 2000.0) * velocityMs;

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

    for (let xl = 0; xl < nCrosslines - stepXL; xl += stepXL) {
      addWallSegment(xl, 0, Math.min(nCrosslines - 1, xl + stepXL), 0);
      addWallSegment(xl, nInlines - 1, Math.min(nCrosslines - 1, xl + stepXL), nInlines - 1);
    }
    for (let il = 0; il < nInlines - stepIL; il += stepIL) {
      addWallSegment(0, il, 0, Math.min(nInlines - 1, il + stepIL));
      addWallSegment(nCrosslines - 1, il, nCrosslines - 1, Math.min(nInlines - 1, il + stepIL));
    }

    // Sort polygons back to front
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
      ctx.lineWidth = poly.isWall ? 1.5 : 0.8;
      ctx.stroke();
    }
  }, [activeTop, activeBase, sampleRate, velocityMs, pitch, yaw, zoom, vertExag, isWireframe]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setYaw((prev) => (prev + dx * 0.6) % 360);
    setPitch((prev) => Math.max(-85, Math.min(85, prev - dy * 0.6)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-4 shadow-xl space-y-3">
      {/* 3D Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#071322] px-4 py-2 rounded-lg border border-[#2a9bb0]/20 text-xs">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-[#00f0ff]" />
          <span className="font-bold text-[#e8f4f8]">
            3D Structural Reservoir Model {is2D ? '(2D Fence Extrusion)' : '(3D Volume Mesh)'}
          </span>
          <span className="text-[10px] text-[#8aafc0]">| Drag canvas to rotate (Pitch {Math.round(pitch)}°, Yaw {Math.round(yaw)}°)</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Vertical Exaggeration Slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#8aafc0]">Z-Exag:</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={vertExag}
              onChange={(e) => setVertExag(parseFloat(e.target.value))}
              className="w-16 h-1 bg-[#1a3d54] rounded accent-[#2a9bb0]"
            />
            <span className="font-mono text-[#00f0ff] w-6">{vertExag}x</span>
          </div>

          {/* Wireframe Toggle */}
          <button
            onClick={() => setIsWireframe(!isWireframe)}
            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
              isWireframe ? 'bg-[#00f0ff] text-[#0a1628] font-bold border-[#00f0ff]' : 'bg-[#0b1b30] text-[#8aafc0] border-[#2a9bb0]/30 hover:text-white'
            }`}
          >
            Wireframe
          </button>

          {/* Reset View */}
          <button
            onClick={() => {
              setPitch(38);
              setYaw(-45);
              setZoom(1.1);
              setVertExag(2.5);
            }}
            className="p-1.5 bg-[#0b1b30] hover:bg-[#162d4c] text-[#8aafc0] hover:text-white rounded border border-[#2a9bb0]/30 transition-colors"
            title="Reset Camera Orientation"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative bg-[#050c17] rounded-lg border border-[#2a9bb0]/20 p-2 overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={650}
          height={380}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-[380px] rounded cursor-grab active:cursor-grabbing object-fill"
        />

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 bg-[#071322]/90 border border-[#2a9bb0]/40 rounded-lg p-2.5 font-mono text-[10px] text-[#e8f4f8] shadow-lg backdrop-blur-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 via-green-400 to-red-500"></span>
            <span>Top Reservoir Horizon (Depth Mapped)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f0a500]"></span>
            <span>Base Reservoir Horizon</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1a6b7a]"></span>
            <span>Stratigraphic Pinchout Perimeter</span>
          </div>
        </div>
      </div>
    </div>
  );
};
