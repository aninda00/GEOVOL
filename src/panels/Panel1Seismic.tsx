import React, { useState } from 'react';
import { SeismicDataset, HorizonSuggestion, WellData } from '../types';
import { suggestHorizons } from '../modules/seismicEngine';
import { SeismicSectionCanvas } from '../components/SeismicSectionCanvas';
import { SpectrumChart } from '../components/SpectrumChart';
import { SegyImportModal, SegyFileItem } from '../components/SegyImportModal';
import { Interactive3DSeismicWindow } from '../components/Interactive3DSeismicWindow';
import { MultiLineSurveyBasemap } from '../components/MultiLineSurveyBasemap';
import {
  UploadCloud,
  ChevronRight,
  Info,
  Box,
  MapPin,
  Eye,
  FileCheck,
  FolderOpen,
  Activity,
  Layers,
} from 'lucide-react';

interface Panel1SeismicProps {
  cube: SeismicDataset | null;
  onCubeLoaded: (dataset: SeismicDataset) => void;
  onNavigateNext: () => void;
  wells?: WellData[];
}

export const Panel1Seismic: React.FC<Panel1SeismicProps> = ({
  cube,
  onCubeLoaded,
  onNavigateNext,
  wells = [],
}) => {
  const [mainViewMode, setMainViewMode] = useState<'section' | '3d-window' | 'basemap'>('section');
  const [sliceType, setSliceType] = useState<'inline' | 'crossline' | 'timeslice' | '2d-line'>('2d-line');
  const [sliceIdx, setSliceIdx] = useState<number>(16);
  const [colorMap, setColorMap] = useState<'RdBu' | 'Gray' | 'Seismic' | 'Thermal' | 'Rainbow'>('RdBu');
  const [gain, setGain] = useState<number>(1.0);
  const [displayMode, setDisplayMode] = useState<'density' | 'wiggle' | 'both'>('density');
  const [showTextHeader, setShowTextHeader] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // 2D Trace Zoom Range
  const [traceRangeStart, setTraceRangeStart] = useState<number>(0);
  const [traceRangeEnd, setTraceRangeEnd] = useState<number>(400);

  // SEG-Y Upload Modal State (Single or Multiple files)
  const [uploadFiles, setUploadFiles] = useState<SegyFileItem[]>([]);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Selected line for Multi-Line Basemap
  const [selectedSurveyLineId, setSelectedSurveyLineId] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<HorizonSuggestion[]>(() => {
    if (cube) {
      return suggestHorizons(cube, cube.sampleRate, 8).suggestions;
    }
    return [];
  });

  const processFileList = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setErrorMessage(null);

    const items: SegyFileItem[] = [];
    const readPromises: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const p = new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const buffer = evt.target?.result as ArrayBuffer;
          if (buffer) {
            items.push({ file, buffer, name: file.name });
          }
          resolve();
        };
        reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
        reader.readAsArrayBuffer(file);
      });
      readPromises.push(p);
    }

    try {
      await Promise.all(readPromises);
      if (items.length > 0) {
        setUploadFiles(items);
        setShowImportModal(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error reading uploaded SEG-Y files.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFileList(e.target.files);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileList(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleConfirmImport = (dataset: SeismicDataset) => {
    setShowImportModal(false);
    onCubeLoaded(dataset);
    setSuggestions(suggestHorizons(dataset, dataset.sampleRate, 8).suggestions);
    if (dataset.type === '2d') {
      setSliceType('2d-line');
      setMainViewMode('section');
      setTraceRangeStart(0);
      setTraceRangeEnd(dataset.nTraces);
      if (dataset.multiLineSurvey?.lines[0]) {
        setSelectedSurveyLineId(dataset.multiLineSurvey.lines[0].id);
      }
    } else {
      setSliceType('inline');
      setMainViewMode('3d-window');
      setSliceIdx(Math.floor(dataset.nInlines / 2));
    }
  };

  const handleSelectLine = (lineId: string) => {
    if (!cube?.multiLineSurvey) return;
    const lineInfo = cube.multiLineSurvey.lines.find((l) => l.id === lineId || l.name === lineId);
    if (!lineInfo) return;

    setSelectedSurveyLineId(lineInfo.id);

    const lineDataset: SeismicDataset = {
      ...lineInfo.dataset,
      multiLineSurvey: cube.multiLineSurvey,
    };
    onCubeLoaded(lineDataset);
    setSuggestions(suggestHorizons(lineDataset, lineDataset.sampleRate, 8).suggestions);
    setSliceType('2d-line');
    setTraceRangeStart(0);
    setTraceRangeEnd(lineDataset.nTraces);
  };

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔬</span>
              <h2 className="text-xl font-bold text-[#e8f4f8]">
                Panel 1 — Seismic Interpretation Workbench
              </h2>
              {cube && (
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    cube.type === '2d'
                      ? 'bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/40'
                      : 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40'
                  }`}
                >
                  {cube.type === '2d'
                    ? cube.multiLineSurvey
                      ? `🌐 ${cube.multiLineSurvey.lines.length}-LINE 2D SURVEY`
                      : '📈 2D SEISMIC PROFILE'
                    : '🧊 3D SEISMIC VOLUME'}
                </span>
              )}
            </div>
            <p className="text-sm text-[#8aafc0] mt-1">
              Petrel-grade seismic workspace: upload and inspect single or multi-line SEG-Y datasets, QC trace headers, examine seismic profiles, and track horizon candidate reflectors.
            </p>
          </div>

          {cube && (
            <button
              onClick={onNavigateNext}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer"
            >
              Proceed to Horizon Tracking <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SEG-Y Data Import & Management Section */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#00f0ff]" />
            <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider">
              SEG-Y Seismic Dataset Source
            </h3>
          </div>

          {cube && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8aafc0] hidden sm:inline">Active File:</span>
              <span className="text-xs font-mono font-bold text-[#00f0ff] bg-[#071322] px-2.5 py-1 rounded border border-[#2a9bb0]/30 truncate max-w-xs">
                {cube.name}
              </span>
            </div>
          )}
        </div>

        {/* Drag & Drop / File Select Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-6 rounded-xl border-2 border-dashed transition-all text-center ${
            isDragging
              ? 'bg-[#1a3d54]/80 border-[#00f0ff] scale-[1.005]'
              : 'bg-[#071322] border-[#2a9bb0]/40 hover:border-[#2a9bb0]'
          }`}
        >
          <input
            type="file"
            multiple
            accept=".sgy,.segy"
            id="segy-upload-main"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center text-[#00f0ff]">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div>
              <label
                htmlFor="segy-upload-main"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg cursor-pointer transition-all shadow-md active:scale-95"
              >
                <UploadCloud className="w-4 h-4" /> Browse SEG-Y Files (.sgy / .segy)
              </label>
              <p className="text-xs text-[#8aafc0] mt-2">
                or drag and drop single or multiple 2D/3D SEG-Y files here
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#8aafc0] pt-1">
              <span className="flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-[#2ecc71]" /> IEEE & IBM Float Support
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#00f0ff]" /> Multi-Line 2D Survey Parser
              </span>
              <span className="flex items-center gap-1">
                <Box className="w-3.5 h-3.5 text-[#f0a500]" /> 3D Volume Slices
              </span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-xs text-red-300">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>

      {/* Dataset Metrics Bar (if dataset loaded) */}
      {cube && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Dataset Type</div>
              <div className="text-base font-bold font-mono text-[#2ecc71] mt-0.5">
                {cube.type === '2d' ? '2D Line' : '3D Volume'}
              </div>
              <div className="text-[10px] text-[#8aafc0]">
                {cube.type === '2d'
                  ? cube.multiLineSurvey
                    ? `${cube.multiLineSurvey.lines.length}-Line Survey`
                    : 'Single Profile'
                  : `${cube.nInlines}×${cube.nCrosslines} Grid`}
              </div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">
                {cube.type === '2d' ? 'Total Traces' : 'Inlines'}
              </div>
              <div className="text-lg font-bold font-mono text-[#00f0ff] mt-0.5">
                {cube.type === '2d' ? cube.nTraces : cube.nInlines}
              </div>
              <div className="text-[10px] text-[#8aafc0]">
                {cube.type === '2d' ? 'CMP / SP' : `(${cube.ilines[0]} - ${cube.ilines[cube.nInlines - 1]})`}
              </div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">
                {cube.type === '2d' ? 'Along-Line Length' : 'Crosslines'}
              </div>
              <div className="text-lg font-bold font-mono text-[#00f0ff] mt-0.5">
                {cube.type === '2d' ? `${(cube.nTraces * 0.025).toFixed(1)} km` : cube.nCrosslines}
              </div>
              <div className="text-[10px] text-[#8aafc0]">
                {cube.type === '2d' ? 'at 25m spacing' : `(${cube.xlines[0]} - ${cube.xlines[cube.nCrosslines - 1]})`}
              </div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Sample Interval (dt)</div>
              <div className="text-lg font-bold font-mono text-[#f0a500] mt-0.5">{cube.sampleRate} ms</div>
              <div className="text-[10px] text-[#8aafc0]">Nyquist {Math.round(500 / cube.sampleRate)} Hz</div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Samples / Trace</div>
              <div className="text-lg font-bold font-mono text-[#e8f4f8] mt-0.5">{cube.nSamples}</div>
              <div className="text-[10px] text-[#8aafc0]">vertical samples</div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Total TWT Window</div>
              <div className="text-lg font-bold font-mono text-[#2ecc71] mt-0.5">{Math.round(cube.totalTimeMs)} ms</div>
              <div className="text-[10px] text-[#8aafc0]">{cube.ramMb} MB RAM</div>
            </div>
          </div>

          {/* Master View Mode Selector */}
          <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#8aafc0] uppercase">Viewport Display:</span>
              <div className="flex bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/30 text-xs">
                <button
                  onClick={() => setMainViewMode('section')}
                  className={`px-3.5 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-all ${
                    mainViewMode === 'section'
                      ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                      : 'text-[#8aafc0] hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" /> 2D Section Slice
                </button>
                <button
                  onClick={() => setMainViewMode('3d-window')}
                  className={`px-3.5 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-all ${
                    mainViewMode === '3d-window'
                      ? 'bg-[#00f0ff] text-[#0a1628] shadow'
                      : 'text-[#8aafc0] hover:text-white'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" /> Interactive 3D Window
                </button>
                {cube.multiLineSurvey && (
                  <button
                    onClick={() => setMainViewMode('basemap')}
                    className={`px-3.5 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-all ${
                      mainViewMode === 'basemap'
                        ? 'bg-[#f0a500] text-[#0a1628] shadow'
                        : 'text-[#8aafc0] hover:text-white'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" /> 2D Survey Basemap
                  </button>
                )}
              </div>
            </div>

            {/* Quick Slicing Plane controls (for 3D mode) */}
            {mainViewMode === 'section' && cube.type === '3d' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#8aafc0]">Slice Plane:</span>
                <select
                  value={sliceType}
                  onChange={(e) => setSliceType(e.target.value as any)}
                  className="bg-[#071322] border border-[#2a9bb0]/30 rounded px-2.5 py-1 text-xs text-[#00f0ff]"
                >
                  <option value="inline">Inline (IL)</option>
                  <option value="crossline">Crossline (XL)</option>
                  <option value="timeslice">Time Slice (Z)</option>
                </select>
                <input
                  type="range"
                  min="0"
                  max={
                    sliceType === 'inline'
                      ? cube.nInlines - 1
                      : sliceType === 'crossline'
                      ? cube.nCrosslines - 1
                      : cube.nSamples - 1
                  }
                  value={sliceIdx}
                  onChange={(e) => setSliceIdx(parseInt(e.target.value, 10))}
                  className="w-28 h-1.5 bg-[#1a3d54] rounded accent-[#2a9bb0]"
                />
                <span className="font-mono text-xs text-[#00f0ff] w-10 text-right">#{sliceIdx}</span>
              </div>
            )}
          </div>

          {/* MAIN VIEWPORT DISPLAY */}
          {mainViewMode === '3d-window' && (
            <Interactive3DSeismicWindow
              cube={cube}
              survey={cube.multiLineSurvey}
              initialHeight={540}
            />
          )}

          {mainViewMode === 'basemap' && cube.multiLineSurvey && (
            <MultiLineSurveyBasemap
              survey={cube.multiLineSurvey}
              selectedLineId={selectedSurveyLineId}
              wells={wells}
              onSelectLine={(id) => {
                setSelectedSurveyLineId(id);
                handleSelectLine(id);
              }}
            />
          )}

          {mainViewMode === 'section' && (
            <SeismicSectionCanvas
              cube={cube}
              sliceType={cube.type === '2d' ? '2d-line' : sliceType}
              sliceIndex={sliceIdx}
              colorMap={colorMap}
              gain={gain}
              displayMode={displayMode}
              traceRange={cube.type === '2d' ? [traceRangeStart, traceRangeEnd] : undefined}
              onSelect2DLine={handleSelectLine}
              selectedLineId={selectedSurveyLineId}
            />
          )}

          {/* Quality Control Spectrum & Suggested Reflectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amplitude & Frequency Spectrum */}
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Average Amplitude & Frequency Spectrum
                </h4>
                <span className="text-[10px] text-[#8aafc0]">Mean Trace Power & Envelope</span>
              </div>
              <SpectrumChart
                meanTrace={cube.meanTrace || []}
                envelope={cube.envelope}
                sampleRate={cube.sampleRate}
                suggestions={suggestions}
              />
            </div>

            {/* Auto-Detected Reflectors & Horizon Suggestions */}
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Auto-Detected Reflector Candidates ({suggestions.length})
                </h4>
                <span className="text-[10px] text-[#8aafc0]">Peak Energy Boundaries</span>
              </div>

              {suggestions.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {suggestions.slice(0, 5).map((sug, idx) => (
                    <div
                      key={idx}
                      className="bg-[#071322] border border-[#2a9bb0]/20 rounded-lg p-2.5 flex items-center justify-between text-xs hover:border-[#2a9bb0]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            sug.amplitude >= 0 ? 'bg-[#2ecc71]' : 'bg-[#e74c3c]'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-[#e8f4f8]">
                            Reflector Candidate #{idx + 1}
                          </div>
                          <div className="text-[10px] text-[#8aafc0]">
                            TWT: <span className="font-mono text-[#00f0ff]">{Math.round(sug.timeMs)} ms</span> (Sample #{sug.sample})
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-[#2ecc71]">
                          Amp: {sug.amplitude > 0 ? `+${sug.amplitude.toFixed(2)}` : sug.amplitude.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#8aafc0]">
                          Conf: {Math.round(sug.confidence)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#8aafc0]">
                  No reflector suggestions detected. Load or import a seismic dataset.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* SEG-Y Import Modal */}
      {showImportModal && uploadFiles.length > 0 && (
        <SegyImportModal
          files={uploadFiles}
          onCancel={() => {
            setShowImportModal(false);
            setUploadFiles([]);
          }}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  );
};
