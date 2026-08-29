import React, { useState, useEffect } from 'react';
import {
  SeismicCube,
  HorizonState,
  PetroState,
  MonteCarloResults,
  ProjectMetadata,
} from './types';
import {
  generateSyntheticCube,
  pickHorizonSurface,
  computeIsochore,
  computeGRV,
} from './modules/seismicEngine';
import { runMonteCarloSimulation } from './modules/volumetricsEngine';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Panel1Seismic } from './panels/Panel1Seismic';
import { Panel2Horizon } from './panels/Panel2Horizon';
import { Panel3Petro } from './panels/Panel3Petro';
import { Panel4Volumetrics } from './panels/Panel4Volumetrics';
import { Panel5Report } from './panels/Panel5Report';

export const App: React.FC = () => {
  // Navigation active panel (1 - 5)
  const [activePanel, setActivePanel] = useState<number>(1);

  // Project Metadata
  const [metadata, setMetadata] = useState<ProjectMetadata>({
    projectName: 'GEOVOL Saldanadi Assessment',
    fieldName: 'Saldanadi Gas Field',
    author: 'Geoscientist',
    formation: 'Bokabil / Upper Bhuban Gas Sand',
    notes: 'Probabilistic exploration & development volumetrics assessment combining 2D/3D seismic, Saldanadi wellhead coordinates, directional deviation surveys, and Monte Carlo uncertainty modeling.',
    date: new Date().toISOString().split('T')[0],
  });

  // Core Pipeline States
  const [cube, setCube] = useState<SeismicCube | null>(null);
  const [horizonState, setHorizonState] = useState<HorizonState | null>(null);
  const [petroState, setPetroState] = useState<PetroState>({
    source: 'default',
    porosity: { p10: 0.16, p50: 0.20, p90: 0.24, distribution: 'triangular' },
    phi: { p10: 0.16, p50: 0.20, p90: 0.24, distribution: 'triangular' },
    sw: { p10: 0.25, p50: 0.33, p90: 0.42, distribution: 'triangular' },
    ntg: { p10: 0.70, p50: 0.82, p90: 0.90, distribution: 'triangular' },
    bo: { p10: 1.15, p50: 1.22, p90: 1.30, distribution: 'triangular' },
    bg: { p10: 0.0040, p50: 0.0045, p90: 0.0052, distribution: 'triangular' },
  });
  const [mcResults, setMcResults] = useState<MonteCarloResults | null>(null);

  // Auto-initialize standard synthetic dataset on first load
  useEffect(() => {
    try {
      const initialCube = generateSyntheticCube(32, 32, 1000, 4.0, 'Saldanadi Exploration 3D Cube');
      setCube(initialCube);

      // Initial horizon picks
      const topHorizon = pickHorizonSurface(initialCube, 560, 12, 'positive');
      const baseHorizon = pickHorizonSurface(initialCube, 615, 12, 'positive');
      const isochoreMs = computeIsochore(topHorizon, baseHorizon, initialCube.sampleRate);
      const grvData = computeGRV(isochoreMs, 25, 25, 2500);

      const p50GRV = grvData.grvAcreFt;
      const initialHorizonState: HorizonState = {
        topHorizon,
        baseHorizon,
        isochoreMs,
        grvData,
        velocity: 2500,
        inlineSpacing: 25,
        crosslineSpacing: 25,
        topTargetMs: 2240,
        baseTargetMs: 2460,
        windowMs: 48,
        polarity: 'positive',
        structuralUncertaintyPercent: 15,
        grvP10: Math.round(p50GRV * 0.85),
        grvP50: Math.round(p50GRV),
        grvP90: Math.round(p50GRV * 1.15),
      };
      setHorizonState(initialHorizonState);

      // Initial Monte Carlo
      const initialMC = runMonteCarloSimulation({
        grv: {
          p10: initialHorizonState.grvP10,
          p50: initialHorizonState.grvP50,
          p90: initialHorizonState.grvP90,
          distribution: 'triangular',
        },
        porosity: petroState.porosity,
        sw: petroState.sw,
        ntg: petroState.ntg,
        bo: petroState.bo,
        bg: petroState.bg,
        runs: 10000,
        calcOil: true,
        calcGas: true,
        seed: 42,
      });
      setMcResults(initialMC);
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#071322] text-[#e8f4f8] flex flex-col font-sans">
      {/* Header */}
      <Header
        metadata={metadata}
        cube={cube}
        horizonState={horizonState}
        mcResults={mcResults}
      />

      {/* Main Workbench Layout: Sidebar + Active Panel */}
      <div className="flex-1 flex flex-col lg:flex-row w-full">
        {/* Navigation Sidebar */}
        <Sidebar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          cube={cube}
          horizonState={horizonState}
          petroState={petroState}
          mcResults={mcResults}
        />

        {/* Dynamic Content Panel View */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {activePanel === 1 && (
            <Panel1Seismic
              cube={cube}
              wells={petroState.wells}
              onCubeLoaded={(loadedCube) => {
                setCube(loadedCube);
                setHorizonState(null);
                setMcResults(null);
              }}
              onNavigateNext={() => setActivePanel(2)}
            />
          )}

          {activePanel === 2 && (
            <Panel2Horizon
              cube={cube}
              horizonState={horizonState}
              onHorizonSaved={(state) => {
                setHorizonState(state);
                setMcResults(null);
              }}
              onNavigateNext={() => setActivePanel(3)}
            />
          )}

          {activePanel === 3 && (
            <Panel3Petro
              petroState={petroState}
              onPetroSaved={(state) => {
                setPetroState(state);
                setMcResults(null);
              }}
              onNavigateNext={() => setActivePanel(4)}
            />
          )}

          {activePanel === 4 && (
            <Panel4Volumetrics
              horizonState={horizonState}
              petroState={petroState}
              mcResults={mcResults}
              onSimulationCompleted={setMcResults}
              onNavigateNext={() => setActivePanel(5)}
            />
          )}

          {activePanel === 5 && (
            <Panel5Report
              cube={cube}
              horizonState={horizonState}
              petroState={petroState}
              mcResults={mcResults}
              metadata={metadata}
              onMetadataChanged={setMetadata}
            />
          )}
        </main>
      </div>
    </div>
  );
};
export default App;
