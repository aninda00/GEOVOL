import { DeviationSurveyStation, WellTrajectory, WellLocation } from '../types';

/**
 * Parses raw text from well heads files such as 'Salda wells heads.txt'
 * Supported header styles:
 * Well Name | Northing Y | Easting.X | KB | TD
 * Well | Northing | Easting | KB | TotalDepth
 */
export interface ParsedWellHead {
  wellName: string;
  northingY?: number;
  eastingX?: number;
  elevationKb?: number;
  totalDepth?: number;
  inline?: number;
  crossline?: number;
  lineName?: string;
  cdpOrSp?: number;
}

export function parseWellHeadsFile(text: string): ParsedWellHead[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) return [];

  // Look for header line
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const rawTokens = lines[i].split(/[\t,;]+| {2,}/).map((t) => t.trim().toLowerCase());
    if (
      rawTokens.some((t) => t.includes('well') || t.includes('name') || t.includes('uwi')) ||
      rawTokens.some((t) => t.includes('north') || t.includes('east') || t.includes('kb') || t.includes('td'))
    ) {
      headerIndex = i;
      headers = rawTokens;
      break;
    }
  }

  // If no header found, assume standard default column layout: Name, Northing, Easting, KB, TD
  const findCol = (keywords: string[]) => {
    if (headerIndex === -1) return -1;
    return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
  };

  const nameIdx = findCol(['well', 'name', 'uwi']);
  const northIdx = findCol(['north', 'northing', 'y', 'lat']);
  const eastIdx = findCol(['east', 'easting', 'x', 'lon', 'long']);
  const kbIdx = findCol(['kb', 'elev', 'rkb', 'datum']);
  const tdIdx = findCol(['td', 'total', 'depth', 'tvd']);

  const startLine = headerIndex >= 0 ? headerIndex + 1 : 0;
  const results: ParsedWellHead[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    // Split by tabs, commas, semicolons, or 2+ spaces
    const tokens = line.split(/[\t,;]+| {2,}/).map((t) => t.trim()).filter((t) => t.length > 0);
    if (tokens.length < 2) continue;

    let wellName = `WELL-${results.length + 1}`;
    let northingY: number | undefined;
    let eastingX: number | undefined;
    let elevationKb: number | undefined;
    let totalDepth: number | undefined;

    if (headerIndex !== -1) {
      if (nameIdx !== -1 && tokens[nameIdx]) wellName = tokens[nameIdx];
      if (northIdx !== -1 && !isNaN(parseFloat(tokens[northIdx]))) northingY = parseFloat(tokens[northIdx]);
      if (eastIdx !== -1 && !isNaN(parseFloat(tokens[eastIdx]))) eastingX = parseFloat(tokens[eastIdx]);
      if (kbIdx !== -1 && !isNaN(parseFloat(tokens[kbIdx]))) elevationKb = parseFloat(tokens[kbIdx]);
      if (tdIdx !== -1 && !isNaN(parseFloat(tokens[tdIdx]))) totalDepth = parseFloat(tokens[tdIdx]);
    } else {
      // Fallback heuristics: First non-numeric is wellName, next large numbers are Northing and Easting
      if (isNaN(parseFloat(tokens[0]))) {
        wellName = tokens[0];
        if (tokens[1] && !isNaN(parseFloat(tokens[1]))) northingY = parseFloat(tokens[1]);
        if (tokens[2] && !isNaN(parseFloat(tokens[2]))) eastingX = parseFloat(tokens[2]);
        if (tokens[3] && !isNaN(parseFloat(tokens[3]))) elevationKb = parseFloat(tokens[3]);
        if (tokens[4] && !isNaN(parseFloat(tokens[4]))) totalDepth = parseFloat(tokens[4]);
      } else {
        if (!isNaN(parseFloat(tokens[0]))) northingY = parseFloat(tokens[0]);
        if (!isNaN(parseFloat(tokens[1]))) eastingX = parseFloat(tokens[1]);
      }
    }

    // Sanity swap if northing and easting are inverted (Northing is usually larger in UTM, e.g. ~2.6M vs ~600k)
    if (northingY != null && eastingX != null && eastingX > 1000000 && northingY < 1000000) {
      const temp = northingY;
      northingY = eastingX;
      eastingX = temp;
    }

    results.push({
      wellName,
      northingY,
      eastingX,
      elevationKb,
      totalDepth,
    });
  }

  return results;
}

