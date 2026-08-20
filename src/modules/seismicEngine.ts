import {
  SeismicDataset,
  SeismicCube,
  HorizonSuggestion,
  GRVData,
  SeismicBinaryHeader,
  TraceHeader,
  SegyImportOptions,
} from '../types';

/**
 * Decode 32-bit IBM floating point to standard IEEE-754 float
 * Standard SEG-Y Format Code 1
 */
export function decodeIBMFloat(view: DataView, offset: number): number {
  const b0 = view.getUint8(offset);
  const b1 = view.getUint8(offset + 1);
  const b2 = view.getUint8(offset + 2);
  const b3 = view.getUint8(offset + 3);

  const sign = (b0 & 0x80) ? -1 : 1;
  const exponent = (b0 & 0x7f) - 64;
  const mantissa = ((b1 << 16) | (b2 << 8) | b3) / 16777216.0; // 2^24

  if (mantissa === 0) return 0;
  return sign * mantissa * Math.pow(16.0, exponent);
}

/**
 * EBCDIC to ASCII conversion map (Standard IBM/CWLS/SEG character map)
 */
const EBCDIC_TO_ASCII: number[] = [
  0,  1,  2,  3, 32,  9, 32,127, 32, 32, 32, 11, 12, 13, 14, 15,
 16, 17, 18, 19, 32, 32,  8, 32, 24, 25, 32, 32, 28, 29, 30, 31,
 32, 32, 32, 32, 32, 10, 23, 27, 32, 32, 32, 32, 32,  5,  6,  7,
 32, 32, 22, 32, 32, 32, 32,  4, 32, 32, 32, 32, 20, 21, 32, 26,
 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 91, 46, 60, 40, 43, 33,
 38, 32, 32, 32, 32, 32, 32, 32, 32, 32, 93, 36, 42, 41, 59, 94,
 45, 47, 32, 32, 32, 32, 32, 32, 32, 32,124, 44, 37, 95, 62, 63,
 32, 32, 32, 32, 32, 32, 32, 32, 32, 96, 58, 35, 64, 39, 61, 34,
 32, 97, 98, 99,100,101,102,103,104,105, 32, 32, 32, 32, 32, 32,
 32,106,107,108,109,110,111,112,113,114, 32, 32, 32, 32, 32, 32,
 32,126,115,116,117,118,119,120,121,122, 32, 32, 32, 32, 32, 32,
 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32,
123, 65, 66, 67, 68, 69, 70, 71, 72, 73, 32, 32, 32, 32, 32, 32,
125, 74, 75, 76, 77, 78, 79, 80, 81, 82, 32, 32, 32, 32, 32, 32,
 92, 32, 83, 84, 85, 86, 87, 88, 89, 90, 32, 32, 32, 32, 32, 32,
 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 32, 32, 32, 32, 32, 32
];

/**
 * Decode 3200-byte Textual Header into 40 lines of 80 characters
 */
export function decodeTextHeader(bytes: Uint8Array): string {
  let isAscii = false;
  let printableAscii = 0;
  for (let i = 0; i < 3200; i++) {
    if (bytes[i] >= 32 && bytes[i] <= 126) printableAscii++;
  }
  if (printableAscii > 1200) isAscii = true;

  const rawChars: string[] = [];
  for (let i = 0; i < 3200; i++) {
    const code = isAscii ? bytes[i] : EBCDIC_TO_ASCII[bytes[i]] || 32;
    rawChars.push(String.fromCharCode(code >= 32 && code <= 126 ? code : 32));
  }

  // Format into 40 distinct 80-character lines
  const lines: string[] = [];
  for (let l = 0; l < 40; l++) {
    const start = l * 80;
    const lineText = rawChars.slice(start, start + 80).join('');
    const lineNum = `C${(l + 1).toString().padStart(2, '0')}`;
    // If line doesn't start with C01 etc., format it nicely
    if (lineText.startsWith('C') && !isNaN(parseInt(lineText.slice(1, 3), 10))) {
      lines.push(lineText);
    } else {
      lines.push(`${lineNum} ${lineText}`);
    }
  }

  return lines.join('\n');
}

/**
 * Read SEG-Y 400-byte Binary Header (bytes 3200 to 3600)
 */
