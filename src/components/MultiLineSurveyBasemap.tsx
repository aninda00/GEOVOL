import React, { useRef, useEffect, useState } from 'react';
import { MultiLine2DSurvey, Seismic2DLineInfo, LineIntersection, WellData } from '../types';
import { MapPin, Eye, EyeOff, Layers, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface MultiLineSurveyBasemapProps {
  survey: MultiLine2DSurvey;
  selectedLineId?: string | null;
  onSelectLine?: (lineId: string) => void;
  onToggleLineVisibility?: (lineId: string) => void;
  wells?: WellData[];
  onSelectWell?: (wellId: string) => void;
}

export const MultiLineSurveyBasemap: React.FC<MultiLineSurveyBasemapProps> = ({
  survey,
  selectedLineId,
  onSelectLine,
  onToggleLineVisibility,
  wells = [],
  onSelectWell,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [hoveredIntersection, setHoveredIntersection] = useState<LineIntersection | null>(null);
  const [hoveredWell, setHoveredWell] = useState<WellData | null>(null);

  const { bounds, lines, intersections } = survey;
  const spanX = Math.max(10, bounds.maxX - bounds.minX);
  const spanY = Math.max(10, bounds.maxY - bounds.minY);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark grid background
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, width, height);

    const pad = 40;
    const drawW = width - pad * 2;
    const drawH = height - pad * 2;

    // Coordinate mapping helper
    const mapX = (x: number) => pad + ((x - bounds.minX) / spanX) * drawW;
    const mapY = (y: number) => height - pad - ((y - bounds.minY) / spanY) * drawH; // Invert Y for cartesian

    // Draw Coordinate Grid Lines & Ticks
    ctx.strokeStyle = 'rgba(42, 155, 176, 0.15)';
    ctx.lineWidth = 1;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = '#8aafc0';

    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
      const frac = i / numTicks;
      const xVal = bounds.minX + frac * spanX;
      const yVal = bounds.minY + frac * spanY;

      const px = mapX(xVal);
      const py = mapY(yVal);

      // Vertical grid
      ctx.beginPath();
      ctx.moveTo(px, pad);
      ctx.lineTo(px, height - pad);
      ctx.stroke();
      ctx.fillText(`${Math.round(xVal)}m`, px - 15, height - pad + 15);

      // Horizontal grid
      ctx.beginPath();
      ctx.moveTo(pad, py);
      ctx.lineTo(width - pad, py);
      ctx.stroke();
      ctx.fillText(`${Math.round(yVal)}m`, 5, py + 3);
    }

    // Draw 3D Grid Reconstruction Bounding Outline
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(pad, pad, drawW, drawH);
    ctx.setLineDash([]);

    // Draw 2D Seismic Lines
    lines.forEach((line) => {
      if (line.visible === false) return;

      const x1 = mapX(line.startX);
      const y1 = mapY(line.startY);
      const x2 = mapX(line.endX);
      const y2 = mapY(line.endY);

      const isSelected = selectedLineId === line.id;
      const isHovered = hoveredLine === line.id;

      // Line glow
      if (isSelected || isHovered) {
        ctx.strokeStyle = line.color;
        ctx.lineWidth = isSelected ? 6 : 4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Base Line
      ctx.strokeStyle = line.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Trace stations (subtle tick marks)
      const ds = line.dataset;
      const nTraces = ds.nTraces;
      const step = Math.max(1, Math.floor(nTraces / 15));

      ctx.fillStyle = line.color;
      for (let t = 0; t < nTraces; t += step) {
        let tx = line.startX + (t / (nTraces - 1)) * (line.endX - line.startX);
        let ty = line.startY + (t / (nTraces - 1)) * (line.endY - line.startY);
        if (ds.xCoords && ds.xCoords[t]) tx = ds.xCoords[t];
        if (ds.yCoords && ds.yCoords[t]) ty = ds.yCoords[t];

        const px = mapX(tx);
        const py = mapY(ty);
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Line Label positioned at line's start point (offset outward from line trajectory so it never overlaps intersections)
      const dx = x1 - x2;
      const dy = y1 - y2;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const labelOffset = 22;
      const labelX = Math.max(25, Math.min(width - 25, x1 + ux * labelOffset));
      const labelY = Math.max(12, Math.min(height - 12, y1 + uy * labelOffset));

      ctx.font = 'bold 9px JetBrains Mono, monospace';
      const textMetrics = ctx.measureText(line.name);
      const textW = textMetrics.width;
      const padX = 5;
      const boxW = textW + padX * 2;
      const boxH = 14;

      ctx.fillStyle = 'rgba(5, 14, 25, 0.92)';
      ctx.fillRect(labelX - boxW / 2, labelY - boxH / 2, boxW, boxH);
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(labelX - boxW / 2, labelY - boxH / 2, boxW, boxH);

      ctx.fillStyle = '#e8f4f8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line.name, labelX, labelY);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    });

    // Draw Intersections (Tie Points)
    intersections.forEach((inter) => {
      const ix = mapX(inter.x);
      const iy = mapY(inter.y);

      ctx.fillStyle = '#f0a500';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(ix, iy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Outer ripple
      ctx.strokeStyle = 'rgba(240, 165, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(ix, iy, 8, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw Well Locations (Well Heads with geological circle & crosshair)
    wells.forEach((well) => {
      let wx: number | undefined = well.location.x;
      let wy: number | undefined = well.location.y;

      // If X/Y not directly in bounds, derive from 3D inline/crossline or line tie
      if (wx == null || wy == null || wx < bounds.minX - 5000 || wx > bounds.maxX + 5000) {
        if (well.location.inline != null && well.location.crossline != null) {
          wx = bounds.minX + (well.location.crossline / 32) * spanX;
          wy = bounds.minY + (well.location.inline / 32) * spanY;
        }
      }

      if (wx == null || wy == null) return;

      const px = mapX(wx);
      const py = mapY(wy);
      const isHovered = hoveredWell?.id === well.id;
      const wellColor = well.color || '#00f0ff';

      // Outer halo
      ctx.fillStyle = isHovered ? 'rgba(0, 240, 255, 0.35)' : 'rgba(46, 204, 113, 0.2)';
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 12 : 9, 0, Math.PI * 2);
      ctx.fill();

      // Wellhead circle
      ctx.fillStyle = '#050d1a';
      ctx.strokeStyle = wellColor;
      ctx.lineWidth = isHovered ? 2.5 : 2;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center dot
      ctx.fillStyle = wellColor;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Well name label
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillStyle = isHovered ? '#00f0ff' : '#e8f4f8';
      ctx.fillText(well.wellName, px + 10, py - 4);

      // Micro pay tag
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillStyle = '#2ecc71';
      ctx.fillText(`${well.extractedPetro.netPayM}m pay`, px + 10, py + 6);
    });
  }, [survey, selectedLineId, hoveredLine, bounds, spanX, spanY, lines, intersections, wells, hoveredWell]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pad = 40;
    const drawW = canvas.width - pad * 2;
    const drawH = canvas.height - pad * 2;
    const mapX = (x: number) => pad + ((x - bounds.minX) / spanX) * drawW;
    const mapY = (y: number) => canvas.height - pad - ((y - bounds.minY) / spanY) * drawH;

    // Check well hover
    let foundWell: WellData | null = null;
    for (const w of wells) {
      let wx = w.location.x;
      let wy = w.location.y;
      if (wx == null || wy == null) {
        if (w.location.inline != null && w.location.crossline != null) {
          wx = bounds.minX + (w.location.crossline / 32) * spanX;
          wy = bounds.minY + (w.location.inline / 32) * spanY;
        }
      }
      if (wx != null && wy != null) {
        const px = mapX(wx);
        const py = mapY(wy);
        if (Math.hypot(mx - px, my - py) < 14) {
          foundWell = w;
          break;
        }
      }
    }
    setHoveredWell(foundWell);

    // Check intersection hover
    let foundInter: LineIntersection | null = null;
    for (const inter of intersections) {
      const ix = mapX(inter.x);
      const iy = mapY(inter.y);
      const dist = Math.sqrt((mx - ix) ** 2 + (my - iy) ** 2);
      if (dist < 10) {
        foundInter = inter;
        break;
      }
    }
    setHoveredIntersection(foundInter);

    // Check line hover
    let foundLine: string | null = null;
    for (const line of lines) {
      const x1 = mapX(line.startX);
      const y1 = mapY(line.startY);
      const x2 = mapX(line.endX);
      const y2 = mapY(line.endY);

      // Distance from point to line segment
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq > 0) {
        const u = Math.max(0, Math.min(1, ((mx - x1) * dx + (my - y1) * dy) / lenSq));
        const px = x1 + u * dx;
        const py = y1 + u * dy;
        const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
        if (dist < 8) {
          foundLine = line.id;
          break;
        }
      }
    }
    setHoveredLine(foundLine);
  };

  const handleCanvasClick = () => {
    if (hoveredWell) {
      onSelectWell?.(hoveredWell.id);
    } else if (hoveredLine) {
      onSelectLine?.(hoveredLine);
    }
  };

  return (
    <div className="bg-[#0b1c30] border border-[#2a9bb0]/30 rounded-xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#00f0ff]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#e8f4f8]">
            2D Multi-Line Survey Basemap & Well Navigation Grid
          </h3>
        </div>
        <span className="text-[11px] font-mono text-[#8aafc0]">
          {lines.length} 2D Profiles | {wells.length} Wells Correlated
        </span>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-[#2a9bb0]/20">
        <canvas
          ref={canvasRef}
          width={640}
          height={320}
          onMouseMove={handleCanvasMouseMove}
          onClick={handleCanvasClick}
          className="w-full h-[320px] cursor-pointer block"
        />

        {/* Hover info tooltip */}
        {hoveredIntersection && (
          <div className="absolute top-3 right-3 bg-[#071322]/95 border border-[#f0a500]/50 rounded-lg p-2.5 font-mono text-[11px] text-[#e8f4f8] shadow-xl backdrop-blur-md">
            <div className="text-[#f0a500] font-bold flex items-center gap-1 mb-1">
              <span>📍 Tie-Point Intersection</span>
            </div>
            <div>{hoveredIntersection.line1Name} (Trace {hoveredIntersection.line1TraceIdx})</div>
            <div>{hoveredIntersection.line2Name} (Trace {hoveredIntersection.line2TraceIdx})</div>
            <div className="text-[10px] text-[#8aafc0] mt-1">
              Coord: ({hoveredIntersection.x}m, {hoveredIntersection.y}m)
            </div>
          </div>
        )}
      </div>

      {/* Survey Lines Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
        {lines.map((line) => {
          const isSelected = selectedLineId === line.id;
          return (
            <div
              key={line.id}
              onClick={() => onSelectLine?.(line.id)}
              className={`p-2 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#102d4a] border-[#00f0ff] shadow-md'
                  : 'bg-[#071322] border-[#2a9bb0]/20 hover:border-[#2a9bb0]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: line.color }}
                  ></span>
                  <span className="font-bold text-[11px] text-[#e8f4f8] truncate">
                    {line.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLineVisibility?.(line.id);
                  }}
                  className="text-[#8aafc0] hover:text-white"
                >
                  {line.visible !== false ? (
                    <Eye className="w-3 h-3 text-[#2ecc71]" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-[#e74c3c]" />
                  )}
                </button>
              </div>
              <div className="text-[10px] font-mono text-[#8aafc0] flex justify-between">
                <span>{line.dataset.nTraces} CMPs</span>
                <span>{line.lengthM}m</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
