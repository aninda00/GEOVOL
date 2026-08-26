import React, { useState, useEffect } from 'react';
import { SeismicDataset, HorizonState } from '../types';
import {
  pickHorizonSurface,
  computeIsochore,
  computeGRV,
  suggestHorizons,
} from '../modules/seismicEngine';
import { HorizonMapCanvas } from '../components/HorizonMapCanvas';
import { IsochoreMapCanvas } from '../components/IsochoreMapCanvas';
import { ThreeDReservoirModel } from '../components/ThreeDReservoirModel';
import { Interactive3DSeismicWindow } from '../components/Interactive3DSeismicWindow';
import { SeismicSectionCanvas } from '../components/SeismicSectionCanvas';
import {
  Sparkles,
  Sliders,
  Layers,
  Box,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  MapPin,
} from 'lucide-react';

interface Panel2HorizonProps {
  cube: SeismicDataset | null;
  horizonState: HorizonState | null;
  onHorizonSaved: (state: HorizonState) => void;
  onNavigateNext: () => void;
}

export const Panel2Horizon: React.FC<Panel2HorizonProps> = ({
  cube,
  horizonState,
  onHorizonSaved,
  onNavigateNext,
}) => {
  if (!cube) {
    return (
      <div className="p-8 bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <h3 className="text-lg font-bold text-[#e8f4f8]">No Seismic Dataset Loaded</h3>
        <p className="text-sm text-[#8aafc0] mt-1 mb-4">
          Please return to Panel 1 and load a 2D line or 3D seismic volume first.
        </p>
      </div>
    );
  }

  const is2D = cube.type === '2d';

  // Picking configuration
  const [topTargetMs, setTopTargetMs] = useState<number>(horizonState?.topTargetMs || 2240);
  const [baseTargetMs, setBaseTargetMs] = useState<number>(horizonState?.baseTargetMs || 2460);
  const [windowMs, setWindowMs] = useState<number>(horizonState?.windowMs || 48);
  const [polarity, setPolarity] = useState<'positive' | 'negative' | 'both'>(
    horizonState?.polarity || 'positive'
  );
  const [velocity, setVelocity] = useState<number>(horizonState?.velocity || 2500);
  const [inlineSpacing, setInlineSpacing] = useState<number>(horizonState?.inlineSpacing || 25);
  const [crosslineSpacing, setCrosslineSpacing] = useState<number>(
    horizonState?.crosslineSpacing || (is2D ? 1500 : 25)
  );
  const [uncertaintyPct, setUncertaintyPct] = useState<number>(
    horizonState?.structuralUncertaintyPercent || 15
  );

  const [activeTab, setActiveTab] = useState<'top' | 'base' | 'isochore' | '3d' | 'section'>('top');
  const [isPicking, setIsPicking] = useState<boolean>(false);

  // Suggestions for rapid preset selection
  const suggestions = React.useMemo(() => {
    return suggestHorizons(cube, cube.sampleRate, 8).suggestions;
  }, [cube]);

  const handleRunPicking = () => {
    setIsPicking(true);
    setTimeout(() => {
      const topSample = Math.round(topTargetMs / cube.sampleRate);
      const baseSample = Math.round(baseTargetMs / cube.sampleRate);
      const windowSamples = Math.max(2, Math.round(windowMs / cube.sampleRate));

      const topHorizon = pickHorizonSurface(cube, topSample, windowSamples, polarity);
      const baseHorizon = pickHorizonSurface(cube, baseSample, windowSamples, polarity);
      const isochoreMs = computeIsochore(topHorizon, baseHorizon, cube.sampleRate);
      const grvData = computeGRV(isochoreMs, inlineSpacing, crosslineSpacing, velocity);

      const p50GRV = grvData.grvAcreFt;
      const p10GRV = p50GRV * (1 - uncertaintyPct / 100);
      const p90GRV = p50GRV * (1 + uncertaintyPct / 100);

      const newState: HorizonState = {
        topHorizon,
        baseHorizon,
        isochoreMs,
        grvData,
        velocity,
        inlineSpacing,
        crosslineSpacing,
        topTargetMs,
        baseTargetMs,
        windowMs,
        polarity,
        structuralUncertaintyPercent: uncertaintyPct,
        grvP10: Math.round(p10GRV),
        grvP50: Math.round(p50GRV),
        grvP90: Math.round(p90GRV),
      };

      onHorizonSaved(newState);
      setIsPicking(false);
    }, 100);
  };

  // Auto-run picking if no horizons exist yet
  useEffect(() => {
    if (!horizonState) {
      handleRunPicking();
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e8f4f8] flex items-center gap-2">
            <span className="text-2xl">📐</span> Panel 2 — Horizon Tracking & Gross Rock Volume (GRV)
            <span
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                is2D
                  ? 'bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/40'
                  : 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40'
              }`}
            >
              {is2D ? '2D Line Tracking' : '3D Volume Tracking'}
            </span>
          </h2>
          <p className="text-sm text-[#8aafc0] mt-1">
            Pick top & base reservoir horizons automatically across all {is2D ? '2D CMP stations' : '3D traces'}, compute isochore thickness, and calculate Gross Rock Volume.
          </p>
        </div>

        {horizonState && (
          <button
            onClick={onNavigateNext}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md"
          >
            Proceed to Petrophysics <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Picking Parameters Controls */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4" /> Horizon Tracker & Depth Conversion Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Top Target */}
          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#00f0ff] font-semibold block mb-1">
              Top Reservoir Target (ms)
            </label>
            <input
              type="number"
              min="0"
              max={cube.totalTimeMs}
              step="4"
              value={topTargetMs}
              onChange={(e) => setTopTargetMs(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] font-mono focus:outline-none"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {suggestions.slice(0, 3).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => setTopTargetMs(sug.timeMs)}
                  className="px-1.5 py-0.5 bg-[#162840] hover:bg-[#2a9bb0] hover:text-[#0a1628] text-[10px] text-[#8aafc0] rounded font-mono"
                >
                  {sug.timeMs}ms
                </button>
              ))}
            </div>
          </div>

          {/* Base Target */}
          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#ffd700] font-semibold block mb-1">
              Base Reservoir Target (ms)
            </label>
            <input
              type="number"
              min="0"
              max={cube.totalTimeMs}
              step="4"
              value={baseTargetMs}
              onChange={(e) => setBaseTargetMs(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] font-mono focus:outline-none"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {suggestions.slice(3, 6).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => setBaseTargetMs(sug.timeMs)}
                  className="px-1.5 py-0.5 bg-[#162840] hover:bg-[#ffd700] hover:text-[#0a1628] text-[10px] text-[#8aafc0] rounded font-mono"
                >
                  {sug.timeMs}ms
                </button>
              ))}
            </div>
          </div>

          {/* Search Window & Polarity */}
          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#8aafc0] font-semibold block mb-1">
              Search Window (±ms)
            </label>
            <input
              type="number"
              min="8"
              max="200"
              step="4"
              value={windowMs}
              onChange={(e) => setWindowMs(parseFloat(e.target.value) || 20)}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] font-mono mb-2 focus:outline-none"
            />
            <div className="flex gap-1">
              {(['positive', 'negative', 'both'] as const).map((pol) => (
                <button
                  key={pol}
                  onClick={() => setPolarity(pol)}
                  className={`flex-1 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${
                    polarity === pol
                      ? 'bg-[#2a9bb0] text-[#0a1628] border-[#2a9bb0]'
                      : 'bg-[#0b1b30] text-[#8aafc0] border-[#2a9bb0]/20 hover:text-[#e8f4f8]'
                  }`}
                >
                  {pol === 'positive' ? '+Peak' : pol === 'negative' ? '-Trough' : 'Both'}
                </button>
              ))}
            </div>
          </div>

          {/* Velocity & Spacing */}
          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#8aafc0] font-semibold block mb-1">
              Interval Velocity $V_p$ (m/s)
            </label>
            <input
              type="number"
              min="1500"
              max="6500"
              step="50"
              value={velocity}
              onChange={(e) => setVelocity(parseFloat(e.target.value) || 2500)}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] font-mono mb-2 focus:outline-none"
            />
            <div className="flex items-center gap-2 text-[11px] text-[#8aafc0]">
              <span>{is2D ? 'Trace dx:' : 'Bin:'}</span>
              <input
                type="number"
                min="5"
                max="100"
                value={inlineSpacing}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 25;
                  setInlineSpacing(val);
                  if (!is2D) setCrosslineSpacing(val);
                }}
                className="w-12 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-1.5 py-0.5 text-center font-mono text-[#e8f4f8]"
              />
              <span>{is2D ? 'm | Width:' : 'm ×'}</span>
              {is2D && (
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="100"
                  value={crosslineSpacing}
                  onChange={(e) => setCrosslineSpacing(parseFloat(e.target.value) || 1500)}
                  className="w-14 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-1.5 py-0.5 text-center font-mono text-[#e8f4f8]"
                  title="Assumed lateral reservoir closure width across line (m)"
                />
              )}
            </div>
          </div>
        </div>

        {/* Run Picking Trigger */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleRunPicking}
            disabled={isPicking}
            className="px-6 py-2.5 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isPicking ? 'animate-spin' : ''}`} />
            {isPicking ? 'Auto-Tracking Horizon Surfaces...' : is2D ? '⚡ Track 2D Horizons & Compute GRV' : '⚡ Pick 3D Horizons & Compute GRV'}
          </button>

          {/* Structural Uncertainty Slider */}
          <div className="flex items-center gap-3 bg-[#071322] px-4 py-2 rounded-lg border border-[#2a9bb0]/20">
            <TrendingUp className="w-4 h-4 text-[#f0a500]" />
            <span className="text-xs text-[#8aafc0]">Structural Uncertainty Range:</span>
            <input
              type="range"
              min="5"
              max="40"
              step="5"
              value={uncertaintyPct}
              onChange={(e) => setUncertaintyPct(parseInt(e.target.value, 10))}
              className="w-24 h-1.5 accent-[#f0a500] cursor-pointer"
            />
            <span className="font-mono text-xs text-[#f0a500] font-bold">±{uncertaintyPct}%</span>
          </div>
        </div>
      </div>

      {/* GRV Metric Highlights */}
      {horizonState && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#0f2139] border border-[#2a9bb0]/40 rounded-xl p-4 text-center shadow-lg">
            <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider font-semibold">
              Gross Rock Volume (P50)
            </div>
            <div className="text-2xl font-bold font-mono text-[#2ecc71] mt-1">
              {horizonState.grvP50.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#8aafc0]">acre-feet (P50)</div>
          </div>

          <div className="bg-[#0f2139] border border-[#2a9bb0]/40 rounded-xl p-4 text-center shadow-lg">
            <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider font-semibold">
              P10 / P90 Uncertainty
            </div>
            <div className="text-sm font-bold font-mono text-[#e8f4f8] mt-2">
              <span className="text-[#e74c3c]">{horizonState.grvP10.toLocaleString()}</span> &nbsp;/&nbsp;{' '}
              <span className="text-[#f0a500]">{horizonState.grvP90.toLocaleString()}</span>
            </div>
            <div className="text-[11px] text-[#8aafc0]">acre-feet (P10 / P90)</div>
          </div>

          <div className="bg-[#0f2139] border border-[#2a9bb0]/40 rounded-xl p-4 text-center shadow-lg">
            <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider font-semibold">
              Average Thickness
            </div>
            <div className="text-2xl font-bold font-mono text-[#2a9bb0] mt-1">
              {horizonState.grvData.avgThicknessM.toFixed(1)} m
            </div>
            <div className="text-[11px] text-[#8aafc0]">
              Max: {horizonState.grvData.maxThicknessM.toFixed(1)} m
            </div>
          </div>

          <div className="bg-[#0f2139] border border-[#2a9bb0]/40 rounded-xl p-4 text-center shadow-lg">
            <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider font-semibold">
              Metric Volume
            </div>
            <div className="text-2xl font-bold font-mono text-[#f0a500] mt-1">
              {(horizonState.grvData.grvM3 / 1e6).toFixed(2)} Mm³
            </div>
            <div className="text-[11px] text-[#8aafc0]">
              {horizonState.grvData.nCells.toLocaleString()} {is2D ? 'stations' : 'active bins'}
            </div>
          </div>
        </div>
      )}

      {/* Visual Navigation Tabs */}
      {horizonState && (
        <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#2a9bb0]/20">
            <div className="flex items-center gap-2 bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/30">
              <button
                onClick={() => setActiveTab('top')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  activeTab === 'top'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                {is2D ? 'Top Horizon Profile' : 'Top Horizon Map'}
              </button>
              <button
                onClick={() => setActiveTab('base')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  activeTab === 'base'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                {is2D ? 'Base Horizon Profile' : 'Base Horizon Map'}
              </button>
              <button
                onClick={() => setActiveTab('isochore')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  activeTab === 'isochore'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                {is2D ? 'Isochore Thickness Profile' : 'Isochore Thickness Map'}
              </button>
              <button
                onClick={() => setActiveTab('3d')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === '3d'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                <Box className="w-3.5 h-3.5" /> 3D Reservoir Model
              </button>
              <button
                onClick={() => setActiveTab('section')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  activeTab === 'section'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                Seismic QC Section
              </button>
            </div>
          </div>

          {/* Tab Views */}
          {activeTab === 'top' && (
            <HorizonMapCanvas
              horizon={horizonState.topHorizon}
              sampleRate={cube.sampleRate}
              velocityMs={horizonState.velocity}
              title="Top Reservoir Horizon Surface (Depth / TWT)"
              horizonType="top"
            />
          )}

          {activeTab === 'base' && (
            <HorizonMapCanvas
              horizon={horizonState.baseHorizon}
              sampleRate={cube.sampleRate}
              velocityMs={horizonState.velocity}
              title="Base Reservoir Horizon Surface (Depth / TWT)"
              horizonType="base"
            />
          )}

          {activeTab === 'isochore' && (
            <IsochoreMapCanvas
              isochoreMs={horizonState.isochoreMs}
              sampleRate={cube.sampleRate}
              velocityMs={horizonState.velocity}
              grvData={horizonState.grvData}
            />
          )}

          {activeTab === '3d' && (
            <Interactive3DSeismicWindow
              cube={cube}
              horizonState={horizonState}
              survey={cube.multiLineSurvey}
              initialHeight={540}
            />
          )}

          {activeTab === 'section' && (
            <SeismicSectionCanvas
              cube={cube}
              sliceType={is2D ? '2d-line' : 'inline'}
              sliceIndex={is2D ? 0 : Math.floor(cube.nInlines / 2)}
              topHorizon={horizonState.topHorizon}
              baseHorizon={horizonState.baseHorizon}
              showHorizons={true}
            />
          )}
        </div>
      )}
    </div>
  );
};
