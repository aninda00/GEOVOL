import React, { useState } from 'react';
import { SeismicDataset, HorizonSuggestion } from '../types';
import {
  generateSyntheticCube,
  generateSynthetic2DLine,
  suggestHorizons,
  GEOLOGICAL_PRESETS_3D,
  GEOLOGICAL_PRESETS_2D,
} from '../modules/seismicEngine';
import { SeismicSectionCanvas } from '../components/SeismicSectionCanvas';
import { SpectrumChart } from '../components/SpectrumChart';
import { SegyImportModal } from '../components/SegyImportModal';
import {
  UploadCloud,
  Database,
  Sparkles,
  Sliders,
  FileText,
  Activity,
  Layers,
  ChevronRight,
  Info,
  TrendingUp,
  Cpu,
  Compass,
} from 'lucide-react';

interface Panel1SeismicProps {
  cube: SeismicDataset | null;
  onCubeLoaded: (dataset: SeismicDataset) => void;
  onNavigateNext: () => void;
}

export const Panel1Seismic: React.FC<Panel1SeismicProps> = ({
  cube,
  onCubeLoaded,
  onNavigateNext,
}) => {
  const [loadCategory, setLoadCategory] = useState<'3d-demo' | '2d-demo' | 'presets' | 'upload'>('2d-demo');
  const [sliceType, setSliceType] = useState<'inline' | 'crossline' | 'timeslice' | '2d-line'>('2d-line');
  const [sliceIdx, setSliceIdx] = useState<number>(16);
  const [colorMap, setColorMap] = useState<'RdBu' | 'Gray' | 'Seismic' | 'Thermal' | 'Rainbow'>('RdBu');
  const [gain, setGain] = useState<number>(1.0);
  const [displayMode, setDisplayMode] = useState<'density' | 'wiggle' | 'both'>('density');
  const [showTextHeader, setShowTextHeader] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 2D Trace Zoom Range
  const [traceRangeStart, setTraceRangeStart] = useState<number>(0);
  const [traceRangeEnd, setTraceRangeEnd] = useState<number>(400);

  // SEG-Y Upload Modal State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBuffer, setUploadBuffer] = useState<ArrayBuffer | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<HorizonSuggestion[]>(() => {
    if (cube) {
      return suggestHorizons(cube, cube.sampleRate, 8).suggestions;
    }
    return [];
  });

  const handleGenerate2D = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      try {
        const dataset = generateSynthetic2DLine(400, 1000, 4.0, 'Synthetic 2D Regional Profile (Line-201)');
        onCubeLoaded(dataset);
        setSuggestions(suggestHorizons(dataset, dataset.sampleRate, 8).suggestions);
        setSliceType('2d-line');
        setTraceRangeStart(0);
        setTraceRangeEnd(dataset.nTraces);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to generate 2D seismic line');
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };

  const handleGenerate3D = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      try {
        const newCube = generateSyntheticCube(32, 32, 1000, 4.0, 'Synthetic Reservoir 3D Cube');
        onCubeLoaded(newCube);
        setSuggestions(suggestHorizons(newCube, newCube.sampleRate, 8).suggestions);
        setSliceType('inline');
        setSliceIdx(Math.floor(newCube.nInlines / 2));
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to generate 3D synthetic volume');
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };

  const handleSelectPreset3D = (preset: typeof GEOLOGICAL_PRESETS_3D[0]) => {
    setIsLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      try {
        const dataset = generateSyntheticCube(
          preset.nInlines,
          preset.nCrosslines,
          preset.nSamples,
          preset.sampleRate,
          preset.name
        );
        onCubeLoaded(dataset);
        setSuggestions(suggestHorizons(dataset, dataset.sampleRate, 8).suggestions);
        setSliceType('inline');
        setSliceIdx(Math.floor(dataset.nInlines / 2));
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load 3D preset');
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };

  const handleSelectPreset2D = (preset: typeof GEOLOGICAL_PRESETS_2D[0]) => {
    setIsLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      try {
        const dataset = generateSynthetic2DLine(
          preset.nTraces,
          preset.nSamples,
          preset.sampleRate,
          preset.name
        );
        onCubeLoaded(dataset);
        setSuggestions(suggestHorizons(dataset, dataset.sampleRate, 8).suggestions);
        setSliceType('2d-line');
        setTraceRangeStart(0);
        setTraceRangeEnd(dataset.nTraces);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load 2D preset');
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        setUploadFile(file);
        setUploadBuffer(buffer);
        setShowImportModal(true);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to read SEG-Y file.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Error reading file from disk.');
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = (dataset: SeismicDataset) => {
    setShowImportModal(false);
    onCubeLoaded(dataset);
    setSuggestions(suggestHorizons(dataset, dataset.sampleRate, 8).suggestions);
    if (dataset.type === '2d') {
      setSliceType('2d-line');
      setTraceRangeStart(0);
      setTraceRangeEnd(dataset.nTraces);
    } else {
      setSliceType('inline');
      setSliceIdx(Math.floor(dataset.nInlines / 2));
    }
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
                Panel 1 — Seismic Interpretation Workbench & SEG-Y Loader
              </h2>
              {cube && (
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    cube.type === '2d'
                      ? 'bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/40'
                      : 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40'
                  }`}
                >
                  {cube.type === '2d' ? '📈 2D SEISMIC LINE' : '🧊 3D SEISMIC CUBE'}
                </span>
              )}
            </div>
            <p className="text-sm text-[#8aafc0] mt-1">
              Petrel-grade open-source seismic workbench: load 2D lines & 3D volumes, inspect EBCDIC/trace headers, apply AGC/gain, and analyze frequency spectra.
            </p>
          </div>

          {cube && (
            <button
              onClick={onNavigateNext}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md"
            >
              Proceed to Horizon Tracking <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loader Controls */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4" /> Select Dataset / Seismic Source
        </h3>

        {/* Source Categories Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <button
            onClick={() => setLoadCategory('2d-demo')}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
              loadCategory === '2d-demo'
                ? 'bg-[#1a3d54] border-[#2ecc71] shadow-md ring-1 ring-[#2ecc71]'
                : 'bg-[#0b1b30] border-[#2a9bb0]/20 hover:border-[#2a9bb0]/40'
            }`}
          >
            <div className="p-2 bg-[#2ecc71]/20 rounded text-[#2ecc71]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-[#e8f4f8]">2D Seismic Profile</div>
              <div className="text-[11px] text-[#8aafc0]">400 CMPs with rollover fault</div>
            </div>
          </button>

          <button
            onClick={() => setLoadCategory('3d-demo')}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
              loadCategory === '3d-demo'
                ? 'bg-[#1a3d54] border-[#00f0ff] shadow-md ring-1 ring-[#00f0ff]'
                : 'bg-[#0b1b30] border-[#2a9bb0]/20 hover:border-[#2a9bb0]/40'
            }`}
          >
            <div className="p-2 bg-[#00f0ff]/20 rounded text-[#00f0ff]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-[#e8f4f8]">3D Volume Cube</div>
              <div className="text-[11px] text-[#8aafc0]">32 IL × 32 XL anticlinal dome</div>
            </div>
          </button>

          <button
            onClick={() => setLoadCategory('presets')}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
              loadCategory === 'presets'
                ? 'bg-[#1a3d54] border-[#f0a500] shadow-md ring-1 ring-[#f0a500]'
                : 'bg-[#0b1b30] border-[#2a9bb0]/20 hover:border-[#2a9bb0]/40'
            }`}
          >
            <div className="p-2 bg-[#f0a500]/20 rounded text-[#f0a500]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-[#e8f4f8]">Geological Presets</div>
              <div className="text-[11px] text-[#8aafc0]">North Sea, GoM & Carbonates</div>
            </div>
          </button>

          <button
            onClick={() => setLoadCategory('upload')}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
              loadCategory === 'upload'
                ? 'bg-[#1a3d54] border-[#2a9bb0] shadow-md ring-1 ring-[#2a9bb0]'
                : 'bg-[#0b1b30] border-[#2a9bb0]/20 hover:border-[#2a9bb0]/40'
            }`}
          >
            <div className="p-2 bg-[#2a9bb0]/20 rounded text-[#2a9bb0]">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-[#e8f4f8]">Import SEG-Y File</div>
              <div className="text-[11px] text-[#8aafc0]">2D line or 3D cube (.sgy/.segy)</div>
            </div>
          </button>
        </div>

        {/* Source Action Section */}
        {loadCategory === '2d-demo' && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#071322] p-4 rounded-lg border border-[#2ecc71]/30">
            <div>
              <div className="text-sm font-bold text-[#2ecc71] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> 2D Regional Seismic Profile Generator
              </div>
              <p className="text-xs text-[#8aafc0] mt-0.5">
                Generates a continuous 400 CMP profile with dipping reflectors, listric growth faulting, bright spots, and realistic noise.
              </p>
            </div>
            <button
              onClick={handleGenerate2D}
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#2ecc71] hover:bg-[#27ae60] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" /> {isLoading ? 'Generating...' : 'Generate 2D Seismic Line'}
            </button>
          </div>
        )}

        {loadCategory === '3d-demo' && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#071322] p-4 rounded-lg border border-[#00f0ff]/30">
            <div>
              <div className="text-sm font-bold text-[#00f0ff] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> 3D Synthetic Reservoir Cube Generator
              </div>
              <p className="text-xs text-[#8aafc0] mt-0.5">
                Generates 32 Inlines × 32 Crosslines × 1000 Samples with anticlinal 3D closure and multiple reservoir targets.
              </p>
            </div>
            <button
              onClick={handleGenerate3D}
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#00f0ff] hover:bg-[#00c8d6] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" /> {isLoading ? 'Generating...' : 'Generate 3D Synthetic Cube'}
            </button>
          </div>
        )}

        {loadCategory === 'presets' && (
          <div className="space-y-4 bg-[#071322] p-4 rounded-lg border border-[#f0a500]/30">
            {/* 2D Presets */}
            <div>
              <div className="text-xs font-bold text-[#2ecc71] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>📈</span> 2D Regional Exploration Profiles
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {GEOLOGICAL_PRESETS_2D.map((preset) => (
                  <div
                    key={preset.id}
                    className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-lg p-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#2ecc71] mb-1">{preset.name}</div>
                      <p className="text-[11px] text-[#8aafc0] mb-3 leading-relaxed">{preset.description}</p>
                    </div>
                    <button
                      onClick={() => handleSelectPreset2D(preset)}
                      disabled={isLoading}
                      className="w-full py-1.5 bg-[#162d4c] hover:bg-[#2ecc71] hover:text-[#0a1628] text-[#2ecc71] font-semibold text-xs rounded transition-colors"
                    >
                      Load 2D Profile
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3D Presets */}
            <div className="pt-2 border-t border-[#2a9bb0]/20">
              <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>🧊</span> 3D Field Volumes
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {GEOLOGICAL_PRESETS_3D.map((preset) => (
                  <div
                    key={preset.id}
                    className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-lg p-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#00f0ff] mb-1">{preset.name}</div>
                      <p className="text-[11px] text-[#8aafc0] mb-3 leading-relaxed">{preset.description}</p>
                    </div>
                    <button
                      onClick={() => handleSelectPreset3D(preset)}
                      disabled={isLoading}
                      className="w-full py-1.5 bg-[#162d4c] hover:bg-[#00f0ff] hover:text-[#0a1628] text-[#00f0ff] font-semibold text-xs rounded transition-colors"
                    >
                      Load 3D Cube
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {loadCategory === 'upload' && (
          <div className="bg-[#071322] p-6 rounded-lg border border-dashed border-[#2a9bb0]/40 text-center space-y-3">
            <input
              type="file"
              accept=".sgy,.segy"
              id="segy-upload"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="segy-upload"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg cursor-pointer transition-all shadow-md"
            >
              <UploadCloud className="w-5 h-5" /> Select SEG-Y Binary File (.sgy / .segy)
            </label>
            <p className="text-xs text-[#8aafc0] max-w-md mx-auto">
              Petrel SEG-Y Wizard auto-detects 2D lines vs 3D cubes, decodes IBM 32-bit & IEEE floats, and parses EBCDIC/binary headers.
            </p>
          </div>
        )}

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
                {cube.type === '2d' ? 'Single Profile' : `${cube.nInlines}×${cube.nCrosslines} Grid`}
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

          {/* Slicing Controls depending on 2D vs 3D */}
          <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            {cube.type === '3d' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#8aafc0] uppercase">Slicing Plane:</span>
                  <div className="flex bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/20 text-xs">
                    <button
                      onClick={() => {
                        setSliceType('inline');
                        setSliceIdx(Math.floor(cube.nInlines / 2));
                      }}
                      className={`px-3 py-1 rounded transition-colors ${
                        sliceType === 'inline' ? 'bg-[#2a9bb0] text-[#0a1628] font-bold' : 'text-[#8aafc0] hover:text-white'
                      }`}
                    >
                      Inline (IL)
                    </button>
                    <button
                      onClick={() => {
                        setSliceType('crossline');
                        setSliceIdx(Math.floor(cube.nCrosslines / 2));
                      }}
                      className={`px-3 py-1 rounded transition-colors ${
                        sliceType === 'crossline' ? 'bg-[#2a9bb0] text-[#0a1628] font-bold' : 'text-[#8aafc0] hover:text-white'
                      }`}
                    >
                      Crossline (XL)
                    </button>
                    <button
                      onClick={() => {
                        setSliceType('timeslice');
                        setSliceIdx(Math.floor(cube.nSamples / 2));
                      }}
                      className={`px-3 py-1 rounded transition-colors ${
                        sliceType === 'timeslice' ? 'bg-[#2a9bb0] text-[#0a1628] font-bold' : 'text-[#8aafc0] hover:text-white'
                      }`}
                    >
                      Time Slice (Z)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <span className="text-xs text-[#8aafc0] whitespace-nowrap">
                    {sliceType === 'inline'
                      ? `Inline ${cube.ilines[sliceIdx] || sliceIdx}:`
                      : sliceType === 'crossline'
                      ? `Crossline ${cube.xlines[sliceIdx] || sliceIdx}:`
                      : `TWT ${Math.round(sliceIdx * cube.sampleRate)} ms:`}
                  </span>
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
                    className="flex-1 h-1.5 bg-[#1a3d54] rounded accent-[#2a9bb0]"
                  />
                  <span className="font-mono text-xs text-[#00f0ff] w-12 text-right">
                    {sliceType === 'timeslice' ? `${Math.round(sliceIdx * cube.sampleRate)}ms` : `#${sliceIdx}`}
                  </span>
                </div>
              </>
            ) : (
              /* 2D Line Trace Window Controls */
              <div className="flex flex-wrap items-center justify-between w-full gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#2ecc71] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> 2D Seismic Profile Navigation
                  </span>
                  <span className="text-[#8aafc0]">| Total {cube.nTraces} Traces</span>
                </div>

                {cube.nTraces > 150 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[#8aafc0]">Trace Window:</span>
                    <button
                      onClick={() => {
                        setTraceRangeStart(0);
                        setTraceRangeEnd(cube.nTraces);
                      }}
                      className="px-2 py-1 bg-[#071322] hover:bg-[#162d4c] text-[#00f0ff] rounded border border-[#2a9bb0]/30"
                    >
                      View All ({cube.nTraces})
                    </button>
                    <button
                      onClick={() => {
                        setTraceRangeStart(0);
                        setTraceRangeEnd(Math.min(200, cube.nTraces));
                      }}
                      className="px-2 py-1 bg-[#071322] hover:bg-[#162d4c] text-[#8aafc0] hover:text-white rounded border border-[#2a9bb0]/20"
                    >
                      First 200
                    </button>
                    <button
                      onClick={() => {
                        setTraceRangeStart(Math.max(0, cube.nTraces - 200));
                        setTraceRangeEnd(cube.nTraces);
                      }}
                      className="px-2 py-1 bg-[#071322] hover:bg-[#162d4c] text-[#8aafc0] hover:text-white rounded border border-[#2a9bb0]/20"
                    >
                      Last 200
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seismic Canvas Viewer */}
          <SeismicSectionCanvas
            cube={cube}
            sliceType={cube.type === '2d' ? '2d-line' : sliceType}
            sliceIndex={sliceIdx}
            colorMap={colorMap}
            gain={gain}
            displayMode={displayMode}
            traceRange={cube.type === '2d' ? [traceRangeStart, traceRangeEnd] : undefined}
          />

          {/* Quality Control Spectrum & Suggested Reflectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amplitude & Frequency Spectrum */}
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-3">
              <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4" /> Average Amplitude & Frequency Spectrum
              </h3>
              <SpectrumChart
                meanTrace={cube.meanTrace || []}
                sampleRate={cube.sampleRate}
              />
            </div>

            {/* Candidate Reservoir Horizon Picks */}
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#00f0ff] uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4" /> Auto-Detected Reservoir Horizon Candidates
                </h3>
                <p className="text-xs text-[#8aafc0] mb-3">
                  Key reflective boundaries identified from zone-normalized amplitude envelope:
                </p>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-[#071322] rounded-lg border border-[#2a9bb0]/20 hover:border-[#2a9bb0]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#2a9bb0]/20 text-[#2a9bb0] text-[10px] font-mono font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-[#e8f4f8]">
                            Reflector at {s.timeMs} ms (Sample #{s.sample})
                          </div>
                          <div className="text-[10px] text-[#8aafc0]">
                            Amp: {s.amplitude > 0 ? `+${s.amplitude}` : s.amplitude} | Confidence: {s.confidence}%
                          </div>
                        </div>
                      </div>

                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#162d4c] text-[#00f0ff]">
                        {s.timeMs} ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onNavigateNext}
                className="w-full mt-3 py-2.5 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
              >
                Proceed to Panel 2: Horizon Auto-Tracking <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* SEG-Y Import Wizard Modal */}
      {showImportModal && uploadFile && uploadBuffer && (
        <SegyImportModal
          file={uploadFile}
          buffer={uploadBuffer}
          onConfirm={handleConfirmImport}
          onCancel={() => {
            setShowImportModal(false);
            setUploadFile(null);
            setUploadBuffer(null);
          }}
        />
      )}
    </div>
  );
};
