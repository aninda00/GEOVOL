import { LASSummary, PetroParam } from '../types';

export const CURVE_ALIASES = {
  porosity: ['PHIF', 'PHIE', 'PHIT', 'POR', 'POROSITY', 'NPHI', 'DPHI', 'CPOR'],
  sw: ['SW', 'SWE', 'SWT', 'SW_ARCHIE', 'SATURATION', 'SW_IND', 'SW_SIM'],
  ntg: ['NTG', 'NET_TO_GROSS', 'NET_PAY', 'SAND_FLAG'],
  gr: ['GR', 'GAMMA', 'GRD', 'CGR', 'SGR', 'GAM', 'GRR'],
  depth: ['DEPT', 'DEPTH', 'MD', 'TVD', 'TVDSS', 'TIME'],
  resistivity: ['RT', 'ILD', 'LLD', 'RES_DEEP', 'RESD', 'AHT90', 'RD'],
};

/**
 * Pre-defined Demo Well LAS data
 */
export const DEMO_WELLS = [
  {
    id: 'brent-a1',
    name: 'Brent Discovery Well A-1',
    description: 'High porosity shallow marine sand reservoir',
    topDepth: 2380,
    baseDepth: 2520,
    lasText: `# LAS 2.0
~VERSION INFORMATION
 VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
 WRAP.    NO : ONE LINE PER DEPTH STEP
~WELL INFORMATION
 WELL.   Brent-A1 : WELL NAME
 FLD .   Brent North : FIELD
~CURVE INFORMATION
 DEPT.M      : Depth
 GR  .GAPI   : Gamma Ray
 PHIF.V/V    : Effective Porosity
 SW  .V/V    : Water Saturation
 RT  .OHMM   : Resistivity
~ASCII
${Array.from({ length: 200 }, (_, i) => {
  const d = 2300 + i * 2;
  const inPay = d >= 2380 && d <= 2520;
  const gr = inPay ? (30 + Math.sin(i * 0.15) * 8).toFixed(1) : (95 + Math.cos(i * 0.2) * 15).toFixed(1);
  const phi = inPay ? (0.23 + Math.sin(i * 0.1) * 0.03).toFixed(3) : (0.06 + Math.random() * 0.02).toFixed(3);
  const sw = inPay ? (0.24 + Math.cos(i * 0.08) * 0.05).toFixed(3) : (0.95 + Math.random() * 0.04).toFixed(3);
  const rt = inPay ? (75 + Math.sin(i * 0.1) * 20).toFixed(1) : (2.5 + Math.random() * 0.5).toFixed(1);
  return `${d} ${gr} ${phi} ${sw} ${rt}`;
}).join('\n')}`,
  },
  {
    id: 'statfjord-a2',
    name: 'Statfjord Appraisal Well A-2',
    description: 'Thick deltaic sandstone sequence',
    topDepth: 2420,
    baseDepth: 2590,
    lasText: `# LAS 2.0
~VERSION INFORMATION
 VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
~WELL INFORMATION
 WELL.   Statfjord-A2 : WELL NAME
~CURVE INFORMATION
 DEPT.M      : Depth
 GR  .GAPI   : Gamma Ray
 PHIF.V/V    : Effective Porosity
 SW  .V/V    : Water Saturation
 RT  .OHMM   : Resistivity
~ASCII
${Array.from({ length: 200 }, (_, i) => {
  const d = 2350 + i * 2;
  const inPay = d >= 2420 && d <= 2590;
  const gr = inPay ? (28 + Math.sin(i * 0.12) * 6).toFixed(1) : (105 + Math.cos(i * 0.2) * 12).toFixed(1);
  const phi = inPay ? (0.26 + Math.sin(i * 0.08) * 0.04).toFixed(3) : (0.05 + Math.random() * 0.02).toFixed(3);
  const sw = inPay ? (0.19 + Math.cos(i * 0.06) * 0.04).toFixed(3) : (0.98 + Math.random() * 0.02).toFixed(3);
  const rt = inPay ? (110 + Math.sin(i * 0.1) * 25).toFixed(1) : (1.8 + Math.random() * 0.4).toFixed(1);
  return `${d} ${gr} ${phi} ${sw} ${rt}`;
}).join('\n')}`,
  },
  {
    id: 'oseberg-b1',
    name: 'Oseberg Wildcat Well B-1',
    description: 'Heterogeneous turbidite channel reservoir',
    topDepth: 2460,
    baseDepth: 2560,
    lasText: `# LAS 2.0
~VERSION INFORMATION
 VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
~WELL INFORMATION
 WELL.   Oseberg-B1 : WELL NAME
~CURVE INFORMATION
 DEPT.M      : Depth
 GR  .GAPI   : Gamma Ray
 PHIF.V/V    : Effective Porosity
 SW  .V/V    : Water Saturation
 RT  .OHMM   : Resistivity
~ASCII
${Array.from({ length: 200 }, (_, i) => {
  const d = 2400 + i * 2;
  const inPay = d >= 2460 && d <= 2560;
  const gr = inPay ? (42 + Math.sin(i * 0.2) * 12).toFixed(1) : (90 + Math.cos(i * 0.15) * 18).toFixed(1);
  const phi = inPay ? (0.19 + Math.sin(i * 0.14) * 0.03).toFixed(3) : (0.08 + Math.random() * 0.02).toFixed(3);
  const sw = inPay ? (0.32 + Math.cos(i * 0.12) * 0.06).toFixed(3) : (0.92 + Math.random() * 0.05).toFixed(3);
  const rt = inPay ? (45 + Math.sin(i * 0.1) * 15).toFixed(1) : (3.2 + Math.random() * 0.8).toFixed(1);
  return `${d} ${gr} ${phi} ${sw} ${rt}`;
}).join('\n')}`,
  },
];

