import { LASSummary, PetroParam, WellData, WellLocation, ExtractedWellPetro, MultiWellSynthesis, WellTrajectory } from '../types';
import { parseDeviationSurveyFile, parseWellHeadsFile } from './deviationEngine';

export const CURVE_ALIASES = {
  porosity: ['PHIF', 'PHIE', 'PHIT', 'POR', 'POROSITY', 'NPHI', 'DPHI', 'CPOR', 'POR_TOTAL', 'POR_EFF'],
  sw: ['SW', 'SWE', 'SWT', 'SW_ARCHIE', 'SATURATION', 'SW_IND', 'SW_SIM', 'SW_TOTAL', 'SW_EFF'],
  ntg: ['NTG', 'NET_TO_GROSS', 'NET_PAY', 'SAND_FLAG', 'PAY_FLAG', 'RES_FLAG'],
  gr: ['GR', 'GAMMA', 'GRD', 'CGR', 'SGR', 'GAM', 'GRR', 'GR_RAW'],
  depth: ['DEPT', 'DEPTH', 'MD', 'TVD', 'TVDSS', 'TIME'],
  resistivity: ['RT', 'ILD', 'LLD', 'RES_DEEP', 'RESD', 'AHT90', 'RD', 'RILD', 'LL8'],
  density: ['RHOB', 'RHOZ', 'DEN', 'DENSITY', 'RHO'],
  sonic: ['DT', 'DTC', 'AC', 'SONIC', 'DT24', 'DELTA_T'],
  caliper: ['CALI', 'CAL', 'CALS', 'HCAL'],
};

export const RAW_SLD2_DEVIATION_TEXT = `MD     Incl	HD     TVD     Azim
200	1.75	0	200	0	
209	1.75	0.07	209	68	
237	1	0.27	236.99	70
266	0.50	0.30	265.99	73
294	0.75	0.36	293.98	69
323	0.50	0.60	322.98	68.9
351	0.25	0.75	350.98	73.4	
380	1	0.57	379.98	77
408	3	0.30	407.96	75
437	5	1.91	436.89	75
465	7	4.32	464.74	76
494	9	8.05	493.46	77.1
522	10.50	12.65	521.05	77
551	11	17.95	549.54	78.2
580	11.50	23.52	577.98	78.4
608	12.50	29.27	605.37	84.6
637	14	35.86	633.60	86.2
665	15	42.83	660.71	80.5
694	16	50.55	688.65	82
722	17.50	58.59	715.46	84.1
751	19.25	67.71	742.98	86.3
764	19.25	71.99	755.26	86.8
793	21.25	82.02	782.46	87
821	21.25	92.17	808.56	87.5
850	21.25	102.67	835.59	88
878	21.25	112.82	861.68	89.1
907	19.25	122.85	888.89	89
921	19	127.41	902.12	88.6
935	20	132.04	915.32	85.3
964	22.25	142.41	942.37	84.8
992	24.25	153.38	968.09	84
1021	27.25	165.90	994.21	84.3
1049	28.25	178.87	1018.99	85.1
1078	29	192.70	1044.44	85.5
1106	28.50	206.10	1068.99	85.8
1134	28.75	219.45	1093.57	86.7
1153	27.50	233.06	1119.14	86
1172	27.25	237.18	1127.14	85.4
1209	27.50	254.12	1159.99	85.2
1237	27	266.90	1184.88	84.9
1265	26.75	279.53	1209.86	85.8
1294	26.25	292.43	1235.81	86.5
1322	26	304.72	1260.95	86
1351	25.75	317.35	1287.05	85.9
1379	25	329.32	1312.34	86.5
1407	24	340.91	1337.82	86.2
1436	24	352.70	1364.32	86.7
1464	24	364.08	1389.90	87
1493	24	375.88	1416.39	87.5
1521	23.75	387.21	1441.99	87.8
1549	23.75	398.48	1467.62	88.1
1578	23.50	410.10	1494.19	88.6
1606	23	421.15	1519.92	87.4
1635	22.50	432.37	1546.66	89.3
1663	22	442.97	1572.58	90
1691	22	453.46	1598.54	96
1720	22.25	464.37	1625.40	94.8
1748	23	475.11	1651.25	96.8
1777	22.75	486.35	1677.97	94.6
1805	23	497.17	1703.76	96.4
1833	23	508.03	1729.54	97
1862	23.25	519.29	1756.21	95.3
1890	23.25	530.21	1781.93	95	
1919	23	541.46	1808.60	95.4
1947	22	552.05	1834.47	94.5
1975	21.25	562.25	1860.50	96.5
2004	20.25	572.40	1887.62	97
2032	19.75	581.87	1913.93	95.8
2067	18.25	593.16	1947.03	94.5
2100	18.50	603.54	1978.34	92
2148	19	618.96	2023.80	91
2225	25	647.74	2095.16	88.9
2245	25	656.17	2113.28	89.6
2302	23.75	679.62	2165.20	85.8
2350	23.50	698.78	2209.18	85.5
2388	23	713.72	2244.09	85.3
2458	22	740.41	2308.76	85
3000	22	740.41	3000.76	85`;

