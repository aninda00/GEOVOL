import { SeismicCube, HorizonSuggestion, GRVData } from '../types';

/**
 * Generate a Ricker wavelet
 * @param frequency Central frequency in Hz (e.g. 30 Hz)
 * @param sampleRate Sampling interval in ms (e.g. 4 ms)
 * @param length Wavelet length in samples
 */
export function generateRickerWavelet(frequency: number = 30, sampleRate: number = 4, length: number = 61): Float32Array {
  const dt = sampleRate / 1000.0;
  const wavelet = new Float32Array(length);
  const half = Math.floor(length / 2);

  for (let i = 0; i < length; i++) {
    const t = (i - half) * dt;
    const pft2 = Math.pow(Math.PI * frequency * t, 2);
    wavelet[i] = (1 - 2 * pft2) * Math.exp(-pft2);
  }
  return wavelet;
}

/**
 * Generate a realistic 3D synthetic seismic volume with anticlinal & dipping geology,
 * fault structures, multiple reflectors and noise.
 */
export function generateSyntheticCube(
  nInlines: number = 32,
  nCrosslines: number = 32,
  nSamples: number = 1000,
  sampleRate: number = 4.0,
  presetName: string = 'Synthetic Reservoir Demo'
): SeismicCube {
  const totalElements = nInlines * nCrosslines * nSamples;
  const data = new Float32Array(totalElements);

  // Key geological reflectors (sample indices and amplitude reflections)
  const reflectors = [70, 160, 280, 420, 560, 617, 740, 880];
  const amplitudes = [0.65, -0.55, 0.90, -0.45, 1.35, -0.80, 0.70, -0.50];
  const wavelet = generateRickerWavelet(30, sampleRate, 55);
  const wavLen = wavelet.length;
  const wavHalf = Math.floor(wavLen / 2);

  // Helper index mapping: [il, xl, s] -> flatIndex
  const getIdx = (il: number, xl: number, s: number) => (il * nCrosslines + xl) * nSamples + s;

  // Fill synthetic reflectors with 3D structural dip and anticlinal curvature
  for (let rIdx = 0; rIdx < reflectors.length; rIdx++) {
    const baseSample = reflectors[rIdx];
    const amp = amplitudes[rIdx];

    for (let il = 0; il < nInlines; il++) {
      for (let xl = 0; xl < nCrosslines; xl++) {
        // Anticlinal closure centered near (16, 16) + regional dip
        const dx = (xl - nCrosslines * 0.45) / nCrosslines;
        const dy = (il - nInlines * 0.5) / nInlines;
        const domeShift = Math.sin(Math.PI * dx) * Math.cos(Math.PI * dy) * 18;
        const dipShift = il * 0.35 + xl * 0.25;
        
        // Fault displacement feature near crossline 22
        const fault = xl > 22 ? 8 : 0;

        const peakPos = Math.round(baseSample + dipShift - domeShift + fault);

        if (peakPos >= 0 && peakPos < nSamples) {
          for (let w = 0; w < wavLen; w++) {
            const s = peakPos - wavHalf + w;
            if (s >= 0 && s < nSamples) {
              const flatIdx = getIdx(il, xl, s);
              data[flatIdx] += amp * wavelet[w];
            }
          }
        }
      }
    }
  }

  // Add subtle background random noise
  for (let i = 0; i < totalElements; i++) {
    // Box-Muller pseudo random Gaussian noise
    const u1 = Math.max(1e-7, Math.random());
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    data[i] += randStdNormal * 0.035;
  }

  const ilines = Array.from({ length: nInlines }, (_, i) => 100 + i);
  const xlines = Array.from({ length: nCrosslines }, (_, i) => 200 + i);
  const totalTimeMs = (nSamples - 1) * sampleRate;
  const ramMb = (data.byteLength / (1024 * 1024));

  const cube: SeismicCube = {
    data,
    nInlines,
    nCrosslines,
    nSamples,
    sampleRate,
    totalTimeMs,
    ilines,
    xlines,
    source: 'synthetic',
    name: presetName,
    ramMb: Math.round(ramMb * 10) / 10,
  };

  // Pre-calculate mean trace & envelope
  const meanTrace = computeMeanAmplitudeTrace(cube);
  const envelope = computeEnvelopeTrace(meanTrace);
  cube.meanTrace = meanTrace;
  cube.envelope = envelope;

  return cube;
}