/**
 * Parse an ASCII LAS file string
 */
export function parseLAS(lasText: string): LASSummary {
  const lines = lasText.split(/\r?\n/);
  let currentSection = '';
  let wellName = 'Unknown Well';
  const curves: Record<string, { unit: string; desc: string }> = {};
  const curveNames: string[] = [];
  const rawDataRows: number[][] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('~')) {
      if (line.toUpperCase().startsWith('~V')) currentSection = 'VERSION';
      else if (line.toUpperCase().startsWith('~W')) currentSection = 'WELL';
      else if (line.toUpperCase().startsWith('~C')) currentSection = 'CURVE';
      else if (line.toUpperCase().startsWith('~P')) currentSection = 'PARAM';
      else if (line.toUpperCase().startsWith('~A') || line.toUpperCase().startsWith('~ASCII')) {
        currentSection = 'ASCII';
      }
      continue;
    }

    if (currentSection === 'WELL') {
      const dotIdx = line.indexOf('.');
      if (dotIdx !== -1) {
        const mnemonic = line.substring(0, dotIdx).trim().toUpperCase();
        const colonIdx = line.indexOf(':', dotIdx);
        const val = (colonIdx !== -1 ? line.substring(dotIdx + 1, colonIdx) : line.substring(dotIdx + 1)).trim();
        if (mnemonic === 'WELL' || mnemonic === 'UWI' || mnemonic === 'NAME') {
          wellName = val || wellName;
        }
      }
    } else if (currentSection === 'CURVE') {
      const dotIdx = line.indexOf('.');
      if (dotIdx !== -1) {
        const mnemonic = line.substring(0, dotIdx).trim().toUpperCase();
        const colonIdx = line.indexOf(':', dotIdx);
        const unit = (colonIdx !== -1 ? line.substring(dotIdx + 1, colonIdx) : line.substring(dotIdx + 1)).trim();
        const desc = colonIdx !== -1 ? line.substring(colonIdx + 1).trim() : '';
        curves[mnemonic] = { unit, desc };
        curveNames.push(mnemonic);
      }
    } else if (currentSection === 'ASCII') {
      const tokens = line.split(/\s+/).filter(Boolean);
      const numbers = tokens.map((t) => parseFloat(t));
      if (numbers.length > 0 && !numbers.some(isNaN)) {
        rawDataRows.push(numbers);
      }
    }
  }

  // Build column arrays
  const data: Record<string, number[]> = {};
  for (let i = 0; i < curveNames.length; i++) {
    const cName = curveNames[i];
    const col: number[] = [];
    for (let r = 0; r < rawDataRows.length; r++) {
      if (i < rawDataRows[r].length) {
        const v = rawDataRows[r][i];
        if (v <= -990 || v >= 9990 || isNaN(v)) {
          col.push(NaN);
        } else {
          col.push(v);
        }
      }
    }
    data[cName] = col;
  }

  // Detect depth curve
  let depthCurve = curveNames.find((c) => CURVE_ALIASES.depth.includes(c)) || curveNames[0] || 'DEPT';
  const depthData = data[depthCurve]?.filter((v) => !isNaN(v)) || [];
  const depthMin = depthData.length > 0 ? Math.min(...depthData) : 0;
  const depthMax = depthData.length > 0 ? Math.max(...depthData) : 5000;

  return {
    wellName,
    curves,
    curveNames,
    nSamples: rawDataRows.length,
    depthMin,
    depthMax,
    depthCurve,
    data,
  };
}