/**
 * Parses raw text from well deviation survey files such as 'Sld2_devi_actual.txt' or 'Sld3_dev actual.txt'
 * Supported column configurations:
 * 1) MD | Incl | HD | TVD | Azim
 * 2) MD | Azimuth | Inclination
 * 3) MD | Inc | Azim
 * 4) MD | TVD | DX | DY
 */
export interface RawSurveyRow {
  md: number;
  inclination?: number;
  azimuth?: number;
  tvd?: number;
  hd?: number;
}

export function parseDeviationSurveyFile(
  text: string,
  surfaceLocation?: { x?: number; y?: number; elevationKb?: number }
): WellTrajectory {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) {
    return {
      rawSurveyText: text,
      stations: [],
      maxInclination: 0,
      bottomHoleLocation: {
        md: 0,
        tvd: 0,
        hd: 0,
        x: surfaceLocation?.x ?? 0,
        y: surfaceLocation?.y ?? 0,
        azimuth: 0,
        inclination: 0,
      },
    };
  }

  // Detect header line
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const rawTokens = lines[i].split(/[\t,;]+| {2,}/).map((t) => t.trim().toLowerCase());
    if (
      rawTokens.some((t) => t.includes('md') || t.includes('depth')) &&
      rawTokens.some((t) => t.includes('inc') || t.includes('az') || t.includes('tvd'))
    ) {
      headerIndex = i;
      headers = rawTokens;
      break;
    }
  }

  const findIdx = (keywords: string[]) => {
    if (headerIndex === -1) return -1;
    return headers.findIndex((h) => keywords.some((k) => h === k || h.startsWith(k) || h.includes(k)));
  };

  const mdIdx = findIdx(['md', 'dept', 'depth']);
  const incIdx = findIdx(['incl', 'inc', 'inclination', 'dip']);
  const azIdx = findIdx(['azim', 'az', 'azimuth', 'dir', 'bearing']);
  const tvdIdx = findIdx(['tvd', 'tvdss', 'true_vert']);
  const hdIdx = findIdx(['hd', 'disp', 'horiz', 'vs', 'dx_dy']);

  const startLine = headerIndex >= 0 ? headerIndex + 1 : 0;
  const rawRows: RawSurveyRow[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    // Split by tab, comma, semicolon or whitespace
    const tokens = line.split(/[\t,;]+|\s+/).map((t) => t.trim()).filter((t) => t.length > 0);
    if (tokens.length < 2) continue;

    let md: number | null = null;
    let inclination: number | undefined;
    let azimuth: number | undefined;
    let tvd: number | undefined;
    let hd: number | undefined;

    if (headerIndex !== -1) {
      if (mdIdx !== -1 && tokens[mdIdx] && !isNaN(parseFloat(tokens[mdIdx]))) md = parseFloat(tokens[mdIdx]);
      if (incIdx !== -1 && tokens[incIdx] && !isNaN(parseFloat(tokens[incIdx]))) inclination = parseFloat(tokens[incIdx]);
      if (azIdx !== -1 && tokens[azIdx] && !isNaN(parseFloat(tokens[azIdx]))) azimuth = parseFloat(tokens[azIdx]);
      if (tvdIdx !== -1 && tokens[tvdIdx] && !isNaN(parseFloat(tokens[tvdIdx]))) tvd = parseFloat(tokens[tvdIdx]);
      if (hdIdx !== -1 && tokens[hdIdx] && !isNaN(parseFloat(tokens[hdIdx]))) hd = parseFloat(tokens[hdIdx]);
    } else {
      // Automatic column position heuristic
      const numTokens = tokens.map((t) => parseFloat(t)).filter((n) => !isNaN(n));
      if (numTokens.length >= 3) {
        md = numTokens[0];
        // Heuristic: If 2nd column is angle < 90, likely inclination; if 2nd column is angle up to 360, likely azimuth
        if (numTokens.length === 3) {
          // MD Azimuth Inclination or MD Inclination Azimuth
          if (numTokens[1] > 90 || numTokens[2] <= 90) {
            azimuth = numTokens[1];
            inclination = numTokens[2];
          } else {
            inclination = numTokens[1];
            azimuth = numTokens[2];
          }
        } else if (numTokens.length >= 5) {
          // MD Incl HD TVD Azim
          inclination = numTokens[1];
          hd = numTokens[2];
          tvd = numTokens[3];
          azimuth = numTokens[4];
        }
      }
    }

    if (md != null && !isNaN(md)) {
      rawRows.push({
        md,
        inclination: inclination != null && !isNaN(inclination) ? inclination : 0,
        azimuth: azimuth != null && !isNaN(azimuth) ? azimuth : 0,
        tvd: tvd != null && !isNaN(tvd) ? tvd : undefined,
        hd: hd != null && !isNaN(hd) ? hd : undefined,
      });
    }
  }

  // Sort rows by MD ascending
  rawRows.sort((a, b) => a.md - b.md);

  // Compute full 3D trajectory using Minimum Curvature Method
  return computeMinimumCurvatureTrajectory(rawRows, surfaceLocation, text);
}