/**
 * Extract an Inline 2D section (shape: nCrosslines x nSamples)
 */
export function getInlineSection(cube: SeismicCube, inlineIndex: number): Float32Array[] {
  const { nCrosslines, nSamples, data } = cube;
  const section: Float32Array[] = [];

  for (let xl = 0; xl < nCrosslines; xl++) {
    const trace = new Float32Array(nSamples);
    const startIdx = (inlineIndex * nCrosslines + xl) * nSamples;
    for (let s = 0; s < nSamples; s++) {
      trace[s] = data[startIdx + s];
    }
    section.push(trace);
  }
  return section;
}

/**
 * Extract a Crossline 2D section (shape: nInlines x nSamples)
 */
export function getCrosslineSection(cube: SeismicCube, crosslineIndex: number): Float32Array[] {
  const { nInlines, nCrosslines, nSamples, data } = cube;
  const section: Float32Array[] = [];

  for (let il = 0; il < nInlines; il++) {
    const trace = new Float32Array(nSamples);
    const startIdx = (il * nCrosslines + crosslineIndex) * nSamples;
    for (let s = 0; s < nSamples; s++) {
      trace[s] = data[startIdx + s];
    }
    section.push(trace);
  }
  return section;
}

/**
 * Extract a horizontal Time/Depth Slice (shape: nInlines x nCrosslines)
 */
export function getTimeSlice(cube: SeismicCube, sampleIndex: number): number[][] {
  const { nInlines, nCrosslines, nSamples, data } = cube;
  const clampedSample = Math.max(0, Math.min(nSamples - 1, Math.round(sampleIndex)));
  const slice: number[][] = [];

  for (let il = 0; il < nInlines; il++) {
    const row: number[] = [];
    for (let xl = 0; xl < nCrosslines; xl++) {
      const idx = (il * nCrosslines + xl) * nSamples + clampedSample;
      row.push(data[idx]);
    }
    slice.push(row);
  }
  return slice;
}

/**
 * Compute the average 1D amplitude trace across all traces in the cube
 */
export function computeMeanAmplitudeTrace(cube: SeismicCube): number[] {
  const { nInlines, nCrosslines, nSamples, data } = cube;
  const totalTraces = nInlines * nCrosslines;
  const meanTrace = new Float64Array(nSamples);

  for (let t = 0; t < totalTraces; t++) {
    const offset = t * nSamples;
    for (let s = 0; s < nSamples; s++) {
      meanTrace[s] += data[offset + s];
    }
  }

  const result: number[] = [];
  for (let s = 0; s < nSamples; s++) {
    result.push(meanTrace[s] / totalTraces);
  }
  return result;
}

/**
 * Hilbert envelope approximation for amplitude magnitude spectrum
 */
export function computeEnvelopeTrace(trace: number[]): number[] {
  const n = trace.length;
  const envelope = new Array<number>(n);
  
  // Discrete Hilbert transform approximation via 31-point FIR filter
  const filterLen = 31;
  const half = Math.floor(filterLen / 2);
  const hilbertFIR = new Float32Array(filterLen);
  for (let k = -half; k <= half; k++) {
    if (k % 2 !== 0) {
      hilbertFIR[k + half] = 2 / (Math.PI * k);
    }
  }

  for (let i = 0; i < n; i++) {
    let quad = 0;
    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < n) {
        quad += trace[idx] * hilbertFIR[k + half];
      }
    }
    envelope[i] = Math.sqrt(trace[i] * trace[i] + quad * quad);
  }

  return envelope;
}

/**
 * Zone-normalised peak detection to suggest strong geological reflector candidates
 */