/**
 * Extract petrophysical properties from LAS in target window
 */
export function extractPetroFromLAS(
  las: LASSummary,
  topDepth: number,
  baseDepth: number
): {
  meanPhi: number;
  meanSw: number;
  ntg: number;
} {
  const depthArr = las.data[las.depthCurve] || [];
  const phiCurve = las.curveNames.find((c) => CURVE_ALIASES.porosity.includes(c)) || 'PHIF';
  const swCurve = las.curveNames.find((c) => CURVE_ALIASES.sw.includes(c)) || 'SW';
  const grCurve = las.curveNames.find((c) => CURVE_ALIASES.gr.includes(c)) || 'GR';

  const phiArr = las.data[phiCurve] || [];
  const swArr = las.data[swCurve] || [];
  const grArr = las.data[grCurve] || [];

  let phiSum = 0;
  let phiCount = 0;
  let swSum = 0;
  let swCount = 0;
  let payCount = 0;
  let totalCount = 0;

  for (let i = 0; i < depthArr.length; i++) {
    const d = depthArr[i];
    if (d >= topDepth && d <= baseDepth) {
      totalCount++;
      const p = phiArr[i];
      const s = swArr[i];
      const gr = grArr[i];

      if (!isNaN(p)) {
        const val = p > 1.0 ? p / 100.0 : p;
        phiSum += val;
        phiCount++;
      }
      if (!isNaN(s)) {
        const val = s > 1.0 ? s / 100.0 : s;
        swSum += val;
        swCount++;
      }
      if (!isNaN(gr) && gr < 65) {
        payCount++;
      }
    }
  }

  const meanPhi = phiCount > 0 ? phiSum / phiCount : 0.22;
  const meanSw = swCount > 0 ? swSum / swCount : 0.30;
  const ntg = totalCount > 0 ? Math.max(0.3, payCount / totalCount) : 0.75;

  return {
    meanPhi: Math.round(meanPhi * 1000) / 1000,
    meanSw: Math.round(meanSw * 1000) / 1000,
    ntg: Math.round(ntg * 1000) / 1000,
  };
}

export function detectCurves(curveNames: string[]) {
  const upperNames = curveNames.map((c) => c.toUpperCase());
  const detected: Record<string, string> = {};
  for (const [key, aliases] of Object.entries(CURVE_ALIASES)) {
    for (const alias of aliases) {
      const idx = upperNames.indexOf(alias);
      if (idx !== -1) {
        detected[key] = curveNames[idx];
        break;
      }
    }
  }
  return detected;
}