export const RAW_SLD3_DEVIATION_TEXT = `MD    Azimuth	Inclination
150	0	0
181	78.6	4.3
210	72.4	7.3
239	67.8	7
267	63.1	8
296	58.2	9.2
325	55.8	10
354	56.1	11
383	53.9	13.5
413	46.6	15.4
442	45.7	16.6
471	46.5	19.2
500	46.4	21.1
529	45.9	22.9
558	45.7	24.7
587	46.2	27
616	47.6	29.4
645	49.3	31.4
674	49.3	33.9
703	52.4	35.7
732	53.8	34.4
761	54.4	36.2
790	54.5	36.4
819	55.1	35.3
848	55.6	35.9
877	56.2	35.4
925	57.6	34.9
955	56.9	34.8
984	55.9	36.5
1013	55.8	36.8
1042	55.9	38
1071	56.1	39.4
1100	56	38.7
1129	55.7	38.6
1158	56.7	37.9
1187	57.3	38.6
1215	57	38.2
1244	57	36.9
1273	57.3	35.8
1303	56.1	35.3
1331	55.9	34.7
1360	56.1	34.2
1389	56.4	34.3
1419	57.1	34.5
1448	57.6	34.9
1477	58.4	35.4
1506	58.4	34.6
1535	59.1	35
1564	57.3	34.3
1593	57.6	34.9
1622	58.6	35.6
1650	59	34.8
1679	59.1	35.3
1708.5	59	34.8
1737	58.8	34.5
1767	58.5	34.1
1795	58.2	34
1824	58.1	33.8
1853	57.6	33.8
1882	57.2	33.7
1910.5	57.1	33.2
1940	56.6	32.5
1967	56.6	32.5
1987	56.1	31.5
2025	56	30.8
2056	56	31.4
2085	55.7	32.3
2114	55.4	33.3
2143	55.6	34.6
2172	55.6	35.8
2200	55.8	36.9
2228	55.9	38.4
2247	56.3	38.9
2328	56.1	36.5
2356.5	55.8	36.4
2385	55.4	36.7
2413	54.8	36.4
2441.5	54.5	36.8
2470	54.4	36.7
2498.5	54.3	36.6
2527	54.3	36.5
2555	55.2	36.1
2584	50.9	36.8
2613	50	36.5
2642	49.2	36.8
2670	48.6	37.2
2698	48.1	37.9
2727	47.6	37.8
2756	46.8	38
2785	46.2	38
2814	45.6	37.4
2842	44.9	37.7
2860	44.46	37.9`;

export const RAW_SALDA_WELL_HEADS_TEXT = `Well Name	Northing Y	Easting.X	KB	TD
SALDANADI-1	2618432.921	619806.234	26.94	3000
SALDANADI-2	2618432.921	619810.234	26.94	3000
SALDANADI-3	2618427.921	619806.234	26.94	3000`;

/**
 * SALDANADI Field Multi-Well Exploration & Development Dataset
 * Real wellhead coordinates, directional deviation surveys, and wireline logs
 */
