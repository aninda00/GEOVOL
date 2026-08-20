import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  MonteCarloResults,
  PetroState,
  HorizonState,
  ProjectMetadata,
  HorizonGrid,
} from '../types';

/**
 * Generate Multi-sheet Excel workbook and trigger download
 */
export function exportExcelReport(
  meta: ProjectMetadata,
  horizonState: HorizonState,
  petro: PetroState,
  mc: MonteCarloResults
) {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryRows: (string | number)[][] = [
    ['GEOVOL — RESERVOIR VOLUMETRICS EXECUTIVE REPORT'],
    ['Project Name:', meta.projectName, 'Field / Prospect:', meta.fieldName],
    ['Author:', meta.author, 'Date:', meta.date || new Date().toISOString().split('T')[0]],
    ['Formation Target:', meta.formation || 'Target Reservoir', 'Notes:', meta.notes || ''],
    [''],
    ['VOLUMETRIC ASSESSMENT SUMMARY (Monte Carlo Simulation)'],
    ['Fluid Type', 'P10 (Low)', 'P50 (Median)', 'P90 (High)', 'Mean', 'Std Dev', 'Unit', 'Simulations'],
  ];

  if (mc.oiip) {
    summaryRows.push([
      'Oil Initially in Place (OIIP)',
      mc.oiip.p10,
      mc.oiip.p50,
      mc.oiip.p90,
      mc.oiip.mean,
      mc.oiip.std,
      mc.oiip.unit,
      mc.runs,
    ]);
  }
  if (mc.giip) {
    summaryRows.push([
      'Gas Initially in Place (GIIP)',
      mc.giip.p10,
      mc.giip.p50,
      mc.giip.p90,
      mc.giip.mean,
      mc.giip.std,
      mc.giip.unit,
      mc.runs,
    ]);
  }

  summaryRows.push(
    [''],
    ['INPUT PETROPHYSICAL PARAMETERS & UNCERTAINTIES'],
    ['Parameter', 'P10 (Low)', 'P50 (Median)', 'P90 (High)', 'Unit', 'Source']
  );

  const petroRows: (string | number)[][] = [
    ['Gross Rock Volume (GRV)', horizonState.grvP10, horizonState.grvP50, horizonState.grvP90, 'acre-ft', '3D Seismic Horizon'],
    ['Porosity (φ)', (petro.porosity.p10 * 100).toFixed(1) + '%', (petro.porosity.p50 * 100).toFixed(1) + '%', (petro.porosity.p90 * 100).toFixed(1) + '%', 'fraction', petro.source.toUpperCase()],
    ['Water Saturation (Sw)', (petro.sw.p10 * 100).toFixed(1) + '%', (petro.sw.p50 * 100).toFixed(1) + '%', (petro.sw.p90 * 100).toFixed(1) + '%', 'fraction', petro.source.toUpperCase()],
    ['Net-to-Gross (NTG)', (petro.ntg.p10 * 100).toFixed(1) + '%', (petro.ntg.p50 * 100).toFixed(1) + '%', (petro.ntg.p90 * 100).toFixed(1) + '%', 'fraction', petro.source.toUpperCase()],
    ['Oil FVF (Bo)', petro.bo.p10, petro.bo.p50, petro.bo.p90, 'rb/stb', 'Input Model'],
    ['Gas FVF (Bg)', petro.bg.p10, petro.bg.p50, petro.bg.p90, 'rcf/scf', 'Input Model'],
  ];

  for (const r of petroRows) {
    summaryRows.push(r);
  }

  summaryRows.push(
    [''],
    ['RESERVOIR GEOMETRY & GRV METRICS'],
    ['Metric', 'Value', 'Unit'],
    ['GRV (Acre-Feet)', Math.round(horizonState.grvData.grvAcreFt), 'acre-ft'],
    ['GRV (Million m³)', Math.round((horizonState.grvData.grvM3 / 1e6) * 100) / 100, 'Mm³'],
    ['Average Reservoir Thickness', horizonState.grvData.avgThicknessM, 'm'],
    ['Maximum Reservoir Thickness', horizonState.grvData.maxThicknessM, 'm'],
    ['Active Reservoir Cells', horizonState.grvData.nCells, 'bins']
  );

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // 2. Raw Monte Carlo Data Sheet (First 10,000 runs)
  const mcHeaders: string[] = ['Iteration'];
  const mcColumns: number[][] = [];

  if (mc.oiip) {
    mcHeaders.push('OIIP_MMstb');
    mcColumns.push(mc.oiip.raw.slice(0, 10000));
  }
  if (mc.giip) {
    mcHeaders.push('GIIP_Bscf');
    mcColumns.push(mc.giip.raw.slice(0, 10000));
  }

  if (mcColumns.length > 0) {
    const mcRows: (string | number)[][] = [
      ['Monte Carlo Raw Sample Dataset (First 10,000 iterations)'],
      mcHeaders,
    ];
    const nRows = mcColumns[0].length;
    for (let r = 0; r < nRows; r++) {
      const row: (string | number)[] = [r + 1];
      for (let c = 0; c < mcColumns.length; c++) {
        row.push(Math.round(mcColumns[c][r] * 1000) / 1000);
      }
      mcRows.push(row);
    }
    const wsMC = XLSX.utils.aoa_to_sheet(mcRows);
    XLSX.utils.book_append_sheet(wb, wsMC, 'Monte Carlo Samples');
  }

  // 3. Sensitivity Analysis Sheet
  const sensRows: (string | number)[][] = [
    ['SENSITIVITY ANALYSIS (Tornado Spearman/Pearson Correlation)'],
    ['Input Parameter', 'OIIP Correlation (r)', 'GIIP Correlation (r)'],
  ];

  const sensKeys = ['GRV (Gross Rock Vol)', 'NTG (Net-to-Gross)', 'Porosity (φ)', 'Water Saturation (Sw)', 'Oil FVF (Bo)', 'Gas FVF (Bg)'];
  for (const k of sensKeys) {
    const rOil = mc.oiip?.sensitivity?.[k] !== undefined ? mc.oiip.sensitivity[k].toFixed(4) : 'N/A';
    const rGas = mc.giip?.sensitivity?.[k] !== undefined ? mc.giip.sensitivity[k].toFixed(4) : 'N/A';
    sensRows.push([k, rOil, rGas]);
  }

  const wsSens = XLSX.utils.aoa_to_sheet(sensRows);
  XLSX.utils.book_append_sheet(wb, wsSens, 'Sensitivity Analysis');

  const safeName = (meta.projectName || 'GeoVol_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `${safeName}_Executive_Report.xlsx`);
}

/**
 * Generate PDF Report using jsPDF & autoTable
 */
export function exportPDFReport(
  meta: ProjectMetadata,
  horizonState: HorizonState,
  petro: PetroState,
  mc: MonteCarloResults
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryTeal: [number, number, number] = [42, 155, 176];
  const darkNavy: [number, number, number] = [15, 33, 57];

  // Header Banner
  doc.setFillColor(10, 24, 41);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(240, 165, 0);
  doc.text('GEOVOL — Reservoir Volumetrics Assessment', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(138, 175, 192);
  doc.text(
    `Project: ${meta.projectName}  |  Field: ${meta.fieldName}  |  Author: ${meta.author}  |  Date: ${meta.date}`,
    14,
    24
  );

  doc.setDrawColor(42, 155, 176);
  doc.setLineWidth(0.6);
  doc.line(14, 30, 196, 30);

  let currentY = 44;

  // 1. Volumetric Results Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryTeal);
  doc.text(`1. Monte Carlo Volumetric Summary (${mc.runs.toLocaleString()} Iterations)`, 14, currentY);
  currentY += 4;

  const volBody: (string | number)[][] = [];
  if (mc.oiip) {
    volBody.push([
      'Oil Initially in Place (OIIP)',
      `${mc.oiip.p10.toFixed(1)} ${mc.oiip.unit}`,
      `${mc.oiip.p50.toFixed(1)} ${mc.oiip.unit}`,
      `${mc.oiip.p90.toFixed(1)} ${mc.oiip.unit}`,
      `${mc.oiip.mean.toFixed(1)} ${mc.oiip.unit}`,
      `${mc.oiip.std.toFixed(1)} ${mc.oiip.unit}`,
    ]);
  }
  if (mc.giip) {
    volBody.push([
      'Gas Initially in Place (GIIP)',
      `${mc.giip.p10.toFixed(1)} ${mc.giip.unit}`,
      `${mc.giip.p50.toFixed(1)} ${mc.giip.unit}`,
      `${mc.giip.p90.toFixed(1)} ${mc.giip.unit}`,
      `${mc.giip.mean.toFixed(1)} ${mc.giip.unit}`,
      `${mc.giip.std.toFixed(1)} ${mc.giip.unit}`,
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Fluid Target', 'P10 (Low)', 'P50 (Median)', 'P90 (High)', 'Mean', 'Std Dev']],
    body: volBody,
    theme: 'grid',
    headStyles: { fillColor: darkNavy, textColor: primaryTeal, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 40, 50] },
    alternateRowStyles: { fillColor: [245, 248, 250] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 2. Petrophysical Parameters Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryTeal);
  doc.text('2. Petrophysical & Geometry Input Parameters', 14, currentY);
  currentY += 4;

  const petroBody = [
    ['Gross Rock Volume (GRV)', `${horizonState.grvP10.toLocaleString()} ac-ft`, `${horizonState.grvP50.toLocaleString()} ac-ft`, `${horizonState.grvP90.toLocaleString()} ac-ft`, 'acre-ft', '3D Horizon'],
    ['Porosity (φ)', `${(petro.porosity.p10 * 100).toFixed(1)}%`, `${(petro.porosity.p50 * 100).toFixed(1)}%`, `${(petro.porosity.p90 * 100).toFixed(1)}%`, 'fraction', petro.source.toUpperCase()],
    ['Water Saturation (Sw)', `${(petro.sw.p10 * 100).toFixed(1)}%`, `${(petro.sw.p50 * 100).toFixed(1)}%`, `${(petro.sw.p90 * 100).toFixed(1)}%`, 'fraction', petro.source.toUpperCase()],
    ['Net-to-Gross (NTG)', `${(petro.ntg.p10 * 100).toFixed(1)}%`, `${(petro.ntg.p50 * 100).toFixed(1)}%`, `${(petro.ntg.p90 * 100).toFixed(1)}%`, 'fraction', petro.source.toUpperCase()],
    ['Oil FVF (Bo)', petro.bo.p10.toFixed(2), petro.bo.p50.toFixed(2), petro.bo.p90.toFixed(2), 'rb/stb', 'Manual'],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Parameter', 'P10', 'P50', 'P90', 'Unit', 'Source']],
    body: petroBody,
    theme: 'grid',
    headStyles: { fillColor: darkNavy, textColor: primaryTeal, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 40, 50] },
    alternateRowStyles: { fillColor: [245, 248, 250] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 3. Reservoir Geometry
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryTeal);
  doc.text('3. Reservoir Model Geometry', 14, currentY);
  currentY += 4;

  const geoBody: (string | number)[][] = [
    ['Gross Rock Volume (GRV)', `${Math.round(horizonState.grvData.grvAcreFt).toLocaleString()} acre-ft (${(horizonState.grvData.grvM3 / 1e6).toFixed(2)} Mm³)`],
    ['Average Reservoir Thickness', `${horizonState.grvData.avgThicknessM.toFixed(1)} m (Max: ${horizonState.grvData.maxThicknessM.toFixed(1)} m)`],
    ['Active Grid Bins', `${horizonState.grvData.nCells.toLocaleString()} bins (${Math.sqrt(horizonState.grvData.cellAreaM2).toFixed(0)}m bin cell)`],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Attribute', 'Value']],
    body: geoBody,
    theme: 'grid',
    headStyles: { fillColor: darkNavy, textColor: primaryTeal, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 40, 50] },
  });

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(130, 140, 150);
  doc.text(
    'GEOVOL Reservoir Studio. Generated for exploration & screening. Subject to qualified petroleum evaluation.',
    14,
    285
  );

  const safeName = (meta.projectName || 'GeoVol_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeName}_Executive_Report.pdf`);
}

/**
 * Generate CSV for Raw Monte Carlo samples
 */
export function exportMonteCarloCSV(mc: MonteCarloResults, filename: string = 'Monte_Carlo_Raw_Simulation.csv') {
  const headers: string[] = ['Iteration'];
  const cols: number[][] = [];

  if (mc.oiip) {
    headers.push(`OIIP_${mc.oiip.unit}`);
    cols.push(mc.oiip.raw);
  }
  if (mc.giip) {
    headers.push(`GIIP_${mc.giip.unit}`);
    cols.push(mc.giip.raw);
  }

  if (cols.length === 0) return;

  const lines: string[] = [headers.join(',')];
  const n = cols[0].length;
  for (let i = 0; i < n; i++) {
    const row = [i + 1, ...cols.map((col) => col[i].toFixed(4))];
    lines.push(row.join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate CSV for Horizon grid matrix
 */
export function exportHorizonGridCSV(
  gridOrMatrix: HorizonGrid | number[][],
  filename: string = 'Horizon_Grid_Matrix.csv'
) {
  const matrix = Array.isArray(gridOrMatrix) ? gridOrMatrix : gridOrMatrix.grid;
  const nIl = matrix.length;
  const nXl = matrix[0]?.length || 0;
  const lines: string[] = ['Inline,Crossline,SampleIndex,Time_ms'];

  for (let il = 0; il < nIl; il++) {
    for (let xl = 0; xl < nXl; xl++) {
      const s = matrix[il][xl];
      const timeMs = s * 4.0; // standard sample rate
      lines.push(`${il + 100},${xl + 200},${s},${timeMs.toFixed(1)}`);
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