export function parseBinaryHeader(buffer: ArrayBuffer): { header: SeismicBinaryHeader; isLittleEndian: boolean } {
  const view = new DataView(buffer, 3200, 400);

  // Auto-detect endianness by testing sample format and sample interval
  // Big-endian is standard SEG-Y
  let isLittleEndian = false;

  let dt = view.getInt16(16, false); // sample interval in µs at byte 17-18 (offset 16)
  let nSamples = view.getInt16(20, false); // samples per trace at byte 21-22 (offset 20)
  let formatCode = view.getInt16(24, false); // format code at byte 25-26 (offset 24)

  if (dt <= 0 || dt > 50000 || formatCode < 1 || formatCode > 8) {
    // Try little endian
    const dtLE = view.getInt16(16, true);
    const formatLE = view.getInt16(24, true);
    if (dtLE > 0 && dtLE <= 50000 && formatLE >= 1 && formatLE <= 8) {
      isLittleEndian = true;
      dt = dtLE;
      nSamples = view.getInt16(20, true);
      formatCode = formatLE;
    }
  }

  const formatDescriptions: Record<number, string> = {
    1: '4-byte IBM floating point',
    2: '4-byte two\'s complement integer',
    3: '2-byte two\'s complement integer',
    4: '4-byte fixed point with gain (obsolete)',
    5: '4-byte IEEE floating point',
    8: '1-byte two\'s complement integer',
  };

  const header: SeismicBinaryHeader = {
    jobId: view.getInt32(0, isLittleEndian),
    lineNum: view.getInt32(4, isLittleEndian),
    reelNum: view.getInt32(8, isLittleEndian),
    tracesPerEnsemble: view.getInt16(12, isLittleEndian),
    auxTracesPerEnsemble: view.getInt16(14, isLittleEndian),
    sampleIntervalUs: dt > 0 ? dt : 4000,
    origSampleIntervalUs: view.getInt16(18, isLittleEndian),
    nSamples: nSamples > 0 && nSamples <= 10000 ? nSamples : 1000,
    origNSamples: view.getInt16(22, isLittleEndian),
    formatCode: formatCode >= 1 && formatCode <= 8 ? formatCode : 1,
    formatDescription: formatDescriptions[formatCode] || 'Unknown Format',
    cdpFold: view.getInt16(26, isLittleEndian),
    traceSorting: view.getInt16(28, isLittleEndian),
    verticalSum: view.getInt16(30, isLittleEndian),
    sweepFreqStart: view.getInt16(32, isLittleEndian),
    sweepFreqEnd: view.getInt16(34, isLittleEndian),
    segRev: view.getInt16(300, isLittleEndian),
    isLittleEndian,
  };

  return { header, isLittleEndian };
}

/**
 * Parse a single 240-byte Trace Header at given offset
 */
export function parseTraceHeader(
  view: DataView,
  offset: number,
  isLittleEndian: boolean,
  options?: SegyImportOptions
): TraceHeader {
  const getI32 = (byteOffset: number) => {
    try {
      return view.getInt32(offset + (byteOffset - 1), isLittleEndian);
    } catch {
      return 0;
    }
  };
  const getI16 = (byteOffset: number) => {
    try {
      return view.getInt16(offset + (byteOffset - 1), isLittleEndian);
    } catch {
      return 0;
    }
  };

  const traceSeqLine = getI32(1);
  const traceSeqFile = getI32(5);
  const ffid = getI32(options?.ffidByte || 9);
  const sp = getI32(options?.spByte || 17);
  const cdp = getI32(options?.cdpByte || 21);
  const scalar = getI16(options?.scalarByte || 71) || 1;
  const scaleMult = scalar < 0 ? 1 / Math.abs(scalar) : scalar;

  const sourceX = getI32(options?.sourceXByte || 73) * scaleMult;
  const sourceY = getI32(options?.sourceYByte || 77) * scaleMult;
  const groupX = getI32(81) * scaleMult;
  const groupY = getI32(85) * scaleMult;
  const cdpX = getI32(options?.cdpXByte || 181) * scaleMult;
  const cdpY = getI32(options?.cdpYByte || 185) * scaleMult;
  const elevation = getI32(41) * scaleMult;

  const nSamples = getI16(115);
  const sampleIntervalUs = getI16(117);

  const inline = getI32(options?.inlineByte || 189);
  const crossline = getI32(options?.crosslineByte || 193);

  return {
    traceNumber: traceSeqFile || traceSeqLine || 1,
    inline,
    crossline,
    cdp: cdp || traceSeqFile || 1,
    shotPoint: sp,
    ffid,
    sourceX,
    sourceY,
    groupX,
    groupY,
    cdpX: cdpX || sourceX,
    cdpY: cdpY || sourceY,
    elevation,
    scalar,
    nSamples,
    sampleIntervalUs,
    offset: getI32(37),
  };
}

/**
 * Scan SEG-Y headers to automatically detect if it is a 2D line or 3D cube,
 * inspect sample headers and geometry layout.
 */
