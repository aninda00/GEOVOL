import React, { useState, useEffect } from 'react';
import { PetroState, LASSummary, WellData, WellLocation } from '../types';
import {
  parseLAS,
  extractPetroFromLAS,
  createWellDataFromParsed,
  calculateMultiWellSynthesis,
  SALDANADI_FIELD_DATASET,
} from '../modules/petroEngine';
import { parseDeviationSurveyFile, compute3DTrajectory } from '../modules/deviationEngine';
import { WellLogTracks } from '../components/WellLogTracks';
import { MultiWellCorrelation } from '../components/MultiWellCorrelation';
import { WellLocationModal } from '../components/WellLocationModal';
import {
  Sparkles,
  UploadCloud,
  FileText,
  Sliders,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Database,
  Layers,
  MapPin,
  Table,
  Plus,
  Compass,
  BarChart3,
  Activity,
  Trash2,
} from 'lucide-react';

const buildSaldanadiWells = (): WellData[] => {
  return SALDANADI_FIELD_DATASET.map((demo) => {
    const parsed = parseLAS(demo.lasText, demo.name);
    let trajectory = undefined;
    if (demo.rawDeviationText) {
      const parsedDev = parseDeviationSurveyFile(demo.rawDeviationText);
      if (parsedDev && parsedDev.stations.length > 0) {
        trajectory = compute3DTrajectory(
          parsedDev.stations,
          demo.location.x ?? 0,
          demo.location.y ?? 0,
          demo.location.elevationKb ?? 0
        );
        trajectory.rawSurveyText = demo.rawDeviationText;
        trajectory.surveyType = parsedDev.surveyType;
      }
    }
    return createWellDataFromParsed(
      parsed,
      demo.id,
      demo.topDepth,
      demo.baseDepth,
      demo.location,
      demo.color,
      trajectory
    );
  });
};

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
  // Initialize wells list - empty by default so ONLY user uploaded logs appear
  const [wells, setWells] = useState<WellData[]>(() => {
    if (petroState.wells && petroState.wells.length > 0) {
      return petroState.wells;
    }
    return [];
  });

  const [activeWellId, setActiveWellId] = useState<string>(
    petroState.activeWellId || (wells.length > 0 ? wells[0].id : '')
  );

  const [activeTab, setActiveTab] = useState<'correlation' | 'synthesis' | 'single-well' | 'manual'>(
    'correlation'
  );

  const [correlationMethod, setCorrelationMethod] = useState<'arithmetic' | 'thickness-weighted' | 'idw-spatial'>(
    petroState.correlationMethod || 'thickness-weighted'
  );

  const [datumMode, setDatumMode] = useState<'structural-depth' | 'stratigraphic-top'>(
    petroState.datumMode === 'stratigraphic-top' ? 'stratigraphic-top' : 'structural-depth'
  );

  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  // Manual inputs fallback
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

  // Active selected well
  const activeWell = wells.find((w) => w.id === activeWellId) || (wells.length > 0 ? wells[0] : null);

  // Compute Multi-Well Synthesis
  const synthesis = calculateMultiWellSynthesis(wells, correlationMethod);

  // Sync to parent when wells, method, or active well change
  const syncPetroState = (
    currentWells: WellData[],
    currentMethod: 'arithmetic' | 'thickness-weighted' | 'idw-spatial',
    currentDatum: 'structural-depth' | 'stratigraphic-top',
    currActiveId: string
  ) => {
    const syn = calculateMultiWellSynthesis(currentWells, currentMethod);
    const selected = currentWells.find((w) => w.id === currActiveId) || (currentWells.length > 0 ? currentWells[0] : null);

    onPetroSaved({
      source: 'multi-well',
      porosity: syn.phi,
      phi: syn.phi,
      sw: syn.sw,
      ntg: syn.ntg,
      bo: { p10: boP50 * 0.95, p50: boP50, p90: boP50 * 1.08, distribution: 'triangular' },
      bg: { p10: bgP50 * 0.95, p50: bgP50, p90: bgP50 * 1.08, distribution: 'triangular' },
      wells: currentWells,
      activeWellId: currActiveId,
      correlationMethod: currentMethod,
      datumMode: currentDatum,
      lasSummary: selected?.lasSummary || null,
      topDepth: selected?.topDepth,
      baseDepth: selected?.baseDepth,
    });
  };

  // Process a list of LAS files (from file input or drag-and-drop)
  const processUploadedLASFiles = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;

    const newWells: WellData[] = [];
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const text = await file.text();
        const parsed = parseLAS(text, file.name);
        const wellId = `well-uploaded-${Date.now()}-${i}`;
        const well = createWellDataFromParsed(parsed, wellId);
        newWells.push(well);
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message || 'Parse error'}`);
      }
    }

    if (newWells.length > 0) {
      // If current workspace has sample/demo wells or is empty, REPLACE with user's uploaded logs
      const hasOnlySampleWells = wells.length > 0 && wells.every(
        (w) => w.id.startsWith('salda-') || w.id.startsWith('demo-') || w.id.startsWith('well-saldanadi-')
      );
      const updatedWells = wells.length === 0 || hasOnlySampleWells ? newWells : [...wells, ...newWells];

      setWells(updatedWells);
      const newActiveId = newWells[0].id;
      setActiveWellId(newActiveId);
      setUploadSuccessMessage(
        `Successfully loaded ${newWells.length} uploaded well log file(s): ${newWells.map((w) => w.wellName).join(', ')}`
      );
      syncPetroState(updatedWells, correlationMethod, datumMode, newActiveId);
    }

    if (errors.length > 0) {
      setErrorMessage(`Encountered issues with ${errors.length} file(s): ${errors.join(', ')}`);
    } else {
      setErrorMessage(null);
    }
  };

  // Handle batch LAS file input change
  const handleBatchFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedLASFiles(e.target.files);
      // Reset input value so same files can be re-selected if needed
      e.target.value = '';
    }
  };

  // Delete a single well
  const handleDeleteWell = (wellId: string) => {
    const targetWell = wells.find((w) => w.id === wellId);
    const updated = wells.filter((w) => w.id !== wellId);
    setWells(updated);
    const newActiveId = updated.length > 0 ? (activeWellId === wellId ? updated[0].id : activeWellId) : '';
    setActiveWellId(newActiveId);
    setUploadSuccessMessage(`Removed well "${targetWell?.wellName || wellId}" from workspace.`);
    syncPetroState(updated, correlationMethod, datumMode, newActiveId);
  };

  // Toggle active well for synthesis
  const handleToggleWellActive = (wellId: string) => {
    const updated = wells.map((w) => (w.id === wellId ? { ...w, isActive: !w.isActive } : w));
    setWells(updated);
    syncPetroState(updated, correlationMethod, datumMode, activeWellId);
  };

  // Update well target reservoir interval
  const handleUpdateWellInterval = (wellId: string, topDepth: number, baseDepth: number) => {
    const updated = wells.map((w) => {
      if (w.id !== wellId) return w;
      const extractedPetro = extractPetroFromLAS(w.lasSummary, topDepth, baseDepth);
      return {
        ...w,
        topDepth,
        baseDepth,
        extractedPetro,
      };
    });
    setWells(updated);
    syncPetroState(updated, correlationMethod, datumMode, activeWellId);
  };

  // Update well locations from modal
  const handleSaveWellLocations = (updatedWells: WellData[]) => {
    // Recalculate petro with new top/base
    const recalculated = updatedWells.map((w) => {
      const extractedPetro = extractPetroFromLAS(w.lasSummary, w.topDepth, w.baseDepth);
      return { ...w, extractedPetro };
    });
    setWells(recalculated);
    syncPetroState(recalculated, correlationMethod, datumMode, activeWellId);
  };

  // Reload Saldanadi Field dataset
  const handleLoadSaldanadiCampaign = () => {
    const saldaWells = buildSaldanadiWells();
    setWells(saldaWells);
    setActiveWellId(saldaWells[0].id);
    setUploadSuccessMessage('Loaded Saldanadi Gas Field dataset (SALDANADI-1, 2, 3 with wellheads and deviation surveys).');
    syncPetroState(saldaWells, correlationMethod, datumMode, saldaWells[0].id);
  };

  // Clear all wells for clean workspace
  const handleClearAllWells = () => {
    setWells([]);
    setActiveWellId('');
    setUploadSuccessMessage('Cleared all wells from workspace. You can now upload your custom LAS well logs and coordinates.');
    syncPetroState([], correlationMethod, datumMode, '');
  };

  return (
    <div className="space-y-6">
      {/* Title & Multi-Well Control Bar */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧪</span>
            <h2 className="text-xl font-bold text-[#e8f4f8]">
              Panel 3 — Multi-Well Petrophysics & Log Correlation
            </h2>
          </div>
          <p className="text-sm text-[#8aafc0] mt-1">
            Upload multiple LAS 2.0 well logs, import wellhead coordinates & directional deviation surveys, and synthesize spatial properties for Monte Carlo volumetrics.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Batch LAS Upload Button */}
          <label className="py-2.5 px-4 bg-[#00f0ff] hover:bg-[#00d0df] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer">
            <UploadCloud className="w-4 h-4" /> Batch Upload LAS Files
            <input
              type="file"
              multiple
              accept=".las,.las2,.txt,.dat"
              onChange={handleBatchFileUpload}
              className="hidden"
            />
          </label>

          {/* Well Locations & Surveys Manager */}
          <button
            id="btn-open-well-coords-modal"
            onClick={() => setShowLocationModal(true)}
            className="py-2.5 px-3.5 bg-[#162d4c] hover:bg-[#1a3d54] border border-[#2a9bb0]/40 text-[#00f0ff] font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-[#f0a500]" /> Well Coordinates & Surveys ({wells.length})
          </button>

          {/* Reload Saldanadi Wells */}
          <button
            onClick={handleLoadSaldanadiCampaign}
            className="py-2.5 px-3 bg-[#071322] hover:bg-[#162d4c] border border-[#2a9bb0]/30 text-[#8aafc0] hover:text-[#00f0ff] text-xs rounded-lg transition-all cursor-pointer"
            title="Reload Saldanadi Field (SALDANADI-1, 2, 3)"
          >
            Load Saldanadi Wells
          </button>

          {/* Clear Wells */}
          <button
            onClick={handleClearAllWells}
            className="py-2.5 px-2.5 bg-[#071322] hover:bg-[#3a1818] border border-[#e74c3c]/30 text-[#8aafc0] hover:text-[#e74c3c] text-xs rounded-lg transition-all cursor-pointer"
            title="Clear all wells to start fresh"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {uploadSuccessMessage && (
        <div className="p-3.5 bg-[#133429] border border-[#2ecc71]/40 rounded-xl text-xs text-[#2ecc71] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{uploadSuccessMessage}</span>
          </div>
          <button
            onClick={() => setUploadSuccessMessage(null)}
            className="text-xs text-[#8aafc0] hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-[#3a1818] border border-[#e74c3c]/40 rounded-xl text-xs text-[#e74c3c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-[#8aafc0] hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Primary Studio View Tabs */}
      <div className="flex border-b border-[#2a9bb0]/30 gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('correlation')}
          className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'correlation'
              ? 'border-[#00f0ff] text-[#00f0ff]'
              : 'border-transparent text-[#8aafc0] hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" /> Multi-Well Correlation Fence ({wells.length} Wells)
        </button>

        <button
          onClick={() => setActiveTab('synthesis')}
          className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'synthesis'
              ? 'border-[#00f0ff] text-[#00f0ff]'
              : 'border-transparent text-[#8aafc0] hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Spatial Petrophysical Synthesis & Monte Carlo Inputs
        </button>

        <button
          onClick={() => setActiveTab('single-well')}
          className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'single-well'
              ? 'border-[#00f0ff] text-[#00f0ff]'
              : 'border-transparent text-[#8aafc0] hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" /> Single-Well Wireline Deep-Dive
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'manual'
              ? 'border-[#00f0ff] text-[#00f0ff]'
              : 'border-transparent text-[#8aafc0] hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" /> Manual Parameter Override
        </button>
      </div>

      {/* TAB 1: MULTI-WELL CORRELATION FENCE */}
      {activeTab === 'correlation' && (
        <div className="space-y-6">
          <MultiWellCorrelation
            wells={wells}
            onUpdateWellInterval={handleUpdateWellInterval}
            onToggleWellActive={handleToggleWellActive}
            onSelectWell={setActiveWellId}
            onDeleteWell={handleDeleteWell}
            onUploadFiles={processUploadedLASFiles}
            onLoadSampleWells={handleLoadSaldanadiCampaign}
            activeWellId={activeWellId}
            datumMode={datumMode}
            onChangeDatumMode={(mode) => {
              setDatumMode(mode);
              syncPetroState(wells, correlationMethod, mode, activeWellId);
            }}
          />

          {/* Bottom Quick Synthesis Callout */}
          {wells.length > 0 && (
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#2ecc71]/20 border border-[#2ecc71] flex items-center justify-center text-[#2ecc71] font-bold text-lg font-mono">
                  {synthesis.activeWellCount}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#e8f4f8]">
                    Field Synthesis: {synthesis.activeWellCount} Active Well Logs Correlated
                  </h4>
                  <p className="text-xs text-[#8aafc0] mt-0.5 font-mono">
                    Synthesized Effective Porosity Φ = <b className="text-[#00f0ff]">{(synthesis.phi.p50 * 100).toFixed(1)}%</b> | Water Saturation Sw = <b className="text-[#f0a500]">{(synthesis.sw.p50 * 100).toFixed(0)}%</b> | Net-to-Gross = <b className="text-[#2ecc71]">{(synthesis.ntg.p50 * 100).toFixed(0)}%</b>
                  </p>
                </div>
              </div>

              <button
                onClick={onNavigateNext}
                className="py-2.5 px-5 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                Proceed to Panel 4: Volumetrics <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SPATIAL SYNTHESIS & STATISTICAL DISTRIBUTIONS */}
      {activeTab === 'synthesis' && (
        <div className="space-y-6">
          {/* Method Selector & Overview */}
          <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#e8f4f8]">Field-Wide Property Synthesis Engine</h3>
                <p className="text-xs text-[#8aafc0]">
                  Select the spatial averaging model to translate multi-well log observations into reservoir distribution parameters for Monte Carlo simulation:
                </p>
              </div>

              {/* Method Selector */}
              <div className="flex items-center gap-2 bg-[#071322] p-1.5 rounded-lg border border-[#2a9bb0]/30 text-xs">
                <span className="text-[11px] font-bold text-[#8aafc0] px-2 uppercase">Method:</span>
                <button
                  onClick={() => {
                    setCorrelationMethod('thickness-weighted');
                    syncPetroState(wells, 'thickness-weighted', datumMode, activeWellId);
                  }}
                  className={`px-3 py-1.5 rounded font-semibold transition-all ${
                    correlationMethod === 'thickness-weighted'
                      ? 'bg-[#00f0ff] text-[#0a1628] shadow'
                      : 'text-[#8aafc0] hover:text-white'
                  }`}
                >
                  Net-Thickness Weighted
                </button>
                <button
                  onClick={() => {
                    setCorrelationMethod('idw-spatial');
                    syncPetroState(wells, 'idw-spatial', datumMode, activeWellId);
                  }}
                  className={`px-3 py-1.5 rounded font-semibold transition-all ${
                    correlationMethod === 'idw-spatial'
                      ? 'bg-[#2ecc71] text-[#0a1628] shadow'
                      : 'text-[#8aafc0] hover:text-white'
                  }`}
                >
                  Inverse Distance (IDW)
                </button>
                <button
                  onClick={() => {
                    setCorrelationMethod('arithmetic');
                    syncPetroState(wells, 'arithmetic', datumMode, activeWellId);
                  }}
                  className={`px-3 py-1.5 rounded font-semibold transition-all ${
                    correlationMethod === 'arithmetic'
                      ? 'bg-[#f0a500] text-[#0a1628] shadow'
                      : 'text-[#8aafc0] hover:text-white'
                  }`}
                >
                  Arithmetic Mean
                </button>
              </div>
            </div>

            {/* Parameter Distribution Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Porosity Box */}
              <div className="bg-[#071322] border border-[#2a9bb0]/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8aafc0] uppercase tracking-wider">Effective Porosity (Φ)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#00f0ff]/10 text-[#00f0ff] rounded">Triangular</span>
                </div>
                <div className="text-2xl font-bold font-mono text-[#00f0ff]">
                  {(synthesis.phi.p50 * 100).toFixed(1)}%
                </div>
                <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] pt-2 border-t border-[#2a9bb0]/20">
                  <div>
                    <span className="text-[#8aafc0]">P90 (Low):</span>
                    <div className="font-bold text-[#e8f4f8]">{(synthesis.phi.p10 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-[#8aafc0]">P50 (Exp):</span>
                    <div className="font-bold text-[#00f0ff]">{(synthesis.phi.p50 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-[#8aafc0]">P10 (High):</span>
                    <div className="font-bold text-[#e8f4f8]">{(synthesis.phi.p90 * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Water Saturation Box */}
              <div className="bg-[#071322] border border-[#2a9bb0]/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8aafc0] uppercase tracking-wider">Water Saturation (Sw)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#f0a500]/10 text-[#f0a500] rounded">Triangular</span>
                </div>
                <div className="text-2xl font-bold font-mono text-[#f0a500]">
                  {(synthesis.sw.p50 * 100).toFixed(1)}%
                </div>
                <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] pt-2 border-t border-[#2a9bb0]/20">
                  <div>
                    <span className="text-[#8aafc0]">P90 (Low):</span>
                    <div className="font-bold text-[#e8f4f8]">{(synthesis.sw.p10 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-[#8aafc0]">P50 (Exp):</span>
                    <div className="font-bold text-[#f0a500]">{(synthesis.sw.p50 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-[#8aafc0]">P10 (High):</span>
                    <div className="font-bold text-[#e8f4f8]">{(synthesis.sw.p90 * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Net-to-Gross Box */}
              <div className="bg-[#071322] border border-[#2a9bb0]/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8aafc0] uppercase tracking-wider">Net-to-Gross (NTG)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#2ecc71]/10 text-[#2ecc71] rounded">Triangular</span>
                </div>
                <div className="text-2xl font-bold font-mono text-[#2ecc71]">
                  {(synthesis.ntg.p50 * 100).toFixed(1)}%
                </div>
                <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] pt-2 border-t border-[#2a9bb0]/20">
                  <div>
                    <span className="text-[#8aafc0]">P90 (Low):</span>
                    <div className="font-bold text-[#e8f4f8]">{(synthesis.ntg.p10 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-[#8aafc0]">P50 (Exp):</span>
                    <div className="font-bold text-[#2ecc71]">{(synthesis.ntg.p50 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-[#8aafc0]">P10 (High):</span>
                    <div className="font-bold text-[#e8f4f8]">{(synthesis.ntg.p90 * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Well Contributions Table */}
          <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-3">
            <h4 className="text-xs font-bold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
              <Table className="w-4 h-4" /> Multi-Well Petrophysical Correlation Matrix
            </h4>

            <div className="overflow-x-auto border border-[#2a9bb0]/20 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#071322] text-[#8aafc0] border-b border-[#2a9bb0]/30">
                  <tr>
                    <th className="p-3">Status</th>
                    <th className="p-3">Well Name</th>
                    <th className="p-3">Coordinates (X, Y)</th>
                    <th className="p-3">Seismic Position</th>
                    <th className="p-3">Interval (m)</th>
                    <th className="p-3">Net Pay (m)</th>
                    <th className="p-3">Porosity (Φ)</th>
                    <th className="p-3">Water Sat (Sw)</th>
                    <th className="p-3">NTG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a9bb0]/10 bg-[#0b1b30]">
                  {wells.map((well) => (
                    <tr
                      key={well.id}
                      onClick={() => setActiveWellId(well.id)}
                      className={`hover:bg-[#14324f]/60 transition-colors cursor-pointer ${
                        !well.isActive ? 'opacity-40' : ''
                      }`}
                    >
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            well.isActive ? 'bg-[#2ecc71]/20 text-[#2ecc71]' : 'bg-gray-700/40 text-gray-400'
                          }`}
                        >
                          {well.isActive ? 'Active' : 'Excluded'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#e8f4f8] flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: well.color || '#00f0ff' }}
                        />
                        {well.wellName}
                      </td>
                      <td className="p-3 text-[#8aafc0]">
                        {well.location.x != null && well.location.y != null
                          ? `${Math.round(well.location.x)}, ${Math.round(well.location.y)}`
                          : '—'}
                      </td>
                      <td className="p-3 text-[#00f0ff]">
                        {well.location.inline != null
                          ? `IL:${well.location.inline} XL:${well.location.crossline}`
                          : well.location.lineName
                          ? `${well.location.lineName}`
                          : '—'}
                      </td>
                      <td className="p-3">
                        {well.topDepth} – {well.baseDepth}m
                      </td>
                      <td className="p-3 text-[#2ecc71] font-bold">
                        {well.extractedPetro.netPayM}m
                      </td>
                      <td className="p-3 text-[#00f0ff] font-bold">
                        {(well.extractedPetro.meanPhi * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-[#f0a500] font-bold">
                        {(well.extractedPetro.meanSw * 100).toFixed(0)}%
                      </td>
                      <td className="p-3 font-bold">
                        {(well.extractedPetro.ntg * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SINGLE-WELL WIRELINE DEEP-DIVE */}
      {activeTab === 'single-well' && (
        wells.length === 0 || !activeWell ? (
          <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-10 text-center text-[#8aafc0]">
            <Activity className="w-12 h-12 mx-auto text-[#2a9bb0]/50 mb-3" />
            <h3 className="text-base font-semibold text-[#e8f4f8]">No Well Logs Uploaded</h3>
            <p className="text-xs mt-1 max-w-md mx-auto">
              Please upload your LAS well log files (.las, .txt) using the upload button above to inspect continuous wireline log tracks (GR, Porosity, Resistivity, Water Saturation).
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Well Picker */}
            <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#8aafc0] uppercase">Selected Well:</span>
                <select
                  value={activeWell.id}
                  onChange={(e) => {
                    setActiveWellId(e.target.value);
                    syncPetroState(wells, correlationMethod, datumMode, e.target.value);
                  }}
                  className="bg-[#071322] border border-[#2a9bb0]/40 rounded-lg px-3 py-1.5 text-xs text-[#00f0ff] font-bold outline-none"
                >
                  {wells.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.wellName} ({w.extractedPetro.netPayM}m Net Pay | Φ={(w.extractedPetro.meanPhi * 100).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick depth slider */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[#2ecc71]">Top:</span>
                  <input
                    type="number"
                    value={activeWell.topDepth}
                    onChange={(e) =>
                      handleUpdateWellInterval(
                        activeWell.id,
                        parseFloat(e.target.value) || 0,
                        activeWell.baseDepth
                      )
                    }
                    className="bg-[#071322] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#2ecc71] w-20"
                  />
                  <span>m</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[#e74c3c]">Base:</span>
                  <input
                    type="number"
                    value={activeWell.baseDepth}
                    onChange={(e) =>
                      handleUpdateWellInterval(
                        activeWell.id,
                        activeWell.topDepth,
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="bg-[#071322] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e74c3c] w-20"
                  />
                  <span>m</span>
                </div>
              </div>
            </div>

            {/* 4-Track Well Log Viewer */}
            <WellLogTracks
              las={activeWell.lasSummary}
              topDepth={activeWell.topDepth}
              baseDepth={activeWell.baseDepth}
            />
          </div>
        )
      )}

      {/* TAB 4: MANUAL OVERRIDE */}
      {activeTab === 'manual' && (
        <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-5">
          <h3 className="text-sm font-semibold text-[#00f0ff] uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Manual Parameter Inputs (Triangular Distributions)
          </h3>
          <p className="text-xs text-[#8aafc0]">
            Directly override statistical parameters for analogue basin modeling or sensitivity checks:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Porosity Manual */}
            <div className="bg-[#071322] p-4 rounded-xl border border-[#2a9bb0]/30 space-y-3">
              <span className="text-xs font-bold text-[#00f0ff] uppercase">Porosity (Φ)</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P50 Expected:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={phiP50}
                    onChange={(e) => setPhiP50(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right text-[#00f0ff] font-mono"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P10 High:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={phiP90}
                    onChange={(e) => setPhiP90(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right font-mono"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P90 Low:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={phiP10}
                    onChange={(e) => setPhiP10(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Water Saturation Manual */}
            <div className="bg-[#071322] p-4 rounded-xl border border-[#2a9bb0]/30 space-y-3">
              <span className="text-xs font-bold text-[#f0a500] uppercase">Water Saturation (Sw)</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P50 Expected:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={swP50}
                    onChange={(e) => setSwP50(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right text-[#f0a500] font-mono"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P10 High:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={swP90}
                    onChange={(e) => setSwP90(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right font-mono"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P90 Low:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={swP10}
                    onChange={(e) => setSwP10(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right font-mono"
                  />
                </div>
              </div>
            </div>

            {/* NTG Manual */}
            <div className="bg-[#071322] p-4 rounded-xl border border-[#2a9bb0]/30 space-y-3">
              <span className="text-xs font-bold text-[#2ecc71] uppercase">Net-to-Gross (NTG)</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P50 Expected:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={ntgP50}
                    onChange={(e) => setNtgP50(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right text-[#2ecc71] font-mono"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P10 High:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={ntgP90}
                    onChange={(e) => setNtgP90(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right font-mono"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8aafc0]">P90 Low:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={ntgP10}
                    onChange={(e) => setNtgP10(parseFloat(e.target.value) || 0)}
                    className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded px-2 py-0.5 w-20 text-right font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Well Location & Coordinates Modal */}
      {showLocationModal && (
        <WellLocationModal
          wells={wells}
          onSaveWellLocations={handleSaveWellLocations}
          onClose={() => setShowLocationModal(false)}
        />
      )}
    </div>
  );
};
