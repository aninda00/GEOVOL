import React, { useState, useRef } from 'react';
import { WellData, WellLocation, WellTrajectory } from '../types';
import { MapPin, X, Save, Upload, Table, Plus, Info, Check, Compass, FileText, Trash2, ArrowUpRight, Navigation, RefreshCw } from 'lucide-react';
import { parseWellLocationTable, RAW_SALDA_WELL_HEADS_TEXT, RAW_SLD2_DEVIATION_TEXT, RAW_SLD3_DEVIATION_TEXT } from '../modules/petroEngine';
import { parseWellHeadsFile, parseDeviationSurveyFile, compute3DTrajectory } from '../modules/deviationEngine';

interface WellLocationModalProps {
  wells: WellData[];
  onSaveWellLocations: (updatedWells: WellData[]) => void;
  onClose: () => void;
}

export const WellLocationModal: React.FC<WellLocationModalProps> = ({
  wells,
  onSaveWellLocations,
  onClose,
}) => {
  const [editedWells, setEditedWells] = useState<WellData[]>(JSON.parse(JSON.stringify(wells)));
  const [activeTab, setActiveTab] = useState<'editor' | 'file-upload' | 'table-import' | 'deviation-manager'>('editor');
  const [selectedWellIdForDeviation, setSelectedWellIdForDeviation] = useState<string>(wells[0]?.id || '');
  const [csvText, setCsvText] = useState<string>(RAW_SALDA_WELL_HEADS_TEXT);
  const [rawSurveyInput, setRawSurveyInput] = useState<string>(RAW_SLD2_DEVIATION_TEXT);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFieldChange = (wellId: string, field: string, value: any) => {
    setEditedWells((prev) =>
      prev.map((w) => {
        if (w.id !== wellId) return w;
        if (field.startsWith('loc.')) {
          const locProp = field.replace('loc.', '');
          return {
            ...w,
            location: {
              ...w.location,
              [locProp]: value,
            },
          };
        }
        return { ...w, [field]: value };
      })
    );
  };

  const handleAddNewWell = () => {
    const newIdx = editedWells.length + 1;
    const newWell: WellData = {
      id: `well-custom-${Date.now()}`,
      wellName: `WELL-${newIdx}`,
      uwi: `UWI-00${newIdx}`,
      field: 'Active Basin',
      location: {
        x: 619800 + newIdx * 20,
        y: 2618400 + newIdx * 20,
        inline: 10 + newIdx * 2,
        crossline: 10 + newIdx * 2,
        elevationKb: 26.94,
        totalDepth: 3000,
      },
      topDepth: 2400,
      baseDepth: 2550,
      lasSummary: {
        wellName: `WELL-${newIdx}`,
        curves: {},
        curveNames: ['DEPT', 'GR', 'PHIF', 'SW'],
        nSamples: 100,
        depthMin: 2200,
        depthMax: 2800,
        depthCurve: 'DEPT',
        data: {},
      },
      extractedPetro: {
        meanPhi: 0.22,
        meanSw: 0.25,
        ntg: 0.8,
        netPayM: 40,
        grossIntervalM: 55,
        phiP10: 0.18,
        phiP50: 0.22,
        phiP90: 0.26,
        swP10: 0.20,
        swP50: 0.25,
        swP90: 0.32,
        ntgP10: 0.70,
        ntgP50: 0.80,
        ntgP90: 0.88,
      },
      isActive: true,
      color: ['#00f0ff', '#2ecc71', '#f0a500', '#e74c3c', '#9b59b6', '#3498db'][newIdx % 6],
    };
    setEditedWells((prev) => [...prev, newWell]);
    setSelectedWellIdForDeviation(newWell.id);
    setImportStatus({ type: 'success', message: `Added new well: ${newWell.wellName}` });
  };

  const handleDeleteWell = (wellId: string) => {
    setEditedWells((prev) => prev.filter((w) => w.id !== wellId));
    setImportStatus({ type: 'info', message: 'Well removed from active workspace.' });
  };

  // Process uploaded files (Wellheads text / CSV / deviation surveys)
  const processUploadedFiles = async (files: FileList | File[]) => {
    let updatedWells = [...editedWells];
    let headsUpdated = 0;
    let surveysAttached = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const fileName = file.name.toLowerCase();

        // 1. Check if it's a wellheads file or coordinate table
        const wellHeads = parseWellHeadsFile(text);
        if (wellHeads.length > 0) {
          // Update matching wells or add new ones
          wellHeads.forEach((head) => {
            const cleanHeadName = head.wellName.toLowerCase().replace(/[-_\s]/g, '');
            const matchIdx = updatedWells.findIndex(
              (w) =>
                w.wellName.toLowerCase().replace(/[-_\s]/g, '') === cleanHeadName ||
                w.id.toLowerCase().includes(cleanHeadName) ||
                cleanHeadName.includes(w.wellName.toLowerCase().replace(/[-_\s]/g, ''))
            );

            if (matchIdx !== -1) {
              updatedWells[matchIdx] = {
                ...updatedWells[matchIdx],
                location: {
                  ...updatedWells[matchIdx].location,
                  x: head.eastingX,
                  y: head.northingY,
                  elevationKb: head.elevationKb,
                  totalDepth: head.totalDepth,
                  inline: head.inline ?? updatedWells[matchIdx].location.inline,
                  crossline: head.crossline ?? updatedWells[matchIdx].location.crossline,
                  lineName: head.lineName ?? updatedWells[matchIdx].location.lineName,
                  cdpOrSp: head.cdpOrSp ?? updatedWells[matchIdx].location.cdpOrSp,
                },
              };
              headsUpdated++;
            } else {
              // Add as a new well entry
              const newWell: WellData = {
                id: `well-${head.wellName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                wellName: head.wellName,
                uwi: `UWI-${head.wellName}`,
                field: 'Uploaded Field',
                location: {
                  x: head.eastingX,
                  y: head.northingY,
                  elevationKb: head.elevationKb,
                  totalDepth: head.totalDepth,
                  inline: head.inline,
                  crossline: head.crossline,
                  lineName: head.lineName,
                  cdpOrSp: head.cdpOrSp,
                },
                topDepth: 2400,
                baseDepth: 2550,
                lasSummary: {
                  wellName: head.wellName,
                  curves: {},
                  curveNames: ['DEPT', 'GR', 'PHIF', 'SW'],
                  nSamples: 100,
                  depthMin: 2200,
                  depthMax: head.totalDepth || 3000,
                  depthCurve: 'DEPT',
                  data: {},
                },
                extractedPetro: {
                  meanPhi: 0.23,
                  meanSw: 0.22,
                  ntg: 0.82,
                  netPayM: 42,
                  grossIntervalM: 55,
                  phiP10: 0.19,
                  phiP50: 0.23,
                  phiP90: 0.27,
                  swP10: 0.18,
                  swP50: 0.22,
                  swP90: 0.30,
                  ntgP10: 0.72,
                  ntgP50: 0.82,
                  ntgP90: 0.89,
                },
                isActive: true,
                color: ['#00f0ff', '#2ecc71', '#f0a500', '#e74c3c', '#9b59b6'][updatedWells.length % 5],
              };
              updatedWells.push(newWell);
              headsUpdated++;
            }
          });
          continue;
        }

        // 2. Check if it's a deviation survey file
        const parsedDev = parseDeviationSurveyFile(text);
        if (parsedDev && parsedDev.stations.length > 0) {
          // Match to well by filename or well number (e.g. sld2 -> SALDANADI-2, sld3 -> SALDANADI-3)
          let targetWellIdx = -1;

          // Check direct name tokens (e.g. 'sld2', 'sld3', 'sld-2', 'sld-3', 'well2', 'well3', '1', '2', '3')
          for (let wIdx = 0; wIdx < updatedWells.length; wIdx++) {
            const wName = updatedWells[wIdx].wellName.toLowerCase().replace(/[-_\s]/g, '');
            const wNumMatch = updatedWells[wIdx].wellName.match(/\d+/);
            const wNum = wNumMatch ? wNumMatch[0] : '';

            if (
              fileName.includes(wName) ||
              (wNum && (fileName.includes(`sld${wNum}`) || fileName.includes(`sld_${wNum}`) || fileName.includes(`well${wNum}`) || fileName.includes(`well_${wNum}`)))
            ) {
              targetWellIdx = wIdx;
              break;
            }
          }

          if (targetWellIdx === -1 && updatedWells.length > 0) {
            // Default to selected well
            targetWellIdx = updatedWells.findIndex((w) => w.id === selectedWellIdForDeviation);
            if (targetWellIdx === -1) targetWellIdx = 0;
          }

          if (targetWellIdx !== -1) {
            const targetWell = updatedWells[targetWellIdx];
            const trajectory = compute3DTrajectory(
              parsedDev.stations,
              targetWell.location.x ?? 0,
              targetWell.location.y ?? 0,
              targetWell.location.elevationKb ?? 0
            );
            trajectory.rawSurveyText = text;
            trajectory.surveyType = parsedDev.surveyType;

            updatedWells[targetWellIdx] = {
              ...targetWell,
              trajectory,
            };
            surveysAttached++;
          }
          continue;
        }

        // 3. Fallback: Try general CSV/TSV table parser
        const csvRows = parseWellLocationTable(text);
        if (csvRows.length > 0) {
          csvRows.forEach((r) => {
            if (!r.wellName) return;
            const matchIdx = updatedWells.findIndex((w) =>
              w.wellName.toLowerCase().includes(r.wellName!.toLowerCase()) ||
              r.wellName!.toLowerCase().includes(w.wellName.toLowerCase())
            );
            if (matchIdx !== -1) {
              updatedWells[matchIdx] = {
                ...updatedWells[matchIdx],
                topDepth: r.topDepth ?? updatedWells[matchIdx].topDepth,
                baseDepth: r.baseDepth ?? updatedWells[matchIdx].baseDepth,
                location: {
                  ...updatedWells[matchIdx].location,
                  x: r.x ?? updatedWells[matchIdx].location.x,
                  y: r.y ?? updatedWells[matchIdx].location.y,
                  inline: r.inline ?? updatedWells[matchIdx].location.inline,
                  crossline: r.crossline ?? updatedWells[matchIdx].location.crossline,
                  lineName: r.lineName ?? updatedWells[matchIdx].location.lineName,
                  cdpOrSp: r.cdpOrSp ?? updatedWells[matchIdx].location.cdpOrSp,
                  elevationKb: r.elevationKb ?? updatedWells[matchIdx].location.elevationKb,
                  totalDepth: r.totalDepth ?? updatedWells[matchIdx].location.totalDepth,
                },
              };
              headsUpdated++;
            }
          });
        } else {
          errors.push(`Could not detect recognizable headers or survey columns in ${file.name}`);
        }
      } catch (err: any) {
        errors.push(`Error reading ${file.name}: ${err.message}`);
      }
    }

    setEditedWells(updatedWells);

    if (headsUpdated > 0 || surveysAttached > 0) {
      setImportStatus({
        type: 'success',
        message: `Successfully processed: ${headsUpdated} well coordinate(s) updated, ${surveysAttached} 3D deviation survey(s) attached!`,
      });
    } else if (errors.length > 0) {
      setImportStatus({ type: 'error', message: errors.join('; ') });
    }
  };

  const handleApplySurveyText = () => {
    try {
      const parsedDev = parseDeviationSurveyFile(rawSurveyInput);
      if (!parsedDev || parsedDev.stations.length === 0) {
        setImportStatus({ type: 'error', message: 'Failed to parse stations from survey text. Check MD/Inc/Az columns.' });
        return;
      }

      const targetWellIdx = editedWells.findIndex((w) => w.id === selectedWellIdForDeviation);
      if (targetWellIdx === -1) {
        setImportStatus({ type: 'error', message: 'Please select a valid well.' });
        return;
      }

      const targetWell = editedWells[targetWellIdx];
      const trajectory = compute3DTrajectory(
        parsedDev.stations,
        targetWell.location.x ?? 0,
        targetWell.location.y ?? 0,
        targetWell.location.elevationKb ?? 0
      );
      trajectory.rawSurveyText = rawSurveyInput;
      trajectory.surveyType = parsedDev.surveyType;

      const updated = [...editedWells];
      updated[targetWellIdx] = {
        ...targetWell,
        trajectory,
      };

      setEditedWells(updated);
      setImportStatus({
        type: 'success',
        message: `Attached 3D trajectory to ${targetWell.wellName}: ${trajectory.stations.length} stations, Max Inc: ${trajectory.maxInclination.toFixed(1)}°, Bottom Hole HD: ${trajectory.bottomHoleLocation.hd.toFixed(1)}m`,
      });
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Survey processing error: ${err.message}` });
    }
  };

  const handleApplyCsv = () => {
    try {
      const parsedRows = parseWellLocationTable(csvText);
      if (parsedRows.length === 0) {
        setImportStatus({ type: 'error', message: 'No valid data rows found in text. Check formatting.' });
        return;
      }

      const updated = editedWells.map((w) => {
        const match = parsedRows.find(
          (r) =>
            r.wellName &&
            (w.wellName.toLowerCase().replace(/[-_\s]/g, '').includes(r.wellName.toLowerCase().replace(/[-_\s]/g, '')) ||
             r.wellName.toLowerCase().replace(/[-_\s]/g, '').includes(w.wellName.toLowerCase().replace(/[-_\s]/g, '')))
        );

        if (!match) return w;

        return {
          ...w,
          topDepth: match.topDepth ?? w.topDepth,
          baseDepth: match.baseDepth ?? w.baseDepth,
          location: {
            ...w.location,
            x: match.x ?? w.location.x,
            y: match.y ?? w.location.y,
            inline: match.inline ?? w.location.inline,
            crossline: match.crossline ?? w.location.crossline,
            lineName: match.lineName ?? w.location.lineName,
            cdpOrSp: match.cdpOrSp ?? w.location.cdpOrSp,
            elevationKb: match.elevationKb ?? w.location.elevationKb,
            totalDepth: match.totalDepth ?? w.location.totalDepth,
          },
        };
      });

      setEditedWells(updated);
      setImportStatus({
        type: 'success',
        message: `Successfully matched & updated coordinates for ${parsedRows.length} well(s)!`,
      });
      setActiveTab('editor');
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Error parsing table: ${err.message}` });
    }
  };

  const handleSaveAndClose = () => {
    onSaveWellLocations(editedWells);
    onClose();
  };

  const selectedWell = editedWells.find((w) => w.id === selectedWellIdForDeviation) || editedWells[0];

  return (
    <div id="well-location-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#0f2139] border border-[#2a9bb0]/50 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0b1b30] border-b border-[#2a9bb0]/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2a9bb0]/20 border border-[#2a9bb0] flex items-center justify-center text-[#00f0ff]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#e8f4f8] flex items-center gap-2">
                Well Coordinates & Directional Trajectory Manager
              </h3>
              <p className="text-xs text-[#8aafc0]">
                Manage surface coordinates, Kelly Bushing datum, 2D/3D seismic ties, and directional deviation surveys.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/30 text-xs overflow-x-auto">
              <button
                id="tab-btn-editor"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'editor' ? 'bg-[#00f0ff] text-[#0a1628]' : 'text-[#8aafc0] hover:text-white'
                }`}
              >
                Wellhead Table
              </button>
              <button
                id="tab-btn-file-upload"
                onClick={() => setActiveTab('file-upload')}
                className={`px-3 py-1.5 rounded font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'file-upload' ? 'bg-[#2ecc71] text-[#0a1628]' : 'text-[#8aafc0] hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> File Upload
              </button>
              <button
                id="tab-btn-deviation"
                onClick={() => setActiveTab('deviation-manager')}
                className={`px-3 py-1.5 rounded font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'deviation-manager' ? 'bg-[#f0a500] text-[#0a1628]' : 'text-[#8aafc0] hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" /> Directional Surveys
              </button>
              <button
                id="tab-btn-table-import"
                onClick={() => setActiveTab('table-import')}
                className={`px-3 py-1.5 rounded font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'table-import' ? 'bg-[#2a9bb0] text-[#0a1628]' : 'text-[#8aafc0] hover:text-white'
                }`}
              >
                Paste Table
              </button>
            </div>
            <button
              id="close-well-location-modal"
              onClick={onClose}
              className="p-2 text-[#8aafc0] hover:text-white hover:bg-[#1a3d54] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {importStatus && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
                importStatus.type === 'success'
                  ? 'bg-[#133429] border border-[#2ecc71]/40 text-[#2ecc71]'
                  : importStatus.type === 'error'
                  ? 'bg-[#3d1a1a] border border-[#e74c3c]/40 text-[#e74c3c]'
                  : 'bg-[#162d4c] border border-[#2a9bb0]/40 text-[#8aafc0]'
              }`}
            >
              <div className="flex items-center gap-2">
                {importStatus.type === 'success' ? <Check className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                <span>{importStatus.message}</span>
              </div>
              <button onClick={() => setImportStatus(null)} className="text-current opacity-70 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: WELLHEAD TABLE */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#8aafc0]">
                  Edit surface locations, KB elevation, total depth, and reservoir top/base intervals:
                </p>
                <button
                  id="btn-add-new-well"
                  onClick={handleAddNewWell}
                  className="px-3 py-1.5 bg-[#162d4c] hover:bg-[#2a9bb0]/30 text-[#00f0ff] border border-[#2a9bb0]/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Well
                </button>
              </div>

              <div className="overflow-x-auto border border-[#2a9bb0]/20 rounded-xl bg-[#071322]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0b1b30] text-[#8aafc0] border-b border-[#2a9bb0]/30">
                    <tr>
                      <th className="p-2.5">Well Name</th>
                      <th className="p-2.5">Easting (X)</th>
                      <th className="p-2.5">Northing (Y)</th>
                      <th className="p-2.5">KB (m)</th>
                      <th className="p-2.5">TD (m)</th>
                      <th className="p-2.5">3D Inline / XL</th>
                      <th className="p-2.5">2D Line / CDP</th>
                      <th className="p-2.5">Top / Base (m)</th>
                      <th className="p-2.5">Trajectory</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a9bb0]/10 bg-[#071322]">
                    {editedWells.map((well) => {
                      const isDeviated = well.trajectory && well.trajectory.maxInclination > 3;
                      return (
                        <tr key={well.id} className="hover:bg-[#14324f]/40 transition-colors">
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: well.color || '#00f0ff' }}
                              />
                              <input
                                type="text"
                                value={well.wellName}
                                onChange={(e) => handleFieldChange(well.id, 'wellName', e.target.value)}
                                className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#e8f4f8] font-bold w-28 focus:border-[#00f0ff] outline-none"
                              />
                            </div>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="0.001"
                              value={well.location.x ?? ''}
                              placeholder="Easting"
                              onChange={(e) => handleFieldChange(well.id, 'loc.x', parseFloat(e.target.value) || undefined)}
                              className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#00f0ff] w-24 focus:border-[#00f0ff] outline-none font-mono"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="0.001"
                              value={well.location.y ?? ''}
                              placeholder="Northing"
                              onChange={(e) => handleFieldChange(well.id, 'loc.y', parseFloat(e.target.value) || undefined)}
                              className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-2 py-1 text-xs text-[#00f0ff] w-24 focus:border-[#00f0ff] outline-none font-mono"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="0.01"
                              value={well.location.elevationKb ?? ''}
                              placeholder="KB"
                              onChange={(e) => handleFieldChange(well.id, 'loc.elevationKb', parseFloat(e.target.value) || undefined)}
                              className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-1.5 py-1 text-xs text-[#8aafc0] w-16 focus:border-[#00f0ff] outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              value={well.location.totalDepth ?? ''}
                              placeholder="TD"
                              onChange={(e) => handleFieldChange(well.id, 'loc.totalDepth', parseFloat(e.target.value) || undefined)}
                              className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-1.5 py-1 text-xs text-[#8aafc0] w-16 focus:border-[#00f0ff] outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={well.location.inline ?? ''}
                                placeholder="IL"
                                onChange={(e) => handleFieldChange(well.id, 'loc.inline', parseInt(e.target.value, 10) || undefined)}
                                className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-1.5 py-1 text-xs text-[#2ecc71] w-12 focus:border-[#00f0ff] outline-none"
                              />
                              <input
                                type="number"
                                value={well.location.crossline ?? ''}
                                placeholder="XL"
                                onChange={(e) => handleFieldChange(well.id, 'loc.crossline', parseInt(e.target.value, 10) || undefined)}
                                className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-1.5 py-1 text-xs text-[#2ecc71] w-12 focus:border-[#00f0ff] outline-none"
                              />
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={well.location.lineName ?? ''}
                                placeholder="2D Line"
                                onChange={(e) => handleFieldChange(well.id, 'loc.lineName', e.target.value || undefined)}
                                className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-1 py-1 text-xs text-[#f0a500] w-16 focus:border-[#00f0ff] outline-none"
                              />
                              <input
                                type="number"
                                value={well.location.cdpOrSp ?? ''}
                                placeholder="CDP"
                                onChange={(e) => handleFieldChange(well.id, 'loc.cdpOrSp', parseInt(e.target.value, 10) || undefined)}
                                className="bg-[#0b1b30] border border-[#2a9bb0]/30 rounded px-1 py-1 text-xs text-[#f0a500] w-12 focus:border-[#00f0ff] outline-none"
                              />
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={well.topDepth}
                                onChange={(e) => handleFieldChange(well.id, 'topDepth', parseFloat(e.target.value) || 0)}
                                className="bg-[#0b1b30] border border-[#2ecc71]/40 rounded px-1.5 py-1 text-xs text-[#2ecc71] font-bold w-16 focus:border-[#2ecc71] outline-none"
                              />
                              <input
                                type="number"
                                value={well.baseDepth}
                                onChange={(e) => handleFieldChange(well.id, 'baseDepth', parseFloat(e.target.value) || 0)}
                                className="bg-[#0b1b30] border border-[#e74c3c]/40 rounded px-1.5 py-1 text-xs text-[#e74c3c] font-bold w-16 focus:border-[#e74c3c] outline-none"
                              />
                            </div>
                          </td>
                          <td className="p-2.5">
                            {isDeviated ? (
                              <button
                                onClick={() => {
                                  setSelectedWellIdForDeviation(well.id);
                                  setActiveTab('deviation-manager');
                                }}
                                className="px-2 py-0.5 rounded bg-[#f0a500]/20 border border-[#f0a500]/40 text-[#f0a500] text-[11px] font-bold flex items-center gap-1 hover:bg-[#f0a500]/30 cursor-pointer"
                              >
                                <Compass className="w-3 h-3" /> Inc {well.trajectory?.maxInclination.toFixed(1)}°
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedWellIdForDeviation(well.id);
                                  setActiveTab('deviation-manager');
                                }}
                                className="px-2 py-0.5 rounded bg-[#162d4c] border border-[#2a9bb0]/30 text-[#8aafc0] text-[11px] hover:text-white cursor-pointer"
                              >
                                Vertical
                              </button>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => handleDeleteWell(well.id)}
                              className="p-1 text-[#8aafc0] hover:text-[#e74c3c] transition-colors cursor-pointer"
                              title="Delete Well"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: FILE UPLOAD (WELLHEADS & DEVIATION SURVEYS) */}
          {activeTab === 'file-upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    processUploadedFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#00f0ff] bg-[#00f0ff]/10'
                    : 'border-[#2a9bb0]/40 hover:border-[#00f0ff] bg-[#071322]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.csv,.tsv,.dat,.las,.dev,.survey"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processUploadedFiles(e.target.files);
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-[#00f0ff]/15 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff] mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-[#e8f4f8]">
                  Drop Wellhead Coordinates & Deviation Survey Files Here
                </h4>
                <p className="text-xs text-[#8aafc0] max-w-md mt-1">
                  Supports <span className="text-[#00f0ff]">Salda wells heads.txt</span>, <span className="text-[#2ecc71]">Sld2_devi_actual.txt</span>, <span className="text-[#f0a500]">Sld3_dev actual.txt</span>, CSV, TSV, and direction deviation files.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-[#00f0ff] text-[#0a1628] rounded-lg text-xs font-bold shadow hover:bg-[#00d0df]">
                    Select Files
                  </span>
                  <span className="text-xs text-[#8aafc0]">or drag files from your computer</span>
                </div>
              </div>

              {/* Supported Format Guide */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#071322] border border-[#2a9bb0]/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#00f0ff]">
                    <FileText className="w-4 h-4" /> 1. Wellhead Coordinates Format
                  </div>
                  <pre className="bg-[#0b1b30] p-2.5 rounded-lg text-[11px] font-mono text-[#8aafc0] overflow-x-auto">
{`Well Name    Northing Y    Easting.X    KB      TD
SALDANADI-1  2618432.921   619806.234   26.94   3000
SALDANADI-2  2618432.921   619810.234   26.94   3000
SALDANADI-3  2618427.921   619806.234   26.94   3000`}
                  </pre>
                  <p className="text-[11px] text-[#8aafc0]">
                    Columns are automatically detected (space, tab, or comma separated).
                  </p>
                </div>

                <div className="p-4 bg-[#071322] border border-[#2a9bb0]/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2ecc71]">
                    <Compass className="w-4 h-4" /> 2. Directional Survey Formats
                  </div>
                  <pre className="bg-[#0b1b30] p-2.5 rounded-lg text-[11px] font-mono text-[#8aafc0] overflow-x-auto">
{`# Format A: MD, Inclination, HD, TVD, Azimuth
MD     Incl    HD     TVD     Azim
200    1.75    0      200     0
408    3.00    0.30   407.96  75
...
# Format B: MD, Azimuth, Inclination
MD     Azimuth Inclination
150    0       0
181    78.6    4.3`}
                  </pre>
                  <p className="text-[11px] text-[#8aafc0]">
                    Calculates 3D well path using the Minimum Curvature Method (TVD, Subsea TVDSS, Dogleg Severity).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIRECTIONAL DEVIATION SURVEYS INSPECTOR */}
          {activeTab === 'deviation-manager' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#071322] p-3 rounded-xl border border-[#2a9bb0]/30">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#8aafc0]">Select Well:</span>
                  <select
                    id="select-well-deviation"
                    value={selectedWellIdForDeviation}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedWellIdForDeviation(newId);
                      const matched = editedWells.find((w) => w.id === newId);
                      if (matched?.trajectory?.rawSurveyText) {
                        setRawSurveyInput(matched.trajectory.rawSurveyText);
                      } else if (matched?.wellName.includes('2')) {
                        setRawSurveyInput(RAW_SLD2_DEVIATION_TEXT);
                      } else if (matched?.wellName.includes('3')) {
                        setRawSurveyInput(RAW_SLD3_DEVIATION_TEXT);
                      }
                    }}
                    className="bg-[#0b1b30] border border-[#2a9bb0]/40 rounded-lg px-3 py-1.5 text-xs text-[#00f0ff] font-bold focus:border-[#00f0ff] outline-none"
                  >
                    {editedWells.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.wellName} {w.trajectory ? `(Deviated - ${w.trajectory.stations.length} stations)` : '(Vertical)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRawSurveyInput(RAW_SLD2_DEVIATION_TEXT)}
                    className="px-2.5 py-1 bg-[#162d4c] hover:bg-[#2a9bb0]/30 text-xs text-[#8aafc0] hover:text-white rounded border border-[#2a9bb0]/30 transition-colors"
                  >
                    Load Saldanadi-2 Survey
                  </button>
                  <button
                    onClick={() => setRawSurveyInput(RAW_SLD3_DEVIATION_TEXT)}
                    className="px-2.5 py-1 bg-[#162d4c] hover:bg-[#2a9bb0]/30 text-xs text-[#8aafc0] hover:text-white rounded border border-[#2a9bb0]/30 transition-colors"
                  >
                    Load Saldanadi-3 Survey
                  </button>
                </div>
              </div>

              {selectedWell?.trajectory && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#071322] border border-[#2a9bb0]/20 rounded-xl">
                    <span className="text-[11px] text-[#8aafc0] block">Max Inclination</span>
                    <span className="text-base font-bold text-[#00f0ff]">
                      {selectedWell.trajectory.maxInclination.toFixed(1)}°
                    </span>
                  </div>
                  <div className="p-3 bg-[#071322] border border-[#2a9bb0]/20 rounded-xl">
                    <span className="text-[11px] text-[#8aafc0] block">Bottom-Hole HD</span>
                    <span className="text-base font-bold text-[#2ecc71]">
                      {selectedWell.trajectory.bottomHoleLocation.hd.toFixed(1)} m
                    </span>
                  </div>
                  <div className="p-3 bg-[#071322] border border-[#2a9bb0]/20 rounded-xl">
                    <span className="text-[11px] text-[#8aafc0] block">Bottom-Hole TVD</span>
                    <span className="text-base font-bold text-[#f0a500]">
                      {selectedWell.trajectory.bottomHoleLocation.tvd.toFixed(1)} m
                    </span>
                  </div>
                  <div className="p-3 bg-[#071322] border border-[#2a9bb0]/20 rounded-xl">
                    <span className="text-[11px] text-[#8aafc0] block">Total Stations</span>
                    <span className="text-base font-bold text-[#e8f4f8]">
                      {selectedWell.trajectory.stations.length} pts
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#8aafc0]">
                      Raw Deviation Survey Text (MD, Inclination, Azimuth):
                    </label>
                    <button
                      onClick={handleApplySurveyText}
                      className="px-3 py-1 bg-[#2ecc71] hover:bg-[#27ae60] text-[#0a1628] rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Compute & Attach
                    </button>
                  </div>
                  <textarea
                    id="textarea-deviation-survey"
                    rows={11}
                    value={rawSurveyInput}
                    onChange={(e) => setRawSurveyInput(e.target.value)}
                    className="w-full bg-[#071322] border border-[#2a9bb0]/30 rounded-xl p-3 font-mono text-xs text-[#00f0ff] focus:border-[#00f0ff] outline-none"
                    placeholder="MD Inclination Azimuth..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#8aafc0]">
                    Calculated 3D Trajectory Stations:
                  </label>
                  <div className="h-[250px] overflow-y-auto border border-[#2a9bb0]/20 rounded-xl bg-[#071322]">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-[#0b1b30] text-[#8aafc0] sticky top-0 border-b border-[#2a9bb0]/30">
                        <tr>
                          <th className="p-2">MD (m)</th>
                          <th className="p-2">Inc (°)</th>
                          <th className="p-2">Az (°)</th>
                          <th className="p-2">TVD (m)</th>
                          <th className="p-2">HD (m)</th>
                          <th className="p-2">Dogleg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a9bb0]/10">
                        {(selectedWell?.trajectory?.stations || []).map((st, sIdx) => (
                          <tr key={sIdx} className="hover:bg-[#14324f]/40">
                            <td className="p-2 text-[#e8f4f8]">{st.md.toFixed(1)}</td>
                            <td className="p-2 text-[#00f0ff]">{st.inclination.toFixed(2)}</td>
                            <td className="p-2 text-[#f0a500]">{st.azimuth.toFixed(1)}</td>
                            <td className="p-2 text-[#2ecc71]">{st.tvd?.toFixed(1) ?? '-'}</td>
                            <td className="p-2 text-[#8aafc0]">{st.hd?.toFixed(1) ?? '-'}</td>
                            <td className="p-2 text-[#8aafc0]">{st.dogleg != null ? st.dogleg.toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                        {(!selectedWell?.trajectory || selectedWell.trajectory.stations.length === 0) && (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-xs text-[#8aafc0]">
                              No deviation survey attached to this well (modeled as vertical).
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PASTE TABLE */}
          {activeTab === 'table-import' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#8aafc0]">
                  Paste wellhead coordinates or CSV/TSV table. Auto-matches columns (WellName, Easting, Northing, KB, TD, IL, XL, Top, Base):
                </p>
                <button
                  onClick={() => setCsvText(RAW_SALDA_WELL_HEADS_TEXT)}
                  className="px-2.5 py-1 bg-[#162d4c] hover:bg-[#2a9bb0]/30 text-xs text-[#00f0ff] rounded border border-[#2a9bb0]/30 transition-colors"
                >
                  Load Saldanadi Wellheads
                </button>
              </div>

              <textarea
                id="textarea-csv-wellheads"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={11}
                className="w-full bg-[#071322] border border-[#2a9bb0]/30 rounded-xl p-3 font-mono text-xs text-[#00f0ff] focus:border-[#00f0ff] outline-none"
                placeholder="Well Name    Northing Y    Easting.X    KB      TD..."
              />
              <button
                id="btn-parse-update-table"
                type="button"
                onClick={handleApplyCsv}
                className="py-2.5 px-4 bg-[#2a9bb0] hover:bg-[#1a6b7a] text-[#0a1628] font-bold text-xs rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow"
              >
                <Table className="w-4 h-4" /> Parse & Update Well Coordinates
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0b1b30] border-t border-[#2a9bb0]/30 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#8aafc0]">
            Total Wells: <b className="text-[#00f0ff]">{editedWells.length}</b> | Directional Wells:{' '}
            <b className="text-[#f0a500]">{editedWells.filter((w) => w.trajectory && w.trajectory.maxInclination > 3).length}</b>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#162d4c] hover:bg-[#1a3d54] text-[#8aafc0] hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-well-locations-btn"
              onClick={handleSaveAndClose}
              className="px-5 py-2 bg-[#00f0ff] hover:bg-[#00d0df] text-[#0a1628] rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Coordinates & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