export function compute3DTrajectory(
  stationsOrRows: (DeviationSurveyStation | RawSurveyRow)[],
  surfaceX: number = 0,
  surfaceY: number = 0,
  kb: number = 0,
  rawSurveyText?: string
): WellTrajectory {
  const rawRows: RawSurveyRow[] = stationsOrRows.map((s) => ({
    md: s.md,
    inclination: s.inclination,
    azimuth: s.azimuth,
    tvd: 'tvd' in s ? s.tvd : undefined,
    hd: 'hd' in s ? s.hd : undefined,
  }));
  return computeMinimumCurvatureTrajectory(rawRows, { x: surfaceX, y: surfaceY, elevationKb: kb }, rawSurveyText);
}

/**
 * Standard Petroleum Engineering Minimum Curvature Method (API / ISO 19389)
 */
export function computeMinimumCurvatureTrajectory(
  rawRows: RawSurveyRow[],
  surfaceLocation?: { x?: number; y?: number; elevationKb?: number },
  rawSurveyText?: string
): WellTrajectory {
  const surfaceX = surfaceLocation?.x ?? 0;
  const surfaceY = surfaceLocation?.y ?? 0;
  const kb = surfaceLocation?.elevationKb ?? 0;

  if (rawRows.length === 0) {
    return {
      rawSurveyText,
      stations: [
        {
          md: 0,
          inclination: 0,
          azimuth: 0,
          tvd: 0,
          tvdss: -kb,
          hd: 0,
          dx: 0,
          dy: 0,
          x: surfaceX,
          y: surfaceY,
          dogleg: 0,
        },
      ],
      maxInclination: 0,
      bottomHoleLocation: {
        md: 0,
        tvd: 0,
        hd: 0,
        x: surfaceX,
        y: surfaceY,
        azimuth: 0,
        inclination: 0,
      },
    };
  }

  const stations: DeviationSurveyStation[] = [];
  let maxInc = 0;

  // Insert station at surface (MD=0) if not present
  if (rawRows[0].md > 0) {
    stations.push({
      md: 0,
      inclination: 0,
      azimuth: rawRows[0].azimuth || 0,
      tvd: 0,
      tvdss: -kb,
      hd: 0,
      dx: 0,
      dy: 0,
      x: surfaceX,
      y: surfaceY,
      dogleg: 0,
    });
  }

  for (let i = 0; i < rawRows.length; i++) {
    const curr = rawRows[i];
    const incDeg = curr.inclination ?? 0;
    const azDeg = curr.azimuth ?? 0;
    maxInc = Math.max(maxInc, incDeg);

    if (stations.length === 0) {
      // First station
      const tvd = curr.tvd ?? curr.md;
      const hd = curr.hd ?? 0;
      stations.push({
        md: curr.md,
        inclination: incDeg,
        azimuth: azDeg,
        tvd,
        tvdss: tvd - kb,
        hd,
        dx: 0,
        dy: 0,
        x: surfaceX,
        y: surfaceY,
        dogleg: 0,
      });
      continue;
    }

    const prev = stations[stations.length - 1];
    const dMD = curr.md - prev.md;

    if (dMD <= 0) {
      continue; // Duplicate MD
    }

    // Convert angles to radians
    const i1 = (prev.inclination * Math.PI) / 180;
    const i2 = (incDeg * Math.PI) / 180;
    const a1 = (prev.azimuth * Math.PI) / 180;
    const a2 = (azDeg * Math.PI) / 180;

    // Minimum curvature calculation
    // Dogleg angle beta: cos(beta) = cos(I2 - I1) - sin(I1)*sin(I2)*(1 - cos(A2 - A1))
    const cosBeta = Math.cos(i2 - i1) - Math.sin(i1) * Math.sin(i2) * (1 - Math.cos(a2 - a1));
    const clampedCosBeta = Math.max(-1, Math.min(1, cosBeta));
    const beta = Math.acos(clampedCosBeta);

    let rf = 1.0; // Ratio factor
    if (beta > 1e-6) {
      rf = (2 / beta) * Math.tan(beta / 2);
    }

    const dTVD = (dMD / 2) * (Math.cos(i1) + Math.cos(i2)) * rf;
    const dNorth = (dMD / 2) * (Math.sin(i1) * Math.cos(a1) + Math.sin(i2) * Math.cos(a2)) * rf;
    const dEast = (dMD / 2) * (Math.sin(i1) * Math.sin(a1) + Math.sin(i2) * Math.sin(a2)) * rf;

    // If survey already has accurate TVD / HD provided (like Sld2_devi_actual.txt), use or blend
    const tvd = curr.tvd != null ? curr.tvd : (prev.tvd ?? 0) + dTVD;
    const dx = (prev.dx ?? 0) + dEast;
    const dy = (prev.dy ?? 0) + dNorth;
    const hd = curr.hd != null ? curr.hd : Math.sqrt(dx * dx + dy * dy);

    // Dogleg severity in deg / 30m
    const dls = dMD > 0 ? ((beta * 180) / Math.PI / dMD) * 30 : 0;

    stations.push({
      md: Math.round(curr.md * 100) / 100,
      inclination: Math.round(incDeg * 100) / 100,
      azimuth: Math.round(azDeg * 100) / 100,
      tvd: Math.round(tvd * 100) / 100,
      tvdss: Math.round((tvd - kb) * 100) / 100,
      hd: Math.round(hd * 100) / 100,
      dx: Math.round(dx * 100) / 100,
      dy: Math.round(dy * 100) / 100,
      x: Math.round((surfaceX + dx) * 100) / 100,
      y: Math.round((surfaceY + dy) * 100) / 100,
      dogleg: Math.round(dls * 100) / 100,
    });
  }

  const lastStation = stations[stations.length - 1];

  return {
    rawSurveyText,
    stations,
    maxInclination: Math.round(maxInc * 10) / 10,
    bottomHoleLocation: {
      md: lastStation.md,
      tvd: lastStation.tvd ?? lastStation.md,
      hd: lastStation.hd ?? 0,
      x: lastStation.x ?? surfaceX,
      y: lastStation.y ?? surfaceY,
      azimuth: lastStation.azimuth,
      inclination: lastStation.inclination,
    },
  };
}