export const SALDANADI_FIELD_DATASET: {
  id: string;
  name: string;
  uwi: string;
  field: string;
  operator: string;
  location: WellLocation;
  topDepth: number;
  baseDepth: number;
  description: string;
  lasText: string;
  rawDeviationText?: string;
  color: string;
}[] = [
  {
    id: 'well-saldanadi-1',
    name: 'SALDANADI-1',
    uwi: 'BAPEX-SLD-01',
    field: 'Saldanadi Gas Field',
    operator: 'BAPEX / Petrobangla',
    location: {
      x: 619806.234,
      y: 2618432.921,
      inline: 12,
      crossline: 15,
      lineName: 'SURVEY-SLD-2D-01',
      cdpOrSp: 240,
      elevationKb: 26.94,
      groundElevation: 12.5,
      totalDepth: 3000,
    },
    topDepth: 2420,
    baseDepth: 2560,
    description: 'Discovery Well (Vertical) — Main Saldanadi Upper & Lower Gas Sand reservoirs',
    color: '#00f0ff',
    lasText: `# LAS 2.0
~VERSION INFORMATION
 VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
 WRAP.    NO : ONE LINE PER DEPTH STEP
~WELL INFORMATION
 WELL.   SALDANADI-1    : WELL NAME
 UWI .   BAPEX-SLD-01   : UNIQUE WELL IDENTIFIER
 FLD .   Saldanadi Gas  : FIELD
 COMP.   BAPEX          : OPERATOR
 SRVC.   Schlumberger   : LOGGING SERVICE
 DATE.   1996-03-24     : DATE LOGGED
 X   .   619806.23      : SURFACE X (EASTING)
 Y   .   2618432.92     : SURFACE Y (NORTHING)
 ELEV.   26.94          : KB ELEVATION (M)
 TD  .   3000.00        : TOTAL DEPTH (M)
~CURVE INFORMATION
 DEPT.M      : Measured Depth
 GR  .GAPI   : Gamma Ray (Clean Sand < 50)
 PHIF.V/V    : Effective Porosity
 SW  .V/V    : Water Saturation
 RT  .OHMM   : True Formation Resistivity
 RHOB.G/C3   : Bulk Density
~ASCII
${Array.from({ length: 240 }, (_, i) => {
  const d = 2320 + i * 2;
  const inPay = d >= 2420 && d <= 2560;
  const gr = inPay ? (26 + Math.sin(i * 0.14) * 6).toFixed(1) : (96 + Math.cos(i * 0.2) * 15).toFixed(1);
  const phi = inPay ? (0.242 + Math.sin(i * 0.1) * 0.022).toFixed(3) : (0.052 + Math.random() * 0.02).toFixed(3);
  const sw = inPay ? (0.22 + Math.cos(i * 0.08) * 0.04).toFixed(3) : (0.94 + Math.random() * 0.04).toFixed(3);
  const rt = inPay ? (95 + Math.sin(i * 0.1) * 25).toFixed(1) : (2.2 + Math.random() * 0.5).toFixed(1);
  const rhob = inPay ? (2.16 + Math.sin(i * 0.1) * 0.04).toFixed(2) : (2.59 + Math.random() * 0.05).toFixed(2);
  return `${d} ${gr} ${phi} ${sw} ${rt} ${rhob}`;
}).join('\n')}`,
  },
  {
    id: 'well-saldanadi-2',
    name: 'SALDANADI-2',
    uwi: 'BAPEX-SLD-02',
    field: 'Saldanadi Gas Field',
    operator: 'BAPEX / Petrobangla',
    location: {
      x: 619810.234,
      y: 2618432.921,
      inline: 18,
      crossline: 22,
      lineName: 'SURVEY-SLD-2D-02',
      cdpOrSp: 310,
      elevationKb: 26.94,
      groundElevation: 12.5,
      totalDepth: 3000,
    },
    topDepth: 2435,
    baseDepth: 2585,
    description: 'Deviated Appraisal Well — East Flank step-out (Max Inc 29°, HD 740m)',
    rawDeviationText: RAW_SLD2_DEVIATION_TEXT,
    color: '#2ecc71',
    lasText: `# LAS 2.0
~VERSION INFORMATION
 VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
 WRAP.    NO : ONE LINE PER DEPTH STEP
~WELL INFORMATION
 WELL.   SALDANADI-2    : WELL NAME
 UWI .   BAPEX-SLD-02   : UNIQUE WELL IDENTIFIER
 FLD .   Saldanadi Gas  : FIELD
 COMP.   BAPEX          : OPERATOR
 SRVC.   Halliburton    : LOGGING SERVICE
 DATE.   2014-07-10     : DATE LOGGED
 X   .   619810.23      : SURFACE X (EASTING)
 Y   .   2618432.92     : SURFACE Y (NORTHING)
 ELEV.   26.94          : KB ELEVATION (M)
 TD  .   3000.00        : TOTAL DEPTH (M)
~CURVE INFORMATION
 DEPT.M      : Measured Depth
 GR  .GAPI   : Gamma Ray
 PHIF.V/V    : Effective Porosity
 SW  .V/V    : Water Saturation
 RT  .OHMM   : True Formation Resistivity
 RHOB.G/C3   : Bulk Density
~ASCII
${Array.from({ length: 240 }, (_, i) => {
  const d = 2360 + i * 2;
  const inPay = d >= 2435 && d <= 2585;
  const gr = inPay ? (23 + Math.sin(i * 0.12) * 5).toFixed(1) : (102 + Math.cos(i * 0.18) * 12).toFixed(1);
  const phi = inPay ? (0.265 + Math.sin(i * 0.09) * 0.028).toFixed(3) : (0.046 + Math.random() * 0.02).toFixed(3);
  const sw = inPay ? (0.185 + Math.cos(i * 0.06) * 0.035).toFixed(3) : (0.97 + Math.random() * 0.02).toFixed(3);
  const rt = inPay ? (130 + Math.sin(i * 0.1) * 30).toFixed(1) : (1.8 + Math.random() * 0.4).toFixed(1);
  const rhob = inPay ? (2.12 + Math.sin(i * 0.08) * 0.04).toFixed(2) : (2.63 + Math.random() * 0.04).toFixed(2);
  return `${d} ${gr} ${phi} ${sw} ${rt} ${rhob}`;
}).join('\n')}`,
  },
  {
    id: 'well-saldanadi-3',
    name: 'SALDANADI-3',
    uwi: 'BAPEX-SLD-03',
    field: 'Saldanadi Gas Field',
    operator: 'BAPEX / Petrobangla',
    location: {
      x: 619806.234,
      y: 2618427.921,
      inline: 24,
      crossline: 10,
      lineName: 'SURVEY-SLD-2D-01',
      cdpOrSp: 180,
      elevationKb: 26.94,
      groundElevation: 12.5,
      totalDepth: 2860,
    },
    topDepth: 2450,
    baseDepth: 2590,
    description: 'Deviated Appraisal Well — North-East Anticlinal Flank (Max Inc 39.4°, HD 1120m)',
    rawDeviationText: RAW_SLD3_DEVIATION_TEXT,
    color: '#f0a500',
    lasText: `# LAS 2.0
~VERSION INFORMATION
 VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
 WRAP.    NO : ONE LINE PER DEPTH STEP
~WELL INFORMATION
 WELL.   SALDANADI-3    : WELL NAME
 UWI .   BAPEX-SLD-03   : UNIQUE WELL IDENTIFIER
 FLD .   Saldanadi Gas  : FIELD
 COMP.   BAPEX          : OPERATOR
 SRVC.   Baker Hughes   : LOGGING SERVICE
 DATE.   2014-07-03     : DATE LOGGED
 X   .   619806.23      : SURFACE X (EASTING)
 Y   .   2618427.92     : SURFACE Y (NORTHING)
 ELEV.   26.94          : KB ELEVATION (M)
 TD  .   2860.00        : TOTAL DEPTH (M)
~CURVE INFORMATION
 DEPT.M      : Measured Depth
 GR  .GAPI   : Gamma Ray
 PHIF.V/V    : Effective Porosity
 SW  .V/V    : Water Saturation
 RT  .OHMM   : True Formation Resistivity
 RHOB.G/C3   : Bulk Density
~ASCII
${Array.from({ length: 240 }, (_, i) => {
  const d = 2380 + i * 2;
  const inPay = d >= 2450 && d <= 2590;
  const gr = inPay ? (32 + Math.sin(i * 0.16) * 9).toFixed(1) : (94 + Math.cos(i * 0.15) * 14).toFixed(1);
  const phi = inPay ? (0.218 + Math.sin(i * 0.12) * 0.025).toFixed(3) : (0.065 + Math.random() * 0.02).toFixed(3);
  const sw = inPay ? (0.26 + Math.cos(i * 0.1) * 0.045).toFixed(3) : (0.92 + Math.random() * 0.04).toFixed(3);
  const rt = inPay ? (68 + Math.sin(i * 0.1) * 18).toFixed(1) : (2.8 + Math.random() * 0.6).toFixed(1);
  const rhob = inPay ? (2.22 + Math.sin(i * 0.12) * 0.04).toFixed(2) : (2.57 + Math.random() * 0.05).toFixed(2);
  return `${d} ${gr} ${phi} ${sw} ${rt} ${rhob}`;
}).join('\n')}`,
  },
];

