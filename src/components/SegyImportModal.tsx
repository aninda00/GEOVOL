import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  inspectSegyFile,
  parseSegyBuffer,
  decodeIBMFloat,
  buildMultiLineSurvey,
  interpolate2DLinesTo3DCube,
} from '../modules/seismicEngine';
import {
  SeismicDataset,
  SegyImportOptions,
  SeismicBinaryHeader,
  TraceHeader,
  MultiLine2DSurvey,
} from '../types';
import { MultiLineSurveyBasemap } from './MultiLineSurveyBasemap';
import {
  X,
  FileText,
  Binary,
  ListFilter,
  Sliders,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Activity,
  Cpu,
  Search,
  Copy,
  Check,
  Box,
  MapPin,
  Sparkles,
  Grid,
  Compass,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const LINE_PALETTE = [
  '#00f0ff',
  '#2ecc71',
  '#f0a500',
  '#e74c3c',
  '#9b59b6',
  '#3498db',
  '#1abc9c',
  '#e67e22',
  '#ff007f',
  '#00ffaa',
];

export interface SegyFileItem {
  file: File;
  buffer: ArrayBuffer;
  name: string;
}

export interface SegyImportModalProps {
  // Support both single file and multi-file props
  file?: File;
  buffer?: ArrayBuffer;
  files?: SegyFileItem[];
  onConfirm: (dataset: SeismicDataset) => void;
  onCancel: () => void;
}

export const SegyImportModal: React.FC<SegyImportModalProps> = ({
  file: propFile,
  buffer: propBuffer,
  files: propFiles,
  onConfirm,
  onCancel,
}) => {
  // Normalize file items
  const fileItems: SegyFileItem[] = useMemo(() => {
    if (propFiles && propFiles.length > 0) return propFiles;
    if (propFile && propBuffer) {
      return [{ file: propFile, buffer: propBuffer, name: propFile.name }];
    }
    return [];
  }, [propFile, propBuffer, propFiles]);

  const isMultiFile = fileItems.length > 1;

  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    'multiline' | 'synthesis' | 'overview' | 'text' | 'binary' | 'traces' | 'mapping'
  >(isMultiFile ? 'multiline' : 'overview');

  const [copied, setCopied] = useState<boolean>(false);
  const [textSearch, setTextSearch] = useState<string>('');

  // 3D Construct Interpolation options
  const [gridNx, setGridNx] = useState<number>(32);
  const [gridNy, setGridNy] = useState<number>(32);
  const [idwPower, setIdwPower] = useState<number>(2.0);
  const [spatialSmoothing, setSpatialSmoothing] = useState<number>(0.5);
  const [constructMode, setConstructMode] = useState<'3d_cube' | '2d_fence' | 'single_line'>(
    isMultiFile ? '2d_fence' : 'single_line'
  );

  // Single file Import options
  const [datasetMode, setDatasetMode] = useState<'auto' | '2d' | '3d'>('auto');
  const [inlineByte, setInlineByte] = useState<number>(189);
  const [crosslineByte, setCrosslineByte] = useState<number>(193);
  const [cdpByte, setCdpByte] = useState<number>(21);
  const [spByte, setSpByte] = useState<number>(17);
  const [formatOverride, setFormatOverride] = useState<number>(0); // 0 = auto

  const filesScrollRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const scrollFiles = (direction: 'left' | 'right') => {
    if (filesScrollRef.current) {
      const offset = direction === 'left' ? -260 : 260;
      filesScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      tabsScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };
  const [endiannessOverride, setEndiannessOverride] = useState<'auto' | 'big' | 'little'>('auto');
  const [maxTraces, setMaxTraces] = useState<number>(5000);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Current active file item for inspection
  const activeItem = fileItems[selectedFileIdx] || fileItems[0];

  // Inspect currently selected file
  const inspection = useMemo(() => {
    if (!activeItem) return { data: null, error: 'No file provided' };
    try {
      const options: SegyImportOptions = {
        mode: datasetMode,
        inlineByte,
        crosslineByte,
        cdpByte,
        spByte,
        formatOverride: formatOverride > 0 ? formatOverride : undefined,
        endiannessOverride,
        maxTraces,
      };
      return {
        data: inspectSegyFile(activeItem.buffer, options),
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err.message || 'Failed to inspect SEG-Y headers',
      };
    }
  }, [
    activeItem,
    datasetMode,
    inlineByte,
    crosslineByte,
    cdpByte,
    spByte,
    formatOverride,
    endiannessOverride,
    maxTraces,
  ]);

  const insp = inspection.data;

  // Inspect all files for multi-line survey
  const multiLineSurveyData = useMemo(() => {
    if (!isMultiFile) return null;
    try {
      const parsedLines: SeismicDataset[] = [];
      for (const item of fileItems) {
        const ds = parseSegyBuffer(item.buffer, item.name, {
          mode: '2d',
          maxTraces: 4000,
        });
        parsedLines.push(ds);
      }
      const survey = buildMultiLineSurvey(parsedLines, `${fileItems.length}-Line 2D Exploration Survey`);
      return { survey, error: null };
    } catch (err: any) {
      return { survey: null, error: err.message || 'Failed to parse multi-line survey' };
    }
  }, [fileItems, isMultiFile]);

  // Mini-preview canvas for single active file
  useEffect(() => {
    if (!insp || !previewCanvasRef.current || !activeItem) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const nSamples = insp.nSamples;
    const nTracesToPreview = Math.min(insp.totalTraces, 120);
    const formatCode = insp.formatCode;
    const isLE = insp.isLittleEndian;
    const bytesPerSample = formatCode === 3 ? 2 : formatCode === 8 ? 1 : 4;
    const traceTotalSize = 240 + nSamples * bytesPerSample;
    const view = new DataView(activeItem.buffer);

    const imgData = ctx.createImageData(nTracesToPreview, nSamples);
    const buf = imgData.data;

    let maxAmp = 0.0001;
    const samplesGrid: number[][] = [];

    for (let t = 0; t < nTracesToPreview; t++) {
      const row: number[] = [];
      const dataStart = 3600 + t * traceTotalSize + 240;
      for (let s = 0; s < nSamples; s++) {
        const offset = dataStart + s * bytesPerSample;
        let val = 0;
        if (offset + 4 <= activeItem.buffer.byteLength) {
          if (formatCode === 1) {
            val = decodeIBMFloat(view, offset);
          } else if (formatCode === 3) {
            val = view.getInt16(offset, isLE) / 32768.0;
          } else {
            val = view.getFloat32(offset, isLE);
          }
        }
        val = isNaN(val) ? 0 : val;
        if (Math.abs(val) > maxAmp) maxAmp = Math.abs(val);
        row.push(val);
      }
      samplesGrid.push(row);
    }

    maxAmp = (maxAmp * 0.85) || 1.0;

    for (let s = 0; s < nSamples; s++) {
      for (let t = 0; t < nTracesToPreview; t++) {
        const norm = Math.max(-1, Math.min(1, samplesGrid[t][s] / maxAmp));
        const idx = (s * nTracesToPreview + t) * 4;
        let r = 240, g = 240, b = 240;
        if (norm < 0) {
          const u = -norm;
          r = Math.round(245 - u * 30);
          g = Math.round(245 - u * 180);
          b = Math.round(245 - u * 190);
        } else {
          const u = norm;
          r = Math.round(245 - u * 190);
          g = Math.round(245 - u * 150);
          b = Math.round(245 - u * 20);
        }
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = 255;
      }
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = nTracesToPreview;
    offCanvas.height = nSamples;
    const offCtx = offCanvas.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imgData, 0, 0);
      ctx.drawImage(offCanvas, 0, 0, width, height);
    }
  }, [insp, activeItem]);

  const handleCopyTextHeader = () => {
    if (!insp) return;
    navigator.clipboard.writeText(insp.textHeader);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteImport = () => {
    if (isMultiFile && constructMode === '3d_cube' && multiLineSurveyData?.survey) {
      // 3D Spatial Interpolation from 2D lines
      const cube = interpolate2DLinesTo3DCube(
        multiLineSurveyData.survey,
        gridNx,
        gridNy,
        idwPower,
        spatialSmoothing
      );
      onConfirm(cube);
    } else if (isMultiFile && constructMode === '2d_fence' && multiLineSurveyData?.survey) {
      // 2D Multi-line survey aggregation (returns primary 2D line with survey metadata)
      const primaryLine = multiLineSurveyData.survey.lines[0].dataset;
      primaryLine.multiLineSurvey = multiLineSurveyData.survey;
      onConfirm(primaryLine);
    } else {
      // Single 2D line or 3D cube
      if (!activeItem) return;
      const options: SegyImportOptions = {
        mode: datasetMode,
        inlineByte,
        crosslineByte,
        cdpByte,
        spByte,
        formatOverride: formatOverride > 0 ? formatOverride : undefined,
        endiannessOverride,
        maxTraces,
      };
      const dataset = parseSegyBuffer(activeItem.buffer, activeItem.name, options);
      onConfirm(dataset);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b1b30] border border-[#2a9bb0]/40 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0f2139] border-b border-[#2a9bb0]/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-[#2a9bb0]/20 rounded-xl text-[#00f0ff] shadow-sm">
              {isMultiFile ? <Grid className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#e8f4f8] flex items-center gap-2.5">
                <span>{isMultiFile ? 'Multi-File 2D SEG-Y Survey & 3D Constructor' : 'SEG-Y Seismic Header & Format Inspector'}</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#1a3d54] text-[#00f0ff] border border-[#2a9bb0]/40 font-bold">
                  {fileItems.length} File{fileItems.length > 1 ? 's' : ''}
                </span>
              </h2>
              <p className="text-xs text-[#8aafc0] mt-0.5">
                {isMultiFile
                  ? 'Parse multiple 2D SEG-Y lines, align spatial coordinates, and synthesize a full 3D seismic volume construct.'
                  : `File: ${activeItem?.name} (${Math.round((activeItem?.buffer.byteLength || 0) / (1024 * 1024) * 10) / 10} MB)`}
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-[#8aafc0] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-File Selector Bar (if multi-file) */}
        {isMultiFile && (
          <div className="px-6 py-2.5 bg-[#061220] border-b border-[#2a9bb0]/25 flex items-center gap-2.5 flex-shrink-0">
            <div className="text-[11px] font-bold text-[#00f0ff] uppercase tracking-wider flex-shrink-0 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Survey Files ({fileItems.length}):
            </div>

            {/* Scroll Left Button */}
            <button
              onClick={() => scrollFiles('left')}
              title="Scroll files left"
              className="p-1 rounded-md bg-[#0b1b30] border border-[#2a9bb0]/30 text-[#8aafc0] hover:text-[#00f0ff] hover:border-[#00f0ff]/50 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scrollable File Chips Container with distinct separated scrollbar */}
            <div
              ref={filesScrollRef}
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
              className="flex items-center gap-2 overflow-x-auto py-1 pb-2.5 custom-scrollbar-x flex-1"
            >
              {fileItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFileIdx(idx)}
                  className={`px-3.5 py-1.5 text-xs rounded-lg font-mono flex items-center gap-2 transition-all flex-shrink-0 whitespace-nowrap ${
                    selectedFileIdx === idx
                      ? 'bg-[#1a3d54] text-[#00f0ff] font-bold border border-[#00f0ff]/60 shadow-md ring-1 ring-[#00f0ff]/30'
                      : 'bg-[#0b1b30] text-[#8aafc0] border border-[#2a9bb0]/20 hover:text-white hover:border-[#2a9bb0]/40'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: LINE_PALETTE[idx % LINE_PALETTE.length] }} />
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-[10px] text-[#8aafc0]">
                    ({Math.round(item.buffer.byteLength / (1024 * 1024) * 10) / 10}MB)
                  </span>
                </button>
              ))}
            </div>

            {/* Scroll Right Button */}
            <button
              onClick={() => scrollFiles('right')}
              title="Scroll files right"
              className="p-1 rounded-md bg-[#0b1b30] border border-[#2a9bb0]/30 text-[#8aafc0] hover:text-[#00f0ff] hover:border-[#00f0ff]/50 transition-colors flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="px-6 py-2 bg-[#0a1628] border-b border-[#2a9bb0]/20 flex items-center gap-2 flex-shrink-0">
          {/* Scroll Left Button */}
          <button
            onClick={() => scrollTabs('left')}
            title="Scroll tabs left"
            className="p-1 rounded-md bg-[#071322] border border-[#2a9bb0]/30 text-[#8aafc0] hover:text-[#00f0ff] hover:border-[#00f0ff]/50 transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Tabs Container with distinct separated scrollbar */}
          <div
            ref={tabsScrollRef}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-2 overflow-x-auto py-1 pb-2.5 custom-scrollbar-x flex-1 text-xs"
          >
            {isMultiFile && (
              <>
                <button
                  onClick={() => setActiveTab('multiline')}
                  className={`py-2 px-3.5 rounded-lg font-semibold flex items-center gap-2 transition-all whitespace-nowrap text-xs flex-shrink-0 ${
                    activeTab === 'multiline'
                      ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-sm font-bold'
                      : 'text-[#8aafc0] hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Compass className="w-4 h-4 text-[#00f0ff]" /> 2D Survey & 3D Spatial Fence HUD
                </button>

                <button
                  onClick={() => setActiveTab('synthesis')}
                  className={`py-2 px-3.5 rounded-lg font-semibold flex items-center gap-2 transition-all whitespace-nowrap text-xs flex-shrink-0 ${
                    activeTab === 'synthesis'
                      ? 'bg-[#f0a500]/15 text-[#f0a500] border border-[#f0a500]/40 shadow-sm font-bold'
                      : 'text-[#8aafc0] hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-[#f0a500]" /> 3D Volume Synthesizer (IDW)
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-3.5 rounded-lg font-semibold flex items-center gap-2 transition-all whitespace-nowrap text-xs flex-shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-sm font-bold'
                  : 'text-[#8aafc0] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Eye className="w-4 h-4" /> Single Profile Preview
            </button>

            <button
              onClick={() => setActiveTab('text')}
              className={`py-2 px-3.5 rounded-lg font-semibold flex items-center gap-2 transition-all whitespace-nowrap text-xs flex-shrink-0 ${
                activeTab === 'text'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-sm font-bold'
                  : 'text-[#8aafc0] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" /> Text Header
            </button>

            <button
              onClick={() => setActiveTab('binary')}
              className={`py-2 px-3.5 rounded-lg font-semibold flex items-center gap-2 transition-all whitespace-nowrap text-xs flex-shrink-0 ${
                activeTab === 'binary'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-sm font-bold'
                  : 'text-[#8aafc0] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Binary className="w-4 h-4" /> Binary Header
            </button>

            <button
              onClick={() => setActiveTab('traces')}
              className={`py-2 px-3.5 rounded-lg font-semibold flex items-center gap-2 transition-all whitespace-nowrap text-xs flex-shrink-0 ${
                activeTab === 'traces'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-sm font-bold'
                  : 'text-[#8aafc0] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <ListFilter className="w-4 h-4" /> Trace Headers
            </button>

            <button
              onClick={() => setActiveTab('mapping')}
              className={`py-2 px-3.5 rounded-lg font-semibold flex items-center gap-2 transition-all whitespace-nowrap text-xs flex-shrink-0 ${
                activeTab === 'mapping'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-sm font-bold'
                  : 'text-[#8aafc0] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Sliders className="w-4 h-4" /> Byte Overrides
            </button>
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scrollTabs('right')}
            title="Scroll tabs right"
            className="p-1 rounded-md bg-[#071322] border border-[#2a9bb0]/30 text-[#8aafc0] hover:text-[#00f0ff] hover:border-[#00f0ff]/50 transition-colors flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-8">
          {/* TAB 0: 2D SURVEY & 3D SPATIAL FENCE HUD */}
          {activeTab === 'multiline' && isMultiFile && (
            <div className="space-y-6">
              {multiLineSurveyData?.survey ? (
                <>
                  {/* Mode Banner */}
                  <div className="bg-[#0f253d] border border-[#00f0ff]/30 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#00f0ff]/20 text-[#00f0ff] text-[10px] font-bold uppercase tracking-wider border border-[#00f0ff]/40">
                          Recommended Mode
                        </span>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          3D Spatial Multi-Line Fence HUD
                        </h3>
                      </div>
                      <p className="text-xs text-[#8aafc0]">
                        Loads all {fileItems.length} 2D seismic lines at their true spatial positions, orientations, and azimuths in an interactive 3D spatial window without unwanted 3D volume interpolation artifacts.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer bg-[#071322] px-3 py-2 rounded-lg border border-[#2a9bb0]/30 hover:border-[#00f0ff]/50 transition-colors">
                        <input
                          type="radio"
                          name="constructMode"
                          checked={constructMode === '2d_fence'}
                          onChange={() => setConstructMode('2d_fence')}
                          className="accent-[#00f0ff]"
                        />
                        <span className="text-xs font-bold text-[#00f0ff]">3D Spatial Fence HUD</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-[#071322] px-3 py-2 rounded-lg border border-[#2a9bb0]/30 hover:border-[#f0a500]/50 transition-colors">
                        <input
                          type="radio"
                          name="constructMode"
                          checked={constructMode === '3d_cube'}
                          onChange={() => setConstructMode('3d_cube')}
                          className="accent-[#f0a500]"
                        />
                        <span className="text-xs font-bold text-[#f0a500]">3D Interpolated Cube</span>
                      </label>
                    </div>
                  </div>

                  {/* Survey Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/25">
                      <span className="text-[10px] uppercase font-bold text-[#8aafc0]">Survey Profiles</span>
                      <div className="text-lg font-bold font-mono text-[#00f0ff] mt-0.5">
                        {multiLineSurveyData.survey.lines.length} Lines
                      </div>
                      <span className="text-[10px] text-[#8aafc0]">
                        {multiLineSurveyData.survey.lines.reduce((acc, l) => acc + l.dataset.nTraces, 0).toLocaleString()} Total Traces
                      </span>
                    </div>

                    <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/25">
                      <span className="text-[10px] uppercase font-bold text-[#8aafc0]">Cross-Tie Points</span>
                      <div className="text-lg font-bold font-mono text-[#2ecc71] mt-0.5">
                        {multiLineSurveyData.survey.intersections.length} Intersections
                      </div>
                      <span className="text-[10px] text-[#8aafc0]">Auto-aligned profiles</span>
                    </div>

                    <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/25">
                      <span className="text-[10px] uppercase font-bold text-[#8aafc0]">Coordinate Bounds</span>
                      <div className="text-xs font-bold font-mono text-[#f0a500] mt-1 truncate">
                        {multiLineSurveyData.survey.bounds.minX}m - {multiLineSurveyData.survey.bounds.maxX}m
                      </div>
                      <span className="text-[10px] text-[#8aafc0] font-mono">
                        Y: {multiLineSurveyData.survey.bounds.minY}m - {multiLineSurveyData.survey.bounds.maxY}m
                      </span>
                    </div>

                    <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/25">
                      <span className="text-[10px] uppercase font-bold text-[#8aafc0]">Sample Extent</span>
                      <div className="text-lg font-bold font-mono text-[#e8f4f8] mt-0.5">
                        {multiLineSurveyData.survey.nSamples} S / {multiLineSurveyData.survey.sampleRate} ms
                      </div>
                      <span className="text-[10px] text-[#8aafc0]">
                        0 - {multiLineSurveyData.survey.bounds.maxT} ms TWT
                      </span>
                    </div>
                  </div>

                  {/* 2D Line Table & Basemap */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left: Line Details List */}
                    <div className="bg-[#0f2139] border border-[#2a9bb0]/25 rounded-xl p-4 space-y-2.5 max-h-80 overflow-y-auto">
                      <div className="text-xs font-bold text-[#e8f4f8] uppercase tracking-wider flex items-center justify-between">
                        <span>Profile Orientations</span>
                        <span className="text-[10px] text-[#8aafc0] font-normal">Azimuth & Length</span>
                      </div>
                      <div className="space-y-1.5">
                        {multiLineSurveyData.survey.lines.map((line, idx) => (
                          <div
                            key={line.id}
                            className="p-2 bg-[#071322] border border-[#2a9bb0]/20 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: line.color }}
                              />
                              <div className="truncate max-w-[140px]">
                                <div className="font-bold text-[#e8f4f8] truncate">{line.name}</div>
                                <div className="text-[10px] text-[#8aafc0] font-mono">{line.dataset.nTraces} Traces</div>
                              </div>
                            </div>
                            <div className="text-right font-mono text-[10px]">
                              <div className="text-[#00f0ff] font-bold">{line.azimuthDeg}° Az</div>
                              <div className="text-[#8aafc0]">{(line.lengthM / 1000).toFixed(1)} km</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Interactive Basemap */}
                    <div className="lg:col-span-2">
                      <MultiLineSurveyBasemap survey={multiLineSurveyData.survey} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 bg-[#0f2139] border border-red-500/30 rounded-xl text-center">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <div className="text-sm font-bold text-red-400">Failed to Parse Multi-Line Survey</div>
                  <p className="text-xs text-[#8aafc0] mt-1">{multiLineSurveyData?.error}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 0B: OPTIONAL 3D VOLUME SYNTHESIZER */}
          {activeTab === 'synthesis' && isMultiFile && (
            <div className="space-y-6">
              {multiLineSurveyData?.survey ? (
                <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#e8f4f8] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#f0a500]" /> 3D Volume Synthesis Parameters (IDW Grid)
                      </h3>
                      <p className="text-xs text-[#8aafc0] mt-0.5">
                        Synthesizes regular 3D grid nodes using spatial Inverse Distance Weighting across all {fileItems.length} loaded 2D lines.
                      </p>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/40 font-bold">
                      {multiLineSurveyData.survey.intersections.length} Cross-Tie Intersections
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Grid Dimensions */}
                    <div>
                      <label className="text-[11px] text-[#8aafc0] block mb-1">
                        Inlines Grid (Ny)
                      </label>
                      <select
                        value={gridNy}
                        onChange={(e) => setGridNy(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 bg-[#071322] border border-[#2a9bb0]/30 rounded-lg text-xs font-mono text-white"
                      >
                        <option value={24}>24 Inlines (Fast)</option>
                        <option value={32}>32 Inlines (Standard)</option>
                        <option value={48}>48 Inlines (High Detail)</option>
                        <option value={64}>64 Inlines (Ultra-Dense)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#8aafc0] block mb-1">
                        Crosslines Grid (Nx)
                      </label>
                      <select
                        value={gridNx}
                        onChange={(e) => setGridNx(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 bg-[#071322] border border-[#2a9bb0]/30 rounded-lg text-xs font-mono text-white"
                      >
                        <option value={24}>24 Crosslines</option>
                        <option value={32}>32 Crosslines (Standard)</option>
                        <option value={48}>48 Crosslines (High Detail)</option>
                        <option value={64}>64 Crosslines (Ultra-Dense)</option>
                      </select>
                    </div>

                    {/* IDW Power */}
                    <div>
                      <label className="text-[11px] text-[#8aafc0] block mb-1">
                        IDW Distance Power (p): {idwPower}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="0.5"
                        value={idwPower}
                        onChange={(e) => setIdwPower(parseFloat(e.target.value))}
                        className="w-full h-2 bg-[#1a3d54] rounded accent-[#00f0ff]"
                      />
                      <div className="flex justify-between text-[9px] text-[#8aafc0] mt-0.5">
                        <span>1.0 (Diffuse)</span>
                        <span>2.0 (Inverse Sq)</span>
                        <span>4.0 (Sharp)</span>
                      </div>
                    </div>

                    {/* Spatial Smoothing */}
                    <div>
                      <label className="text-[11px] text-[#8aafc0] block mb-1">
                        Spatial 3D Smoothing: {Math.round(spatialSmoothing * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="0.8"
                        step="0.1"
                        value={spatialSmoothing}
                        onChange={(e) => setSpatialSmoothing(parseFloat(e.target.value))}
                        className="w-full h-2 bg-[#1a3d54] rounded accent-[#2ecc71]"
                      />
                      <div className="flex justify-between text-[9px] text-[#8aafc0] mt-0.5">
                        <span>None</span>
                        <span>Standard (50%)</span>
                        <span>Max Filter</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#2a9bb0]/20 flex items-center justify-between">
                    <p className="text-xs text-[#8aafc0]">
                      Clicking button below will interpolate a dense 3D Seismic Cube for orthogonal slicing.
                    </p>
                    <button
                      onClick={() => setConstructMode('3d_cube')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        constructMode === '3d_cube'
                          ? 'bg-[#00f0ff] text-[#0a1628]'
                          : 'bg-[#1a3d54] text-[#8aafc0] hover:text-white'
                      }`}
                    >
                      {constructMode === '3d_cube' ? '✓ Selected: Construct 3D Cube' : 'Select 3D Cube Mode'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 1: OVERVIEW & GEOMETRY */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {inspection.error ? (
                <div className="p-6 bg-red-950/40 border border-red-500/40 rounded-xl text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                  <h3 className="text-sm font-bold text-red-200">SEG-Y Header Parse Warning</h3>
                  <p className="text-xs text-red-300 max-w-md mx-auto">{inspection.error}</p>
                </div>
              ) : insp ? (
                <>
                  {/* Geometry Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/25">
                      <span className="text-[10px] uppercase font-bold text-[#8aafc0]">Detected Geometry</span>
                      <div className="text-base font-bold font-mono text-[#00f0ff] mt-1">
                        {insp.detectedType === '2d' ? '2D Seismic Profile' : '3D Seismic Volume'}
                      </div>
                      <span className="text-[10px] text-[#8aafc0]">
                        {insp.detectedType === '2d' ? 'Single Line Transect' : `${insp.uniqueInlines.length} IL × ${insp.uniqueCrosslines.length} XL`}
                      </span>
                    </div>

                    <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/25">
                      <span className="text-[10px] uppercase font-bold text-[#8aafc0]">Total Traces</span>
                      <div className="text-base font-bold font-mono text-[#2ecc71] mt-1">
                        {insp.totalTraces.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-[#8aafc0]">Max import: {maxTraces.toLocaleString()}</span>
                    </div>

                    <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/25">
                      <span className="text-[10px] uppercase font-bold text-[#8aafc0]">Sample Rate (dt)</span>
                      <div className="text-base font-bold font-mono text-[#f0a500] mt-1">
                        {insp.sampleRate} ms
                      </div>
                      <span className="text-[10px] text-[#8aafc0]">{insp.binaryHeader.sampleIntervalUs} µs interval</span>
                    </div>

                    <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/25">
                      <span className="text-[10px] uppercase font-bold text-[#8aafc0]">Format & Endianness</span>
                      <div className="text-base font-bold font-mono text-[#e8f4f8] mt-1 truncate">
                        {insp.binaryHeader.formatDescription.split(' ')[0]}
                      </div>
                      <span className="text-[10px] text-[#8aafc0]">
                        {insp.isLittleEndian ? 'Little-Endian (PC)' : 'Big-Endian (SEG-Y Std)'}
                      </span>
                    </div>
                  </div>

                  {/* Section Visualizer Preview */}
                  <div className="bg-[#0f2139] p-4 rounded-xl border border-[#2a9bb0]/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#e8f4f8] flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#00f0ff]" /> Quick Trace Amplitude Preview (First 120 Traces)
                      </h4>
                      <span className="text-[10px] font-mono text-[#8aafc0]">
                        {insp.nSamples} Samples | TWT {((insp.nSamples - 1) * insp.sampleRate).toFixed(0)} ms
                      </span>
                    </div>

                    <div className="bg-[#071322] rounded-lg p-2 border border-[#2a9bb0]/20 flex justify-center">
                      <canvas
                        ref={previewCanvasRef}
                        width={600}
                        height={180}
                        className="w-full h-[180px] rounded object-fill"
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* TAB 2: 3200-BYTE TEXTUAL HEADER */}
          {activeTab === 'text' && insp && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8aafc0]" />
                  <input
                    type="text"
                    placeholder="Search textual header comments..."
                    value={textSearch}
                    onChange={(e) => setTextSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#071322] border border-[#2a9bb0]/30 rounded-lg text-xs text-white focus:outline-none focus:border-[#00f0ff]"
                  />
                </div>

                <button
                  onClick={handleCopyTextHeader}
                  className="px-3 py-2 bg-[#1a3d54] hover:bg-[#2a9bb0]/30 text-xs font-bold text-[#00f0ff] rounded-lg border border-[#2a9bb0]/40 flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-[#2ecc71]" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy Header'}</span>
                </button>
              </div>

              <div className="bg-[#050c17] p-4 rounded-xl border border-[#2a9bb0]/30 font-mono text-[11px] text-[#2ecc71] h-80 overflow-y-auto leading-relaxed select-text space-y-0.5">
                {insp.textHeader.split('\n').map((line, idx) => {
                  const isMatch = textSearch && line.toLowerCase().includes(textSearch.toLowerCase());
                  return (
                    <div
                      key={idx}
                      className={`whitespace-pre px-1 rounded ${
                        isMatch ? 'bg-[#f0a500]/30 text-white font-bold' : ''
                      }`}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: 400-BYTE BINARY HEADER */}
          {activeTab === 'binary' && insp && (
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#071322] text-[#8aafc0] text-[10px] uppercase border-b border-[#2a9bb0]/20">
                  <tr>
                    <th className="p-3">Field Description</th>
                    <th className="p-3">Byte Offset</th>
                    <th className="p-3">Value</th>
                    <th className="p-3">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a9bb0]/10 text-[#e8f4f8]">
                  <tr>
                    <td className="p-3 font-semibold">Sample Interval (dt)</td>
                    <td className="p-3 text-[#8aafc0]">Bytes 17-18</td>
                    <td className="p-3 text-[#00f0ff] font-bold">{insp.binaryHeader.sampleIntervalUs} µs</td>
                    <td className="p-3 text-[#8aafc0]">{insp.sampleRate} ms sampling</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Samples Per Trace (ns)</td>
                    <td className="p-3 text-[#8aafc0]">Bytes 21-22</td>
                    <td className="p-3 text-[#2ecc71] font-bold">{insp.binaryHeader.nSamples}</td>
                    <td className="p-3 text-[#8aafc0]">{insp.nSamples} time/depth points</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Data Sample Format Code</td>
                    <td className="p-3 text-[#8aafc0]">Bytes 25-26</td>
                    <td className="p-3 text-[#f0a500] font-bold">{insp.binaryHeader.formatCode}</td>
                    <td className="p-3 text-[#8aafc0]">{insp.binaryHeader.formatDescription}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">CDP Fold Coverage</td>
                    <td className="p-3 text-[#8aafc0]">Bytes 27-28</td>
                    <td className="p-3 font-bold">{insp.binaryHeader.cdpFold}</td>
                    <td className="p-3 text-[#8aafc0]">Ensemble fold</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Trace Sorting Code</td>
                    <td className="p-3 text-[#8aafc0]">Bytes 29-30</td>
                    <td className="p-3 font-bold">{insp.binaryHeader.traceSorting}</td>
                    <td className="p-3 text-[#8aafc0]">
                      {insp.binaryHeader.traceSorting === 2 ? 'CDP Ensemble' : 'As Recorded'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">SEG-Y Format Revision</td>
                    <td className="p-3 text-[#8aafc0]">Bytes 301-302</td>
                    <td className="p-3 font-bold">{insp.binaryHeader.segRev}</td>
                    <td className="p-3 text-[#8aafc0]">
                      {insp.binaryHeader.segRev === 256 ? 'SEG-Y rev 1.0' : 'SEG-Y rev 0'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: SAMPLE TRACE HEADERS */}
          {activeTab === 'traces' && insp && (
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl overflow-hidden shadow-lg">
              <div className="p-3 bg-[#071322] border-b border-[#2a9bb0]/20 flex items-center justify-between text-xs">
                <span className="font-bold text-[#8aafc0] uppercase tracking-wider">
                  First {insp.sampleTraceHeaders.length} Trace Headers (240 Bytes Each)
                </span>
                <span className="text-[10px] text-[#00f0ff] font-mono">
                  Total Traces: {insp.totalTraces.toLocaleString()}
                </span>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-[#0a1628] text-[#8aafc0] text-[10px] uppercase sticky top-0">
                    <tr>
                      <th className="p-2.5">Tr#</th>
                      <th className="p-2.5">CDP</th>
                      <th className="p-2.5">SP</th>
                      <th className="p-2.5">Inline</th>
                      <th className="p-2.5">X-Line</th>
                      <th className="p-2.5">CDP X</th>
                      <th className="p-2.5">CDP Y</th>
                      <th className="p-2.5">Offset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a9bb0]/10 text-[#e8f4f8]">
                    {insp.sampleTraceHeaders.map((th, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="p-2.5 font-bold text-[#00f0ff]">{th.traceNumber}</td>
                        <td className="p-2.5 text-[#2ecc71]">{th.cdp}</td>
                        <td className="p-2.5">{th.shotPoint || '-'}</td>
                        <td className="p-2.5">{th.inline || '-'}</td>
                        <td className="p-2.5">{th.crossline || '-'}</td>
                        <td className="p-2.5 text-[#8aafc0]">{Math.round(th.cdpX)}</td>
                        <td className="p-2.5 text-[#8aafc0]">{Math.round(th.cdpY)}</td>
                        <td className="p-2.5">{th.offset}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HEADER BYTE OVERRIDES & CUSTOM MAPPINGS */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#0f2139] rounded-xl border border-[#2a9bb0]/30 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00f0ff] flex items-center gap-2">
                  <Sliders className="w-4 h-4" /> Header Byte Location Customizer
                </h3>
                <p className="text-xs text-[#8aafc0]">
                  Override byte positions for non-standard SEG-Y formats or custom navigation headers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#071322] p-4 rounded-xl border border-[#2a9bb0]/20 space-y-3">
                  <h4 className="text-xs font-bold text-[#00f0ff] uppercase tracking-wider">3D Volume Header Offsets</h4>
                  <div>
                    <label className="text-[11px] text-[#8aafc0] block mb-1">Inline Byte Offset</label>
                    <input
                      type="number"
                      value={inlineByte}
                      onChange={(e) => setInlineByte(parseInt(e.target.value, 10) || 189)}
                      className="w-full px-3 py-1.5 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded text-xs font-mono text-white focus:outline-none focus:border-[#00f0ff]"
                    />
                    <span className="text-[10px] text-[#8aafc0]">Standard byte 189 (4-byte integer)</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#8aafc0] block mb-1">Crossline Byte Offset</label>
                    <input
                      type="number"
                      value={crosslineByte}
                      onChange={(e) => setCrosslineByte(parseInt(e.target.value, 10) || 193)}
                      className="w-full px-3 py-1.5 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded text-xs font-mono text-white focus:outline-none focus:border-[#00f0ff]"
                    />
                    <span className="text-[10px] text-[#8aafc0]">Standard byte 193 (4-byte integer)</span>
                  </div>
                </div>

                <div className="bg-[#071322] p-4 rounded-xl border border-[#2a9bb0]/20 space-y-3">
                  <h4 className="text-xs font-bold text-[#2ecc71] uppercase tracking-wider">2D / CMP Header Offsets</h4>
                  <div>
                    <label className="text-[11px] text-[#8aafc0] block mb-1">CDP Ensemble Byte Offset</label>
                    <input
                      type="number"
                      value={cdpByte}
                      onChange={(e) => setCdpByte(parseInt(e.target.value, 10) || 21)}
                      className="w-full px-3 py-1.5 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded text-xs font-mono text-white focus:outline-none focus:border-[#2ecc71]"
                    />
                    <span className="text-[10px] text-[#8aafc0]">Standard byte 21 (4-byte integer)</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#8aafc0] block mb-1">Shot Point (SP) Byte Offset</label>
                    <input
                      type="number"
                      value={spByte}
                      onChange={(e) => setSpByte(parseInt(e.target.value, 10) || 17)}
                      className="w-full px-3 py-1.5 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded text-xs font-mono text-white focus:outline-none focus:border-[#2ecc71]"
                    />
                    <span className="text-[10px] text-[#8aafc0]">Standard byte 17 (4-byte integer)</span>
                  </div>
                </div>

                <div className="bg-[#071322] p-4 rounded-xl border border-[#2a9bb0]/20 space-y-3">
                  <h4 className="text-xs font-bold text-[#f0a500] uppercase tracking-wider">Format & Trace Limit</h4>
                  <div>
                    <label className="text-[11px] text-[#8aafc0] block mb-1">Sample Format Override</label>
                    <select
                      value={formatOverride}
                      onChange={(e) => setFormatOverride(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-1.5 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded text-xs text-white focus:outline-none focus:border-[#f0a500]"
                    >
                      <option value={0}>Auto-detect from binary header</option>
                      <option value={1}>1 — IBM 32-bit Floating Point</option>
                      <option value={5}>5 — IEEE 32-bit Floating Point</option>
                      <option value={3}>3 — 16-bit Integer</option>
                      <option value={2}>2 — 32-bit Integer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#8aafc0] block mb-1">Max Traces to Load</label>
                    <input
                      type="number"
                      step="500"
                      value={maxTraces}
                      onChange={(e) => setMaxTraces(Math.max(100, parseInt(e.target.value, 10) || 1000))}
                      className="w-full px-3 py-1.5 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded text-xs font-mono text-white focus:outline-none focus:border-[#f0a500]"
                    />
                    <span className="text-[10px] text-[#8aafc0]">Trace memory limit</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#0f2139] border-t border-[#2a9bb0]/30 flex items-center justify-between">
          <div className="text-xs text-[#8aafc0] flex items-center gap-2">
            <span>Import Target:</span>
            <span className="font-bold text-white font-mono bg-[#071322] px-2.5 py-1 rounded border border-[#2a9bb0]/30">
              {isMultiFile && constructMode === '3d_cube'
                ? '🧊 Synthesize 3D Seismic Cube (IDW Grid)'
                : isMultiFile && constructMode === '2d_fence'
                ? '📈 2D Multi-Line Fence Survey'
                : (datasetMode === '2d' || (datasetMode === 'auto' && insp?.detectedType === '2d'))
                ? '📈 2D Seismic Line'
                : '🧊 3D Seismic Cube'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-transparent hover:bg-white/10 text-xs font-semibold text-[#8aafc0] rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleExecuteImport}
              disabled={!insp && !multiLineSurveyData?.survey}
              className="px-6 py-2 bg-[#2ecc71] hover:bg-[#27ae60] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isMultiFile && constructMode === '3d_cube'
                ? `Construct ${gridNy}×${gridNx} 3D Volume`
                : 'Load Seismic Dataset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
