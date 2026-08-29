import React, { useState, useRef } from 'react';
import { WellData } from '../types';
import { Layers, Sliders, Activity, Info, Check, Eye, EyeOff, MapPin, Trash2, UploadCloud, FileText, Plus } from 'lucide-react';

interface MultiWellCorrelationProps {
  wells: WellData[];
  onUpdateWellInterval: (wellId: string, topDepth: number, baseDepth: number) => void;
  onToggleWellActive: (wellId: string) => void;
  onSelectWell: (wellId: string) => void;
  onDeleteWell?: (wellId: string) => void;
  onUploadFiles?: (files: FileList | File[]) => void;
  onLoadSampleWells?: () => void;
  activeWellId?: string;
  datumMode: 'structural-depth' | 'stratigraphic-top';
  onChangeDatumMode: (mode: 'structural-depth' | 'stratigraphic-top') => void;
}

export const MultiWellCorrelation: React.FC<MultiWellCorrelationProps> = ({
  wells,
  onUpdateWellInterval,
  onToggleWellActive,
  onSelectWell,
  onDeleteWell,
  onUploadFiles,
  onLoadSampleWells,
  activeWellId,
  datumMode,
  onChangeDatumMode,
}) => {
  const [hoveredWellId, setHoveredWellId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUploadFiles) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUploadFiles) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  if (wells.length === 0) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-[#0f2139] border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          isDragging ? 'border-[#00f0ff] bg-[#14324f]/60' : 'border-[#2a9bb0]/40'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 mx-auto flex items-center justify-center text-[#00f0ff] mb-4">
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#e8f4f8]">Upload Your LAS Well Log Files</h3>
        <p className="text-xs text-[#8aafc0] mt-1.5 max-w-md mx-auto leading-relaxed">
          Drag and drop your CWLS LAS 2.0 well log files (<code className="text-[#00f0ff]">.las</code>, <code className="text-[#00f0ff]">.txt</code>, <code className="text-[#00f0ff]">.dat</code>) here. Only the log files you upload will appear on screen.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-5 bg-[#00f0ff] hover:bg-[#00d0df] text-[#0a1628] font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" /> Browse & Upload LAS Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".las,.las2,.txt,.dat"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {onLoadSampleWells && (
            <button
              onClick={onLoadSampleWells}
              className="py-2.5 px-4 bg-[#071322] hover:bg-[#162d4c] border border-[#2a9bb0]/30 text-[#8aafc0] hover:text-[#00f0ff] text-xs rounded-xl transition-all cursor-pointer"
            >
              Load Reference Sample Wells
            </button>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-[#2a9bb0]/20 flex flex-wrap items-center justify-center gap-6 text-[11px] text-[#8aafc0] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f0a500]" /> Gamma Ray (GR)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff]" /> Porosity (PHIF / NPHI / DPHI)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3498db]" /> Water Saturation (SW)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2ecc71]" /> Resistivity / Pay Interval
          </span>
        </div>
      </div>
    );
  }

  // Dimensions & scaling for cross-section
  const trackW = 160;
  const trackGap = 50;
  const padLeft = 60;
  const padTop = 60;
  const padBottom = 40;
  const plotH = 460;

  // Global depth bounds across all wells
  const allMinD = Math.min(...wells.map((w) => w.lasSummary.depthMin));
  const allMaxD = Math.max(...wells.map((w) => w.lasSummary.depthMax));
  const globalDepthSpan = Math.max(10, allMaxD - allMinD);

  // Maximum gross interval for stratigraphic datum
  const maxRelativeSpan = Math.max(...wells.map((w) => w.baseDepth - w.topDepth + 120), 200);

  // Calculate Y position for a given well and depth
  const getY = (well: WellData, depth: number) => {
    if (datumMode === 'stratigraphic-top') {
      const relD = depth - (well.topDepth - 40);
      return padTop + (relD / maxRelativeSpan) * plotH;
    } else {
      // Structural true vertical depth
      return padTop + ((depth - allMinD) / globalDepthSpan) * plotH;
    }
  };

  // Generate SVG path for a curve within its well track
  const makeTrackCurve = (well: WellData, curveName: string, minVal: number, maxVal: number, leftX: number, width: number) => {
    const depthArr = well.lasSummary.data[well.lasSummary.depthCurve] || [];
    const valArr = well.lasSummary.data[curveName] || [];
    const n = depthArr.length;
    if (n === 0) return '';

    const span = Math.max(1e-5, maxVal - minVal);
    let path = '';
    const step = Math.max(1, Math.floor(n / 200));

    for (let i = 0; i < n; i += step) {
      const d = depthArr[i];
      const val = valArr[i];
      if (isNaN(d) || isNaN(val)) continue;

      const normX = Math.max(0, Math.min(1, (val - minVal) / span));
      const x = leftX + normX * width;
      const y = getY(well, d);

      if (path === '') path += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return path;
  };

  const totalSvgWidth = padLeft + wells.length * trackW + (wells.length - 1) * trackGap + 40;
  const totalSvgHeight = padTop + plotH + padBottom;

  return (
    <div className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-2xl space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#2a9bb0]/20">
        <div>
          <h3 className="text-base font-bold text-[#e8f4f8] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#00f0ff]" /> Multi-Well Log Correlation Cross-Section
          </h3>
          <p className="text-xs text-[#8aafc0] mt-0.5">
            Inter-well stratigraphic & structural fence displaying continuous GR, Porosity ($\phi$), and Water Saturation ($S_w$) wireline logs.
          </p>
        </div>

        {/* Datum Mode Toggle */}
        <div className="flex items-center gap-2 bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/30 text-xs">
          <span className="text-[11px] font-bold text-[#8aafc0] px-2 uppercase">Datum:</span>
          <button
            onClick={() => onChangeDatumMode('structural-depth')}
            className={`px-3 py-1.5 rounded font-semibold transition-all ${
              datumMode === 'structural-depth'
                ? 'bg-[#00f0ff] text-[#0a1628] shadow'
                : 'text-[#8aafc0] hover:text-white'
            }`}
          >
            Structural (True TVD)
          </button>
          <button
            onClick={() => onChangeDatumMode('stratigraphic-top')}
            className={`px-3 py-1.5 rounded font-semibold transition-all ${
              datumMode === 'stratigraphic-top'
                ? 'bg-[#2ecc71] text-[#0a1628] shadow'
                : 'text-[#8aafc0] hover:text-white'
            }`}
          >
            Stratigraphic (Flatten on Top Sand)
          </button>
        </div>
      </div>

      {/* SVG Multi-Track Correlation Canvas */}
      <div className="w-full overflow-x-auto bg-[#071322] rounded-lg border border-[#2a9bb0]/20 p-2">
        <svg
          viewBox={`0 0 ${Math.max(860, totalSvgWidth)} ${totalSvgHeight}`}
          className="w-full h-auto min-w-[800px]"
          style={{ maxHeight: '560px' }}
        >
          <defs>
            <linearGradient id="payZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(46, 204, 113, 0.25)" />
              <stop offset="100%" stopColor="rgba(0, 240, 255, 0.15)" />
            </linearGradient>
            <linearGradient id="sandShading" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(240, 165, 0, 0.35)" />
              <stop offset="100%" stopColor="rgba(240, 165, 0, 0.05)" />
            </linearGradient>
          </defs>

          {/* Depth Scale Column (Left) */}
          <g>
            <rect x={10} y={padTop} width={40} height={plotH} fill="#0d2138" rx={4} stroke="rgba(42,155,176,0.2)" />
            <text x={30} y={padTop - 12} fill="#8aafc0" fontSize="9" fontWeight="bold" textAnchor="middle">
              {datumMode === 'structural-depth' ? 'TVD (m)' : 'REL (m)'}
            </text>
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((frac, idx) => {
              const d = datumMode === 'structural-depth'
                ? allMinD + frac * globalDepthSpan
                : frac * maxRelativeSpan;
              const y = padTop + frac * plotH;
              return (
                <g key={idx}>
                  <line x1={10} y1={y} x2={50} y2={y} stroke="rgba(42,155,176,0.3)" strokeDasharray="2,2" />
                  <text x={30} y={y + 3} fill="#8aafc0" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
                    {Math.round(d)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Correlation Tie-Lines between adjacent wells (Top & Base reservoir markers) */}
          {wells.map((well, idx) => {
            if (idx === wells.length - 1) return null;
            const nextWell = wells[idx + 1];

            const curLeft = padLeft + idx * (trackW + trackGap);
            const curRight = curLeft + trackW;
            const nextLeft = padLeft + (idx + 1) * (trackW + trackGap);

            const topY1 = getY(well, well.topDepth);
            const topY2 = getY(nextWell, nextWell.topDepth);

            const baseY1 = getY(well, well.baseDepth);
            const baseY2 = getY(nextWell, nextWell.baseDepth);

            return (
              <g key={`tie-${idx}`}>
                {/* Shaded correlation corridor */}
                <polygon
                  points={`${curRight},${topY1} ${nextLeft},${topY2} ${nextLeft},${baseY2} ${curRight},${baseY1}`}
                  fill="rgba(46, 204, 113, 0.08)"
                  stroke="none"
                />

                {/* Top Reservoir Correlation Line */}
                <line
                  x1={curRight}
                  y1={topY1}
                  x2={nextLeft}
                  y2={topY2}
                  stroke="#2ecc71"
                  strokeWidth="2.5"
                  strokeDasharray="4,3"
                />

                {/* Base Reservoir Correlation Line */}
                <line
                  x1={curRight}
                  y1={baseY1}
                  x2={nextLeft}
                  y2={baseY2}
                  stroke="#e74c3c"
                  strokeWidth="2.5"
                  strokeDasharray="4,3"
                />

                {/* Mid-point Distance & Correlation Marker */}
                <circle
                  cx={(curRight + nextLeft) / 2}
                  cy={(topY1 + topY2) / 2}
                  r="3.5"
                  fill="#2ecc71"
                />
              </g>
            );
          })}

          {/* Individual Well Tracks */}
          {wells.map((well, idx) => {
            const trackX = padLeft + idx * (trackW + trackGap);
            const isSelected = activeWellId === well.id;
            const isHovered = hoveredWellId === well.id;

            const topY = getY(well, well.topDepth);
            const baseY = getY(well, well.baseDepth);
            const payH = Math.max(4, baseY - topY);

            // Curve paths
            const halfTrack = (trackW - 8) / 2;
            const grPath = makeTrackCurve(well, 'GR', 0, 150, trackX + 4, halfTrack);
            const phiPath = makeTrackCurve(well, 'PHIF', 0, 0.35, trackX + 4 + halfTrack, halfTrack);
            const swPath = makeTrackCurve(well, 'SW', 0, 1.0, trackX + 4 + halfTrack, halfTrack);

            return (
              <g
                key={well.id}
                onMouseEnter={() => setHoveredWellId(well.id)}
                onMouseLeave={() => setHoveredWellId(null)}
                onClick={() => onSelectWell(well.id)}
                className="cursor-pointer"
              >
                {/* Track Background Box */}
                <rect
                  x={trackX}
                  y={padTop}
                  width={trackW}
                  height={plotH}
                  fill={isSelected ? '#0c2742' : isHovered ? '#091c32' : '#081524'}
                  stroke={isSelected ? '#00f0ff' : well.color || '#2a9bb0'}
                  strokeWidth={isSelected ? 2 : 1}
                  rx={6}
                />

                {/* Well Header Card on Top */}
                <rect
                  x={trackX}
                  y={12}
                  width={trackW}
                  height={38}
                  fill={isSelected ? '#14385a' : '#0d2138'}
                  stroke={well.color || '#2a9bb0'}
                  strokeWidth="1.2"
                  rx={5}
                />
                <circle cx={trackX + 12} cy={24} r="5" fill={well.color || '#00f0ff'} />
                <text
                  x={trackX + 22}
                  y={25}
                  fill="#e8f4f8"
                  fontSize="10.5"
                  fontWeight="bold"
                >
                  {well.wellName}
                </text>
                <text
                  x={trackX + 22}
                  y={38}
                  fill="#8aafc0"
                  fontSize="8"
                  fontFamily="JetBrains Mono"
                >
                  {well.trajectory && well.trajectory.maxInclination > 3
                    ? `🧭 ${well.trajectory.maxInclination.toFixed(1)}° Inc (${Math.round(well.trajectory.bottomHoleLocation.hd)}m HD)`
                    : well.location.inline != null && well.location.crossline != null
                    ? `IL:${well.location.inline} XL:${well.location.crossline}`
                    : well.location.x != null
                    ? `X:${Math.round(well.location.x / 1000)}k`
                    : 'Log Profile'}
                  {' '}| {well.extractedPetro.netPayM}m Pay
                </text>

                {/* Sub-track header labels (GR & Porosity) */}
                <text x={trackX + 10} y={padTop - 4} fill="#f0a500" fontSize="7.5" fontWeight="bold">
                  GR (0-150)
                </text>
                <text x={trackX + trackW - 48} y={padTop - 4} fill="#2a9bb0" fontSize="7.5" fontWeight="bold">
                  Φ (0-0.35)
                </text>

                {/* Reservoir Pay Zone Overlay in well */}
                <rect
                  x={trackX + 2}
                  y={topY}
                  width={trackW - 4}
                  height={payH}
                  fill="url(#payZoneGrad)"
                  stroke="#2ecc71"
                  strokeWidth="1.5"
                />

                {/* Top Horizon Marker Line */}
                <line
                  x1={trackX - 6}
                  y1={topY}
                  x2={trackX + trackW + 6}
                  y2={topY}
                  stroke="#2ecc71"
                  strokeWidth="2.5"
                />
                <rect x={trackX + 4} y={topY - 14} width={58} height={13} fill="#14385a" rx={2} stroke="#2ecc71" strokeWidth="0.8" />
                <text x={trackX + 8} y={topY - 4} fill="#2ecc71" fontSize="8" fontWeight="bold">
                  Top: {well.topDepth}m
                </text>

                {/* Base Horizon Marker Line */}
                <line
                  x1={trackX - 6}
                  y1={baseY}
                  x2={trackX + trackW + 6}
                  y2={baseY}
                  stroke="#e74c3c"
                  strokeWidth="2.5"
                />
                <rect x={trackX + 4} y={baseY + 2} width={62} height={13} fill="#14385a" rx={2} stroke="#e74c3c" strokeWidth="0.8" />
                <text x={trackX + 8} y={baseY + 12} fill="#e74c3c" fontSize="8" fontWeight="bold">
                  Base: {well.baseDepth}m
                </text>

                {/* Log Curves */}
                {grPath && <path d={grPath} fill="none" stroke="#f0a500" strokeWidth="1.4" />}
                {phiPath && <path d={phiPath} fill="none" stroke="#00f0ff" strokeWidth="1.4" />}
                {swPath && <path d={swPath} fill="none" stroke="#3498db" strokeWidth="1.2" strokeDasharray="3,2" />}

                {/* Well Footer Summary */}
                <g transform={`translate(${trackX}, ${padTop + plotH + 8})`}>
                  <rect width={trackW} height={24} fill="#0d2138" rx={4} stroke="rgba(42,155,176,0.2)" />
                  <text x={trackW / 2} y={15} fill="#00f0ff" fontSize="8.5" fontFamily="JetBrains Mono" textAnchor="middle">
                    Φ={(well.extractedPetro.meanPhi * 100).toFixed(1)}% | Sw={(well.extractedPetro.meanSw * 100).toFixed(0)}% | NTG={(well.extractedPetro.ntg * 100).toFixed(0)}%
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Well Cards Summary & Active Inclusion Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {wells.map((well) => (
          <div
            key={well.id}
            onClick={() => onSelectWell(well.id)}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeWellId === well.id
                ? 'bg-[#14324f] border-[#00f0ff] shadow-lg ring-1 ring-[#00f0ff]'
                : 'bg-[#0f2139] border-[#2a9bb0]/30 hover:border-[#2a9bb0]/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: well.color || '#00f0ff' }}
                />
                <span className="text-xs font-bold text-[#e8f4f8] truncate" title={well.wellName}>
                  {well.wellName}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWellActive(well.id);
                  }}
                  className={`p-1 rounded text-xs transition-colors ${
                    well.isActive
                      ? 'bg-[#2ecc71]/20 text-[#2ecc71] hover:bg-[#2ecc71]/30'
                      : 'bg-gray-700/40 text-gray-400 hover:bg-gray-700/60'
                  }`}
                  title={well.isActive ? 'Well active in reservoir synthesis' : 'Well excluded'}
                >
                  {well.isActive ? <Check className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                {onDeleteWell && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteWell(well.id);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-[#e74c3c] hover:bg-[#e74c3c]/10 transition-colors"
                    title={`Delete ${well.wellName} from workspace`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Location coordinates */}
            <div className="text-[10px] text-[#8aafc0] mt-1.5 flex items-center gap-1 font-mono">
              <MapPin className="w-3 h-3 text-[#2a9bb0]" />
              {well.location.x != null && well.location.y != null
                ? `(${Math.round(well.location.x)}, ${Math.round(well.location.y)})`
                : well.location.inline != null
                ? `IL:${well.location.inline} XL:${well.location.crossline}`
                : well.location.lineName
                ? `${well.location.lineName} @ ${well.location.cdpOrSp}`
                : 'Location not set'}
            </div>

            {/* Petrophysical Metrics */}
            <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-[#2a9bb0]/20 text-center font-mono">
              <div className="bg-[#071322] p-1 rounded">
                <div className="text-[8px] text-[#8aafc0]">POROSITY</div>
                <div className="text-xs font-bold text-[#00f0ff]">
                  {(well.extractedPetro.meanPhi * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-[#071322] p-1 rounded">
                <div className="text-[8px] text-[#8aafc0]">WATER SAT</div>
                <div className="text-xs font-bold text-[#f0a500]">
                  {(well.extractedPetro.meanSw * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-[#071322] p-1 rounded">
                <div className="text-[8px] text-[#8aafc0]">NET PAY</div>
                <div className="text-xs font-bold text-[#2ecc71]">
                  {well.extractedPetro.netPayM}m
                </div>
              </div>
            </div>

            {/* Interval Adjuster */}
            <div className="flex items-center justify-between text-[10px] text-[#8aafc0] mt-2">
              <span>Top: <b className="text-[#2ecc71]">{well.topDepth}m</b></span>
              <span>Base: <b className="text-[#e74c3c]">{well.baseDepth}m</b></span>
              <span>Gross: <b>{well.baseDepth - well.topDepth}m</b></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