export function inspectSegyFile(
  buffer: ArrayBuffer,
  options?: SegyImportOptions
): {
  binaryHeader: SeismicBinaryHeader;
  textHeader: string;
  sampleTraceHeaders: TraceHeader[];
  totalTraces: number;
  detectedType: '2d' | '3d';
  uniqueInlines: number[];
  uniqueCrosslines: number[];
  sampleRate: number;
  nSamples: number;
  formatCode: number;
  isLittleEndian: boolean;
} {
  const totalBytes = buffer.byteLength;
  if (totalBytes < 3600 + 240) {
    throw new Error('File is too small to be a valid SEG-Y file.');
  }

  const textBytes = new Uint8Array(buffer, 0, 3200);
  const textHeader = decodeTextHeader(textBytes);

  const { header: binaryHeader, isLittleEndian } = parseBinaryHeader(buffer);
  const formatCode = options?.formatOverride || binaryHeader.formatCode;
  const dtMicroseconds = binaryHeader.sampleIntervalUs;
  const sampleRate = dtMicroseconds > 0 ? dtMicroseconds / 1000.0 : 4.0;
  const nSamples = binaryHeader.nSamples;

  let bytesPerSample = 4;
  if (formatCode === 3) bytesPerSample = 2; // Int16
  else if (formatCode === 8) bytesPerSample = 1; // Int8

  const traceDataSize = nSamples * bytesPerSample;
  const traceTotalSize = 240 + traceDataSize;
  const totalTraces = Math.max(1, Math.floor((totalBytes - 3600) / traceTotalSize));

  const view = new DataView(buffer);
  const sampleTraceHeaders: TraceHeader[] = [];
  const inlineSet = new Set<number>();
  const crosslineSet = new Set<number>();

  const scanLimit = Math.min(totalTraces, 100);
  for (let t = 0; t < scanLimit; t++) {
    const traceStart = 3600 + t * traceTotalSize;
    if (traceStart + 240 <= totalBytes) {
      const th = parseTraceHeader(view, traceStart, isLittleEndian, options);
      if (t < 25) {
        sampleTraceHeaders.push(th);
      }
      if (th.inline > 0) inlineSet.add(th.inline);
      if (th.crossline > 0) crosslineSet.add(th.crossline);
    }
  }

  const uniqueInlines = Array.from(inlineSet).sort((a, b) => a - b);
  const uniqueCrosslines = Array.from(crosslineSet).sort((a, b) => a - b);

  // Auto-detection logic:
  // If uniqueInlines > 1 and uniqueCrosslines > 1 -> 3D cube
  // Otherwise -> 2D line
  let detectedType: '2d' | '3d' = '2d';
  if (options?.mode === '3d') {
    detectedType = '3d';
  } else if (options?.mode === '2d') {
    detectedType = '2d';
  } else {
    if (uniqueInlines.length > 1 && uniqueCrosslines.length > 1) {
      detectedType = '3d';
    } else {
      detectedType = '2d';
    }
  }

  return {
    binaryHeader,
    textHeader,
    sampleTraceHeaders,
    totalTraces,
    detectedType,
    uniqueInlines,
    uniqueCrosslines,
    sampleRate,
    nSamples,
    formatCode,
    isLittleEndian,
  };
}

/**
 * Parse an uploaded SEG-Y file buffer into a SeismicDataset (2D Line or 3D Volume)
 */
