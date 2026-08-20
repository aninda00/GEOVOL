import React, { useState } from 'react';
import { PetroState, LASSummary } from '../types';
import { parseLAS, extractPetroFromLAS, DEMO_WELLS } from '../modules/petroEngine';
import { WellLogTracks } from '../components/WellLogTracks';
import {
  Sparkles,
  UploadCloud,
  FileText,
  Sliders,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';

interface Panel3PetroProps {
  petroState: PetroState;
  onPetroSaved: (state: PetroState) => void;
  onNavigateNext: () => void;
}

export const Panel3Petro: React.FC<Panel3PetroProps> = ({
  petroState,
  onPetroSaved,
  onNavigateNext,
}) => {
  const [mode, setMode] = useState<'manual' | 'las'>(petroState.source === 'las' ? 'las' : 'manual');

  // Manual inputs
  const [phiP50, setPhiP50] = useState<number>(petroState.porosity.p50);
  const [phiP10, setPhiP10] = useState<number>(petroState.porosity.p10);
  const [phiP90, setPhiP90] = useState<number>(petroState.porosity.p90);

  const [swP50, setSwP50] = useState<number>(petroState.sw.p50);
  const [swP10, setSwP10] = useState<number>(petroState.sw.p10);
  const [swP90, setSwP90] = useState<number>(petroState.sw.p90);

  const [ntgP50, setNtgP50] = useState<number>(petroState.ntg.p50);
  const [ntgP10, setNtgP10] = useState<number>(petroState.ntg.p10);
  const [ntgP90, setNtgP90] = useState<number>(petroState.ntg.p90);

  const [boP50, setBoP50] = useState<number>(petroState.bo.p50);
  const [bgP50, setBgP50] = useState<number>(petroState.bg.p50);

  // LAS state
  const [lasData, setLasData] = useState<LASSummary | null>(petroState.lasSummary || null);
  const [topDepth, setTopDepth] = useState<number>(petroState.topDepth || 2400);
  const [baseDepth, setBaseDepth] = useState<number>(petroState.baseDepth || 2550);
  const [selectedPhiCurve, setSelectedPhiCurve] = useState<string>('PHIF');
  const [selectedSwCurve, setSelectedSwCurve] = useState<string>('SW');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load demo well LAS
  const handleLoadDemoWell = (demo: typeof DEMO_WELLS[0]) => {
    try {
      const parsed = parseLAS(demo.lasText);
      setLasData(parsed);
      setTopDepth(demo.topDepth);
      setBaseDepth(demo.baseDepth);

      const detected = extractPetroFromLAS(parsed, demo.topDepth, demo.baseDepth);
      applyExtractedPetro(detected, parsed, demo.topDepth, demo.baseDepth);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse demo LAS');
    }
  };

  // Upload LAS file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseLAS(text);
        setLasData(parsed);

        const defaultTop = parsed.depthMin + (parsed.depthMax - parsed.depthMin) * 0.3;
        const defaultBase = parsed.depthMin + (parsed.depthMax - parsed.depthMin) * 0.6;
        setTopDepth(Math.round(defaultTop));
        setBaseDepth(Math.round(defaultBase));

        const detected = extractPetroFromLAS(parsed, defaultTop, defaultBase);
        applyExtractedPetro(detected, parsed, defaultTop, defaultBase);
        setErrorMessage(null);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to parse uploaded LAS file.');
      }
    };
    reader.readAsText(file);
  };

  const applyExtractedPetro = (
    res: ReturnType<typeof extractPetroFromLAS>,
    lasSummary: LASSummary,
    tDepth: number,
    bDepth: number
  ) => {
    const phi = Math.max(0.05, Math.min(0.35, res.meanPhi));
    const sw = Math.max(0.1, Math.min(0.8, res.meanSw));
    const ntg = Math.max(0.3, Math.min(0.95, res.ntg));

    setPhiP50(parseFloat(phi.toFixed(3)));
    setPhiP10(parseFloat((phi * 0.85).toFixed(3)));
    setPhiP90(parseFloat((phi * 1.15).toFixed(3)));

    setSwP50(parseFloat(sw.toFixed(3)));
    setSwP10(parseFloat((sw * 0.8).toFixed(3)));
    setSwP90(parseFloat((sw * 1.2).toFixed(3)));

    setNtgP50(parseFloat(ntg.toFixed(3)));
    setNtgP10(parseFloat((ntg * 0.85).toFixed(3)));
    setNtgP90(parseFloat((ntg * 1.12).toFixed(3)));

    // Save to state
    onPetroSaved({
      source: 'las',
      porosity: { p10: phi * 0.85, p50: phi, p90: phi * 1.15, distribution: 'triangular' },
      phi: { p10: phi * 0.85, p50: phi, p90: phi * 1.15, distribution: 'triangular' },
      sw: { p10: sw * 0.8, p50: sw, p90: sw * 1.2, distribution: 'triangular' },
      ntg: { p10: ntg * 0.85, p50: ntg, p90: ntg * 1.12, distribution: 'triangular' },
      bo: { p10: boP50 * 0.95, p50: boP50, p90: boP50 * 1.08, distribution: 'triangular' },
      bg: { p10: bgP50 * 0.95, p50: bgP50, p90: bgP50 * 1.08, distribution: 'triangular' },
      lasSummary,
      topDepth: tDepth,
      baseDepth: bDepth,
    });
  };

  const handleManualSave = () => {
    onPetroSaved({
      source: 'manual',
      porosity: { p10: phiP10, p50: phiP50, p90: phiP90, distribution: 'triangular' },
      phi: { p10: phiP10, p50: phiP50, p90: phiP90, distribution: 'triangular' },
      sw: { p10: swP10, p50: swP50, p90: swP90, distribution: 'triangular' },
      ntg: { p10: ntgP10, p50: ntgP50, p90: ntgP90, distribution: 'triangular' },
      bo: { p10: boP50 * 0.95, p50: boP50, p90: boP50 * 1.08, distribution: 'triangular' },
      bg: { p10: bgP50 * 0.95, p50: bgP50, p90: bgP50 * 1.08, distribution: 'triangular' },
      lasSummary: lasData || undefined,
      topDepth,
      baseDepth,
    });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e8f4f8] flex items-center gap-2">
            <span className="text-2xl">🧪</span> Panel 3 — Petrophysics & Well Log Analysis
          </h2>
          <p className="text-sm text-[#8aafc0] mt-1">
            Define reservoir rock & fluid properties ($Phi$, $S_w$, $NTG$, $B_o$, $B_g$) manually or extract directly from LAS wireline well logs.
          </p>
        </div>

        <button
          onClick={onNavigateNext}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md"
        >
          Proceed to Volumetrics <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Selector */}
      <div className="flex items-center gap-3 bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-3 shadow-lg">
        <button
          onClick={() => setMode('las')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-xs transition-all ${
            mode === 'las'
              ? 'bg-[#2a9bb0] text-[#0a1628] shadow-md'
              : 'bg-[#0b1b30] text-[#8aafc0] hover:text-[#e8f4f8]'
          }`}
        >
          <Database className="w-4 h-4" /> 📂 LAS Well Log Mode (Automated Extraction)
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-xs transition-all ${
            mode === 'manual'
              ? 'bg-[#2a9bb0] text-[#0a1628] shadow-md'
              : 'bg-[#0b1b30] text-[#8aafc0] hover:text-[#e8f4f8]'
          }`}
        >
          <Sliders className="w-4 h-4" /> ✏️ Manual Parameter Entry (P10 / P50 / P90)
        </button>
      </div>

      {/* LAS Mode Section */}
      {mode === 'las' && (
        <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" /> Wireline Well Log Source
            </h3>

            {lasData && (
              <span className="bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/40 px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Well: <b>{lasData.wellName}</b> loaded
              </span>
            )}
          </div>

          {/* Demo Wells & Upload buttons */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {DEMO_WELLS.map((demo) => (
              <button
                key={demo.id}
                onClick={() => handleLoadDemoWell(demo)}
                className="bg-[#0b1b30] border border-[#2a9bb0]/30 hover:border-[#2a9bb0] p-3 rounded-lg text-left transition-all group"
              >
                <div className="font-bold text-xs text-[#f0a500] group-hover:text-[#2a9bb0]">
                  {demo.name}
                </div>
                <div className="text-[11px] text-[#8aafc0] mt-1">{demo.description}</div>
                <div className="text-[10px] text-[#2a9bb0] font-mono mt-2">
                  Pay: {demo.topDepth}m – {demo.baseDepth}m
                </div>
              </button>
            ))}

            <div className="bg-[#0b1b30] border border-dashed border-[#2a9bb0]/40 p-3 rounded-lg flex flex-col justify-center items-center text-center">
              <input
                type="file"
                accept=".las,.txt"
                id="las-file-input"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="las-file-input"
                className="px-3 py-1.5 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded cursor-pointer transition-all flex items-center gap-1.5 mb-1"
              >
                <UploadCloud className="w-3.5 h-3.5" /> Upload .LAS
              </label>
              <span className="text-[10px] text-[#8aafc0]">Custom LAS 2.0 / 3.0 file</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded text-xs text-red-300">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* If LAS Loaded, show Well Log Tracks and Depth Window Controls */}
          {lasData && (
            <div className="space-y-4 pt-2">
              <div className="bg-[#071322] p-4 rounded-lg border border-[#2a9bb0]/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#8aafc0] font-semibold">Pay Window (m):</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#2ecc71]">Top:</span>
                    <input
                      type="number"
                      value={topDepth}
                      onChange={(e) => setTopDepth(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-mono"
                    />
                    <span className="text-xs text-[#2ecc71]">Base:</span>
                    <input
                      type="number"
                      value={baseDepth}
                      onChange={(e) => setBaseDepth(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    const detected = extractPetroFromLAS(lasData, topDepth, baseDepth);
                    applyExtractedPetro(detected, lasData, topDepth, baseDepth);
                  }}
                  className="px-4 py-1.5 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded transition-colors"
                >
                  Recalculate Zone Averages
                </button>
              </div>

              {/* 4-Track Well Log Viewer */}
              <WellLogTracks
                las={lasData}
                topDepth={topDepth}
                baseDepth={baseDepth}
                phiCurve={selectedPhiCurve}
                swCurve={selectedSwCurve}
              />
            </div>
          )}
        </div>
      )}

      {/* Manual / Confirmation Parameters Table */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Active Petrophysical Distributions for Simulation
          </h3>
          <span className="text-xs text-[#8aafc0]">
            Source: <b className="text-[#f0a500] uppercase">{petroState.source}</b>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Porosity */}
          <div className="bg-[#071322] border border-[#2a9bb0]/20 rounded-lg p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-[#2a9bb0]">Porosity ($\phi$)</span>
              <span className="text-[11px] text-[#8aafc0]">V/V fraction</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-[#e74c3c] block">P10 (Low)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  value={phiP10}
                  onChange={(e) => setPhiP10(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#2ecc71] block font-bold">P50 (Median)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  value={phiP50}
                  onChange={(e) => setPhiP50(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0] rounded px-2 py-1 text-xs text-[#2ecc71] font-mono font-bold"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#f0a500] block">P90 (High)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  value={phiP90}
                  onChange={(e) => setPhiP90(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Water Saturation */}
          <div className="bg-[#071322] border border-[#2a9bb0]/20 rounded-lg p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-[#3498db]">Water Saturation ($S_w$)</span>
              <span className="text-[11px] text-[#8aafc0]">fraction</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-[#e74c3c] block">P10</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.0"
                  value={swP10}
                  onChange={(e) => setSwP10(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#2ecc71] block font-bold">P50</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.0"
                  value={swP50}
                  onChange={(e) => setSwP50(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0] rounded px-2 py-1 text-xs text-[#2ecc71] font-mono font-bold"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#f0a500] block">P90</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.0"
                  value={swP90}
                  onChange={(e) => setSwP90(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Net to Gross */}
          <div className="bg-[#071322] border border-[#2a9bb0]/20 rounded-lg p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-[#f0a500]">Net-to-Gross ($NTG$)</span>
              <span className="text-[11px] text-[#8aafc0]">fraction</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-[#e74c3c] block">P10</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.0"
                  value={ntgP10}
                  onChange={(e) => setNtgP10(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#2ecc71] block font-bold">P50</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.0"
                  value={ntgP50}
                  onChange={(e) => setNtgP50(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0] rounded px-2 py-1 text-xs text-[#2ecc71] font-mono font-bold"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#f0a500] block">P90</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.0"
                  value={ntgP90}
                  onChange={(e) => setNtgP90(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Formation Volume Factors (Bo, Bg) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#071322] border border-[#2a9bb0]/20 rounded-lg p-3.5 flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#e8f4f8] block">Oil Formation Volume Factor ($B_o$)</span>
              <span className="text-[11px] text-[#8aafc0]">rb/stb (typically 1.10 - 1.60)</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="1.0"
              max="2.5"
              value={boP50}
              onChange={(e) => setBoP50(parseFloat(e.target.value) || 1.25)}
              className="w-24 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1 text-xs text-[#e8f4f8] font-mono font-bold"
            />
          </div>

          <div className="bg-[#071322] border border-[#2a9bb0]/20 rounded-lg p-3.5 flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#e8f4f8] block">Gas Formation Volume Factor ($B_g$)</span>
              <span className="text-[11px] text-[#8aafc0]">rcf/scf (typically 0.003 - 0.015)</span>
            </div>
            <input
              type="number"
              step="0.0005"
              min="0.001"
              max="0.05"
              value={bgP50}
              onChange={(e) => setBgP50(parseFloat(e.target.value) || 0.0045)}
              className="w-28 bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1 text-xs text-[#e8f4f8] font-mono font-bold"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleManualSave}
            className="px-6 py-2.5 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md"
          >
            💾 Save Petrophysical Inputs
          </button>
        </div>
      </div>
    </div>
  );
};
