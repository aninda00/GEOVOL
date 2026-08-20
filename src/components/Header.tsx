import React from 'react';
import { Layers, Database, Sparkles, Activity, FileSpreadsheet } from 'lucide-react';
import { SeismicCube, HorizonState, MonteCarloResults, ProjectMetadata } from '../types';

interface HeaderProps {
  metadata: ProjectMetadata;
  cube: SeismicCube | null;
  horizonState: HorizonState | null;
  mcResults: MonteCarloResults | null;
}

export const Header: React.FC<HeaderProps> = ({
  metadata,
  cube,
  horizonState,
  mcResults,
}) => {
  return (
    <header className="w-full bg-[#0a1829] border-b border-[#2a9bb0]/30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xl select-none">
      {/* Brand & Project Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2a9bb0] via-[#1a6b7a] to-[#0f2139] border border-[#00f0ff]/50 flex items-center justify-center shadow-lg shadow-[#2a9bb0]/20">
          <span className="font-mono font-black text-sm text-[#0a1628]">GV</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-wider text-[#e8f4f8]">
              GEOVOL <span className="text-[#2a9bb0] text-xs font-normal">3D Studio</span>
            </h1>
            <span className="bg-[#2a9bb0]/20 text-[#2a9bb0] text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-[#2a9bb0]/40">
              v2.0 Web
            </span>
          </div>
          <p className="text-[11px] text-[#8aafc0]">
            {metadata.projectName} — <span className="text-[#f0a500] font-semibold">{metadata.fieldName}</span>
          </p>
        </div>
      </div>

      {/* Quick Live Project Status Badges */}
      <div className="flex items-center gap-3 text-xs">
        {/* Seismic status */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#0f243f] px-3 py-1.5 rounded-lg border border-[#2a9bb0]/20">
          <Database className="w-3.5 h-3.5 text-[#2a9bb0]" />
          <span className="text-[#8aafc0]">Seismic:</span>
          <span className="font-mono text-[#e8f4f8] font-semibold">
            {cube ? `${cube.nInlines}×${cube.nCrosslines}` : 'Not Loaded'}
          </span>
        </div>

        {/* GRV status */}
        {horizonState && (
          <div className="hidden md:flex items-center gap-1.5 bg-[#0f243f] px-3 py-1.5 rounded-lg border border-[#2a9bb0]/20">
            <Layers className="w-3.5 h-3.5 text-[#f0a500]" />
            <span className="text-[#8aafc0]">GRV:</span>
            <span className="font-mono text-[#f0a500] font-semibold">
              {Math.round(horizonState.grvP50 / 1000)}k ac-ft
            </span>
          </div>
        )}

        {/* OIIP status */}
        {mcResults?.oiip && (
          <div className="flex items-center gap-1.5 bg-[#0f243f] px-3 py-1.5 rounded-lg border border-[#2ecc71]/30">
            <Activity className="w-3.5 h-3.5 text-[#2ecc71]" />
            <span className="text-[#8aafc0]">P50 OIIP:</span>
            <span className="font-mono text-[#2ecc71] font-bold">
              {mcResults.oiip.p50.toFixed(1)} MMstb
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
