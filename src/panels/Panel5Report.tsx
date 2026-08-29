import React, { useState } from 'react';
import { SeismicCube, HorizonState, PetroState, MonteCarloResults, ProjectMetadata } from '../types';
import {
  exportExcelReport,
  exportPDFReport,
  exportMonteCarloCSV,
  exportHorizonGridCSV,
} from '../modules/exportEngine';
import {
  FileSpreadsheet,
  FileText,
  Download,
  CheckCircle2,
  Share2,
  Calendar,
  User,
  MapPin,
  Building,
  Sparkles,
  FileCode,
} from 'lucide-react';

interface Panel5ReportProps {
  cube: SeismicCube | null;
  horizonState: HorizonState | null;
  petroState: PetroState;
  mcResults: MonteCarloResults | null;
  metadata: ProjectMetadata;
  onMetadataChanged: (meta: ProjectMetadata) => void;
}

export const Panel5Report: React.FC<Panel5ReportProps> = ({
  cube,
  horizonState,
  petroState,
  mcResults,
  metadata,
  onMetadataChanged,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleExportExcel = () => {
    if (!horizonState || !mcResults) return;
    try {
      exportExcelReport(metadata, horizonState, petroState, mcResults);
      notifySuccess('Excel Workbook (.xlsx) generated and downloaded successfully!');
    } catch (err: any) {
      alert('Failed to export Excel: ' + err.message);
    }
  };

  const handleExportPDF = () => {
    if (!horizonState || !mcResults) return;
    try {
      exportPDFReport(metadata, horizonState, petroState, mcResults);
      notifySuccess('PDF Executive Report (.pdf) generated and downloaded successfully!');
    } catch (err: any) {
      alert('Failed to export PDF: ' + err.message);
    }
  };

  const handleExportMCRawCSV = () => {
    if (!mcResults) return;
    try {
      exportMonteCarloCSV(mcResults);
      notifySuccess('Monte Carlo Raw Simulation Dataset (.csv) downloaded!');
    } catch (err: any) {
      alert('Failed to export CSV: ' + err.message);
    }
  };

  const handleExportTopHorizonCSV = () => {
    if (!horizonState) return;
    try {
      exportHorizonGridCSV(horizonState.topHorizon, 'Top_Reservoir_Horizon_Matrix.csv');
      notifySuccess('Top Horizon Grid Matrix (.csv) downloaded!');
    } catch (err: any) {
      alert('Failed to export Horizon CSV: ' + err.message);
    }
  };

  const handleExportBaseHorizonCSV = () => {
    if (!horizonState) return;
    try {
      exportHorizonGridCSV(horizonState.baseHorizon, 'Base_Reservoir_Horizon_Matrix.csv');
      notifySuccess('Base Horizon Grid Matrix (.csv) downloaded!');
    } catch (err: any) {
      alert('Failed to export Horizon CSV: ' + err.message);
    }
  };

  const notifySuccess = (msg: string) => {
    setDownloadSuccess(msg);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  if (!horizonState || !mcResults) {
    return (
      <div className="p-8 bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <h3 className="text-lg font-bold text-[#e8f4f8]">Incomplete Project Pipeline</h3>
        <p className="text-sm text-[#8aafc0] mt-1 mb-4">
          Please complete Horizon Picking (Panel 2) and Monte Carlo Simulation (Panel 4) before generating executive reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e8f4f8] flex items-center gap-2">
            <span className="text-2xl">📋</span> Panel 5 — Executive Report & Multi-Format Export
          </h2>
          <p className="text-sm text-[#8aafc0] mt-1">
            Review the final volumetric assessment summary and download professional Excel workbooks, PDF audit reports, or raw CSV datasets.
          </p>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-4 bg-[#2ecc71]/20 border border-[#2ecc71] rounded-xl text-sm font-semibold text-[#2ecc71] flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-5 h-5" /> {downloadSuccess}
        </div>
      )}

      {/* Metadata Configuration */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
          <Building className="w-4 h-4" /> Project & Asset Metadata
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#8aafc0] block mb-1">Project Name</label>
            <input
              type="text"
              value={metadata.projectName}
              onChange={(e) => onMetadataChanged({ ...metadata, projectName: e.target.value })}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] focus:outline-none"
            />
          </div>

          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#8aafc0] block mb-1">Field / Prospect</label>
            <input
              type="text"
              value={metadata.fieldName}
              onChange={(e) => onMetadataChanged({ ...metadata, fieldName: e.target.value })}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] focus:outline-none"
            />
          </div>

          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#8aafc0] block mb-1">Author / Geophysicist</label>
            <input
              type="text"
              value={metadata.author}
              onChange={(e) => onMetadataChanged({ ...metadata, author: e.target.value })}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] focus:outline-none"
            />
          </div>

          <div className="bg-[#071322] p-3 rounded-lg border border-[#2a9bb0]/20">
            <label className="text-xs text-[#8aafc0] block mb-1">Formation Target</label>
            <input
              type="text"
              value={metadata.formation}
              onChange={(e) => onMetadataChanged({ ...metadata, formation: e.target.value })}
              className="w-full bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2.5 py-1.5 text-xs text-[#e8f4f8] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Export Suite Buttons */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-semibold text-[#2a9bb0] uppercase tracking-wider flex items-center gap-2">
          <Download className="w-4 h-4" /> 1-Click Export Suite
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Excel Export */}
          <button
            onClick={handleExportExcel}
            className="flex flex-col items-center justify-center p-5 bg-[#0b1b30] hover:bg-[#1a3d54] border border-[#2ecc71]/40 hover:border-[#2ecc71] rounded-xl transition-all group text-center shadow-md"
          >
            <div className="p-3 bg-[#2ecc71]/20 text-[#2ecc71] rounded-xl mb-3 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="font-bold text-sm text-[#e8f4f8]">Excel Workbook (.xlsx)</div>
            <div className="text-[11px] text-[#8aafc0] mt-1">
              Multi-tab spreadsheet with summary & distributions
            </div>
          </button>

          {/* PDF Export */}
          <button
            onClick={handleExportPDF}
            className="flex flex-col items-center justify-center p-5 bg-[#0b1b30] hover:bg-[#1a3d54] border border-[#e74c3c]/40 hover:border-[#e74c3c] rounded-xl transition-all group text-center shadow-md cursor-pointer"
          >
            <div className="p-3 bg-[#e74c3c]/20 text-[#e74c3c] rounded-xl mb-3 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <div className="font-bold text-sm text-[#e8f4f8]">PDF Executive Report</div>
            <div className="text-[11px] text-[#8aafc0] mt-1">
              Audit-ready document with formatted tables
            </div>
          </button>

          {/* Monte Carlo CSV */}
          <button
            onClick={handleExportMCRawCSV}
            className="flex flex-col items-center justify-center p-5 bg-[#0b1b30] hover:bg-[#1a3d54] border border-[#2a9bb0]/40 hover:border-[#2a9bb0] rounded-xl transition-all group text-center shadow-md"
          >
            <div className="p-3 bg-[#2a9bb0]/20 text-[#2a9bb0] rounded-xl mb-3 group-hover:scale-110 transition-transform">
              <Download className="w-6 h-6" />
            </div>
            <div className="font-bold text-sm text-[#e8f4f8]">Simulation Raw CSV</div>
            <div className="text-[11px] text-[#8aafc0] mt-1">
              All {mcResults.runs.toLocaleString()} Monte Carlo iterations dataset
            </div>
          </button>

          {/* Horizon Grids CSV */}
          <div className="flex flex-col justify-between p-4 bg-[#0b1b30] border border-[#f0a500]/40 rounded-xl shadow-md space-y-2">
            <div className="text-center">
              <div className="font-bold text-xs text-[#f0a500]">Horizon Grid Matrices (.csv)</div>
              <div className="text-[10px] text-[#8aafc0]">2D time/depth grid arrays</div>
            </div>
            <div className="space-y-1.5">
              <button
                onClick={handleExportTopHorizonCSV}
                className="w-full py-1 bg-[#162d4c] hover:bg-[#2a9bb0] hover:text-[#0a1628] text-[#2a9bb0] text-xs font-semibold rounded transition-colors"
              >
                Top Horizon Grid
              </button>
              <button
                onClick={handleExportBaseHorizonCSV}
                className="w-full py-1 bg-[#162d4c] hover:bg-[#ffd700] hover:text-[#0a1628] text-[#ffd700] text-xs font-semibold rounded transition-colors"
              >
                Base Horizon Grid
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Report Preview */}
      <div className="bg-[#0f2139] border border-[#2a9bb0]/30 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#2a9bb0]/20">
          <div>
            <span className="text-xs font-bold text-[#2a9bb0] uppercase tracking-widest block">
              GEOVOL EXECUTIVE SUMMARY REPORT
            </span>
            <h3 className="text-lg font-bold text-[#e8f4f8] mt-0.5">
              {metadata.projectName} — {metadata.fieldName} Field
            </h3>
          </div>
          <div className="text-right text-xs text-[#8aafc0]">
            <div>Date: {metadata.date}</div>
            <div>Author: {metadata.author}</div>
          </div>
        </div>

        {/* Key Findings Callout */}
        <div className="bg-[#071322] border border-[#2a9bb0]/30 rounded-xl p-5">
          <h4 className="text-xs font-bold text-[#f0a500] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Volumetric Assessment Highlights
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mcResults.oiip && (
              <div className="bg-[#0b1b30] p-4 rounded-lg border border-[#2a9bb0]/30">
                <div className="text-xs text-[#2a9bb0] font-semibold">
                  Oil Initially In Place (OIIP)
                </div>
                <div className="text-2xl font-bold font-mono text-[#e8f4f8] my-1">
                  {mcResults.oiip.p50.toFixed(1)} <span className="text-sm font-normal text-[#8aafc0]">MMstb (P50)</span>
                </div>
                <div className="text-xs text-[#8aafc0] font-mono">
                  Range (P10–P90): <b className="text-[#e74c3c]">{mcResults.oiip.p10.toFixed(1)}</b> – <b className="text-[#f0a500]">{mcResults.oiip.p90.toFixed(1)}</b> MMstb
                </div>
              </div>
            )}

            {mcResults.giip && (
              <div className="bg-[#0b1b30] p-4 rounded-lg border border-[#f0a500]/30">
                <div className="text-xs text-[#f0a500] font-semibold">
                  Gas Initially In Place (GIIP)
                </div>
                <div className="text-2xl font-bold font-mono text-[#e8f4f8] my-1">
                  {mcResults.giip.p50.toFixed(1)} <span className="text-sm font-normal text-[#8aafc0]">Bscf (P50)</span>
                </div>
                <div className="text-xs text-[#8aafc0] font-mono">
                  Range (P10–P90): <b className="text-[#e74c3c]">{mcResults.giip.p10.toFixed(1)}</b> – <b className="text-[#f0a500]">{mcResults.giip.p90.toFixed(1)}</b> Bscf
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Parameters Summary Table */}
        <div>
          <h4 className="text-xs font-semibold text-[#8aafc0] uppercase tracking-wider mb-2">
            Asset Input Parameters & Uncertainty Bounds
          </h4>
          <div className="overflow-x-auto rounded-lg border border-[#2a9bb0]/20">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#071322] text-[#8aafc0]">
                <tr>
                  <th className="p-2.5">Parameter</th>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5">P10 (Low)</th>
                  <th className="p-2.5">P50 (Median)</th>
                  <th className="p-2.5">P90 (High)</th>
                  <th className="p-2.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a9bb0]/15 bg-[#0b1b30]">
                <tr>
                  <td className="p-2.5 font-bold text-[#e8f4f8]">Gross Rock Volume (GRV)</td>
                  <td className="p-2.5 text-[#2a9bb0]">acre-ft</td>
                  <td className="p-2.5 text-[#e74c3c]">{horizonState.grvP10.toLocaleString()}</td>
                  <td className="p-2.5 text-[#2ecc71] font-bold">{horizonState.grvP50.toLocaleString()}</td>
                  <td className="p-2.5 text-[#f0a500]">{horizonState.grvP90.toLocaleString()}</td>
                  <td className="p-2.5 text-[#8aafc0]">3D Seismic Tracker</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-[#e8f4f8]">Porosity ($\phi$)</td>
                  <td className="p-2.5 text-[#2a9bb0]">V/V fraction</td>
                  <td className="p-2.5 text-[#e74c3c]">{(petroState.porosity.p10 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#2ecc71] font-bold">{(petroState.porosity.p50 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#f0a500]">{(petroState.porosity.p90 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#8aafc0]">{petroState.source.toUpperCase()}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-[#e8f4f8]">Water Saturation ($S_w$)</td>
                  <td className="p-2.5 text-[#2a9bb0]">fraction</td>
                  <td className="p-2.5 text-[#e74c3c]">{(petroState.sw.p10 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#2ecc71] font-bold">{(petroState.sw.p50 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#f0a500]">{(petroState.sw.p90 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#8aafc0]">{petroState.source.toUpperCase()}</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-[#e8f4f8]">Net-to-Gross ($NTG$)</td>
                  <td className="p-2.5 text-[#2a9bb0]">fraction</td>
                  <td className="p-2.5 text-[#e74c3c]">{(petroState.ntg.p10 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#2ecc71] font-bold">{(petroState.ntg.p50 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#f0a500]">{(petroState.ntg.p90 * 100).toFixed(1)}%</td>
                  <td className="p-2.5 text-[#8aafc0]">{petroState.source.toUpperCase()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Multi-Well Log Correlation Summary */}
        {petroState.wells && petroState.wells.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-[#8aafc0] uppercase tracking-wider mb-2 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#00f0ff]" /> Correlated Multi-Well Log Inventory ({petroState.wells.length} Wells)
            </h4>
            <div className="overflow-x-auto rounded-lg border border-[#2a9bb0]/20">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#071322] text-[#8aafc0]">
                  <tr>
                    <th className="p-2.5">Well Name</th>
                    <th className="p-2.5">Coordinates (X, Y)</th>
                    <th className="p-2.5">Seismic Grid</th>
                    <th className="p-2.5">Interval (m)</th>
                    <th className="p-2.5">Net Pay (m)</th>
                    <th className="p-2.5">Porosity (Φ)</th>
                    <th className="p-2.5">Water Sat (Sw)</th>
                    <th className="p-2.5">NTG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a9bb0]/15 bg-[#0b1b30]">
                  {petroState.wells.map((well) => (
                    <tr key={well.id} className={well.isActive ? '' : 'opacity-40'}>
                      <td className="p-2.5 font-bold text-[#e8f4f8] flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: well.color || '#00f0ff' }}
                        />
                        {well.wellName}
                      </td>
                      <td className="p-2.5 text-[#8aafc0]">
                        {well.location.x != null && well.location.y != null
                          ? `${Math.round(well.location.x)}, ${Math.round(well.location.y)}`
                          : '—'}
                      </td>
                      <td className="p-2.5 text-[#00f0ff]">
                        {well.location.inline != null
                          ? `IL:${well.location.inline} XL:${well.location.crossline}`
                          : well.location.lineName || '—'}
                      </td>
                      <td className="p-2.5">{well.topDepth} – {well.baseDepth}m</td>
                      <td className="p-2.5 text-[#2ecc71] font-bold">{well.extractedPetro.netPayM}m</td>
                      <td className="p-2.5 text-[#00f0ff]">{(well.extractedPetro.meanPhi * 100).toFixed(1)}%</td>
                      <td className="p-2.5 text-[#f0a500]">{(well.extractedPetro.meanSw * 100).toFixed(0)}%</td>
                      <td className="p-2.5 font-bold">{(well.extractedPetro.ntg * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
