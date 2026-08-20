import { MonteCarloResults, FluidMCResult, MonteCarloConfig } from '../types';

/**
 * Deterministic PRNG using Mulberry32 algorithm
 */
function createMulberry32(seed: number) {
  let s = Math.abs(seed | 0) + 1;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard Normal variate generator (Box-Muller)
 */
function sampleStandardNormal(rand: () => number): number {
  let u1 = rand();
  while (u1 <= 1e-7) u1 = rand();
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Sample from Triangular distribution defined by min, mode, max
 */
function sampleTriangular(min: number, mode: number, max: number, rand: () => number): number {
  if (min === max) return min;
  const c = (mode - min) / (max - min);
  const u = rand();
  if (u <= c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

/**
 * Sample parameter with P10, P50, P90 percentiles using PERT / Triangular bounds
 */
function sampleParameter(
  p10: number,
  p50: number,
  p90: number,
  clampMin: number,
  clampMax: number,
  rand: () => number
): number {
  if (p10 === p50 && p50 === p90) return p50;

  const span = p90 - p10;
  const minVal = Math.max(clampMin, p10 - span * 0.25);
  const maxVal = Math.min(clampMax, p90 + span * 0.25);
  const modeVal = Math.max(minVal, Math.min(maxVal, p50));

  const val = sampleTriangular(minVal, modeVal, maxVal, rand);
  return Math.max(clampMin, Math.min(clampMax, val));
}

/**
 * Sample GRV using lognormal distribution
 */
function sampleLognormalGRV(p10: number, p50: number, p90: number, rand: () => number): number {
  if (p10 <= 0 || p50 <= 0 || p90 <= 0 || (p10 === p50 && p50 === p90)) return Math.max(1, p50);

  const z90 = 1.28155;
  const mu = Math.log(p50);
  const sigma = Math.max(0.01, (Math.log(p90) - Math.log(p10)) / (2 * z90));

  const z = sampleStandardNormal(rand);
  return Math.exp(mu + sigma * z);
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;

  return Math.max(-1.0, Math.min(1.0, numerator / denom));
}

/**
 * Run full Monte Carlo reservoir simulation from Config object
 */
export function runMonteCarloSimulation(config: MonteCarloConfig): MonteCarloResults {
  const { grv, porosity, sw, ntg, bo, bg, runs, calcOil = true, calcGas = true, seed = 42 } = config;
  const rand = createMulberry32(seed);

  const grvArr = new Float64Array(runs);
  const ntgArr = new Float64Array(runs);
  const phiArr = new Float64Array(runs);
  const swArr = new Float64Array(runs);
  const boArr = new Float64Array(runs);
  const bgArr = new Float64Array(runs);

  const oiipRaw: number[] = [];
  const giipRaw: number[] = [];

  for (let i = 0; i < runs; i++) {
    const g = sampleLognormalGRV(grv.p10, grv.p50, grv.p90, rand);
    const n = sampleParameter(ntg.p10, ntg.p50, ntg.p90, 0.01, 1.0, rand);
    const p = sampleParameter(porosity.p10, porosity.p50, porosity.p90, 0.01, 0.5, rand);
    const s = sampleParameter(sw.p10, sw.p50, sw.p90, 0.05, 0.95, rand);
    const bOil = sampleParameter(bo.p10, bo.p50, bo.p90, 0.8, 3.0, rand);
    const bGas = sampleParameter(bg.p10, bg.p50, bg.p90, 0.001, 0.1, rand);

    grvArr[i] = g;
    ntgArr[i] = n;
    phiArr[i] = p;
    swArr[i] = s;
    boArr[i] = bOil;
    bgArr[i] = bGas;

    // Oil Initially In Place: (GRV [acre-ft] * 7758 * NTG * phi * (1 - Sw)) / (Bo * 1e6) -> MMstb
    if (calcOil) {
      const hcpvOil = g * 7758 * n * p * (1 - s);
      const oiip = hcpvOil / (bOil * 1e6);
      oiipRaw.push(Math.max(0, oiip));
    }

    // Gas Initially In Place: (GRV [acre-ft] * 43560 * NTG * phi * (1 - Sw)) / (Bg * 1e9) -> Bscf
    if (calcGas) {
      const hcpvGas = g * 43560 * n * p * (1 - s);
      const giip = hcpvGas / (bGas * 1e9);
      giipRaw.push(Math.max(0, giip));
    }
  }

  const buildFluidResult = (raw: number[], unit: string, fluidType: 'oiip' | 'giip'): FluidMCResult => {
    const sorted = [...raw].sort((a, b) => a - b);
    const n = sorted.length;
    // Petroleum P10 = low (10th percentile), P50 = median, P90 = high (90th percentile)
    const p10 = sorted[Math.floor(n * 0.1)] ?? sorted[0];
    const p50 = sorted[Math.floor(n * 0.5)] ?? sorted[Math.floor(n / 2)];
    const p90 = sorted[Math.floor(n * 0.9)] ?? sorted[n - 1];

    let sum = 0;
    for (let i = 0; i < n; i++) sum += sorted[i];
    const mean = sum / n;

    let sumSq = 0;
    for (let i = 0; i < n; i++) sumSq += Math.pow(sorted[i] - mean, 2);
    const std = Math.sqrt(sumSq / n);

    const gList = Array.from(grvArr);
    const nList = Array.from(ntgArr);
    const pList = Array.from(phiArr);
    const sList = Array.from(swArr);
    const boList = Array.from(boArr);
    const bgList = Array.from(bgArr);

    const sensitivity: Record<string, number> = {
      'GRV (Gross Rock Vol)': calculatePearsonCorrelation(gList, raw),
      'NTG (Net-to-Gross)': calculatePearsonCorrelation(nList, raw),
      'Porosity (φ)': calculatePearsonCorrelation(pList, raw),
      'Water Saturation (Sw)': calculatePearsonCorrelation(sList, raw),
    };

    if (fluidType === 'oiip') {
      sensitivity['Oil FVF (Bo)'] = calculatePearsonCorrelation(boList, raw);
    } else {
      sensitivity['Gas FVF (Bg)'] = calculatePearsonCorrelation(bgList, raw);
    }

    return {
      raw,
      p10: Math.round(p10 * 100) / 100,
      p50: Math.round(p50 * 100) / 100,
      p90: Math.round(p90 * 100) / 100,
      mean: Math.round(mean * 100) / 100,
      std: Math.round(std * 100) / 100,
      unit,
      sensitivity,
    };
  };

  const results: MonteCarloResults = {
    runs,
    inputs: config,
  };

  if (calcOil && oiipRaw.length > 0) {
    results.oiip = buildFluidResult(oiipRaw, 'MMstb', 'oiip');
  }

  if (calcGas && giipRaw.length > 0) {
    results.giip = buildFluidResult(giipRaw, 'Bscf', 'giip');
  }

  return results;
}

export const runMonteCarlo = runMonteCarloSimulation;
