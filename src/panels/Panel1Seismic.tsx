import React, { useState } from 'react';
import { SeismicCube, HorizonSuggestion } from '../types';
import {
  generateSyntheticCube,
  parseSegyBuffer,
  suggestHorizons,
  GEOLOGICAL_PRESETS,
} from '../modules/seismicEngine';
import { SeismicSectionCanvas } from '../components/SeismicSectionCanvas';
import { SpectrumChart } from '../components/SpectrumChart';
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
} from 'lucide-react';

interface Panel1SeismicProps {
  cube: SeismicCube | null;
  onCubeLoaded: (cube: SeismicCube) => void;
  onNavigateNext: () => void;
}

export const Panel1Seismic: React.FC<Panel1SeismicProps> = ({
  cube,
  onCubeLoaded,
  onNavigateNext,
}) => {
  const [loadMode, setLoadMode] = useState<'demo' | 'preset' | 'upload'>('demo');
  const [sliceType, setSliceType] = useState<'inline' | 'crossline' | 'timeslice'>('inline');
  const [sliceIdx, setSliceIdx] = useState<number>(16);
  const [colorMap, setColorMap] = useState<'RdBu' | 'Gray' | 'Seismic'>('RdBu');
  const [showTextHeader, setShowTextHeader] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<HorizonSuggestion[]>(() => {
    if (cube) {
      return suggestHorizons(cube, cube.sampleRate, 8).suggestions;
    }
    return [];
  });

  const handleGenerateSynthetic = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      try {
        const newCube = generateSyntheticCube(32, 32, 1000, 4.0, 'Synthetic Reservoir Demo');
        onCubeLoaded(newCube);
        setSuggestions(suggestHorizons(newCube, newCube.sampleRate, 8).suggestions);
        setSliceIdx(Math.floor(newCube.nInlines / 2));
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to generate synthetic data');
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };

  const handleSelectPreset = (preset: typeof GEOLOGICAL_PRESETS[0]) => {
    setIsLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      try {
        const newCube = generateSyntheticCube(
          preset.nInlines,
          preset.nCrosslines,
          preset.nSamples,
          preset.sampleRate,
          preset.name
        );
        onCubeLoaded(newCube);
        setSuggestions(suggestHorizons(newCube, newCube.sampleRate, 8).suggestions);
        setSliceIdx(Math.floor(newCube.nInlines / 2));
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load preset');
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
        const parsedCube = parseSegyBuffer(buffer, file.name);
        onCubeLoaded(parsedCube);
        setSuggestions(suggestHorizons(parsedCube, parsedCube.sampleRate, 8).suggestions);
        setSliceIdx(Math.floor(parsedCube.nInlines / 2));
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to parse SEG-Y file. Please ensure it is a valid SEG-Y 3D volume.');
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

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#e8f4f8] flex items-center gap-2">
              <span className="text-2xl">🔬</span> Panel 1 — 3D Seismic Loader & Quality Control
            </h2>
            <p className="text-sm text-[#8aafc0] mt-1">
              Load and inspect 3D seismic volumes, view orthogonal amplitude slices, and scan for key reservoir horizon candidates.
            </p>
          </div>

          {cube && (
            <button
              onClick={onNavigateNext}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md"
            >
              Proceed to Horizon Picking <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loader Controls */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4" /> Select Data Source
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <button
            onClick={() => setLoadMode('demo')}
            className={`flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all ${
              loadMode === 'demo'
                ? 'bg-[#1a3d54] border-[#2a9bb0] shadow-md'
                : 'bg-[#0b1b30] border-[#2a9bb0]/20 hover:border-[#2a9bb0]/40'
            }`}
          >
            <div className="p-2 bg-[#2a9bb0]/20 rounded text-[#2a9bb0]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-[#e8f4f8]">Synthetic Demo Volume</div>
              <div className="text-[11px] text-[#8aafc0]">Anticlinal dome with 7 reflectors</div>
            </div>
          </button>

          <button
            onClick={() => setLoadMode('preset')}
            className={`flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all ${
              loadMode === 'preset'
                ? 'bg-[#1a3d54] border-[#2a9bb0] shadow-md'
                : 'bg-[#0b1b30] border-[#2a9bb0]/20 hover:border-[#2a9bb0]/40'
            }`}
          >
            <div className="p-2 bg-[#f0a500]/20 rounded text-[#f0a500]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-[#e8f4f8]">Geological Presets</div>
              <div className="text-[11px] text-[#8aafc0]">North Sea, GoM & Carbonates</div>
            </div>
          </button>

          <button
            onClick={() => setLoadMode('upload')}
            className={`flex items-center gap-3 p-3.5 rounded-lg border text-left transition-all ${
              loadMode === 'upload'
                ? 'bg-[#1a3d54] border-[#2a9bb0] shadow-md'
                : 'bg-[#0b1b30] border-[#2a9bb0]/20 hover:border-[#2a9bb0]/40'
            }`}
          >
            <div className="p-2 bg-[#2ecc71]/20 rounded text-[#2ecc71]">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-[#e8f4f8]">Upload SEG-Y File</div>
              <div className="text-[11px] text-[#8aafc0]">Custom .sgy / .segy binary file</div>
            </div>
          </button>
        </div>

        {/* Mode Specific Actions */}
        {loadMode === 'demo' && (
          <div className="flex items-center gap-3 bg-[#071322] p-4 rounded-lg border border-[#2a9bb0]/20">
            <button
              onClick={handleGenerateSynthetic}
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> {isLoading ? 'Generating Volume...' : 'Generate 3D Synthetic Cube'}
            </button>
            <span className="text-xs text-[#8aafc0]">
              Generates 32 Inlines × 32 Crosslines × 1000 Samples with Ricker wavelets & noise.
            </span>
          </div>
        )}

        {loadMode === 'preset' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#071322] p-4 rounded-lg border border-[#2a9bb0]/20">
            {GEOLOGICAL_PRESETS.map((preset) => (
              <div
                key={preset.id}
                className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded-lg p-3 flex flex-col justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-[#f0a500] mb-1">{preset.name}</div>
                  <p className="text-[11px] text-[#8aafc0] mb-3">{preset.description}</p>
                </div>
                <button
                  onClick={() => handleSelectPreset(preset)}
                  disabled={isLoading}
                  className="w-full py-1.5 bg-[#162d4c] hover:bg-[#2a9bb0] hover:text-[#0a1628] text-[#2a9bb0] font-semibold text-xs rounded transition-colors"
                >
                  Load {preset.name.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>
        )}

        {loadMode === 'upload' && (
          <div className="bg-[#071322] p-5 rounded-lg border border-dashed border-[#2a9bb0]/40 text-center">
            <input
              type="file"
              accept=".sgy,.segy"
              id="segy-upload"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="segy-upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2ecc71] hover:bg-[#27ae60] text-[#0a1628] font-bold text-xs rounded-lg cursor-pointer transition-all shadow-md mb-2"
            >
              <UploadCloud className="w-4 h-4" /> Browse SEG-Y (.sgy / .segy) File
            </label>
            <p className="text-xs text-[#8aafc0]">
              Supports standard SEG-Y 3D volumes (IEEE Float & IBM 32-bit float).
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-xs text-red-300">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>

      {/* If Cube Loaded, Show Cube Metrics & Viewer */}
      {cube && (
        <>
          {/* Metrics Overview Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Inlines</div>
              <div className="text-lg font-bold font-mono text-[#2a9bb0] mt-0.5">{cube.nInlines}</div>
              <div className="text-[10px] text-[#8aafc0]">({cube.ilines[0]} - {cube.ilines[cube.nInlines - 1]})</div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Crosslines</div>
              <div className="text-lg font-bold font-mono text-[#2a9bb0] mt-0.5">{cube.nCrosslines}</div>
              <div className="text-[10px] text-[#8aafc0]">({cube.xlines[0]} - {cube.xlines[cube.nCrosslines - 1]})</div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Sample Interval</div>
              <div className="text-lg font-bold font-mono text-[#f0a500] mt-0.5">{cube.sampleRate} ms</div>
              <div className="text-[10px] text-[#8aafc0]">dt sampling</div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Samples / Trace</div>
              <div className="text-lg font-bold font-mono text-[#e8f4f8] mt-0.5">{cube.nSamples}</div>
              <div className="text-[10px] text-[#8aafc0]">trace depth</div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Total TWT</div>
              <div className="text-lg font-bold font-mono text-[#2ecc71] mt-0.5">{Math.round(cube.totalTimeMs)} ms</div>
              <div className="text-[10px] text-[#8aafc0]">Two-way time</div>
            </div>

            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 text-center">
              <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider">Memory Size</div>
              <div className="text-lg font-bold font-mono text-[#e8f4f8] mt-0.5">{cube.ramMb} MB</div>
              <div className="text-[10px] text-[#8aafc0]">Float32 tensor</div>
            </div>
          </div>

          {/* Section Slice Controls & Viewer */}
          <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#2a9bb0]/20">
              {/* Slice Type Tabs */}
              <div className="flex items-center bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/30">
                <button
                  onClick={() => {
                    setSliceType('inline');
                    setSliceIdx(Math.floor(cube.nInlines / 2));
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                    sliceType === 'inline'
                      ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                      : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                  }`}
                >
                  Inline Section
                </button>
                <button
                  onClick={() => {
                    setSliceType('crossline');
                    setSliceIdx(Math.floor(cube.nCrosslines / 2));
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                    sliceType === 'crossline'
                      ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                      : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                  }`}
                >
                  Crossline Section
                </button>
                <button
                  onClick={() => {
                    setSliceType('timeslice');
                    setSliceIdx(Math.floor(cube.nSamples / 2));
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                    sliceType === 'timeslice'
                      ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                      : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                  }`}
                >
                  Time Slice
                </button>
              </div>

              {/* Colormap selection */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8aafc0]">Colormap:</span>
                <select
                  value={colorMap}
                  onChange={(e) => setColorMap(e.target.value as any)}
                  className="bg-[#071322] border border-[#2a9bb0]/30 rounded px-2.5 py-1 text-xs text-[#e8f4f8] focus:outline-none"
                >
                  <option value="RdBu">RdBu (Red-Blue Seismic)</option>
                  <option value="Seismic">Seismic (High Contrast)</option>
                  <option value="Gray">Grayscale</option>
                </select>
              </div>
            </div>

            {/* Slice Slider */}
            <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20 flex items-center gap-4">
              <Sliders className="w-4 h-4 text-[#2a9bb0]" />
              <span className="text-xs font-semibold text-[#e8f4f8] min-w-[120px]">
                {sliceType === 'inline' && `Inline: ${cube.ilines[sliceIdx] || 100 + sliceIdx}`}
                {sliceType === 'crossline' && `Crossline: ${cube.xlines[sliceIdx] || 200 + sliceIdx}`}
                {sliceType === 'timeslice' && `TWT: ${Math.round(sliceIdx * cube.sampleRate)} ms`}
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
                className="flex-1 h-1.5 bg-[#162d4c] rounded-lg accent-[#2a9bb0] cursor-pointer"
              />
              <span className="font-mono text-xs text-[#8aafc0]">
                Index: {sliceIdx} /{' '}
                {sliceType === 'inline'
                  ? cube.nInlines - 1
                  : sliceType === 'crossline'
                  ? cube.nCrosslines - 1
                  : cube.nSamples - 1}
              </span>
            </div>

            {/* The High DPI Canvas Viewer */}
            <SeismicSectionCanvas
              cube={cube}
              sliceType={sliceType}
              sliceIndex={sliceIdx}
              colorMap={colorMap}
            />
          </div>

          {/* Spectrum and Candidate Peaks Scanner */}
          <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4" /> Amplitude Spectrum & Candidate Horizon Peaks
            </h3>

            {cube.meanTrace && cube.envelope && (
              <SpectrumChart
                meanTrace={cube.meanTrace}
                envelope={cube.envelope}
                sampleRate={cube.sampleRate}
                suggestions={suggestions}
              />
            )}

            {/* Candidates Table */}
            {suggestions.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-[#8aafc0] uppercase tracking-wider block mb-2">
                  Detected Horizon Candidates (Zone-Normalized Ranking)
                </span>
                <div className="overflow-x-auto rounded-lg border border-[#2a9bb0]/20">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#071322] text-[#8aafc0] font-mono">
                      <tr>
                        <th className="p-2.5">Candidate #</th>
                        <th className="p-2.5">Time (TWT)</th>
                        <th className="p-2.5">Sample Index</th>
                        <th className="p-2.5">Envelope Amplitude</th>
                        <th className="p-2.5">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a9bb0]/15 bg-[#0b1b30]">
                      {suggestions.map((sug, idx) => (
                        <tr key={idx} className="hover:bg-[#162d4c]/50 transition-colors font-mono">
                          <td className="p-2.5 font-bold text-[#f0a500]">#{idx + 1}</td>
                          <td className="p-2.5 text-[#e8f4f8]">{sug.timeMs.toFixed(1)} ms</td>
                          <td className="p-2.5 text-[#8aafc0]">{sug.sample}</td>
                          <td className="p-2.5 text-[#2a9bb0]">{sug.amplitude.toFixed(4)}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                sug.confidence >= 70
                                  ? 'bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/40'
                                  : sug.confidence >= 40
                                  ? 'bg-[#f0a500]/20 text-[#f0a500] border border-[#f0a500]/40'
                                  : 'bg-[#8aafc0]/20 text-[#8aafc0]'
                              }`}
                            >
                              {sug.confidence}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Optional Text Header Viewer */}
          {cube.textHeader && (
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-4 shadow-lg">
              <button
                onClick={() => setShowTextHeader(!showTextHeader)}
                className="flex items-center gap-2 text-xs font-semibold text-[#2a9bb0] hover:text-[#e8f4f8] transition-colors"
              >
                <FileText className="w-4 h-4" />
                {showTextHeader ? 'Hide SEG-Y Textual Header' : 'View SEG-Y Textual Header (3200 bytes)'}
              </button>
              {showTextHeader && (
                <pre className="mt-3 p-3 bg-[#071322] border border-[#2a9bb0]/20 rounded font-mono text-[11px] text-[#8aafc0] overflow-x-auto max-h-60">
                  {cube.textHeader}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
