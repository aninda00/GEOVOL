export type SeismicType = '3d' | '2d';

export interface TraceHeader {
  traceNumber: number;
  inline: number;
  crossline: number;
  cdp: number;
  shotPoint: number;
  ffid: number;
  sourceX: number;
  sourceY: number;
  groupX: number;
  groupY: number;
  cdpX: number;
  cdpY: number;
  elevation: number;
  scalar: number;
  nSamples: number;
  sampleIntervalUs: number;
  offset: number;
}

export interface SeismicBinaryHeader {
  jobId: number;
  lineNum: number;
  reelNum: number;
  tracesPerEnsemble: number;
  auxTracesPerEnsemble: number;
  sampleIntervalUs: number; // dt in µs
  origSampleIntervalUs: number;
  nSamples: number;
  origNSamples: number;
  formatCode: number; // 1=IBM float, 5=IEEE float, 2=int32, 3=int16, 8=int8
  formatDescription: string;
  cdpFold: number;
  traceSorting: number;
  verticalSum: number;
  sweepFreqStart: number;
  sweepFreqEnd: number;
  segRev: number;
  isLittleEndian: boolean;
}

export interface SegyImportOptions {
  mode: 'auto' | '2d' | '3d';
  inlineByte?: number; // default 189
  crosslineByte?: number; // default 193
  cdpByte?: number; // default 21
  spByte?: number; // default 17
  ffidByte?: number; // default 9
  scalarByte?: number; // default 71
  sourceXByte?: number; // default 73
  sourceYByte?: number; // default 77
  cdpXByte?: number; // default 181
  cdpYByte?: number; // default 185
  formatOverride?: number; // 1=IBM, 5=IEEE, 2=Int32, 3=Int16
  endiannessOverride?: 'auto' | 'big' | 'little';
  maxTraces?: number;
}

export interface SeismicDataset {
  type: SeismicType; // '2d' or '3d'
  data: Float32Array; // For 3D: [nInlines * nCrosslines * nSamples], for 2D: [nTraces * nSamples]
  nInlines: number; // For 2D: 1
  nCrosslines: number; // For 2D: nTraces
  nTraces: number; // Total traces: nInlines * nCrosslines
  nSamples: number;
  sampleRate: number; // in ms, e.g. 4.0
  totalTimeMs: number;
  ilines: number[]; // For 2D: [1]
  xlines: number[]; // For 2D: [1, 2, ..., nTraces] or CDP numbers
  cdpNumbers?: number[];
  shotPoints?: number[];
  xCoords?: number[];
  yCoords?: number[];
  source: 'synthetic' | 'segy' | 'preset' | '2d-preset';
  name: string;
  lineName?: string;
  ramMb: number;
  meanTrace?: number[];
  envelope?: number[];
  textHeader?: string;
  binaryHeader?: SeismicBinaryHeader;
  sampleTraceHeaders?: TraceHeader[];
  isLittleEndian?: boolean;
}

// Seamless alias for backwards compatibility
export type SeismicCube = SeismicDataset;

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
  isochoreM: number[][]; // [nInlines][nCrosslines] or [1][nTraces]
  cellAreaM2: number;
  nCells: number;
  avgThicknessM: number;
  maxThicknessM: number;
  // 2D line specific volumetric parameters
  is2D?: boolean;
  crossSectionAreaM2?: number; // Area under 2D line in m2
  assumedClosureWidthM?: number; // Assumed lateral width for 2D GRV
}

export interface HorizonState {
  topHorizon: number[][]; // [nInlines][nCrosslines] or [1][nTraces] sample index
  baseHorizon: number[][];
  isochoreMs: number[][];
  grvData: GRVData;
  velocity: number;
  inlineSpacing: number; // For 2D: along-line trace spacing in meters (e.g. 25m)
  crosslineSpacing: number; // For 2D: lateral closure width in meters (e.g. 1500m)
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