export function parseSegyBuffer(
  buffer: ArrayBuffer,
  fileName: string = 'uploaded.sgy',
  options?: SegyImportOptions
): SeismicDataset {
  const inspection = inspectSegyFile(buffer, options);
  const {
    binaryHeader,
    textHeader,
    sampleTraceHeaders,
    totalTraces,
    detectedType,
    sampleRate,
    nSamples,
    formatCode,
    isLittleEndian,
  } = inspection;

  const totalBytes = buffer.byteLength;
  let bytesPerSample = 4;
  if (formatCode === 3) bytesPerSample = 2;
  else if (formatCode === 8) bytesPerSample = 1;

  const traceDataSize = nSamples * bytesPerSample;
  const traceTotalSize = 240 + traceDataSize;
  const view = new DataView(buffer);

  const maxTracesToRead = options?.maxTraces ? Math.min(totalTraces, options.maxTraces) : Math.min(totalTraces, 10000);

  // Decode helper based on sample format
  const readSample = (offset: number): number => {
    if (offset + bytesPerSample > totalBytes) return 0;
    if (formatCode === 1) {
      // IBM 32-bit float
      return decodeIBMFloat(view, offset);
    } else if (formatCode === 5) {
      // IEEE 32-bit float
      return view.getFloat32(offset, isLittleEndian);
    } else if (formatCode === 2) {
      // 32-bit int
      return view.getInt32(offset, isLittleEndian);
    } else if (formatCode === 3) {
      // 16-bit int
      return view.getInt16(offset, isLittleEndian);
    } else if (formatCode === 8) {
      // 8-bit int
      return view.getInt8(offset);
    }
    // Fallback IEEE float
    return view.getFloat32(offset, isLittleEndian);
  };

  if (detectedType === '2d') {
    // ==========================================
    // 2D SEISMIC LINE IMPORT
    // ==========================================
    const nTraces = maxTracesToRead;
    const data = new Float32Array(nTraces * nSamples);
    const cdpNumbers: number[] = [];
    const shotPoints: number[] = [];
    const xCoords: number[] = [];
    const yCoords: number[] = [];

    for (let t = 0; t < nTraces; t++) {
      const traceStart = 3600 + t * traceTotalSize;
      const dataStart = traceStart + 240;

      const th = parseTraceHeader(view, traceStart, isLittleEndian, options);
      cdpNumbers.push(th.cdp || (t + 1));
      shotPoints.push(th.shotPoint || (t + 1));
      xCoords.push(th.cdpX);
      yCoords.push(th.cdpY);

      for (let s = 0; s < nSamples; s++) {
        const sampleOffset = dataStart + s * bytesPerSample;
        const val = readSample(sampleOffset);
        data[t * nSamples + s] = isNaN(val) ? 0 : val;
      }
    }

    const totalTimeMs = (nSamples - 1) * sampleRate;
    const ramMb = Math.round((data.byteLength / (1024 * 1024)) * 10) / 10;

    const dataset: SeismicDataset = {
      type: '2d',
      data,
      nInlines: 1,
      nCrosslines: nTraces,
      nTraces,
      nSamples,
      sampleRate,
      totalTimeMs,
      ilines: [1],
      xlines: cdpNumbers,
      cdpNumbers,
      shotPoints,
      xCoords,
      yCoords,
      source: 'segy',
      name: fileName,
      lineName: fileName.replace(/\.[^/.]+$/, ''),
      ramMb,
      textHeader,
      binaryHeader,
      sampleTraceHeaders,
      isLittleEndian,
    };

    dataset.meanTrace = computeMeanAmplitudeTrace(dataset);
    dataset.envelope = computeEnvelopeTrace(dataset.meanTrace);

    return dataset;
  } else {
    // ==========================================
    // 3D SEISMIC CUBE IMPORT
    // ==========================================
    // Collect all trace inlines & crosslines
    const traceCoords: { tIdx: number; il: number; xl: number }[] = [];
    const ilSet = new Set<number>();
    const xlSet = new Set<number>();

    for (let t = 0; t < maxTracesToRead; t++) {
      const traceStart = 3600 + t * traceTotalSize;
      const th = parseTraceHeader(view, traceStart, isLittleEndian, options);
      const il = th.inline > 0 ? th.inline : Math.floor(t / 32) + 100;
      const xl = th.crossline > 0 ? th.crossline : (t % 32) + 200;
      traceCoords.push({ tIdx: t, il, xl });
      ilSet.add(il);
      xlSet.add(xl);
    }

    const ilines = Array.from(ilSet).sort((a, b) => a - b);
    const xlines = Array.from(xlSet).sort((a, b) => a - b);

    // Build index maps
    const ilMap = new Map<number, number>();
    ilines.forEach((il, i) => ilMap.set(il, i));
    const xlMap = new Map<number, number>();
    xlines.forEach((xl, i) => xlMap.set(xl, i));

    const nInlines = ilines.length;
    const nCrosslines = xlines.length;
    const totalGridTraces = nInlines * nCrosslines;
    const data = new Float32Array(totalGridTraces * nSamples);

    for (const { tIdx, il, xl } of traceCoords) {
      const ilGrid = ilMap.get(il);
      const xlGrid = xlMap.get(xl);
      if (ilGrid !== undefined && xlGrid !== undefined) {
        const gridTraceIdx = ilGrid * nCrosslines + xlGrid;
        const traceStart = 3600 + tIdx * traceTotalSize;
        const dataStart = traceStart + 240;

        for (let s = 0; s < nSamples; s++) {
          const sampleOffset = dataStart + s * bytesPerSample;
          const val = readSample(sampleOffset);
          data[gridTraceIdx * nSamples + s] = isNaN(val) ? 0 : val;
        }
      }
    }

    const totalTimeMs = (nSamples - 1) * sampleRate;
    const ramMb = Math.round((data.byteLength / (1024 * 1024)) * 10) / 10;

    const dataset: SeismicDataset = {
      type: '3d',
      data,
      nInlines,
      nCrosslines,
      nTraces: totalGridTraces,
      nSamples,
      sampleRate,
      totalTimeMs,
      ilines,
      xlines,
      source: 'segy',
      name: fileName,
      ramMb,
      textHeader,
      binaryHeader,
      sampleTraceHeaders,
      isLittleEndian,
    };

    dataset.meanTrace = computeMeanAmplitudeTrace(dataset);
    dataset.envelope = computeEnvelopeTrace(dataset.meanTrace);

    return dataset;
  }
}