export function suggestHorizons(
  cubeOrTrace: SeismicCube | number[],
  sampleRate: number,
  nSuggestions: number = 8
): { suggestions: HorizonSuggestion[]; meanTrace: number[]; envelope: number[] } {
  let meanTrace: number[];
  if (Array.isArray(cubeOrTrace)) {
    meanTrace = cubeOrTrace;
  } else {
    meanTrace = cubeOrTrace.meanTrace || computeMeanAmplitudeTrace(cubeOrTrace);
  }
  const envelope = computeEnvelopeTrace(meanTrace);
  const n = meanTrace.length;

  // Smoothing filter
  const smoothed = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) {
      sum += envelope[j];
      count++;
    }
    smoothed[i] = sum / count;
  }

  // Zone normalisation
  const zoneSize = Math.max(30, Math.floor(n / 8));
  const zoneStep = Math.floor(zoneSize / 2);
  const normEnv = new Float64Array(n);
  const zoneCounts = new Int32Array(n);

  for (let start = 0; start < n; start += zoneStep) {
    const end = Math.min(start + zoneSize, n);
    let zMax = 0;
    for (let i = start; i < end; i++) {
      if (smoothed[i] > zMax) zMax = smoothed[i];
    }
    if (zMax > 0) {
      for (let i = start; i < end; i++) {
        normEnv[i] += smoothed[i] / zMax;
        zoneCounts[i] += 1;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (zoneCounts[i] > 0) normEnv[i] /= zoneCounts[i];
  }

  // Find local peaks
  const peaks: number[] = [];
  const gMax = Math.max(...smoothed, 1e-6);

  for (let i = 4; i < n - 4; i++) {
    if (
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] > smoothed[i + 1] &&
      smoothed[i] > smoothed[i - 2] &&
      smoothed[i] > smoothed[i + 2] &&
      smoothed[i] >= 0.03 * gMax
    ) {
      peaks.push(i);
    }
  }

  // Fallback if few peaks found
  if (peaks.length === 0) {
    const step = Math.floor(n / (nSuggestions + 1));
    for (let i = 1; i <= nSuggestions; i++) {
      peaks.push(i * step);
    }
  }

  // Rank peaks by combined amplitude and zone prominence
  const ranked = peaks
    .map((pk) => {
      const amp = smoothed[pk];
      const normScore = normEnv[pk] || 0;
      const score = 0.5 * (amp / gMax) + 0.5 * normScore;
      const conf = Math.min(100, Math.round((0.4 * (amp / gMax) + 0.6 * normScore) * 100));
      return {
        sample: pk,
        timeMs: Math.round(pk * sampleRate * 10) / 10,
        amplitude: Math.round(amp * 10000) / 10000,
        confidence: Math.max(15, conf),
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, nSuggestions)
    .sort((a, b) => a.sample - b.sample);

  return {
    suggestions: ranked,
    meanTrace,
    envelope,
  };
}

/**
 * Fast vectorized Horizon Surface Picking across every trace in the cube
 */
export function pickHorizonSurface(
  cube: SeismicCube,
  targetSample: number,
  windowSamples: number = 12,
  polarity: 'positive' | 'negative' | 'both' = 'positive'
): number[][] {
  const { nInlines, nCrosslines, nSamples, data } = cube;
  const surface: number[][] = [];

  const sStart = Math.max(0, targetSample - windowSamples);
  const sEnd = Math.min(nSamples - 1, targetSample + windowSamples);

  for (let il = 0; il < nInlines; il++) {
    const row: number[] = [];
    for (let xl = 0; xl < nCrosslines; xl++) {
      const traceOffset = (il * nCrosslines + xl) * nSamples;
      
      let bestSample = targetSample;
      let bestVal = polarity === 'negative' ? Infinity : -Infinity;

      for (let s = sStart; s <= sEnd; s++) {
        const val = data[traceOffset + s];
        if (polarity === 'positive') {
          if (val > bestVal) {
            bestVal = val;
            bestSample = s;
          }
        } else if (polarity === 'negative') {
          if (val < bestVal) {
            bestVal = val;
            bestSample = s;
          }
        } else {
          // Both: absolute amplitude maximum
          const absVal = Math.abs(val);
          if (absVal > bestVal) {
            bestVal = absVal;
            bestSample = s;
          }
        }
      }
      row.push(bestSample);
    }
    surface.push(row);
  }

  return surface;
}

/**
 * Compute Isochore (thickness) matrix in ms
 */
export function computeIsochore(
  topHorizon: number[][],
  baseHorizon: number[][],
  sampleRate: number
): number[][] {
  const nInlines = topHorizon.length;
  const nCrosslines = topHorizon[0].length;
  const isochoreMs: number[][] = [];

  for (let il = 0; il < nInlines; il++) {
    const row: number[] = [];
    for (let xl = 0; xl < nCrosslines; xl++) {
      const diffSamples = Math.max(0, baseHorizon[il][xl] - topHorizon[il][xl]);
      row.push(diffSamples * sampleRate);
    }
    isochoreMs.push(row);
  }

  return isochoreMs;
}

/**
 * Compute Gross Rock Volume (GRV) from isochore and geometry
 */
export function computeGRV(
  isochoreMs: number[][],
  inlineSpacingM: number = 25,
  crosslineSpacingM: number = 25,
  velocityMs: number = 2500
): GRVData {
  const nInlines = isochoreMs.length;
  const nCrosslines = isochoreMs[0].length;
  const isochoreM: number[][] = [];

  const cellAreaM2 = inlineSpacingM * crosslineSpacingM;
  let totalM3 = 0;
  let totalThickness = 0;
  let maxThickness = 0;
  let activeCells = 0;

  for (let il = 0; il < nInlines; il++) {
    const row: number[] = [];
    for (let xl = 0; xl < nCrosslines; xl++) {
      const ms = isochoreMs[il][xl];
      const thickM = (ms / 2000.0) * velocityMs;
      row.push(thickM);

      if (thickM > 0) {
        totalM3 += thickM * cellAreaM2;
        totalThickness += thickM;
        if (thickM > maxThickness) maxThickness = thickM;
        activeCells++;
      }
    }
    isochoreM.push(row);
  }

  const grvAcreFt = totalM3 / 1233.48;
  const grvFt3 = totalM3 * 35.3147;
  const grvKm3 = totalM3 / 1e9;
  const avgThicknessM = activeCells > 0 ? totalThickness / activeCells : 0;

  return {
    grvM3: totalM3,
    grvFt3,
    grvAcreFt,
    grvKm3,
    isochoreM,
    cellAreaM2,
    nCells: activeCells,
    avgThicknessM: Math.round(avgThicknessM * 10) / 10,
    maxThicknessM: Math.round(maxThickness * 10) / 10,
  };
}

/**
 * Parse an uploaded SEG-Y file buffer
 */
export function parseSegyBuffer(buffer: ArrayBuffer, fileName: string = 'uploaded.sgy'): SeismicCube {
  const view = new DataView(buffer);
  const totalBytes = buffer.byteLength;

  if (totalBytes < 3600 + 240) {
    throw new Error('File is too small to be a valid SEG-Y file.');
  }

  // 1. Read EBCDIC/ASCII textual header (first 3200 bytes)
  const textBytes = new Uint8Array(buffer, 0, 3200);
  let textHeader = '';
  // Check if ASCII or EBCDIC
  let isAscii = false;
  let printableCount = 0;
  for (let i = 0; i < 3200; i++) {
    if (textBytes[i] >= 32 && textBytes[i] <= 126) printableCount++;
  }
  if (printableCount > 1000) isAscii = true;

  if (isAscii) {
    const decoder = new TextDecoder('utf-8');
    textHeader = decoder.decode(textBytes);
  } else {
    // Simple EBCDIC to ASCII conversion
    const ebcdicMap: Record<number, number> = {
      0x40: 32, 0xc1: 65, 0xc2: 66, 0xc3: 67, 0xc4: 68, 0xc5: 69, 0xc6: 70, 0xc7: 71,
      0xc8: 72, 0xc9: 73, 0xd1: 74, 0xd2: 75, 0xd3: 76, 0xd4: 77, 0xd5: 78, 0xd6: 79,
      0xd7: 80, 0xd8: 81, 0xd9: 82, 0xe2: 83, 0xe3: 84, 0xe4: 85, 0xe5: 86, 0xe6: 87,
      0xe7: 88, 0xe8: 89, 0xe9: 90, 0xf0: 48, 0xf1: 49, 0xf2: 50, 0xf3: 51, 0xf4: 52,
      0xf5: 53, 0xf6: 54, 0xf7: 55, 0xf8: 56, 0xf9: 57, 0x4b: 46, 0x6b: 44, 0x7a: 58,
      0x5a: 33, 0x7b: 35, 0x60: 45, 0x61: 47,
    };
    const chars: string[] = [];
    for (let i = 0; i < 3200; i++) {
      const asciiCode = ebcdicMap[textBytes[i]] || 32;
      chars.push(String.fromCharCode(asciiCode));
    }
    textHeader = chars.join('');
  }

  // 2. Read Binary Header (bytes 3200 to 3600)
  // Byte 3216: sample interval in microseconds (dt)
  const dtMicroseconds = view.getInt16(3216, false); // Big endian
  const sampleRate = dtMicroseconds > 0 ? dtMicroseconds / 1000.0 : 4.0;

  // Byte 3220: number of samples per data trace
  let nSamples = view.getInt16(3220, false);
  // Byte 3224: data sample format code (1 = IBM float, 5 = IEEE float, 3 = 2-byte integer)
  const formatCode = view.getInt16(3224, false);

  if (nSamples <= 0 || nSamples > 10000) {
    nSamples = 1000; // sensible fallback
  }

  // Trace size calculation: 240-byte header + samples bytes
  let bytesPerSample = 4;
  if (formatCode === 3) bytesPerSample = 2; // int16
  else if (formatCode === 8) bytesPerSample = 1; // int8

  const traceDataSize = nSamples * bytesPerSample;
  const traceTotalSize = 240 + traceDataSize;
  const traceCount = Math.floor((totalBytes - 3600) / traceTotalSize);

  if (traceCount <= 0) {
    throw new Error('No valid traces found in SEG-Y file.');
  }

  // Estimate grid dimension
  const gridDim = Math.max(2, Math.floor(Math.sqrt(traceCount)));
  const nInlines = Math.min(gridDim, 64);
  const nCrosslines = Math.min(gridDim, 64);
  const maxTracesToRead = nInlines * nCrosslines;

  const totalElements = nInlines * nCrosslines * nSamples;
  const data = new Float32Array(totalElements);

  for (let t = 0; t < Math.min(traceCount, maxTracesToRead); t++) {
    const traceStart = 3600 + t * traceTotalSize;
    const dataStart = traceStart + 240;

    for (let s = 0; s < nSamples; s++) {
      const sampleOffset = dataStart + s * bytesPerSample;
      let val = 0;
      if (sampleOffset + 4 <= totalBytes) {
        if (formatCode === 5 || formatCode <= 0) {
          val = view.getFloat32(sampleOffset, false);
        } else if (formatCode === 3) {
          val = view.getInt16(sampleOffset, false) / 32768.0;
        } else {
          // IBM Float approximation or fallback
          val = view.getFloat32(sampleOffset, false);
        }
      }
      data[t * nSamples + s] = isNaN(val) ? 0 : val;
    }
  }

  const ilines = Array.from({ length: nInlines }, (_, i) => 100 + i);
  const xlines = Array.from({ length: nCrosslines }, (_, i) => 200 + i);
  const totalTimeMs = (nSamples - 1) * sampleRate;
  const ramMb = Math.round((data.byteLength / (1024 * 1024)) * 10) / 10;

  const cube: SeismicCube = {
    data,
    nInlines,
    nCrosslines,
    nSamples,
    sampleRate,
    totalTimeMs,
    ilines,
    xlines,
    source: 'segy',
    name: fileName,
    ramMb,
    textHeader,
  };

  cube.meanTrace = computeMeanAmplitudeTrace(cube);
  cube.envelope = computeEnvelopeTrace(cube.meanTrace);

  return cube;
}

/**
 * Built-in geological preset cubes
 */
export const GEOLOGICAL_PRESETS = [
  {
    id: 'north_sea',
    name: 'North Sea Brent Sandstone',
    description: 'Tilted fault-block geometry with prominent sandstone reservoir unit and top unconformity.',
    nInlines: 32,
    nCrosslines: 32,
    nSamples: 1200,
    sampleRate: 4.0,
    topTargetMs: 2420,
    baseTargetMs: 2580,
    velocity: 2750,
  },
  {
    id: 'gulf_mexico',
    name: 'Gulf of Mexico Deepwater Turbidite',
    description: 'High-amplitude sheet turbidite sand lobes below salt overhang with bright spot anomaly.',
    nInlines: 36,
    nCrosslines: 36,
    nSamples: 1400,
    sampleRate: 4.0,
    topTargetMs: 3100,
    baseTargetMs: 3240,
    velocity: 2400,
  },
  {
    id: 'arabian_carbonate',
    name: 'Arabian Basin Carbonate Reef',
    description: 'Thick platform carbonate with high porosity shoal facies and sharp top reservoir seal.',
    nInlines: 30,
    nCrosslines: 30,
    nSamples: 1100,
    sampleRate: 4.0,
    topTargetMs: 1850,
    baseTargetMs: 2020,
    velocity: 3200,
  },
];
