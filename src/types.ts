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

export interface Seismic2DLineInfo {
  id: string;
  name: string;
  dataset: SeismicDataset;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  azimuthDeg: number;
  lengthM: number;
  color: string;
  visible: boolean;
  inlineEquivalent?: number;
}

export interface LineIntersection {
  line1Id: string;
  line1Name: string;
  line1TraceIdx: number;
  line2Id: string;
  line2Name: string;
  line2TraceIdx: number;
  x: number;
  y: number;
  angleDeg?: number;
  timeDiffMs?: number;
}

export interface MultiLine2DSurvey {
  id: string;
  name: string;
  lines: Seismic2DLineInfo[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minT: number;
    maxT: number;
  };
  intersections: LineIntersection[];
  interpolatedCube?: SeismicDataset;
  gridNx: number;
  gridNy: number;
  inlineSpacingM: number;
  crosslineSpacingM: number;
  sampleRate: number;
  nSamples: number;
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
  source: 'synthetic' | 'segy' | 'preset' | '2d-preset' | 'multi-line-interpolated';
  name: string;
  lineName?: string;
  ramMb: number;
  meanTrace?: number[];
  envelope?: number[];
  textHeader?: string;
  binaryHeader?: SeismicBinaryHeader;
  sampleTraceHeaders?: TraceHeader[];
  isLittleEndian?: boolean;
  multiLineSurvey?: MultiLine2DSurvey;
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

export interface DeviationSurveyStation {
  md: number; // Measured Depth (m)
  inclination: number; // Inclination angle in degrees (0 = vertical, 90 = horizontal)
  azimuth: number; // Azimuth in degrees (0-360)
  tvd?: number; // True Vertical Depth (m) below KB
  tvdss?: number; // True Vertical Depth Subsea (TVD - KB)
  hd?: number; // Horizontal Displacement (m)
  dx?: number; // Delta Easting / X offset (m)
  dy?: number; // Delta Northing / Y offset (m)
  x?: number; // Absolute Easting
  y?: number; // Absolute Northing
  dogleg?: number; // Dogleg severity (deg/30m)
}

export interface WellTrajectory {
  rawSurveyText?: string;
  surveyType?: 'md_inc_az' | 'md_az_inc' | 'md_inc_hd_tvd_az' | 'directional';
  stations: DeviationSurveyStation[];
  maxInclination: number;
  bottomHoleLocation: {
    md: number;
    tvd: number;
    hd: number;
    x: number;
    y: number;
    azimuth: number;
    inclination: number;
  };
}

export interface WellLocation {
  x?: number; // Easting / Longitude / X Coordinate
  y?: number; // Northing / Latitude / Y Coordinate
  inline?: number; // 3D Seismic Inline index
  crossline?: number; // 3D Seismic Crossline index
  lineName?: string; // 2D Line ID/Name if in a 2D survey
  cdpOrSp?: number; // Shotpoint / CDP / Trace number along 2D line
  elevationKb?: number; // Kelly Bushing Elevation in meters
  groundElevation?: number; // Ground Level / Water Depth in meters
  totalDepth?: number; // Total Measured Depth in meters
}

export interface ExtractedWellPetro {
  meanPhi: number;
  meanSw: number;
  ntg: number;
  netPayM: number;
  grossIntervalM: number;
  phiP10: number;
  phiP50: number;
  phiP90: number;
  swP10: number;
  swP50: number;
  swP90: number;
  ntgP10: number;
  ntgP50: number;
  ntgP90: number;
  meanGr?: number;
  meanRt?: number;
}

export interface WellData {
  id: string;
  wellName: string;
  uwi?: string;
  field?: string;
  operator?: string;
  location: WellLocation;
  trajectory?: WellTrajectory; // Directional wellbore trajectory & deviation survey
  topDepth: number; // Top Reservoir depth in meters
  baseDepth: number; // Base Reservoir depth in meters
  topTwtMs?: number; // Computed/estimated seismic Two-Way Travel Time in ms
  baseTwtMs?: number;
  lasSummary: LASSummary;
  extractedPetro: ExtractedWellPetro;
  isActive: boolean; // Toggle for inclusion in field-wide property synthesis
  color?: string; // Color tag for charts and basemap
}

export interface MultiWellSynthesis {
  method: 'arithmetic' | 'thickness-weighted' | 'idw-spatial';
  activeWellCount: number;
  phi: PetroParam;
  sw: PetroParam;
  ntg: PetroParam;
  averageNetPayM: number;
  averageGrossIntervalM: number;
}

export interface PetroState {
  source: 'manual' | 'las' | 'multi-well' | 'demo' | 'default';
  porosity: PetroParam;
  phi: PetroParam;
  sw: PetroParam;
  ntg: PetroParam;
  bo: PetroParam;
  bg: PetroParam;
  lasSummary?: LASSummary | null;
  topDepth?: number;
  baseDepth?: number;
  wells?: WellData[]; // Multi-well array with location and petro properties
  activeWellId?: string; // Selected well for focused log curve viewing
  correlationMethod?: 'arithmetic' | 'thickness-weighted' | 'idw-spatial';
  datumMode?: 'structural-depth' | 'stratigraphic-top' | 'twt-time';
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