/**
 * Generate a Ricker wavelet
 */
export function generateRickerWavelet(
  frequency: number = 30,
  sampleRate: number = 4,
  length: number = 61
): Float32Array {
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
 * Generate a high-fidelity 2D Seismic Line (e.g. 500 CMP traces with rollover anticline,
 * dipping strata, major listric fault, unconformity, bright spot)
 */
export function generateSynthetic2DLine(
  nTraces: number = 400,
  nSamples: number = 1000,
  sampleRate: number = 4.0,
  lineName: string = 'Synthetic 2D Regional Profile (Line-201)'
): SeismicDataset {
  const totalElements = nTraces * nSamples;
  const data = new Float32Array(totalElements);

  // Key reflector sample baselines
  const reflectors = [80, 180, 310, 450, 580, 680, 820];
  const amplitudes = [0.75, -0.65, 1.10, -0.85, 1.45, -0.90, 0.60];
  const wavelet = generateRickerWavelet(28, sampleRate, 55);
  const wavLen = wavelet.length;
  const wavHalf = Math.floor(wavLen / 2);

  for (let rIdx = 0; rIdx < reflectors.length; rIdx++) {
    const baseSample = reflectors[rIdx];
    const amp = amplitudes[rIdx];

    for (let t = 0; t < nTraces; t++) {
      // Structural geology: Anticlinal dome centered at trace 220 + regional dip
      const xNorm = (t - nTraces * 0.45) / (nTraces * 0.5);
      const anticlinalRise = Math.exp(-Math.pow(xNorm, 2) * 2.5) * 35;
      const regionalDip = t * 0.12;

      // Major normal listric fault at trace 280 with downthrow
      const faultDisplacement = t > 280 ? 18 + (t - 280) * 0.05 : 0;

      // Bright spot anomaly on reflector 4 (index 4 = 580ms) near crest
      let localAmp = amp;
      if (rIdx === 4 && t >= 160 && t <= 260) {
        const gasFactor = 1.0 + Math.sin(((t - 160) / 100) * Math.PI) * 1.2;
        localAmp *= gasFactor;
      }

      const peakPos = Math.round(baseSample + regionalDip - anticlinalRise + faultDisplacement);

      if (peakPos >= 0 && peakPos < nSamples) {
        for (let w = 0; w < wavLen; w++) {
          const s = peakPos - wavHalf + w;
          if (s >= 0 && s < nSamples) {
            data[t * nSamples + s] += localAmp * wavelet[w];
          }
        }
      }
    }
  }

  // Gaussian noise
  for (let i = 0; i < totalElements; i++) {
    const u1 = Math.max(1e-7, Math.random());
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    data[i] += randStdNormal * 0.035;
  }

  const cdpNumbers = Array.from({ length: nTraces }, (_, i) => 1000 + i * 5);
  const shotPoints = Array.from({ length: nTraces }, (_, i) => 100 + i);
  const totalTimeMs = (nSamples - 1) * sampleRate;
  const ramMb = Math.round((data.byteLength / (1024 * 1024)) * 10) / 10;

  const dataset: SeismicDataset = {
    type: '2d',
    data,
    nInlines: 1,
    nCrosslines: nTraces,
    nTraces,
    nSamples,
    sampleRate,
    totalTimeMs,
    ilines: [1],
    xlines: cdpNumbers,
    cdpNumbers,
    shotPoints,
    source: '2d-preset',
    name: lineName,
    lineName,
    ramMb,
  };

  dataset.meanTrace = computeMeanAmplitudeTrace(dataset);
  dataset.envelope = computeEnvelopeTrace(dataset.meanTrace);

  return dataset;
}

/**
 * Generate a 3D synthetic seismic volume
 */
export function generateSyntheticCube(
  nInlines: number = 32,
  nCrosslines: number = 32,
  nSamples: number = 1000,
  sampleRate: number = 4.0,
  presetName: string = 'Synthetic Reservoir Demo'
): SeismicDataset {
  const totalTraces = nInlines * nCrosslines;
  const totalElements = totalTraces * nSamples;
  const data = new Float32Array(totalElements);

  const reflectors = [70, 160, 280, 420, 560, 617, 740, 880];
  const amplitudes = [0.65, -0.55, 0.90, -0.45, 1.35, -0.80, 0.70, -0.50];
  const wavelet = generateRickerWavelet(30, sampleRate, 55);
  const wavLen = wavelet.length;
  const wavHalf = Math.floor(wavLen / 2);

  const getIdx = (il: number, xl: number, s: number) => (il * nCrosslines + xl) * nSamples + s;

  for (let rIdx = 0; rIdx < reflectors.length; rIdx++) {
    const baseSample = reflectors[rIdx];
    const amp = amplitudes[rIdx];

    for (let il = 0; il < nInlines; il++) {
      for (let xl = 0; xl < nCrosslines; xl++) {
        const dx = (xl - nCrosslines * 0.45) / nCrosslines;
        const dy = (il - nInlines * 0.5) / nInlines;
        const domeShift = Math.sin(Math.PI * dx) * Math.cos(Math.PI * dy) * 18;
        const dipShift = il * 0.35 + xl * 0.25;
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

  for (let i = 0; i < totalElements; i++) {
    const u1 = Math.max(1e-7, Math.random());
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    data[i] += randStdNormal * 0.035;
  }

  const ilines = Array.from({ length: nInlines }, (_, i) => 100 + i);
  const xlines = Array.from({ length: nCrosslines }, (_, i) => 200 + i);
  const totalTimeMs = (nSamples - 1) * sampleRate;
  const ramMb = Math.round((data.byteLength / (1024 * 1024)) * 10) / 10;

  const dataset: SeismicDataset = {
    type: '3d',
    data,
    nInlines,
    nCrosslines,
    nTraces: totalTraces,
    nSamples,
    sampleRate,
    totalTimeMs,
    ilines,
    xlines,
    source: 'synthetic',
    name: presetName,
    ramMb,
  };

  dataset.meanTrace = computeMeanAmplitudeTrace(dataset);
  dataset.envelope = computeEnvelopeTrace(dataset.meanTrace);

  return dataset;
}

/**
 * Extract 2D line traces or 3D slice traces
 */
export function getLineTraces(dataset: SeismicDataset): Float32Array[] {
  const { nTraces, nSamples, data } = dataset;
  const traces: Float32Array[] = [];
  for (let t = 0; t < nTraces; t++) {
    const trace = new Float32Array(nSamples);
    const startIdx = t * nSamples;
    for (let s = 0; s < nSamples; s++) {
      trace[s] = data[startIdx + s];
    }
    traces.push(trace);
  }
  return traces;
}

/**
 * Extract an Inline 2D section from 3D Cube
 */
export function getInlineSection(dataset: SeismicDataset, inlineIndex: number): Float32Array[] {
  if (dataset.type === '2d') {
    return getLineTraces(dataset);
  }
  const { nCrosslines, nSamples, data } = dataset;
  const section: Float32Array[] = [];
  const safeIl = Math.max(0, Math.min(dataset.nInlines - 1, inlineIndex));

  for (let xl = 0; xl < nCrosslines; xl++) {
    const trace = new Float32Array(nSamples);
    const startIdx = (safeIl * nCrosslines + xl) * nSamples;
    for (let s = 0; s < nSamples; s++) {
      trace[s] = data[startIdx + s];
    }
    section.push(trace);
  }
  return section;
}

/**
 * Extract a Crossline 2D section from 3D Cube
 */
export function getCrosslineSection(dataset: SeismicDataset, crosslineIndex: number): Float32Array[] {
  if (dataset.type === '2d') {
    return getLineTraces(dataset);
  }
  const { nInlines, nCrosslines, nSamples, data } = dataset;
  const section: Float32Array[] = [];
  const safeXl = Math.max(0, Math.min(nCrosslines - 1, crosslineIndex));

  for (let il = 0; il < nInlines; il++) {
    const trace = new Float32Array(nSamples);
    const startIdx = (il * nCrosslines + safeXl) * nSamples;
    for (let s = 0; s < nSamples; s++) {
      trace[s] = data[startIdx + s];
    }
    section.push(trace);
  }
  return section;
}

/**
 * Extract a horizontal Time/Depth Slice (3D Cube only)
 */
export function getTimeSlice(dataset: SeismicDataset, sampleIndex: number): number[][] {
  const { nInlines, nCrosslines, nSamples, data } = dataset;
  const clampedSample = Math.max(0, Math.min(nSamples - 1, Math.round(sampleIndex)));
  const slice: number[][] = [];

  for (let il = 0; il < nInlines; il++) {
    const row: number[] = [];
    for (let xl = 0; xl < nCrosslines; xl++) {
      const idx = (il * nCrosslines + xl) * nSamples + clampedSample;
      row.push(data[idx] || 0);
    }
    slice.push(row);
  }
  return slice;
}

/**
 * Compute the average 1D amplitude trace across all traces in the dataset
 */
export function computeMeanAmplitudeTrace(dataset: SeismicDataset): number[] {
  const { nTraces, nSamples, data } = dataset;
  const meanTrace = new Float64Array(nSamples);

  for (let t = 0; t < nTraces; t++) {
    const offset = t * nSamples;
    for (let s = 0; s < nSamples; s++) {
      meanTrace[s] += data[offset + s];
    }
  }

  const result: number[] = [];
  for (let s = 0; s < nSamples; s++) {
    result.push(meanTrace[s] / Math.max(1, nTraces));
  }
  return result;
}

/**
 * Hilbert envelope approximation
 */
export function computeEnvelopeTrace(trace: number[]): number[] {
  const n = trace.length;
  const envelope = new Array<number>(n);
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
 * Suggest strong geological reflector candidates
 */
export function suggestHorizons(
  datasetOrTrace: SeismicDataset | number[],
  sampleRate: number,
  nSuggestions: number = 8
): { suggestions: HorizonSuggestion[]; meanTrace: number[]; envelope: number[] } {
  let meanTrace: number[];
  if (Array.isArray(datasetOrTrace)) {
    meanTrace = datasetOrTrace;
  } else {
    meanTrace = datasetOrTrace.meanTrace || computeMeanAmplitudeTrace(datasetOrTrace);
  }
  const envelope = computeEnvelopeTrace(meanTrace);
  const n = meanTrace.length;

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

  if (peaks.length === 0) {
    const step = Math.floor(n / (nSuggestions + 1));
    for (let i = 1; i <= nSuggestions; i++) {
      peaks.push(i * step);
    }
  }

  const ranked = peaks
    .map((sample) => {
      const timeMs = Math.round(sample * sampleRate * 10) / 10;
      const amp = Math.round(meanTrace[sample] * 1000) / 1000;
      const confidence = Math.min(99, Math.round((normEnv[sample] || 0.5) * 85 + 15));
      return { sample, timeMs, amplitude: amp, confidence };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, nSuggestions);

  return { suggestions: ranked, meanTrace, envelope };
}

/**
 * Auto-track a geological horizon across 3D survey grid or 2D seismic profile
 */
export function pickHorizonSurface(
  dataset: SeismicDataset,
  seedSample: number,
  searchWindow: number = 6,
  polarity: 'positive' | 'negative' | 'both' = 'positive'
): number[][] {
  const { nInlines, nCrosslines, nSamples, data } = dataset;
  const surface: number[][] = [];

  for (let il = 0; il < nInlines; il++) {
    const row: number[] = [];
    for (let xl = 0; xl < nCrosslines; xl++) {
      const traceOffset = (il * nCrosslines + xl) * nSamples;

      // Seed tracking search around seedSample
      const startS = Math.max(0, seedSample - searchWindow);
      const endS = Math.min(nSamples - 1, seedSample + searchWindow);

      let bestS = seedSample;
      let bestScore = -Infinity;

      for (let s = startS; s <= endS; s++) {
        const val = data[traceOffset + s] || 0;
        let score = 0;
        if (polarity === 'positive') score = val;
        else if (polarity === 'negative') score = -val;
        else score = Math.abs(val);

        // Distance penalty from seed
        const distPenalty = Math.abs(s - seedSample) * 0.05;
        score -= distPenalty;

        if (score > bestScore) {
          bestScore = score;
          bestS = s;
        }
      }

      row.push(bestS);
    }
    surface.push(row);
  }

  return surface;
}

/**
 * Compute Isochore (thickness in milliseconds) between Top and Base Horizons
 */
export function computeIsochore(
  topHorizon: number[][],
  baseHorizon: number[][],
  sampleRate: number
): number[][] {
  const nIl = topHorizon.length;
  const nXl = topHorizon[0]?.length || 0;
  const isochore: number[][] = [];

  for (let il = 0; il < nIl; il++) {
    const row: number[] = [];
    for (let xl = 0; xl < nXl; xl++) {
      const topS = topHorizon[il][xl];
      const baseS = baseHorizon[il][xl];
      const deltaSamples = Math.max(0, baseS - topS);
      const deltaMs = deltaSamples * sampleRate;
      row.push(deltaMs);
    }
    isochore.push(row);
  }

  return isochore;
}

/**
 * Compute Gross Rock Volume (GRV) from Isochore matrix
 */
export function computeGRV(
  isochoreMs: number[][],
  inlineSpacing: number = 25,
  crosslineSpacing: number = 25,
  velocity: number = 2500,
  is2D: boolean = false
): GRVData {
  const nIl = isochoreMs.length;
  const nXl = isochoreMs[0]?.length || 0;
  const cellAreaM2 = inlineSpacing * crosslineSpacing;

  const isochoreM: number[][] = [];
  let totalVolumeM3 = 0;
  let totalThickness = 0;
  let maxThickness = 0;
  let cellCount = 0;
  let crossSectionAreaM2 = 0;

  for (let il = 0; il < nIl; il++) {
    const row: number[] = [];
    for (let xl = 0; xl < nXl; xl++) {
      const dtMs = isochoreMs[il][xl];
      // Thickness in meters: (dt in seconds * velocity) / 2 (two-way travel time)
      const thicknessM = (dtMs / 1000.0) * (velocity / 2.0);
      row.push(thicknessM);

      if (thicknessM > 0) {
        totalThickness += thicknessM;
        if (thicknessM > maxThickness) maxThickness = thicknessM;
        cellCount++;
        
        if (is2D) {
          crossSectionAreaM2 += thicknessM * inlineSpacing;
        } else {
          totalVolumeM3 += thicknessM * cellAreaM2;
        }
      }
    }
    isochoreM.push(row);
  }

  if (is2D) {
    // For 2D seismic lines: GRV = Cross Section Area * Assumed Lateral Closure Width
    const assumedWidth = crosslineSpacing; // Use crosslineSpacing as lateral width parameter
    totalVolumeM3 = crossSectionAreaM2 * assumedWidth;
  }

  const grvFt3 = totalVolumeM3 * 35.3147;
  const grvAcreFt = totalVolumeM3 / 1233.48; // 1 acre-ft = 1233.48 m^3
  const grvKm3 = totalVolumeM3 / 1e9;
  const avgThicknessM = cellCount > 0 ? totalThickness / cellCount : 0;

  return {
    grvM3: Math.round(totalVolumeM3),
    grvFt3: Math.round(grvFt3),
    grvAcreFt: Math.round(grvAcreFt),
    grvKm3: Math.round(grvKm3 * 10000) / 10000,
    isochoreM,
    cellAreaM2,
    nCells: cellCount,
    avgThicknessM: Math.round(avgThicknessM * 10) / 10,
    maxThicknessM: Math.round(maxThickness * 10) / 10,
    is2D,
    crossSectionAreaM2: Math.round(crossSectionAreaM2),
    assumedClosureWidthM: crosslineSpacing,
  };
}

/**
 * Built-in 2D & 3D geological presets
 */
export const GEOLOGICAL_PRESETS_3D = [
  {
    id: 'north_sea',
    type: '3d' as const,
    name: 'North Sea Brent Sandstone 3D',
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
    type: '3d' as const,
    name: 'Gulf of Mexico Turbidite 3D',
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
    type: '3d' as const,
    name: 'Arabian Basin Carbonate Reef 3D',
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

export const GEOLOGICAL_PRESETS_2D = [
  {
    id: 'north_sea_2d',
    type: '2d' as const,
    name: 'North Sea Regional Strike Line 101 (2D)',
    description: '400 CMP 2D profile across fault block rotation with rollover crest and flat spot contact.',
    nTraces: 400,
    nSamples: 1200,
    sampleRate: 4.0,
    topTargetMs: 2320,
    baseTargetMs: 2480,
    velocity: 2700,
  },
  {
    id: 'gom_subsalt_2d',
    type: '2d' as const,
    name: 'Gulf of Mexico Subsalt Profile 204 (2D)',
    description: 'Deepwater mini-basin 2D line showing bright turbidite pay interval below salt flank.',
    nTraces: 450,
    nSamples: 1400,
    sampleRate: 4.0,
    topTargetMs: 2720,
    baseTargetMs: 2880,
    velocity: 2450,
  },
  {
    id: 'thrust_belt_2d',
    type: '2d' as const,
    name: 'Fold & Thrust Belt Structural Line 55 (2D)',
    description: 'Compressional anticline with steep forelimb dip and imbricate thrust fault repetition.',
    nTraces: 380,
    nSamples: 1100,
    sampleRate: 4.0,
    topTargetMs: 1950,
    baseTargetMs: 2120,
    velocity: 3100,
  },
];

export const GEOLOGICAL_PRESETS = [...GEOLOGICAL_PRESETS_3D, ...GEOLOGICAL_PRESETS_2D];