/**
 * Interpolates full 3D coordinates (X, Y, TVD, TVDSS, Inc, Azim) at any given Measured Depth (MD)
 */
export function interpolateTrajectoryAtMD(
  trajectory: WellTrajectory | undefined,
  targetMD: number,
  fallbackLocation?: WellLocation
): {
  md: number;
  tvd: number;
  tvdss: number;
  x: number;
  y: number;
  hd: number;
  inclination: number;
  azimuth: number;
} {
  const surfaceX = fallbackLocation?.x ?? 0;
  const surfaceY = fallbackLocation?.y ?? 0;
  const kb = fallbackLocation?.elevationKb ?? 0;

  if (!trajectory || !trajectory.stations || trajectory.stations.length === 0) {
    return {
      md: targetMD,
      tvd: targetMD,
      tvdss: targetMD - kb,
      x: surfaceX,
      y: surfaceY,
      hd: 0,
      inclination: 0,
      azimuth: 0,
    };
  }

  const stations = trajectory.stations;

  // Before first station
  if (targetMD <= stations[0].md) {
    const s0 = stations[0];
    return {
      md: targetMD,
      tvd: targetMD,
      tvdss: targetMD - kb,
      x: s0.x ?? surfaceX,
      y: s0.y ?? surfaceY,
      hd: 0,
      inclination: s0.inclination,
      azimuth: s0.azimuth,
    };
  }

  // After last station
  if (targetMD >= stations[stations.length - 1].md) {
    const sl = stations[stations.length - 1];
    const extraMD = targetMD - sl.md;
    const incRad = (sl.inclination * Math.PI) / 180;
    const azRad = (sl.azimuth * Math.PI) / 180;
    const extraTVD = extraMD * Math.cos(incRad);
    const extraDX = extraMD * Math.sin(incRad) * Math.sin(azRad);
    const extraDY = extraMD * Math.sin(incRad) * Math.cos(azRad);

    const tvd = (sl.tvd ?? sl.md) + extraTVD;
    const x = (sl.x ?? surfaceX) + extraDX;
    const y = (sl.y ?? surfaceY) + extraDY;
    const hd = (sl.hd ?? 0) + Math.sqrt(extraDX * extraDX + extraDY * extraDY);

    return {
      md: targetMD,
      tvd: Math.round(tvd * 100) / 100,
      tvdss: Math.round((tvd - kb) * 100) / 100,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      hd: Math.round(hd * 100) / 100,
      inclination: sl.inclination,
      azimuth: sl.azimuth,
    };
  }

  // Find surrounding stations
  for (let i = 0; i < stations.length - 1; i++) {
    const s1 = stations[i];
    const s2 = stations[i + 1];

    if (targetMD >= s1.md && targetMD <= s2.md) {
      const frac = (targetMD - s1.md) / (s2.md - s1.md || 1);
      const tvd1 = s1.tvd ?? s1.md;
      const tvd2 = s2.tvd ?? s2.md;
      const tvd = tvd1 + frac * (tvd2 - tvd1);

      const x1 = s1.x ?? surfaceX;
      const x2 = s2.x ?? surfaceX;
      const x = x1 + frac * (x2 - x1);

      const y1 = s1.y ?? surfaceY;
      const y2 = s2.y ?? surfaceY;
      const y = y1 + frac * (y2 - y1);

      const hd1 = s1.hd ?? 0;
      const hd2 = s2.hd ?? 0;
      const hd = hd1 + frac * (hd2 - hd1);

      const inc = s1.inclination + frac * (s2.inclination - s1.inclination);
      const az = s1.azimuth + frac * (s2.azimuth - s1.azimuth);

      return {
        md: targetMD,
        tvd: Math.round(tvd * 100) / 100,
        tvdss: Math.round((tvd - kb) * 100) / 100,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        hd: Math.round(hd * 100) / 100,
        inclination: Math.round(inc * 100) / 100,
        azimuth: Math.round(az * 100) / 100,
      };
    }
  }

  return {
    md: targetMD,
    tvd: targetMD,
    tvdss: targetMD - kb,
    x: surfaceX,
    y: surfaceY,
    hd: 0,
    inclination: 0,
    azimuth: 0,
  };
}