// For backward compatibility
export const MULTI_WELL_DEMO_DATASET = SALDANADI_FIELD_DATASET;
export const DEMO_WELLS = SALDANADI_FIELD_DATASET;

/**
 * Enhanced LAS parser with automatic Well Header Metadata & Coordinate extraction
 */
export function parseLAS(lasText: string, fileName?: string): {
  summary: LASSummary;
  headerLocation: WellLocation;
  wellName: string;
  uwi?: string;
  field?: string;
  operator?: string;
} {
  const lines = lasText.split(/\r?\n/);
  let currentSection = '';
  let wellName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Unknown Well';
  let uwi: string | undefined;
  let field: string | undefined;
  let operator: string | undefined;
  const headerLocation: WellLocation = {};

  const curves: Record<string, { unit: string; desc: string }> = {};
  const curveNames: string[] = [];
  const rawDataRows: number[][] = [];

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('~')) {
      const secUpper = line.toUpperCase();
      if (secUpper.startsWith('~V')) currentSection = 'VERSION';
      else if (secUpper.startsWith('~W')) currentSection = 'WELL';
      else if (secUpper.startsWith('~C')) currentSection = 'CURVE';
      else if (secUpper.startsWith('~P')) currentSection = 'PARAM';
      else if (secUpper.startsWith('~A') || secUpper.startsWith('~ASCII')) currentSection = 'ASCII';
      continue;
    }

    if (currentSection === 'WELL' || currentSection === 'PARAM') {
      const dotIdx = line.indexOf('.');
      if (dotIdx !== -1) {
        const mnemonic = line.substring(0, dotIdx).trim().toUpperCase();
        const colonIdx = line.indexOf(':', dotIdx);
        const val = (colonIdx !== -1 ? line.substring(dotIdx + 1, colonIdx) : line.substring(dotIdx + 1)).trim();

        if (mnemonic === 'WELL' || mnemonic === 'NAME' || mnemonic === 'WELLNAME') {
          if (val) wellName = val;
        } else if (mnemonic === 'UWI' || mnemonic === 'API' || mnemonic === 'IDENTIFIER') {
          uwi = val;
        } else if (mnemonic === 'FLD' || mnemonic === 'FIELD') {
          field = val;
        } else if (mnemonic === 'COMP' || mnemonic === 'COMPANY' || mnemonic === 'OPERATOR') {
          operator = val;
        } else if (['X', 'XCOORD', 'EASTING', 'EAST', 'LONG', 'LONGITUDE'].includes(mnemonic)) {
          const num = parseFloat(val);
          if (!isNaN(num)) headerLocation.x = num;
        } else if (['Y', 'YCOORD', 'NORTHING', 'NORTH', 'LAT', 'LATITUDE'].includes(mnemonic)) {
          const num = parseFloat(val);
          if (!isNaN(num)) headerLocation.y = num;
        } else if (['ELEV', 'KB', 'ELEVATION', 'KBELEV', 'DATUM'].includes(mnemonic)) {
          const num = parseFloat(val);
          if (!isNaN(num)) headerLocation.elevationKb = num;
        } else if (['GL', 'GROUND', 'WD', 'WATERDEPTH'].includes(mnemonic)) {
          const num = parseFloat(val);
          if (!isNaN(num)) headerLocation.groundElevation = num;
        } else if (['ILIN', 'INLINE', 'IL', 'INL'].includes(mnemonic)) {
          const num = parseInt(val, 10);
          if (!isNaN(num)) headerLocation.inline = num;
        } else if (['XLIN', 'CROSSLIN', 'CROSSLINE', 'XL', 'XLINE'].includes(mnemonic)) {
          const num = parseInt(val, 10);
          if (!isNaN(num)) headerLocation.crossline = num;
        } else if (['LINE', 'LINENAME', 'SURVEYLINE', '2DLINE'].includes(mnemonic)) {
          headerLocation.lineName = val;
        } else if (['CDP', 'SP', 'SHOTPOINT', 'TRACE', 'CMP'].includes(mnemonic)) {
          const num = parseInt(val, 10);
          if (!isNaN(num)) headerLocation.cdpOrSp = num;
        } else if (['TD', 'STOP', 'TOTALDEPTH'].includes(mnemonic)) {
          const num = parseFloat(val);
          if (!isNaN(num)) headerLocation.totalDepth = num;
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
  const depthCurve = curveNames.find((c) => CURVE_ALIASES.depth.includes(c)) || curveNames[0] || 'DEPT';
  const depthData = data[depthCurve]?.filter((v) => !isNaN(v)) || [];
  const depthMin = depthData.length > 0 ? Math.min(...depthData) : 0;
  const depthMax = depthData.length > 0 ? Math.max(...depthData) : 5000;

  const summary: LASSummary = {
    wellName,
    curves,
    curveNames,
    nSamples: rawDataRows.length,
    depthMin,
    depthMax,
    depthCurve,
    data,
  };

  return {
    summary,
    headerLocation,
    wellName,
    uwi,
    field,
    operator,
  };
}

/**
 * Extract comprehensive petrophysical properties from LAS in reservoir window
 */
export function extractPetroFromLAS(
  las: LASSummary,
  topDepth: number,
  baseDepth: number
): ExtractedWellPetro {
  const depthArr = las.data[las.depthCurve] || [];
  const phiCurve = las.curveNames.find((c) => CURVE_ALIASES.porosity.includes(c)) || 'PHIF';
  const swCurve = las.curveNames.find((c) => CURVE_ALIASES.sw.includes(c)) || 'SW';
  const grCurve = las.curveNames.find((c) => CURVE_ALIASES.gr.includes(c)) || 'GR';
  const rtCurve = las.curveNames.find((c) => CURVE_ALIASES.resistivity.includes(c)) || 'RT';

  const phiArr = las.data[phiCurve] || [];
  const swArr = las.data[swCurve] || [];
  const grArr = las.data[grCurve] || [];
  const rtArr = las.data[rtCurve] || [];

  const phiValues: number[] = [];
  const swValues: number[] = [];
  const grValues: number[] = [];
  const rtValues: number[] = [];

  let payCount = 0;
  let totalCount = 0;

  for (let i = 0; i < depthArr.length; i++) {
    const d = depthArr[i];
    if (d >= topDepth && d <= baseDepth) {
      totalCount++;
      const p = phiArr[i];
      const s = swArr[i];
      const gr = grArr[i];
      const rt = rtArr[i];

      let isCleanSand = true;
      let hasPorosity = false;
      let hasLowSw = false;

      if (!isNaN(p)) {
        const val = p > 1.0 ? p / 100.0 : p;
        phiValues.push(val);
        if (val >= 0.08) hasPorosity = true;
      }
      if (!isNaN(s)) {
        const val = s > 1.0 ? s / 100.0 : s;
        swValues.push(val);
        if (val <= 0.65) hasLowSw = true;
      }
      if (!isNaN(gr)) {
        grValues.push(gr);
        if (gr > 65) isCleanSand = false;
      }
      if (!isNaN(rt)) {
        rtValues.push(rt);
      }

      // Net Pay cutoff criteria
      if (isCleanSand && (hasPorosity || phiValues.length === 0) && (hasLowSw || swValues.length === 0)) {
        payCount++;
      }
    }
  }

  // Percentiles helper
  const getPercentiles = (arr: number[], fallback: number) => {
    if (arr.length === 0) {
      return { p10: fallback * 0.85, p50: fallback, p90: fallback * 1.15, mean: fallback };
    }
    const sorted = [...arr].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? fallback;
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? fallback;
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? fallback;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      p10: Math.round(p10 * 1000) / 1000,
      p50: Math.round(p50 * 1000) / 1000,
      p90: Math.round(p90 * 1000) / 1000,
      mean: Math.round(mean * 1000) / 1000,
    };
  };

  const phiStats = getPercentiles(phiValues, 0.22);
  const swStats = getPercentiles(swValues, 0.30);

  const ntgRaw = totalCount > 0 ? payCount / totalCount : 0.75;
  const ntg = Math.max(0.2, Math.min(0.98, Math.round(ntgRaw * 1000) / 1000));
  const grossIntervalM = Math.max(1, baseDepth - topDepth);
  const netPayM = Math.round(grossIntervalM * ntg * 10) / 10;

  const meanGr = grValues.length > 0 ? Math.round(grValues.reduce((a, b) => a + b, 0) / grValues.length) : undefined;
  const meanRt = rtValues.length > 0 ? Math.round((rtValues.reduce((a, b) => a + b, 0) / rtValues.length) * 10) / 10 : undefined;

  return {
    meanPhi: phiStats.mean,
    meanSw: swStats.mean,
    ntg,
    netPayM,
    grossIntervalM,
    phiP10: phiStats.p10,
    phiP50: phiStats.p50,
    phiP90: phiStats.p90,
    swP10: swStats.p10,
    swP50: swStats.p50,
    swP90: swStats.p90,
    ntgP10: Math.max(0.15, Math.round(ntg * 0.85 * 1000) / 1000),
    ntgP50: ntg,
    ntgP90: Math.min(0.99, Math.round(ntg * 1.12 * 1000) / 1000),
    meanGr,
    meanRt,
  };
}

/**
 * Creates a WellData instance from parsed LAS, coordinates, and optional deviation trajectory
 */
export const createWellDataFromParsed = (
  parsed: ReturnType<typeof parseLAS>,
  id: string,
  topDepthOverride?: number,
  baseDepthOverride?: number,
  locationOverride?: Partial<WellLocation>,
  color?: string,
  trajectory?: WellTrajectory
): WellData => {
  const depthMin = parsed.summary.depthMin;
  const depthMax = parsed.summary.depthMax;
  const depthSpan = Math.max(10, depthMax - depthMin);

  const topDepth = topDepthOverride ?? Math.round(depthMin + depthSpan * 0.35);
  const baseDepth = baseDepthOverride ?? Math.round(depthMin + depthSpan * 0.65);

  const location: WellLocation = {
    ...parsed.headerLocation,
    ...locationOverride,
  };

  const extractedPetro = extractPetroFromLAS(parsed.summary, topDepth, baseDepth);

  const defaultColors = ['#00f0ff', '#2ecc71', '#f0a500', '#e74c3c', '#9b59b6', '#3498db'];
  const assignedColor = color || defaultColors[Math.abs(id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % defaultColors.length];

  return {
    id,
    wellName: parsed.wellName,
    uwi: parsed.uwi,
    field: parsed.field,
    operator: parsed.operator,
    location,
    trajectory,
    topDepth,
    baseDepth,
    lasSummary: parsed.summary,
    extractedPetro,
    isActive: true,
    color: assignedColor,
  };
};

/**
 * Multi-Well Spatial Synthesis & Field-Wide Property Correlation
 * Combines petrophysical interpretations across all active wells using:
 * 1. Arithmetic mean
 * 2. Net-thickness weighting
 * 3. Spatial / Inverse Distance Weighting (IDW) relative to seismic grid center
 */
export function calculateMultiWellSynthesis(
  wells: WellData[],
  method: 'arithmetic' | 'thickness-weighted' | 'idw-spatial' = 'thickness-weighted',
  seismicCentroid?: { x: number; y: number }
): MultiWellSynthesis {
  const activeWells = wells.filter((w) => w.isActive);

  if (activeWells.length === 0) {
    return {
      method,
      activeWellCount: 0,
      phi: { p10: 0.18, p50: 0.22, p90: 0.26, distribution: 'triangular', source: 'multi-well' },
      sw: { p10: 0.22, p50: 0.30, p90: 0.38, distribution: 'triangular', source: 'multi-well' },
      ntg: { p10: 0.65, p50: 0.78, p90: 0.88, distribution: 'triangular', source: 'multi-well' },
      averageNetPayM: 35,
      averageGrossIntervalM: 50,
    };
  }

  // Calculate weights for each well
  const weights: number[] = [];
  for (let i = 0; i < activeWells.length; i++) {
    const w = activeWells[i];
    if (method === 'arithmetic') {
      weights.push(1.0);
    } else if (method === 'thickness-weighted') {
      weights.push(Math.max(1, w.extractedPetro.netPayM));
    } else if (method === 'idw-spatial' && seismicCentroid && w.location.x != null && w.location.y != null) {
      const dx = w.location.x - seismicCentroid.x;
      const dy = w.location.y - seismicCentroid.y;
      const dist = Math.max(100, Math.sqrt(dx * dx + dy * dy));
      weights.push(1.0 / (dist * dist));
    } else {
      weights.push(Math.max(1, w.extractedPetro.netPayM));
    }
  }

  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const normWeights = weights.map((w) => w / (sumWeights || 1));

  let weightedPhi = 0;
  let weightedSw = 0;
  let weightedNtg = 0;
  let totalNetPay = 0;
  let totalGross = 0;

  for (let i = 0; i < activeWells.length; i++) {
    const w = activeWells[i];
    const wt = normWeights[i];
    weightedPhi += w.extractedPetro.meanPhi * wt;
    weightedSw += w.extractedPetro.meanSw * wt;
    weightedNtg += w.extractedPetro.ntg * wt;
    totalNetPay += w.extractedPetro.netPayM;
    totalGross += w.extractedPetro.grossIntervalM;
  }

  const meanPhi = Math.round(weightedPhi * 1000) / 1000;
  const meanSw = Math.round(weightedSw * 1000) / 1000;
  const meanNtg = Math.round(weightedNtg * 1000) / 1000;

  // Inter-well dispersion / standard deviation for uncertainty modeling
  const phiVariance = activeWells.reduce((sum, w, i) => sum + normWeights[i] * Math.pow(w.extractedPetro.meanPhi - meanPhi, 2), 0);
  const swVariance = activeWells.reduce((sum, w, i) => sum + normWeights[i] * Math.pow(w.extractedPetro.meanSw - meanSw, 2), 0);
  const ntgVariance = activeWells.reduce((sum, w, i) => sum + normWeights[i] * Math.pow(w.extractedPetro.ntg - meanNtg, 2), 0);

  const phiStd = Math.sqrt(phiVariance);
  const swStd = Math.sqrt(swVariance);
  const ntgStd = Math.sqrt(ntgVariance);

  const phiP10 = Math.max(0.04, Math.round(Math.min(...activeWells.map((w) => w.extractedPetro.phiP10), meanPhi - 1.28 * Math.max(phiStd, meanPhi * 0.12)) * 1000) / 1000);
  const phiP90 = Math.min(0.38, Math.round(Math.max(...activeWells.map((w) => w.extractedPetro.phiP90), meanPhi + 1.28 * Math.max(phiStd, meanPhi * 0.12)) * 1000) / 1000);

  const swP10 = Math.max(0.08, Math.round(Math.min(...activeWells.map((w) => w.extractedPetro.swP10), meanSw - 1.28 * Math.max(swStd, meanSw * 0.15)) * 1000) / 1000);
  const swP90 = Math.min(0.85, Math.round(Math.max(...activeWells.map((w) => w.extractedPetro.swP90), meanSw + 1.28 * Math.max(swStd, meanSw * 0.15)) * 1000) / 1000);

  const ntgP10 = Math.max(0.15, Math.round(Math.min(...activeWells.map((w) => w.extractedPetro.ntgP10), meanNtg - 1.28 * Math.max(ntgStd, meanNtg * 0.12)) * 1000) / 1000);
  const ntgP90 = Math.min(0.99, Math.round(Math.max(...activeWells.map((w) => w.extractedPetro.ntgP90), meanNtg + 1.28 * Math.max(ntgStd, meanNtg * 0.12)) * 1000) / 1000);

  return {
    method,
    activeWellCount: activeWells.length,
    phi: {
      p10: phiP10,
      p50: meanPhi,
      p90: phiP90,
      distribution: 'triangular',
      source: `Multi-Well (${activeWells.length} wells, ${method})`,
    },
    sw: {
      p10: swP10,
      p50: meanSw,
      p90: swP90,
      distribution: 'triangular',
      source: `Multi-Well (${activeWells.length} wells, ${method})`,
    },
    ntg: {
      p10: ntgP10,
      p50: meanNtg,
      p90: ntgP90,
      distribution: 'triangular',
      source: `Multi-Well (${activeWells.length} wells, ${method})`,
    },
    averageNetPayM: Math.round((totalNetPay / activeWells.length) * 10) / 10,
    averageGrossIntervalM: Math.round((totalGross / activeWells.length) * 10) / 10,
  };
}

/**
 * Parse CSV/TSV table or wellheads text file of well coordinates and interval picks
 */
export function parseWellLocationTable(tableText: string): Partial<WellLocation & { wellName: string; topDepth: number; baseDepth: number }>[] {
  // First try parseWellHeadsFile
  const wellHeads = parseWellHeadsFile(tableText);
  if (wellHeads.length > 0) {
    return wellHeads.map((wh) => ({
      wellName: wh.wellName,
      x: wh.eastingX,
      y: wh.northingY,
      elevationKb: wh.elevationKb,
      totalDepth: wh.totalDepth,
      inline: wh.inline,
      crossline: wh.crossline,
      lineName: wh.lineName,
      cdpOrSp: wh.cdpOrSp,
    }));
  }

  const lines = tableText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length <= 1) return [];

  const headerTokens = lines[0].toLowerCase().split(/[,;\t]+/).map((t) => t.trim());
  const rows: Partial<WellLocation & { wellName: string; topDepth: number; baseDepth: number }>[] = [];

  const findIdx = (keywords: string[]) => {
    return headerTokens.findIndex((h) => keywords.some((k) => h.includes(k)));
  };

  const nameIdx = findIdx(['name', 'well', 'uwi']);
  const xIdx = findIdx(['x', 'east', 'long', 'easting']);
  const yIdx = findIdx(['y', 'north', 'lat', 'northing']);
  const ilIdx = findIdx(['inline', 'il', 'inl']);
  const xlIdx = findIdx(['crossline', 'xl', 'xline']);
  const lineIdx = findIdx(['line', 'survey']);
  const cdpIdx = findIdx(['cdp', 'sp', 'shotpoint', 'trace']);
  const kbIdx = findIdx(['kb', 'elev', 'datum']);
  const tdIdx = findIdx(['td', 'total_depth']);
  const topIdx = findIdx(['top', 'sand_top']);
  const baseIdx = findIdx(['base', 'sand_base', 'owc']);

  for (let r = 1; r < lines.length; r++) {
    const tokens = lines[r].split(/[,;\t]+/).map((t) => t.trim());
    if (tokens.length === 0) continue;

    const row: any = {};
    if (nameIdx !== -1 && tokens[nameIdx]) row.wellName = tokens[nameIdx];
    if (xIdx !== -1 && !isNaN(parseFloat(tokens[xIdx]))) row.x = parseFloat(tokens[xIdx]);
    if (yIdx !== -1 && !isNaN(parseFloat(tokens[yIdx]))) row.y = parseFloat(tokens[yIdx]);
    if (ilIdx !== -1 && !isNaN(parseInt(tokens[ilIdx], 10))) row.inline = parseInt(tokens[ilIdx], 10);
    if (xlIdx !== -1 && !isNaN(parseInt(tokens[xlIdx], 10))) row.crossline = parseInt(tokens[xlIdx], 10);
    if (lineIdx !== -1 && tokens[lineIdx]) row.lineName = tokens[lineIdx];
    if (cdpIdx !== -1 && !isNaN(parseInt(tokens[cdpIdx], 10))) row.cdpOrSp = parseInt(tokens[cdpIdx], 10);
    if (kbIdx !== -1 && !isNaN(parseFloat(tokens[kbIdx]))) row.elevationKb = parseFloat(tokens[kbIdx]);
    if (tdIdx !== -1 && !isNaN(parseFloat(tokens[tdIdx]))) row.totalDepth = parseFloat(tokens[tdIdx]);
    if (topIdx !== -1 && !isNaN(parseFloat(tokens[topIdx]))) row.topDepth = parseFloat(tokens[topIdx]);
    if (baseIdx !== -1 && !isNaN(parseFloat(tokens[baseIdx]))) row.baseDepth = parseFloat(tokens[baseIdx]);

    if (row.wellName || row.x != null || row.inline != null) {
      rows.push(row);
    }
  }

  return rows;
}
