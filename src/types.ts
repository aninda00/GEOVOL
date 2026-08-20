export interface SeismicCube {
  data: Float32Array; // Flattened 3D array: [nInlines, nCrosslines, nSamples]
  nInlines: number;
  nCrosslines: number;
  nSamples: number;
  sampleRate: number; // in ms, e.g. 4.0
  totalTimeMs: number;
  ilines: number[];
  xlines: number[];
  source: 'synthetic' | 'segy' | 'preset';
  name: string;
  ramMb: number;
  meanTrace?: number[];
  envelope?: number[];
  textHeader?: string;
}

export interface HorizonSuggestion {
  sample: number;
  timeMs: number;
  amplitude: number;
  confidence: number;
}

export interface HorizonGrid {
  grid: number[][];
  name?: string;
  sampleRate?: number;
}

export interface GRVData {
  grvM3: number;
  grvFt3: number;
  grvAcreFt: number;
  grvKm3: number;
  isochoreM: number[][];
  cellAreaM2: number;
  nCells: number;
  avgThicknessM: number;
  maxThicknessM: number;
}

export interface HorizonState {
  topHorizon: number[][]; // [nInlines][nCrosslines] sample index
  baseHorizon: number[][];
  isochoreMs: number[][];
  grvData: GRVData;
  velocity: number;
  inlineSpacing: number;
  crosslineSpacing: number;
  topTargetMs: number;
  baseTargetMs: number;
  windowMs: number;
  polarity: 'positive' | 'negative' | 'both';
  structuralUncertaintyPercent: number;
  grvP10: number;
  grvP50: number;
  grvP90: number;
}

export interface PetroParam {
  p10: number;
  p50: number;
  p90: number;
  distribution?: 'triangular' | 'lognormal' | 'uniform' | 'normal';
  source?: 'manual' | 'las' | 'demo' | 'default' | string;
  curve?: string;
  mean?: number;
}

export interface PetroState {
  source: 'manual' | 'las' | 'demo' | 'default';
  porosity: PetroParam;
  phi: PetroParam;
  sw: PetroParam;
  ntg: PetroParam;
  bo: PetroParam;
  bg: PetroParam;
  lasSummary?: LASSummary | null;
  topDepth?: number;
  baseDepth?: number;
}

export interface LASSummary {
  wellName: string;
  curves: Record<string, { unit: string; desc: string }>;
  curveNames: string[];
  nSamples: number;
  depthMin: number;
  depthMax: number;
  depthCurve: string;
  data: Record<string, number[]>;
}

export interface FluidMCResult {
  raw: number[];
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  std: number;
  unit: string;
  sensitivity?: Record<string, number>;
}

export interface MonteCarloConfig {
  grv: PetroParam;
  porosity: PetroParam;
  sw: PetroParam;
  ntg: PetroParam;
  bo: PetroParam;
  bg: PetroParam;
  runs: number;
  calcOil?: boolean;
  calcGas?: boolean;
  seed?: number;
}

export interface MonteCarloResults {
  oiip?: FluidMCResult;
  giip?: FluidMCResult;
  sensitivity?: {
    oiip?: Record<string, number>;
    giip?: Record<string, number>;
  };
  runs: number;
  nSimulations?: number;
  inputs?: MonteCarloConfig;
  inputsSummary?: {
    grv: { p10: number; p50: number; p90: number };
    ntg: { p10: number; p50: number; p90: number };
    phi: { p10: number; p50: number; p90: number };
    sw: { p10: number; p50: number; p90: number };
    bo: { p10: number; p50: number; p90: number };
    bg: { p10: number; p50: number; p90: number };
  };
}

export interface ProjectMetadata {
  projectName: string;
  author: string;
  fieldName: string;
  formation?: string;
  notes?: string;
  date?: string;
}

export type ActivePanel = 'seismic' | 'horizon' | 'petro' | 'volumetrics' | 'report';
