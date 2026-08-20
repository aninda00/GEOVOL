import React, { useState, useEffect } from 'react';
import { HorizonState, PetroState, MonteCarloResults } from '../types';
import { runMonteCarloSimulation } from '../modules/volumetricsEngine';
import { HistogramChart } from '../components/HistogramChart';
import { TornadoChart } from '../components/TornadoChart';
import { SummaryBarChart } from '../components/SummaryBarChart';
import {
  Activity,
  Play,
  TrendingUp,
  Sliders,
  ChevronRight,
  RefreshCw,
  Award,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

interface Panel4VolumetricsProps {
  horizonState: HorizonState | null;
  petroState: PetroState;
  mcResults: MonteCarloResults | null;
  onSimulationCompleted: (results: MonteCarloResults) => void;
  onNavigateNext: () => void;
}

export const Panel4Volumetrics: React.FC<Panel4VolumetricsProps> = ({
  horizonState,
  petroState,
  mcResults,
  onSimulationCompleted,
  onNavigateNext,
}) => {
  const [numRuns, setNumRuns] = useState<number>(10000);
  const [calcOil, setCalcOil] = useState<boolean>(true);
  const [calcGas, setCalcGas] = useState<boolean>(true);
  const [seed, setSeed] = useState<number>(42);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'distributions' | 'tornado' | 'summary' | 'table'>(
    'distributions'
  );

  const handleRunSimulation = () => {
    if (!horizonState) return;

    setIsSimulating(true);
    setTimeout(() => {
      const results = runMonteCarloSimulation({
        grv: {
          p10: horizonState.grvP10,
          p50: horizonState.grvP50,
          p90: horizonState.grvP90,
          distribution: 'triangular',
        },
        porosity: petroState.porosity,
        sw: petroState.sw,
        ntg: petroState.ntg,
        bo: petroState.bo,
        bg: petroState.bg,
        runs: numRuns,
        calcOil,
        calcGas,
        seed,
      });

      onSimulationCompleted(results);
      setIsSimulating(false);
    }, 120);
  };

  // Run initial simulation if results don't exist yet
  useEffect(() => {
    if (!mcResults && horizonState) {
      handleRunSimulation();
    }
  }, [horizonState]);

  if (!horizonState) {
    return (
      <div className="p-8 bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <h3 className="text-lg font-bold text-[#e8f4f8]">No Horizon GRV Data Found</h3>
        <p className="text-sm text-[#8aafc0] mt-1 mb-4">
          Please complete horizon picking in Panel 2 before running Monte Carlo volumetrics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e8f4f8] flex items-center gap-2">
            <span className="text-2xl">🎲</span> Panel 4 — Monte Carlo Reservoir Volumetrics
          </h2>
          <p className="text-sm text-[#8aafc0] mt-1">
            Perform probabilistic Monte Carlo simulation to quantify reservoir uncertainty and calculate P10, P50, and P90 volumetric ranges for OIIP & GIIP.
          </p>
        </div>

        {mcResults && (
          <button
            onClick={onNavigateNext}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all shadow-md"
          >
            Proceed to Report & Export <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Simulation Controls & Parameters Summary */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#2a9bb0]/20">
          <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Monte Carlo Simulation Engine Setup
          </h3>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-[#e8f4f8]">
              <input
                type="checkbox"
                checked={calcOil}
                onChange={(e) => setCalcOil(e.target.checked)}
                className="accent-[#2a9bb0]"
              />
              Calculate Oil (OIIP)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[#e8f4f8]">
              <input
                type="checkbox"
                checked={calcGas}
                onChange={(e) => setCalcGas(e.target.checked)}
                className="accent-[#f0a500]"
              />
              Calculate Gas (GIIP)
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 items-center">
          {/* Runs Selector */}
          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#8aafc0] block mb-1 font-semibold">
              Monte Carlo Iterations ($N$)
            </label>
            <select
              value={numRuns}
              onChange={(e) => setNumRuns(parseInt(e.target.value, 10))}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] font-mono focus:outline-none"
            >
              <option value="1000">1,000 Iterations</option>
              <option value="5000">5,000 Iterations</option>
              <option value="10000">10,000 Iterations (Recommended)</option>
              <option value="50000">50,000 Iterations (High Precision)</option>
              <option value="100000">100,000 Iterations (Ultra Precision)</option>
            </select>
          </div>

          {/* Random Seed */}
          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#8aafc0] block mb-1 font-semibold">
              Reproducible PRNG Seed
            </label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] font-mono focus:outline-none"
            />
          </div>

          {/* Input Snapshot Summary */}
          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20 md:col-span-2 flex items-center justify-between text-xs">
            <div>
              <span className="text-[#8aafc0] block text-[10px] uppercase">Input Distributions</span>
              <span className="font-mono text-[#e8f4f8] text-[11px]">
                GRV: {horizonState.grvP50.toLocaleString()} ac-ft | $\phi$: {(petroState.porosity.p50 * 100).toFixed(1)}% | $S_w$: {(petroState.sw.p50 * 100).toFixed(1)}%
              </span>
            </div>
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-5 py-2.5 bg-[#2ecc71] hover:bg-[#27ae60] text-[#0a1628] font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-lg disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
              {isSimulating ? 'Running Simulation...' : '🚀 Execute Simulation'}
            </button>
          </div>
        </div>
      </div>

      {/* Volumetric Results Hero Cards */}
      {mcResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Oil Card */}
          {mcResults.oiip && (
            <div className="bg-[#0f2139] border border-[#2a9bb0]/40 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#2a9bb0]/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#2a9bb0]" />
                  <span className="font-bold text-base text-[#e8f4f8]">
                    Oil Initially In Place (OIIP / STOIIP)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold bg-[#2a9bb0]/20 text-[#2a9bb0] border border-[#2a9bb0]/40 px-2 py-0.5 rounded">
                  MMstb (Million STB)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 my-4 text-center">
                <div className="bg-[#071322] p-3 rounded-lg border border-[#e74c3c]/30">
                  <div className="text-[10px] text-[#e74c3c] uppercase font-bold">P10 (Low)</div>
                  <div className="text-2xl font-bold font-mono text-[#e74c3c] mt-0.5">
                    {mcResults.oiip.p10.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8aafc0]">90% exceedance</div>
                </div>

                <div className="bg-[#071322] p-3 rounded-lg border border-[#2ecc71]/40 shadow-inner">
                  <div className="text-[10px] text-[#2ecc71] uppercase font-bold">P50 (Median)</div>
                  <div className="text-2xl font-bold font-mono text-[#2ecc71] mt-0.5">
                    {mcResults.oiip.p50.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8aafc0]">Best Estimate</div>
                </div>

                <div className="bg-[#071322] p-3 rounded-lg border border-[#f0a500]/30">
                  <div className="text-[10px] text-[#f0a500] uppercase font-bold">P90 (High)</div>
                  <div className="text-2xl font-bold font-mono text-[#f0a500] mt-0.5">
                    {mcResults.oiip.p90.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8aafc0]">10% exceedance</div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-[#8aafc0] pt-2 border-t border-[#2a9bb0]/15 font-mono">
                <span>Mean: <b className="text-[#e8f4f8]">{mcResults.oiip.mean.toFixed(2)} MMstb</b></span>
                <span>StdDev: <b className="text-[#e8f4f8]">{mcResults.oiip.std.toFixed(2)} MMstb</b></span>
                <span>P90/P10 Ratio: <b className="text-[#2a9bb0]">{(mcResults.oiip.p90 / Math.max(0.1, mcResults.oiip.p10)).toFixed(2)}x</b></span>
              </div>
            </div>
          )}

          {/* Gas Card */}
          {mcResults.giip && (
            <div className="bg-[#0f2139] border border-[#f0a500]/40 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#f0a500]/20">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f0a500]" />
                  <span className="font-bold text-base text-[#e8f4f8]">
                    Gas Initially In Place (GIIP)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold bg-[#f0a500]/20 text-[#f0a500] border border-[#f0a500]/40 px-2 py-0.5 rounded">
                  Bscf (Billion SCF)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 my-4 text-center">
                <div className="bg-[#071322] p-3 rounded-lg border border-[#e74c3c]/30">
                  <div className="text-[10px] text-[#e74c3c] uppercase font-bold">P10 (Low)</div>
                  <div className="text-2xl font-bold font-mono text-[#e74c3c] mt-0.5">
                    {mcResults.giip.p10.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8aafc0]">90% exceedance</div>
                </div>

                <div className="bg-[#071322] p-3 rounded-lg border border-[#2ecc71]/40 shadow-inner">
                  <div className="text-[10px] text-[#2ecc71] uppercase font-bold">P50 (Median)</div>
                  <div className="text-2xl font-bold font-mono text-[#2ecc71] mt-0.5">
                    {mcResults.giip.p50.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8aafc0]">Best Estimate</div>
                </div>

                <div className="bg-[#071322] p-3 rounded-lg border border-[#f0a500]/30">
                  <div className="text-[10px] text-[#f0a500] uppercase font-bold">P90 (High)</div>
                  <div className="text-2xl font-bold font-mono text-[#f0a500] mt-0.5">
                    {mcResults.giip.p90.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8aafc0]">10% exceedance</div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-[#8aafc0] pt-2 border-t border-[#f0a500]/15 font-mono">
                <span>Mean: <b className="text-[#e8f4f8]">{mcResults.giip.mean.toFixed(2)} Bscf</b></span>
                <span>StdDev: <b className="text-[#e8f4f8]">{mcResults.giip.std.toFixed(2)} Bscf</b></span>
                <span>P90/P10 Ratio: <b className="text-[#f0a500]">{(mcResults.giip.p90 / Math.max(0.1, mcResults.giip.p10)).toFixed(2)}x</b></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tabs */}
      {mcResults && (
        <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#2a9bb0]/20">
            <div className="flex items-center gap-2 bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/30">
              <button
                onClick={() => setActiveTab('distributions')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  activeTab === 'distributions'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                Distributions & CDF Curves
              </button>
              <button
                onClick={() => setActiveTab('tornado')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  activeTab === 'tornado'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                Sensitivity Tornado Charts
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  activeTab === 'summary'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                Volumetric Summary Bars
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  activeTab === 'table'
                    ? 'bg-[#2a9bb0] text-[#0a1628] shadow'
                    : 'text-[#8aafc0] hover:text-[#e8f4f8]'
                }`}
              >
                Statistical Distribution Matrix
              </button>
            </div>
          </div>

          {/* Tab 1: Histograms */}
          {activeTab === 'distributions' && (
            <div className="space-y-4">
              {mcResults.oiip && (
                <HistogramChart
                  fluidResult={mcResults.oiip}
                  fluidLabel="Oil Initially In Place (OIIP)"
                  color="#2a9bb0"
                />
              )}
              {mcResults.giip && (
                <HistogramChart
                  fluidResult={mcResults.giip}
                  fluidLabel="Gas Initially In Place (GIIP)"
                  color="#f0a500"
                />
              )}
            </div>
          )}

          {/* Tab 2: Tornado Charts */}
          {activeTab === 'tornado' && (
            <div className="space-y-4">
              {mcResults.oiip && (
                <TornadoChart
                  sensitivity={mcResults.oiip.sensitivity}
                  fluidLabel="Oil (OIIP)"
                  unit="MMstb"
                />
              )}
              {mcResults.giip && (
                <TornadoChart
                  sensitivity={mcResults.giip.sensitivity}
                  fluidLabel="Gas (GIIP)"
                  unit="Bscf"
                />
              )}
            </div>
          )}

          {/* Tab 3: Summary Bars */}
          {activeTab === 'summary' && <SummaryBarChart mc={mcResults} />}

          {/* Tab 4: Statistical Table */}
          {activeTab === 'table' && (
            <div className="overflow-x-auto rounded-lg border border-[#2a9bb0]/20">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#071322] text-[#8aafc0] font-mono">
                  <tr>
                    <th className="p-3">Hydrocarbon Metric</th>
                    <th className="p-3">Unit</th>
                    <th className="p-3 text-[#e74c3c]">P10 (Low)</th>
                    <th className="p-3 text-[#2ecc71]">P50 (Median)</th>
                    <th className="p-3 text-[#f0a500]">P90 (High)</th>
                    <th className="p-3">Mean</th>
                    <th className="p-3">Std Dev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a9bb0]/15 bg-[#0b1b30] font-mono">
                  {mcResults.oiip && (
                    <tr className="hover:bg-[#162d4c]/50 transition-colors">
                      <td className="p-3 font-bold text-[#e8f4f8]">Oil Initially In Place (OIIP)</td>
                      <td className="p-3 text-[#2a9bb0]">MMstb</td>
                      <td className="p-3 text-[#e74c3c] font-bold">{mcResults.oiip.p10.toFixed(2)}</td>
                      <td className="p-3 text-[#2ecc71] font-bold">{mcResults.oiip.p50.toFixed(2)}</td>
                      <td className="p-3 text-[#f0a500] font-bold">{mcResults.oiip.p90.toFixed(2)}</td>
                      <td className="p-3 text-[#e8f4f8]">{mcResults.oiip.mean.toFixed(2)}</td>
                      <td className="p-3 text-[#8aafc0]">{mcResults.oiip.std.toFixed(2)}</td>
                    </tr>
                  )}
                  {mcResults.giip && (
                    <tr className="hover:bg-[#162d4c]/50 transition-colors">
                      <td className="p-3 font-bold text-[#e8f4f8]">Gas Initially In Place (GIIP)</td>
                      <td className="p-3 text-[#f0a500]">Bscf</td>
                      <td className="p-3 text-[#e74c3c] font-bold">{mcResults.giip.p10.toFixed(2)}</td>
                      <td className="p-3 text-[#2ecc71] font-bold">{mcResults.giip.p50.toFixed(2)}</td>
                      <td className="p-3 text-[#f0a500] font-bold">{mcResults.giip.p90.toFixed(2)}</td>
                      <td className="p-3 text-[#e8f4f8]">{mcResults.giip.mean.toFixed(2)}</td>
                      <td className="p-3 text-[#8aafc0]">{mcResults.giip.std.toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
