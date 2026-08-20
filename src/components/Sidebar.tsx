import React from 'react';
import {
  Activity,
  Layers,
  FlaskConical,
  Dice5,
  FileCheck2,
  CheckCircle2,
  CircleDot,
  Circle,
} from 'lucide-react';
import { SeismicCube, HorizonState, PetroState, MonteCarloResults } from '../types';

interface SidebarProps {
  activePanel: number;
  onSelectPanel: (panelIndex: number) => void;
  cube: SeismicCube | null;
  horizonState: HorizonState | null;
  petroState: PetroState;
  mcResults: MonteCarloResults | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePanel,
  onSelectPanel,
  cube,
  horizonState,
  petroState,
  mcResults,
}) => {
  const panels = [
    {
      id: 1,
      title: 'Seismic QC',
      subtitle: '3D Volume & Candidate Slices',
      icon: Activity,
      isCompleted: !!cube,
      badge: cube ? `${cube.nInlines}×${cube.nCrosslines}` : 'Required',
    },
    {
      id: 2,
      title: 'Horizon & GRV',
      subtitle: 'Auto-Picking & 3D Model',
      icon: Layers,
      isCompleted: !!horizonState,
      badge: horizonState ? `${Math.round(horizonState.grvP50 / 1000)}k ac-ft` : 'Step 2',
    },
    {
      id: 3,
      title: 'Petrophysics',
      subtitle: 'Well Logs & Properties',
      icon: FlaskConical,
      isCompleted: true,
      badge: petroState.source.toUpperCase(),
    },
    {
      id: 4,
      title: 'Volumetrics',
      subtitle: 'Monte Carlo Simulation',
      icon: Dice5,
      isCompleted: !!mcResults,
      badge: mcResults ? `${mcResults.runs.toLocaleString()} runs` : 'Step 4',
    },
    {
      id: 5,
      title: 'Report & Export',
      subtitle: 'Excel & PDF Generator',
      icon: FileCheck2,
      isCompleted: !!(horizonState && mcResults),
      badge: 'Export',
    },
  ];

  // Calculate completion percentage
  let completedCount = 0;
  if (cube) completedCount++;
  if (horizonState) completedCount++;
  if (petroState) completedCount++;
  if (mcResults) completedCount++;
  if (horizonState && mcResults) completedCount++;
  const progressPct = Math.round((completedCount / 5) * 100);

  return (
    <aside className="w-full lg:w-72 bg-[#0a1829] border-b lg:border-b-0 lg:border-r border-[#2a9bb0]/20 p-4 flex flex-col justify-between shrink-0 shadow-lg select-none">
      <div className="space-y-4">
        {/* Workflow Progress Widget */}
        <div className="bg-[#071322] border border-[#2a9bb0]/30 rounded-xl p-3.5 shadow-inner">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-[#8aafc0]">Workflow Pipeline</span>
            <span className="font-mono text-[#2ecc71] font-bold">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-[#0f243f] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2a9bb0] via-[#2ecc71] to-[#00f0ff] transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step Buttons */}
        <nav className="space-y-2">
          {panels.map((p) => {
            const Icon = p.icon;
            const isActive = activePanel === p.id;

            return (
              <button
                key={p.id}
                onClick={() => onSelectPanel(p.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all group ${
                  isActive
                    ? 'bg-[#163654] border-[#2a9bb0] shadow-lg shadow-[#2a9bb0]/15'
                    : 'bg-[#0b1b30] border-[#2a9bb0]/15 hover:border-[#2a9bb0]/40 hover:bg-[#0f243f]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#2a9bb0] text-[#0a1628]'
                        : 'bg-[#162d4c] text-[#2a9bb0] group-hover:text-[#e8f4f8]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div
                      className={`text-xs font-bold ${
                        isActive ? 'text-[#e8f4f8]' : 'text-[#8aafc0] group-hover:text-[#e8f4f8]'
                      }`}
                    >
                      {p.id}. {p.title}
                    </div>
                    <div className="text-[10px] text-[#8aafc0]/80">{p.subtitle}</div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {p.isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2ecc71]" />
                  ) : isActive ? (
                    <CircleDot className="w-3.5 h-3.5 text-[#2a9bb0] animate-pulse" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-[#8aafc0]/40" />
                  )}
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                      p.isCompleted
                        ? 'bg-[#2ecc71]/10 text-[#2ecc71] border-[#2ecc71]/30'
                        : 'bg-[#0f243f] text-[#8aafc0] border-[#2a9bb0]/20'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-[#2a9bb0]/20 text-[11px] text-[#8aafc0] space-y-1">
        <div className="flex justify-between">
          <span>Engine:</span>
          <span className="font-mono text-[#e8f4f8]">React + Vite + WASM-ready</span>
        </div>
        <div className="flex justify-between">
          <span>Simulation:</span>
          <span className="font-mono text-[#2ecc71]">Box-Muller PRNG</span>
        </div>
      </div>
    </aside>
  );
};
