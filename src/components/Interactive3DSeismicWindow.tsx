import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  SeismicDataset,
  HorizonState,
  MultiLine2DSurvey,
  Seismic2DLineInfo,
} from '../types';
import {
  Box,
  RotateCw,
  Maximize2,
  Minimize2,
  Sliders,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Play,
  Pause,
  Download,
  Compass,
  Activity,
  Grid,
  Camera,
  SunMedium,
  Check,
  Search,
  Focus,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  Move3d,
  Hand,
  ZoomIn,
  Ruler,
  MousePointer,
  HelpCircle,
  Split,
  EyeClosed,
} from 'lucide-react';
import { SYNTHETIC_3D_LINE_TRAJECTORIES } from '../modules/seismicEngine';

export type MouseInteractionMode = 'orbit' | 'pan' | 'zoom' | 'slice_drag' | 'measure' | 'line_select';

export interface Interactive3DSeismicWindowProps {
  cube: SeismicDataset | null;
  horizonState?: HorizonState | null;
  survey?: MultiLine2DSurvey | null;
  initialHeight?: number;
  showCardWrapper?: boolean;
  onSliceChanged?: (type: 'inline' | 'crossline' | 'timeslice', index: number) => void;
}

export const Interactive3DSeismicWindow: React.FC<Interactive3DSeismicWindowProps> = ({
  cube,
  horizonState,
  survey: propSurvey,
  initialHeight = 540,
  showCardWrapper = true,
  onSliceChanged,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active survey reference (from props, embedded in cube, or null)
  const activeSurvey = propSurvey || cube?.multiLineSurvey || null;

  // View camera & transformation state
  const [pitch, setPitch] = useState<number>(-32); // degrees (isometric vantage)
  const [yaw, setYaw] = useState<number>(42); // degrees (corner perspective)
  const [zoom, setZoom] = useState<number>(1.05);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [xExag, setXExag] = useState<number>(1.0);
  const [yExag, setYExag] = useState<number>(1.0);
  const [vertExag, setVertExag] = useState<number>(2.0);
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Active Mouse Interaction Tool
  const [mouseMode, setMouseMode] = useState<MouseInteractionMode>('orbit');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isZoomDragging, setIsZoomDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredSlice, setHoveredSlice] = useState<'inline' | 'crossline' | 'timeslice' | null>(null);
  const [activeSliceDrag, setActiveSliceDrag] = useState<'inline' | 'crossline' | 'timeslice' | null>(null);
  const [showMouseHelp, setShowMouseHelp] = useState<boolean>(false);

  // 3D Measurement Mode
  const [measureStart, setMeasureStart] = useState<{ xNorm: number; yNorm: number; zNorm: number; screenX: number; screenY: number; label: string } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ xNorm: number; yNorm: number; zNorm: number; screenX: number; screenY: number; label: string } | null>(null);

  // Probe Info State
  const [probeInfo, setProbeInfo] = useState<{
    x: number;
    y: number;
    z: number;
    il?: number;
    xl?: number;
    twtMs?: number;
    amplitude?: number;
    worldX?: number;
    worldY?: number;
    lineName?: string;
    cmpIdx?: number;
  } | null>(null);

  // 3D Display mode for surveys
  const [displayModeType, setDisplayModeType] = useState<'fences_only' | 'volume_only' | 'hybrid'>(() => {
    if (activeSurvey && activeSurvey.lines.length > 0) return 'fences_only';
    return 'volume_only';
  });

  // 3D Slicing and Display configuration
  const [showInlineSlice, setShowInlineSlice] = useState<boolean>(true);
  const [showCrosslineSlice, setShowCrosslineSlice] = useState<boolean>(true);
  const [showTimeSlice, setShowTimeSlice] = useState<boolean>(true);
  const [showChairCut, setShowChairCut] = useState<boolean>(false);
  const [showTopHorizon, setShowTopHorizon] = useState<boolean>(true);
  const [showBaseHorizon, setShowBaseHorizon] = useState<boolean>(true);
  const [showIsochoreEnvelope, setShowIsochoreEnvelope] = useState<boolean>(true);
  const [show2DFenceCurtains, setShow2DFenceCurtains] = useState<boolean>(true);
  const [showTiePillars, setShowTiePillars] = useState<boolean>(true);
  const [showLineLabels3D, setShowLineLabels3D] = useState<boolean>(true);
  const [showBasemapFootprint, setShowBasemapFootprint] = useState<boolean>(true);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(true);
  const [showGridTicks, setShowGridTicks] = useState<boolean>(true);

  // Colormap & Gain
  const [colorMap, setColorMap] = useState<'RdBu' | 'Turbo' | 'Gray' | 'Thermal' | 'Seismic'>('RdBu');
  const [gain, setGain] = useState<number>(1.2);
  const [opacity3D, setOpacity3D] = useState<number>(0.92);

  // Slice Indices
  const nInlines = cube?.type === '3d' ? cube.nInlines : 1;
  const nCrosslines = cube?.type === '3d' ? cube.nCrosslines : (cube?.nTraces || 1);
  const nSamples = cube?.nSamples || 1000;
  const sampleRate = cube?.sampleRate || 4.0;
  const velocity = horizonState?.velocity || 2500;

  const [inlineIdx, setInlineIdx] = useState<number>(Math.floor(nInlines / 2));
  const [crosslineIdx, setCrosslineIdx] = useState<number>(Math.floor(nCrosslines / 2));
  const [timeSliceSample, setTimeSliceSample] = useState<number>(Math.floor(nSamples * 0.45));

  // Animation player
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animationMode, setAnimationMode] = useState<'turntable' | 'inline_sweep' | 'time_sweep'>('turntable');

  // Multi-line visibility filters, isolation & highlights
  const [lineVisibility, setLineVisibility] = useState<Record<string, boolean>>({});
  const [isolatedLineId, setIsolatedLineId] = useState<string | null>(null);
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);
  const [surveySearchQuery, setSurveySearchQuery] = useState<string>('');
  const [showSurveyDrawer, setShowSurveyDrawer] = useState<boolean>(false);
  const [activeTabDrawer, setActiveTabDrawer] = useState<'lines' | 'ties' | 'settings'>('lines');

  // Initialize visibility from activeSurvey
  useEffect(() => {
    if (activeSurvey) {
      const initialVis: Record<string, boolean> = {};
      activeSurvey.lines.forEach((l) => {
        initialVis[l.id] = l.visible !== false;
      });
      setLineVisibility(initialVis);
    }
  }, [activeSurvey]);

  // Sync mode if activeSurvey changes
  useEffect(() => {
    if (activeSurvey && activeSurvey.lines.length > 0) {
      setDisplayModeType('fences_only');
    } else {
      setDisplayModeType('volume_only');
    }
  }, [activeSurvey?.name]);

  // Keep slice sliders within safe bounds on cube change
  useEffect(() => {
    if (cube) {
      if (cube.type === '3d') {
        setInlineIdx((prev) => Math.max(0, Math.min(cube.nInlines - 1, prev)));
        setCrosslineIdx((prev) => Math.max(0, Math.min(cube.nCrosslines - 1, prev)));
      }
      setTimeSliceSample((prev) => Math.max(0, Math.min(cube.nSamples - 1, prev)));
    }
  }, [cube]);

  // Animation Loop
  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      if (animationMode === 'turntable') {
        setYaw((prev) => (prev + 0.7) % 360);
      } else if (animationMode === 'inline_sweep' && cube && cube.type === '3d') {
        setInlineIdx((prev) => (prev + 1) % cube.nInlines);
      } else if (animationMode === 'time_sweep' && cube) {
        setTimeSliceSample((prev) => (prev + 3) % cube.nSamples);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [isAnimating, animationMode, cube]);

  // Color lookup helper
  const getColorRGB = useCallback(
    (normalizedAmp: number, alpha: number = 1.0): string => {
      const clamped = Math.max(-1, Math.min(1, normalizedAmp * gain));

      if (colorMap === 'RdBu') {
        if (clamped < 0) {
          const t = -clamped;
          const r = Math.round(245 - t * 195);
          const g = Math.round(245 - t * 155);
          const b = Math.round(245 - t * 25);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } else {
          const t = clamped;
          const r = Math.round(245 - t * 25);
          const g = Math.round(245 - t * 165);
          const b = Math.round(245 - t * 195);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      } else if (colorMap === 'Seismic') {
        if (clamped < 0) {
          const t = -clamped;
          return `rgba(${Math.round(20 + (1 - t) * 200)}, ${Math.round(40 + (1 - t) * 180)}, 240, ${alpha})`;
        } else {
          const t = clamped;
          return `rgba(240, ${Math.round(30 + (1 - t) * 190)}, ${Math.round(30 + (1 - t) * 190)}, ${alpha})`;
        }
      } else if (colorMap === 'Turbo') {
        const t = (clamped + 1) / 2.0;
        const r = Math.round(Math.sin(t * Math.PI * 1.5 - 0.5) * 127 + 128);
        const g = Math.round(Math.sin(t * Math.PI * 2.0) * 127 + 128);
        const b = Math.round(Math.cos(t * Math.PI * 1.5) * 127 + 128);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      } else if (colorMap === 'Thermal') {
        const t = (clamped + 1) / 2.0;
        const r = Math.round(Math.min(255, t * 350));
        const g = Math.round(Math.max(0, Math.min(255, (t - 0.3) * 350)));
        const b = Math.round(Math.max(0, Math.min(255, (t - 0.7) * 450)));
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      } else {
        const v = Math.round(((clamped + 1) / 2.0) * 255);
        return `rgba(${v}, ${v}, ${v}, ${alpha})`;
      }
    },
    [colorMap, gain]
  );

  // Depth color for horizons
  const getHorizonDepthColor = useCallback(
    (depthM: number, minD: number, maxD: number, alpha: number = 0.9): string => {
      const span = Math.max(1, maxD - minD);
      const t = Math.max(0, Math.min(1, (depthM - minD) / span));
      let r = 0, g = 0, b = 0;
      if (t < 0.3) {
        const u = t / 0.3;
        r = 0;
        g = Math.round(u * 230);
        b = 255;
      } else if (t < 0.65) {
        const u = (t - 0.3) / 0.35;
        r = Math.round(u * 240);
        g = 240;
        b = Math.round((1 - u) * 240);
      } else {
        const u = (t - 0.65) / 0.35;
        r = 245;
        g = Math.round((1 - u) * 180);
        b = Math.round(u * 80);
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },
    []
  );

  // Helper to compute normalized (X, Y) world position for any trace index on a line
  const getTraceWorldPos = useCallback(
    (ds: SeismicDataset, line: Seismic2DLineInfo, tIdx: number, lineIdx: number) => {
      const bounds = activeSurvey?.bounds || { minX: 0, maxX: 10000, minY: 0, maxY: 10000, minT: 0, maxT: 2000 };
      const spanX = Math.max(1, bounds.maxX - bounds.minX);
      const spanY = Math.max(1, bounds.maxY - bounds.minY);

      const nTraces = Math.max(2, ds.nTraces);
      const fraction = Math.max(0, Math.min(1, tIdx / Math.max(1, nTraces - 1)));

      let x = line.startX + fraction * (line.endX - line.startX);
      let y = line.startY + fraction * (line.endY - line.startY);

      if (
        ds.xCoords &&
        ds.xCoords[tIdx] !== undefined &&
        isFinite(ds.xCoords[tIdx]) &&
        (Math.abs(ds.xCoords[tIdx]) > 0.001 || Math.abs(ds.yCoords?.[tIdx] || 0) > 0.001)
      ) {
        x = ds.xCoords[tIdx];
      }
      if (
        ds.yCoords &&
        ds.yCoords[tIdx] !== undefined &&
        isFinite(ds.yCoords[tIdx]) &&
        (Math.abs(ds.yCoords[tIdx]) > 0.001 || Math.abs(ds.xCoords?.[tIdx] || 0) > 0.001)
      ) {
        y = ds.yCoords[tIdx];
      }

      const normX = Math.max(0, Math.min(1, (x - bounds.minX) / spanX));
      const normY = Math.max(0, Math.min(1, (y - bounds.minY) / spanY));
      return { normX, normY, x, y };
    },
    [activeSurvey]
  );

  // 3D Bounding Box & Center calculation
  const sceneBounds = useMemo(() => {
    let minNormX = 0.0;
    let maxNormX = 1.0;
    let minNormY = 0.0;
    let maxNormY = 1.0;
    const minNormZ = 0.0;
    const maxNormZ = 1.0;

    // Convert normalized [0, 1] bounds into 3D scene coordinates [-1, 1] * exag
    const minX = (minNormX - 0.5) * 2 * xExag;
    const maxX = (maxNormX - 0.5) * 2 * xExag;
    const minY = (minNormY - 0.5) * 2 * yExag;
    const maxY = (maxNormY - 0.5) * 2 * yExag;
    const minZ = (minNormZ - 0.5) * vertExag;
    const maxZ = (maxNormZ - 0.5) * vertExag;

    const targetX = 0;
    const targetY = 0;
    const targetZ = 0;

    const sizeX = Math.max(0.1, maxX - minX);
    const sizeY = Math.max(0.1, maxY - minY);
    const sizeZ = Math.max(0.1, maxZ - minZ);

    const radius = Math.max(0.5, Math.hypot(sizeX / 2, sizeY / 2, sizeZ / 2));

    return {
      minNormX,
      maxNormX,
      minNormY,
      maxNormY,
      minNormZ,
      maxNormZ,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      targetX,
      targetY,
      targetZ,
      sizeX,
      sizeY,
      sizeZ,
      radius,
    };
  }, [xExag, yExag, vertExag]);

  // Automated Camera Fit-to-Bounds handler
  const handleFitToSurvey = useCallback(() => {
    setPitch(-32);
    setYaw(42);
    setZoom(1.05);
    setPanX(0);
    setPanY(0);
  }, []);

  // Quick Preset View setter
  const handleSetPresetView = (view: 'iso' | 'chair' | 'top' | 'front' | 'side' | 'bottom' | 'fit') => {
    if (view === 'fit') {
      handleFitToSurvey();
    } else if (view === 'iso') {
      setPitch(-32); setYaw(42); setShowChairCut(false); setZoom(1.05); setPanX(0); setPanY(0);
    } else if (view === 'chair') {
      setPitch(-30); setYaw(38); setShowChairCut(true); setZoom(1.05); setPanX(0); setPanY(0);
    } else if (view === 'top') {
      setPitch(0); setYaw(0); setZoom(1.1); setPanX(0); setPanY(0);
    } else if (view === 'front') {
      setPitch(-89.9); setYaw(0); setZoom(1.1); setPanX(0); setPanY(0);
    } else if (view === 'side') {
      setPitch(-89.9); setYaw(90); setZoom(1.1); setPanX(0); setPanY(0);
    } else if (view === 'bottom') {
      setPitch(45); setYaw(42); setZoom(1.05); setPanX(0); setPanY(0);
    }
  };

  // Main 3D Render Loop on 2D Canvas with Software Projection & Painter's Depth Sorting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = Math.max(300, rect.width || (isFullscreen ? window.innerWidth : 980));
    const displayHeight = Math.max(200, rect.height || (isFullscreen ? window.innerHeight - 130 : initialHeight));

    const physicalWidth = Math.round(displayWidth * dpr);
    const physicalHeight = Math.round(displayHeight * dpr);

    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = displayWidth;
    const height = displayHeight;
    ctx.clearRect(0, 0, width, height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Dark space background gradient
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      50,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.8
    );
    bgGrad.addColorStop(0, '#0a1a2e');
    bgGrad.addColorStop(1, '#040913');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle background grid
    ctx.strokeStyle = 'rgba(42, 155, 176, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Camera transformation math
    const radYaw = (yaw * Math.PI) / 180;
    const radPitch = (pitch * Math.PI) / 180;

    const cosY = Math.cos(radYaw);
    const sinY = Math.sin(radYaw);
    const cosP = Math.cos(radPitch);
    const sinP = Math.sin(radPitch);

    const cameraDistance = 5.2;

    const project = (
      xNorm: number,
      yNorm: number,
      zNorm: number
    ): { x: number; y: number; zDepth: number } => {
      // 1. Normalized [0, 1] to centered scene space
      const x0 = (xNorm - 0.5) * 2 * xExag;
      const y0 = (yNorm - 0.5) * 2 * yExag;
      const z0 = (zNorm - 0.5) * vertExag;

      // 2. Center relative to orbit target
      const x = x0 - sceneBounds.targetX;
      const y = y0 - sceneBounds.targetY;
      const z = z0 - sceneBounds.targetZ;

      // 3. Orbit yaw rotation
      const x1 = x * cosY - y * sinY;
      const y1 = x * sinY + y * cosY;

      // 4. Orbit pitch rotation
      const y2 = y1 * cosP - z * sinP;
      const z2 = y1 * sinP + z * cosP;

      // 5. Perspective depth projection
      const dist = cameraDistance;
      const fov = 680 * zoom;
      const depth = dist + z2;

      const screenX = width / 2 + panX + (x1 * fov) / depth;
      const screenY = height / 2 + panY + (y2 * fov) / depth;

      return { x: screenX, y: screenY, zDepth: z2 };
    };

    interface Poly3D {
      pts: { x: number; y: number; zDepth: number }[];
      avgZ: number;
      fill: string;
      stroke?: string;
      lineWidth?: number;
      type: 'slice' | 'horizon' | 'fence' | 'wall' | 'axis' | 'tie';
      label?: string;
      labelPos?: { x: number; y: number };
    }

    const polygons: Poly3D[] = [];

    // =========================================================================
    // 1. DRAW 3D BOUNDING BOX & GRID TICKS
    // =========================================================================
    if (showBoundingBox) {
      ctx.strokeStyle = 'rgba(42, 155, 176, 0.35)';
      ctx.lineWidth = 1;

      const b000 = project(0, 0, 0);
      const b100 = project(1, 0, 0);
      const b110 = project(1, 1, 0);
      const b010 = project(0, 1, 0);

      const b001 = project(0, 0, 1);
      const b101 = project(1, 0, 1);
      const b111 = project(1, 1, 1);
      const b011 = project(0, 1, 1);

      // Top box (TWT = 0 ms)
      ctx.beginPath();
      ctx.moveTo(b000.x, b000.y);
      ctx.lineTo(b100.x, b100.y);
      ctx.lineTo(b110.x, b110.y);
      ctx.lineTo(b010.x, b010.y);
      ctx.closePath();
      ctx.stroke();

      // Bottom box (TWT = max ms)
      ctx.beginPath();
      ctx.moveTo(b001.x, b001.y);
      ctx.lineTo(b101.x, b101.y);
      ctx.lineTo(b111.x, b111.y);
      ctx.lineTo(b011.x, b011.y);
      ctx.closePath();
      ctx.stroke();

      // Vertical pillars
      ctx.beginPath();
      ctx.moveTo(b000.x, b000.y); ctx.lineTo(b001.x, b001.y);
      ctx.moveTo(b100.x, b100.y); ctx.lineTo(b101.x, b101.y);
      ctx.moveTo(b110.x, b110.y); ctx.lineTo(b111.x, b111.y);
      ctx.moveTo(b010.x, b010.y); ctx.lineTo(b011.x, b011.y);
      ctx.stroke();

      // Floor grid mesh for spatial orientation
      if (showGridTicks) {
        ctx.strokeStyle = 'rgba(42, 155, 176, 0.15)';
        ctx.setLineDash([3, 3]);
        for (let g = 1; g <= 4; g++) {
          const f = g / 5;
          const pA = project(f, 0, 1);
          const pB = project(f, 1, 1);
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();

          const pC = project(0, f, 1);
          const pD = project(1, f, 1);
          ctx.beginPath();
          ctx.moveTo(pC.x, pC.y);
          ctx.lineTo(pD.x, pD.y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    }

    // =========================================================================
    // 2. DRAW 3D SEISMIC VOLUME ORTHOGONAL SLICES (When 3D Cube or Hybrid)
    // =========================================================================
    const shouldDrawVolume = cube && cube.type === '3d' && (displayModeType === 'volume_only' || displayModeType === 'hybrid');

    if (shouldDrawVolume && cube) {
      const curData = cube.data;
      const cIl = cube.nInlines;
      const cXl = cube.nCrosslines;
      const cS = cube.nSamples;

      const getSampleVal = (il: number, xl: number, s: number): number => {
        const safeIl = Math.max(0, Math.min(cIl - 1, il));
        const safeXl = Math.max(0, Math.min(cXl - 1, xl));
        const safeS = Math.max(0, Math.min(cS - 1, s));
        const idx = (safeIl * cXl + safeXl) * cS + safeS;
        return curData[idx] || 0;
      };

      const stepS = Math.max(1, Math.floor(cS / 110));
      const stepX = Math.max(1, Math.floor(cXl / 90));
      const stepY = Math.max(1, Math.floor(cIl / 90));

      // 2A. INLINE SLICE (Fixed IL, spanning XL and S)
      if (showInlineSlice) {
        const il = Math.max(0, Math.min(cIl - 1, inlineIdx));
        const yNorm = il / Math.max(1, cIl - 1);
        const xlLimit = showChairCut ? Math.floor(cXl * 0.6) : cXl;

        for (let xl = 0; xl < xlLimit; xl += stepX) {
          const nextXl = Math.min(xlLimit, xl + stepX);
          for (let s = 0; s < cS; s += stepS) {
            const nextS = Math.min(cS - 1, s + stepS);

            const x0 = xl / Math.max(1, cXl - 1);
            const x1 = nextXl / Math.max(1, cXl - 1);
            const z0 = s / Math.max(1, cS - 1);
            const z1 = nextS / Math.max(1, cS - 1);

            const p00 = project(x0, yNorm, z0);
            const p10 = project(x1, yNorm, z0);
            const p11 = project(x1, yNorm, z1);
            const p01 = project(x0, yNorm, z1);

            const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;
            const amp = getSampleVal(il, xl, s);
            const fill = getColorRGB(amp, opacity3D);

            polygons.push({
              pts: [p00, p10, p11, p01],
              avgZ,
              fill,
              stroke: isWireframe ? 'rgba(0, 240, 255, 0.4)' : undefined,
              type: 'slice',
            });
          }
        }
      }

      // 2B. CROSSLINE SLICE (Fixed XL, spanning IL and S)
      if (showCrosslineSlice) {
        const xl = Math.max(0, Math.min(cXl - 1, crosslineIdx));
        const xNorm = xl / Math.max(1, cXl - 1);
        const ilLimit = showChairCut ? Math.floor(cIl * 0.6) : cIl;

        for (let il = 0; il < ilLimit; il += stepY) {
          const nextIl = Math.min(ilLimit, il + stepY);
          for (let s = 0; s < cS; s += stepS) {
            const nextS = Math.min(cS - 1, s + stepS);

            const y0 = il / Math.max(1, cIl - 1);
            const y1 = nextIl / Math.max(1, cIl - 1);
            const z0 = s / Math.max(1, cS - 1);
            const z1 = nextS / Math.max(1, cS - 1);

            const p00 = project(xNorm, y0, z0);
            const p10 = project(xNorm, y1, z0);
            const p11 = project(xNorm, y1, z1);
            const p01 = project(xNorm, y0, z1);

            const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;
            const amp = getSampleVal(il, xl, s);
            const fill = getColorRGB(amp, opacity3D);

            polygons.push({
              pts: [p00, p10, p11, p01],
              avgZ,
              fill,
              stroke: isWireframe ? 'rgba(240, 165, 0, 0.4)' : undefined,
              type: 'slice',
            });
          }
        }
      }

      // 2C. TIME / DEPTH SLICE (Fixed S, spanning IL and XL)
      if (showTimeSlice) {
        const s = Math.max(0, Math.min(cS - 1, timeSliceSample));
        const zNorm = s / Math.max(1, cS - 1);

        for (let il = 0; il < cIl; il += stepY) {
          const nextIl = Math.min(cIl - 1, il + stepY);
          for (let xl = 0; xl < cXl; xl += stepX) {
            const nextXl = Math.min(cXl - 1, xl + stepX);

            if (showChairCut && il >= cIl * 0.6 && xl >= cXl * 0.6) continue;

            const y0 = il / Math.max(1, cIl - 1);
            const y1 = nextIl / Math.max(1, cIl - 1);
            const x0 = xl / Math.max(1, cXl - 1);
            const x1 = nextXl / Math.max(1, cXl - 1);

            const p00 = project(x0, y0, zNorm);
            const p10 = project(x1, y0, zNorm);
            const p11 = project(x1, y1, zNorm);
            const p01 = project(x0, y1, zNorm);

            const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;
            const amp = getSampleVal(il, xl, s);
            const fill = getColorRGB(amp, opacity3D);

            polygons.push({
              pts: [p00, p10, p11, p01],
              avgZ,
              fill,
              stroke: isWireframe ? 'rgba(46, 204, 113, 0.4)' : undefined,
              type: 'slice',
            });
          }
        }
      }
    }

    // =========================================================================
    // 3. DRAW 2D SEISMIC LINES (MULTI-LINE FENCE NETWORK & BASEMAP FOOTPRINT)
    // =========================================================================
    const shouldDrawFences =
      (displayModeType === 'fences_only' || displayModeType === 'hybrid') &&
      ((activeSurvey && activeSurvey.lines.length > 0) || (cube && cube.type === '2d'));

    if (shouldDrawFences) {
      const linesToDraw: { line: Seismic2DLineInfo; ds: SeismicDataset; idx: number }[] = [];

      if (activeSurvey && activeSurvey.lines.length > 0) {
        activeSurvey.lines.forEach((l, i) => {
          if (lineVisibility[l.id] === false) return;
          if (isolatedLineId && isolatedLineId !== l.id) return;
          linesToDraw.push({ line: l, ds: l.dataset, idx: i });
        });
      } else if (cube && cube.type === '2d') {
        // Render single 2D line spanning across the 3D space diagonally / centrically
        const singleLineInfo: Seismic2DLineInfo = {
          id: 'line_single',
          name: cube.lineName || cube.name || '2D Seismic Profile',
          dataset: cube,
          startX: 500,
          startY: 2500,
          endX: 9500,
          endY: 2500,
          azimuthDeg: 90,
          lengthM: 9000,
          color: '#00f0ff',
          visible: true,
        };
        linesToDraw.push({ line: singleLineInfo, ds: cube, idx: 0 });
      }

      // 3A. Ground Floor Basemap Footprint (Z = 1.0)
      if (showBasemapFootprint) {
        linesToDraw.forEach(({ line, ds, idx }) => {
          const isHighlighted = highlightedLineId === line.id;
          const nTraces = ds.nTraces;
          const stepT = Math.max(1, Math.floor(nTraces / 24));

          for (let t = 0; t < nTraces; t += stepT) {
            const nextT = Math.min(nTraces - 1, t + stepT);
            const posA = getTraceWorldPos(ds, line, t, idx);
            const posB = getTraceWorldPos(ds, line, nextT, idx);

            const p0 = project(posA.normX, posA.normY, 1.0);
            const p1 = project(posB.normX, posB.normY, 1.0);

            polygons.push({
              pts: [p0, p1],
              avgZ: (p0.zDepth + p1.zDepth) / 2 + 0.05,
              fill: 'transparent',
              stroke: isHighlighted ? '#ffffff' : (line.color || '#00f0ff'),
              lineWidth: isHighlighted ? 3.0 : 1.5,
              type: 'fence',
            });
          }
        });
      }

      // 3B. 2D Vertical Planar Fence Ribbon Mesh with Double-Sided Seismic Amplitudes
      if (show2DFenceCurtains) {
        linesToDraw.forEach(({ line, ds, idx }) => {
          const isHighlighted = highlightedLineId === line.id;
          const activeOpacity = isHighlighted ? 1.0 : opacity3D;
          const nTraces = ds.nTraces;
          const lineSamples = ds.nSamples;
          const rawData = ds.data;

          const stepT = Math.max(1, Math.floor(nTraces / 110));
          const stepS = Math.max(1, Math.floor(lineSamples / 90));

          for (let t = 0; t < nTraces; t += stepT) {
            const nextT = Math.min(nTraces - 1, t + stepT);

            const posA = getTraceWorldPos(ds, line, t, idx);
            const posB = getTraceWorldPos(ds, line, nextT, idx);

            for (let s = 0; s < lineSamples; s += stepS) {
              const nextS = Math.min(lineSamples - 1, s + stepS);
              const z0 = s / Math.max(1, lineSamples - 1);
              const z1 = nextS / Math.max(1, lineSamples - 1);

              const p00 = project(posA.normX, posA.normY, z0);
              const p10 = project(posB.normX, posB.normY, z0);
              const p11 = project(posB.normX, posB.normY, z1);
              const p01 = project(posA.normX, posA.normY, z1);

              const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4 + idx * 0.0001;

              // Sample amplitude at mid-point
              const midT = Math.floor((t + nextT) / 2);
              const midS = Math.floor((s + nextS) / 2);
              const amp = rawData[midT * lineSamples + midS] || 0;
              const fill = getColorRGB(amp, activeOpacity);

              polygons.push({
                pts: [p00, p10, p11, p01],
                avgZ,
                fill,
                stroke: isWireframe ? (line.color || 'rgba(0, 240, 255, 0.5)') : fill,
                lineWidth: isWireframe ? 0.8 : 0.6,
                type: 'fence',
              });
            }

            // Top ribbon edge
            const pTop0 = project(posA.normX, posA.normY, 0.0);
            const pTop1 = project(posB.normX, posB.normY, 0.0);
            polygons.push({
              pts: [pTop0, pTop1],
              avgZ: (pTop0.zDepth + pTop1.zDepth) / 2 + 0.02,
              fill: 'transparent',
              stroke: isHighlighted ? '#ffffff' : (line.color || '#00f0ff'),
              lineWidth: isHighlighted ? 3 : 1.5,
              type: 'fence',
            });

            // Bottom ribbon edge
            const pBot0 = project(posA.normX, posA.normY, 1.0);
            const pBot1 = project(posB.normX, posB.normY, 1.0);
            polygons.push({
              pts: [pBot0, pBot1],
              avgZ: (pBot0.zDepth + pBot1.zDepth) / 2 + 0.02,
              fill: 'transparent',
              stroke: isHighlighted ? '#ffffff' : (line.color || '#00f0ff'),
              lineWidth: isHighlighted ? 2 : 1,
              type: 'fence',
            });
          }

          // Start & End vertical pillars
          const posStart = getTraceWorldPos(ds, line, 0, idx);
          const posEnd = getTraceWorldPos(ds, line, nTraces - 1, idx);
          const pStartTop = project(posStart.normX, posStart.normY, 0.0);
          const pStartBot = project(posStart.normX, posStart.normY, 1.0);
          const pEndTop = project(posEnd.normX, posEnd.normY, 0.0);
          const pEndBot = project(posEnd.normX, posEnd.normY, 1.0);

          polygons.push({
            pts: [pStartTop, pStartBot],
            avgZ: (pStartTop.zDepth + pStartBot.zDepth) / 2 + 0.03,
            fill: 'transparent',
            stroke: isHighlighted ? '#ffffff' : (line.color || '#00f0ff'),
            lineWidth: isHighlighted ? 2.5 : 1.2,
            type: 'fence',
          });

          polygons.push({
            pts: [pEndTop, pEndBot],
            avgZ: (pEndTop.zDepth + pEndBot.zDepth) / 2 + 0.03,
            fill: 'transparent',
            stroke: isHighlighted ? '#ffffff' : (line.color || '#00f0ff'),
            lineWidth: isHighlighted ? 2.5 : 1.2,
            type: 'fence',
          });

          // Billboard Line Name Label at line start point (offset outward from grid like Petrel)
          if (showLineLabels3D) {
            const dx = posStart.normX - posEnd.normX;
            const dy = posStart.normY - posEnd.normY;
            const dirLen = Math.hypot(dx, dy) || 1;
            const offsetDist = 0.045; // outward spatial offset
            const labelNormX = posStart.normX + (dx / dirLen) * offsetDist;
            const labelNormY = posStart.normY + (dy / dirLen) * offsetDist;

            const pLabel = project(labelNormX, labelNormY, -0.02);
            polygons.push({
              pts: [pLabel],
              avgZ: pLabel.zDepth + 0.06,
              fill: isHighlighted ? '#ffffff' : (line.color || '#00f0ff'),
              type: 'fence',
              label: line.name,
              labelPos: { x: pLabel.x, y: pLabel.y },
            });
          }
        });
      }
    }

    // =========================================================================
    // 4. DRAW 3D HORIZON SURFACES & RESERVOIR ISOCHORE ENVELOPE
    // =========================================================================
    if (horizonState && (showTopHorizon || showBaseHorizon || showIsochoreEnvelope)) {
      const topH = horizonState.topHorizon;
      const baseH = horizonState.baseHorizon;
      const hIl = topH.length;
      const hXl = topH[0]?.length || 0;

      const activeTop = hIl === 1 ? [topH[0], topH[0]] : topH;
      const activeBase = hIl === 1 ? [baseH[0], baseH[0]] : baseH;
      const effIl = activeTop.length;
      const effXl = activeTop[0]?.length || 0;

      let minD = Infinity, maxD = -Infinity;
      for (let il = 0; il < effIl; il++) {
        for (let xl = 0; xl < effXl; xl++) {
          const tD = ((activeTop[il][xl] * sampleRate) / 2000.0) * velocity;
          const bD = ((activeBase[il][xl] * sampleRate) / 2000.0) * velocity;
          if (tD < minD) minD = tD;
          if (bD > maxD) maxD = bD;
        }
      }

      const stepHIl = Math.max(1, Math.floor(effIl / 18));
      const stepHXl = Math.max(1, Math.floor(effXl / 18));

      // 4A. Base Horizon Surface
      if (showBaseHorizon) {
        for (let il = 0; il < effIl - stepHIl; il += stepHIl) {
          for (let xl = 0; xl < effXl - stepHXl; xl += stepHXl) {
            const nextIl = Math.min(effIl - 1, il + stepHIl);
            const nextXl = Math.min(effXl - 1, xl + stepHXl);

            const z00 = activeBase[il][xl] / Math.max(1, nSamples - 1);
            const z10 = activeBase[nextIl][xl] / Math.max(1, nSamples - 1);
            const z11 = activeBase[nextIl][nextXl] / Math.max(1, nSamples - 1);
            const z01 = activeBase[il][nextXl] / Math.max(1, nSamples - 1);

            const p00 = project(xl / Math.max(1, effXl - 1), il / Math.max(1, effIl - 1), z00);
            const p10 = project(xl / Math.max(1, effXl - 1), nextIl / Math.max(1, effIl - 1), z10);
            const p11 = project(nextXl / Math.max(1, effXl - 1), nextIl / Math.max(1, effIl - 1), z11);
            const p01 = project(nextXl / Math.max(1, effXl - 1), il / Math.max(1, effIl - 1), z01);

            const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;

            polygons.push({
              pts: [p00, p10, p11, p01],
              avgZ: avgZ - 0.02,
              fill: isWireframe ? 'rgba(240, 165, 0, 0.1)' : 'rgba(215, 140, 20, 0.75)',
              stroke: 'rgba(240, 165, 0, 0.8)',
              type: 'horizon',
            });
          }
        }
      }

      // 4B. Top Horizon Surface
      if (showTopHorizon) {
        for (let il = 0; il < effIl - stepHIl; il += stepHIl) {
          for (let xl = 0; xl < effXl - stepHXl; xl += stepHXl) {
            const nextIl = Math.min(effIl - 1, il + stepHIl);
            const nextXl = Math.min(effXl - 1, xl + stepHXl);

            const d00 = ((activeTop[il][xl] * sampleRate) / 2000.0) * velocity;
            const d10 = ((activeTop[nextIl][xl] * sampleRate) / 2000.0) * velocity;
            const d11 = ((activeTop[nextIl][nextXl] * sampleRate) / 2000.0) * velocity;
            const d01 = ((activeTop[il][nextXl] * sampleRate) / 2000.0) * velocity;
            const avgD = (d00 + d10 + d11 + d01) / 4;

            const z00 = activeTop[il][xl] / Math.max(1, nSamples - 1);
            const z10 = activeTop[nextIl][xl] / Math.max(1, nSamples - 1);
            const z11 = activeTop[nextIl][nextXl] / Math.max(1, nSamples - 1);
            const z01 = activeTop[il][nextXl] / Math.max(1, nSamples - 1);

            const p00 = project(xl / Math.max(1, effXl - 1), il / Math.max(1, effIl - 1), z00);
            const p10 = project(xl / Math.max(1, effXl - 1), nextIl / Math.max(1, effIl - 1), z10);
            const p11 = project(nextXl / Math.max(1, effXl - 1), nextIl / Math.max(1, effIl - 1), z11);
            const p01 = project(nextXl / Math.max(1, effXl - 1), il / Math.max(1, effIl - 1), z01);

            const avgZ = (p00.zDepth + p10.zDepth + p11.zDepth + p01.zDepth) / 4;
            const fill = isWireframe
              ? 'rgba(0, 240, 255, 0.15)'
              : getHorizonDepthColor(avgD, minD, maxD, 0.88);

            polygons.push({
              pts: [p00, p10, p11, p01],
              avgZ,
              fill,
              stroke: isWireframe ? 'rgba(0, 240, 255, 0.9)' : 'rgba(0, 240, 255, 0.3)',
              type: 'horizon',
            });
          }
        }
      }

      // 4C. Isochore Reservoir Side Walls
      if (showIsochoreEnvelope) {
        const addWall = (xl1: number, il1: number, xl2: number, il2: number) => {
          const zT1 = activeTop[il1][xl1] / Math.max(1, nSamples - 1);
          const zB1 = activeBase[il1][xl1] / Math.max(1, nSamples - 1);
          const zT2 = activeTop[il2][xl2] / Math.max(1, nSamples - 1);
          const zB2 = activeBase[il2][xl2] / Math.max(1, nSamples - 1);

          const x1 = xl1 / Math.max(1, effXl - 1);
          const y1 = il1 / Math.max(1, effIl - 1);
          const x2 = xl2 / Math.max(1, effXl - 1);
          const y2 = il2 / Math.max(1, effIl - 1);

          const pT1 = project(x1, y1, zT1);
          const pB1 = project(x1, y1, zB1);
          const pB2 = project(x2, y2, zB2);
          const pT2 = project(x2, y2, zT2);

          const avgZ = (pT1.zDepth + pB1.zDepth + pB2.zDepth + pT2.zDepth) / 4;

          polygons.push({
            pts: [pT1, pB1, pB2, pT2],
            avgZ,
            fill: 'rgba(26, 107, 122, 0.65)',
            stroke: 'rgba(42, 155, 176, 0.8)',
            type: 'wall',
          });
        };

        for (let xl = 0; xl < effXl - stepHXl; xl += stepHXl) {
          addWall(xl, 0, Math.min(effXl - 1, xl + stepHXl), 0);
          addWall(xl, effIl - 1, Math.min(effXl - 1, xl + stepHXl), effIl - 1);
        }
        for (let il = 0; il < effIl - stepHIl; il += stepHIl) {
          addWall(0, il, 0, Math.min(effIl - 1, il + stepHIl));
          addWall(effXl - 1, il, effXl - 1, Math.min(effIl - 1, il + stepHIl));
        }
      }
    }

    // =========================================================================
    // 5. SORT ALL 3D POLYGONS BACK-TO-FRONT (PAINTER'S ALGORITHM) & DRAW
    // =========================================================================
    polygons.sort((a, b) => a.avgZ - b.avgZ);

    for (const poly of polygons) {
      if (poly.pts.length === 1 && poly.label && poly.labelPos) {
        // Draw 3D Billboard text label with background pill/rect for crisp readability against seismic
        ctx.save();
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        const labelText = poly.label;
        const textMetrics = ctx.measureText(labelText);
        const textW = textMetrics.width;
        const textH = 13;
        const padX = 5;
        const padY = 2;
        const rx = poly.labelPos.x - textW / 2 - padX;
        const ry = poly.labelPos.y - textH / 2 - padY;
        const rw = textW + padX * 2;
        const rh = textH + padY * 2;

        // Background container box
        ctx.fillStyle = 'rgba(5, 14, 25, 0.88)';
        ctx.strokeStyle = poly.fill || '#00f0ff';
        ctx.lineWidth = 1.0;

        if (typeof (ctx as any).roundRect === 'function') {
          ctx.beginPath();
          (ctx as any).roundRect(rx, ry, rw, rh, 3);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeRect(rx, ry, rw, rh);
        }

        ctx.fillStyle = poly.fill || '#00f0ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.fillText(labelText, poly.labelPos.x, poly.labelPos.y);
        ctx.restore();
        continue;
      }

      if (poly.pts.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(poly.pts[0].x, poly.pts[0].y);
      for (let i = 1; i < poly.pts.length; i++) {
        ctx.lineTo(poly.pts[i].x, poly.pts[i].y);
      }
      if (poly.pts.length > 2) {
        ctx.closePath();
        ctx.fillStyle = poly.fill;
        ctx.fill();
      }

      if (poly.stroke && poly.stroke !== 'transparent') {
        ctx.strokeStyle = poly.stroke;
        ctx.lineWidth = poly.lineWidth || 0.75;
        ctx.stroke();
      }
    }

    // =========================================================================
    // 6. 3D TIE PILLARS & INTERSECTIONS
    // =========================================================================
    if (showTiePillars && activeSurvey && activeSurvey.lines.length > 1 && shouldDrawFences) {
      const lineCount = activeSurvey.lines.length;
      for (let i = 0; i < lineCount; i++) {
        for (let j = i + 1; j < lineCount; j++) {
          const l1 = activeSurvey.lines[i];
          const l2 = activeSurvey.lines[j];
          if (lineVisibility[l1.id] === false || lineVisibility[l2.id] === false) continue;
          if (isolatedLineId && (isolatedLineId !== l1.id && isolatedLineId !== l2.id)) continue;

          const p1Start = getTraceWorldPos(l1.dataset, l1, 0, i);
          const p1End = getTraceWorldPos(l1.dataset, l1, l1.dataset.nTraces - 1, i);
          const p2Start = getTraceWorldPos(l2.dataset, l2, 0, j);
          const p2End = getTraceWorldPos(l2.dataset, l2, l2.dataset.nTraces - 1, j);

          const x1 = p1Start.normX, y1 = p1Start.normY, x2 = p1End.normX, y2 = p1End.normY;
          const x3 = p2Start.normX, y3 = p2Start.normY, x4 = p2End.normX, y4 = p2End.normY;

          const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
          if (Math.abs(denom) > 1e-6) {
            const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
            const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
            if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
              const ix = x1 + uA * (x2 - x1);
              const iy = y1 + uA * (y2 - y1);

              const pTop = project(ix, iy, 0.0);
              const pBot = project(ix, iy, 1.0);

              ctx.save();
              ctx.strokeStyle = '#2ecc71';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 3]);
              ctx.beginPath();
              ctx.moveTo(pTop.x, pTop.y);
              ctx.lineTo(pBot.x, pBot.y);
              ctx.stroke();
              ctx.restore();

              // Glowing tie node
              ctx.fillStyle = '#2ecc71';
              ctx.beginPath();
              ctx.arc(pTop.x, pTop.y, 3.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }
    }

    // =========================================================================
    // 7. 3D MEASUREMENT RULER LINE OVERLAY
    // =========================================================================
    if (measureStart && measureEnd) {
      const p1 = project(measureStart.xNorm, measureStart.yNorm, measureStart.zNorm);
      const p2 = project(measureEnd.xNorm, measureEnd.yNorm, measureEnd.zNorm);

      ctx.save();
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();

      // End point nodes
      [p1, p2].forEach((p) => {
        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Mid-point measurement badge
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dxM = Math.abs((measureEnd.xNorm - measureStart.xNorm) * 10000);
      const dyM = Math.abs((measureEnd.yNorm - measureStart.yNorm) * 10000);
      const dzMs = Math.abs((measureEnd.zNorm - measureStart.zNorm) * (nSamples * sampleRate));
      const dist3DM = Math.round(Math.hypot(dxM, dyM));

      const text = `ΔDist: ${dist3DM}m | ΔTWT: ${Math.round(dzMs)}ms`;
      ctx.save();
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(7, 19, 34, 0.88)';
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 1;
      ctx.fillRect(midX - textWidth / 2 - 6, midY - 18, textWidth + 12, 20);
      ctx.strokeRect(midX - textWidth / 2 - 6, midY - 18, textWidth + 12, 20);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(text, midX, midY - 4);
      ctx.restore();
    }

    // =========================================================================
    // 8. INTERACTIVE 3D VIEWCUBE & COMPASS GIZMO (TOP RIGHT)
    // =========================================================================
    const gizmoX = width - 60;
    const gizmoY = 60;
    const gizmoLen = 34;

    const gO = { x: gizmoX, y: gizmoY };
    const gX = {
      x: gizmoX + cosY * gizmoLen,
      y: gizmoY - sinY * cosP * gizmoLen,
    };
    const gY = {
      x: gizmoX - sinY * gizmoLen,
      y: gizmoY - cosY * cosP * gizmoLen,
    };
    const gZ = {
      x: gizmoX,
      y: gizmoY + sinP * gizmoLen,
    };

    // Draw View Gizmo Compass Axis
    // X - East (Red)
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gO.x, gO.y);
    ctx.lineTo(gX.x, gX.y);
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.fillText('X (E)', gX.x + 4, gX.y + 3);

    // Y - North (Green)
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gO.x, gO.y);
    ctx.lineTo(gY.x, gY.y);
    ctx.stroke();
    ctx.fillStyle = '#2ecc71';
    ctx.fillText('Y (N)', gY.x - 14, gY.y - 4);

    // Z - TWT Depth (Cyan)
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gO.x, gO.y);
    ctx.lineTo(gZ.x, gZ.y);
    ctx.stroke();
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('Z (TWT)', gZ.x - 10, gZ.y + 12);

    // Center Origin Node
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(gO.x, gO.y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [
    cube,
    horizonState,
    activeSurvey,
    displayModeType,
    lineVisibility,
    pitch,
    yaw,
    zoom,
    panX,
    panY,
    xExag,
    yExag,
    vertExag,
    inlineIdx,
    crosslineIdx,
    timeSliceSample,
    showInlineSlice,
    showCrosslineSlice,
    showTimeSlice,
    showChairCut,
    showTopHorizon,
    showBaseHorizon,
    showIsochoreEnvelope,
    show2DFenceCurtains,
    showTiePillars,
    showLineLabels3D,
    showBasemapFootprint,
    showBoundingBox,
    showGridTicks,
    colorMap,
    gain,
    opacity3D,
    isWireframe,
    isolatedLineId,
    highlightedLineId,
    sceneBounds,
    getColorRGB,
    getHorizonDepthColor,
    getTraceWorldPos,
    measureStart,
    measureEnd,
  ]);

  // =========================================================================
  // MOUSE & POINTER INTERACTION ENGINE
  // =========================================================================

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    // Check if clicked in Gizmo Area (Top Right)
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const gizmoX = rect.width - 60;
    const gizmoY = 60;
    if (Math.hypot(relX - gizmoX, relY - gizmoY) < 40) {
      // Clicked on Compass Gizmo -> Snap to closest orthogonal view or cycle
      handleSetPresetView('iso');
      return;
    }

    // Determine Action by Mouse Button and Active Mode
    const isRightClick = e.button === 2;
    const isMiddleClick = e.button === 1;
    const isShiftPressed = e.shiftKey;
    const isCtrlPressed = e.ctrlKey || e.metaKey;
    const isAltPressed = e.altKey;

    setDragStart({ x: clientX, y: clientY });

    if (isMiddleClick || isRightClick || isShiftPressed || mouseMode === 'pan') {
      setIsPanning(true);
      setIsDragging(false);
      setIsZoomDragging(false);
    } else if (isCtrlPressed || mouseMode === 'zoom') {
      setIsZoomDragging(true);
      setIsDragging(false);
      setIsPanning(false);
    } else if (isAltPressed || mouseMode === 'slice_drag') {
      setActiveSliceDrag('inline');
      setIsDragging(false);
      setIsPanning(false);
    } else if (mouseMode === 'measure') {
      const xNorm = Math.max(0, Math.min(1, relX / rect.width));
      const yNorm = Math.max(0, Math.min(1, relY / rect.height));
      const zNorm = timeSliceSample / Math.max(1, nSamples - 1);
      if (!measureStart || (measureStart && measureEnd)) {
        setMeasureStart({ xNorm, yNorm, zNorm, screenX: relX, screenY: relY, label: 'P1' });
        setMeasureEnd(null);
      } else {
        setMeasureEnd({ xNorm, yNorm, zNorm, screenX: relX, screenY: relY, label: 'P2' });
      }
    } else {
      // Standard Orbit / Rotate Mode
      setIsDragging(true);
      setIsPanning(false);
      setIsZoomDragging(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    if (isDragging) {
      setYaw((prev) => (prev + dx * 0.55) % 360);
      setPitch((prev) => Math.max(-89.9, Math.min(89.9, prev - dy * 0.55)));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isPanning) {
      setPanX((prev) => prev + dx);
      setPanY((prev) => prev + dy);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isZoomDragging) {
      const zoomFactor = dy < 0 ? 1.03 : 0.97;
      setZoom((prev) => Math.max(0.2, Math.min(6.0, prev * zoomFactor)));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeSliceDrag) {
      // Directly slide inline or crossline index with mouse drag
      if (cube && cube.type === '3d') {
        if (Math.abs(dx) > Math.abs(dy)) {
          setInlineIdx((prev) => {
            const next = Math.max(0, Math.min(cube.nInlines - 1, prev + Math.sign(dx)));
            onSliceChanged?.('inline', next);
            return next;
          });
        } else {
          setTimeSliceSample((prev) => {
            const next = Math.max(0, Math.min(cube.nSamples - 1, prev - Math.sign(dy) * 2));
            onSliceChanged?.('timeslice', next);
            return next;
          });
        }
      }
      setDragStart({ x: e.clientX, y: e.clientY });
    }

    // Dynamic Spatial Probe under Cursor
    const rect = canvas.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const curIl = Math.round(xRatio * (nInlines - 1));
    const curXl = Math.round(yRatio * (nCrosslines - 1));
    const curTwt = Math.round(timeSliceSample * sampleRate);

    let probedAmp = 0;
    let worldX: number | undefined;
    let worldY: number | undefined;
    let nearestLineName: string | undefined;
    let nearestCmpIdx: number | undefined;

    if (activeSurvey && activeSurvey.lines.length > 0) {
      const bounds = activeSurvey.bounds;
      const spanX = Math.max(1, bounds.maxX - bounds.minX);
      const spanY = Math.max(1, bounds.maxY - bounds.minY);

      worldX = Math.round(bounds.minX + xRatio * spanX);
      worldY = Math.round(bounds.minY + yRatio * spanY);

      let minDistance = Infinity;
      activeSurvey.lines.forEach((l) => {
        if (lineVisibility[l.id] === false) return;
        const ds = l.dataset;
        const nTraces = ds.nTraces;

        const sampleIdx = Math.min(nTraces - 1, Math.max(0, Math.round(xRatio * (nTraces - 1))));
        const fraction = sampleIdx / Math.max(1, nTraces - 1);
        let lx = l.startX + fraction * (l.endX - l.startX);
        let ly = l.startY + fraction * (l.endY - l.startY);
        if (ds.xCoords && ds.xCoords[sampleIdx] !== undefined) lx = ds.xCoords[sampleIdx];
        if (ds.yCoords && ds.yCoords[sampleIdx] !== undefined) ly = ds.yCoords[sampleIdx];

        const dist = Math.hypot(worldX! - lx, worldY! - ly);
        if (dist < minDistance) {
          minDistance = dist;
          nearestLineName = l.name;
          nearestCmpIdx = sampleIdx + 1;
          const sIdx = Math.min(ds.nSamples - 1, Math.max(0, Math.round(timeSliceSample)));
          probedAmp = Math.round((ds.data[sampleIdx * ds.nSamples + sIdx] || 0) * 1000) / 1000;
        }
      });
    } else if (cube && cube.type === '3d') {
      const idx = (curIl * nCrosslines + curXl) * nSamples + timeSliceSample;
      probedAmp = Math.round((cube.data[idx] || 0) * 1000) / 1000;
    }

    setProbeInfo({
      x: curXl,
      y: curIl,
      z: curTwt,
      il: curIl + 100,
      xl: curXl + 200,
      twtMs: curTwt,
      amplitude: probedAmp,
      worldX,
      worldY,
      lineName: nearestLineName,
      cmpIdx: nearestCmpIdx,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
    setIsZoomDragging(false);
    setActiveSliceDrag(null);
  };

  // Double-Click to Center & Focus on clicked 3D target
  const handleDoubleClick = () => {
    setPanX(0);
    setPanY(0);
    setZoom((prev) => Math.min(prev * 1.25, 4.0));
  };

  // Non-passive wheel event listener to strictly zoom without outer page scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
      setZoom((prev) => Math.max(0.2, Math.min(6.0, prev * zoomFactor)));
    };

    canvas.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheelNative);
    };
  }, []);

  // Snapshot PNG export
  const handleTakeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `GeoVol_3D_Workbench_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-[#071322] border border-[#2a9bb0]/30 rounded-xl overflow-hidden shadow-2xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* 3D Master Workbench Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#0b1c30] px-4 py-2.5 border-b border-[#2a9bb0]/25 text-xs">
        {/* Left Title & Dataset Type Badge */}
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-[#00f0ff]" />
          <span className="font-bold text-[#e8f4f8]">
            Interactive 3D Geoscience Workbench
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1a3d54] text-[#00f0ff] border border-[#2a9bb0]/40">
            {activeSurvey && activeSurvey.lines.length > 0
              ? `2D Survey Network (${activeSurvey.lines.length} Lines)`
              : cube?.type === '3d'
              ? '3D Seismic Cube'
              : '2D Seismic Profile'}
          </span>
        </div>

        {/* Center: Mouse Tool Palette */}
        <div className="flex items-center gap-1 bg-[#071322] p-1 rounded-lg border border-[#2a9bb0]/30">
          <button
            onClick={() => setMouseMode('orbit')}
            className={`px-2 py-1 text-[11px] rounded flex items-center gap-1.5 transition-colors ${
              mouseMode === 'orbit'
                ? 'bg-[#00f0ff] text-[#071322] font-bold shadow-sm'
                : 'text-[#8aafc0] hover:bg-[#162f48] hover:text-white'
            }`}
            title="Orbit / Free 3D Rotation [Left-Click + Drag]"
          >
            <Move3d className="w-3.5 h-3.5" />
            <span>Orbit</span>
          </button>

          <button
            onClick={() => setMouseMode('pan')}
            className={`px-2 py-1 text-[11px] rounded flex items-center gap-1.5 transition-colors ${
              mouseMode === 'pan'
                ? 'bg-[#00f0ff] text-[#071322] font-bold shadow-sm'
                : 'text-[#8aafc0] hover:bg-[#162f48] hover:text-white'
            }`}
            title="Pan / Translate View [Right-Click or Shift+Drag]"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Pan</span>
          </button>

          <button
            onClick={() => setMouseMode('zoom')}
            className={`px-2 py-1 text-[11px] rounded flex items-center gap-1.5 transition-colors ${
              mouseMode === 'zoom'
                ? 'bg-[#00f0ff] text-[#071322] font-bold shadow-sm'
                : 'text-[#8aafc0] hover:bg-[#162f48] hover:text-white'
            }`}
            title="Zoom Dolly [Scroll Wheel or Ctrl+Drag]"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Zoom</span>
          </button>

          <button
            onClick={() => setMouseMode('slice_drag')}
            className={`px-2 py-1 text-[11px] rounded flex items-center gap-1.5 transition-colors ${
              mouseMode === 'slice_drag'
                ? 'bg-[#2ecc71] text-[#071322] font-bold shadow-sm'
                : 'text-[#8aafc0] hover:bg-[#162f48] hover:text-white'
            }`}
            title="Slice Direct-Drag [Alt+Drag to slide slice with mouse]"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Slide</span>
          </button>

          <button
            onClick={() => {
              setMouseMode('measure');
              setMeasureStart(null);
              setMeasureEnd(null);
            }}
            className={`px-2 py-1 text-[11px] rounded flex items-center gap-1.5 transition-colors ${
              mouseMode === 'measure'
                ? 'bg-[#ff0055] text-white font-bold shadow-sm'
                : 'text-[#8aafc0] hover:bg-[#162f48] hover:text-white'
            }`}
            title="3D Spatial Distance & TWT Measurement Tool"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Measure</span>
          </button>
        </div>

        {/* Center: Camera Preset Views */}
        <div className="flex items-center gap-1 bg-[#071322] p-0.5 rounded-lg border border-[#2a9bb0]/20">
          <button
            onClick={() => handleSetPresetView('iso')}
            className="px-2 py-1 text-[10px] rounded hover:bg-[#162f48] text-[#8aafc0] hover:text-white transition-colors"
          >
            3D Iso
          </button>
          <button
            onClick={() => handleSetPresetView('chair')}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              showChairCut ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold' : 'text-[#8aafc0] hover:bg-[#162f48]'
            }`}
          >
            Chair Cut
          </button>
          <button
            onClick={() => handleSetPresetView('top')}
            className="px-2 py-1 text-[10px] rounded hover:bg-[#162f48] text-[#8aafc0] hover:text-white transition-colors"
          >
            Map (Top)
          </button>
          <button
            onClick={() => handleSetPresetView('front')}
            className="px-2 py-1 text-[10px] rounded hover:bg-[#162f48] text-[#8aafc0] hover:text-white transition-colors"
          >
            Inline (Front)
          </button>
          <button
            onClick={() => handleSetPresetView('side')}
            className="px-2 py-1 text-[10px] rounded hover:bg-[#162f48] text-[#8aafc0] hover:text-white transition-colors"
          >
            X-Line (Side)
          </button>
          <button
            onClick={() => handleSetPresetView('bottom')}
            className="px-2 py-1 text-[10px] rounded hover:bg-[#162f48] text-[#8aafc0] hover:text-white transition-colors"
          >
            Underground
          </button>
        </div>

        {/* Right Tools & Exaggeration Controls */}
        <div className="flex items-center gap-2">
          {/* Display Mode Switcher (When Multi-Line Survey exists) */}
          {activeSurvey && activeSurvey.lines.length > 0 && (
            <div className="flex items-center bg-[#071322] p-0.5 rounded-lg border border-[#2a9bb0]/30 text-[10px]">
              <button
                onClick={() => setDisplayModeType('fences_only')}
                className={`px-2 py-1 rounded transition-colors ${
                  displayModeType === 'fences_only'
                    ? 'bg-[#00f0ff] text-[#0a1628] font-bold'
                    : 'text-[#8aafc0] hover:text-white'
                }`}
              >
                Fences
              </button>
              <button
                onClick={() => setDisplayModeType('hybrid')}
                className={`px-2 py-1 rounded transition-colors ${
                  displayModeType === 'hybrid'
                    ? 'bg-[#00f0ff] text-[#0a1628] font-bold'
                    : 'text-[#8aafc0] hover:text-white'
                }`}
              >
                Hybrid
              </button>
              <button
                onClick={() => setDisplayModeType('volume_only')}
                className={`px-2 py-1 rounded transition-colors ${
                  displayModeType === 'volume_only'
                    ? 'bg-[#00f0ff] text-[#0a1628] font-bold'
                    : 'text-[#8aafc0] hover:text-white'
                }`}
              >
                Volume
              </button>
            </div>
          )}

          {/* Spatial Exaggeration Controls (X, Y, Z) */}
          <div className="flex items-center gap-2 bg-[#071322] px-2.5 py-1 rounded-lg border border-[#2a9bb0]/25">
            <div className="flex items-center gap-1">
              <span className="text-[#2ecc71] font-bold text-[10px]" title="X-Axis Exaggeration">X:</span>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={xExag}
                onChange={(e) => setXExag(parseFloat(e.target.value))}
                className="w-10 h-1 bg-[#1a3d54] rounded accent-[#2ecc71]"
              />
              <span className="font-mono text-[#2ecc71] text-[10px] w-4">{xExag.toFixed(1)}x</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#f0a500] font-bold text-[10px]" title="Y-Axis Exaggeration">Y:</span>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={yExag}
                onChange={(e) => setYExag(parseFloat(e.target.value))}
                className="w-10 h-1 bg-[#1a3d54] rounded accent-[#f0a500]"
              />
              <span className="font-mono text-[#f0a500] text-[10px] w-4">{yExag.toFixed(1)}x</span>
            </div>

            <div className="flex items-center gap-1 border-l border-[#2a9bb0]/20 pl-2">
              <span className="text-[#00f0ff] font-bold text-[10px]" title="Vertical (Z) Exaggeration">Z:</span>
              <input
                type="range"
                min="1.0"
                max="6.0"
                step="0.5"
                value={vertExag}
                onChange={(e) => setVertExag(parseFloat(e.target.value))}
                className="w-10 h-1 bg-[#1a3d54] rounded accent-[#00f0ff]"
              />
              <span className="font-mono text-[#00f0ff] text-[10px] w-4">{vertExag.toFixed(1)}x</span>
            </div>
          </div>

          {/* Fit Survey */}
          <button
            onClick={handleFitToSurvey}
            className="px-2.5 py-1 bg-[#162f48] hover:bg-[#00f0ff] hover:text-[#0a1628] text-[#00f0ff] rounded border border-[#2a9bb0]/40 transition-all font-semibold flex items-center gap-1.5 text-[11px] cursor-pointer"
            title="Recenter Camera & Fit to Viewport"
          >
            <Focus className="w-3.5 h-3.5" />
            <span>Fit</span>
          </button>

          {/* Survey Manager Drawer Toggle */}
          {activeSurvey && activeSurvey.lines.length > 0 && (
            <button
              onClick={() => setShowSurveyDrawer(!showSurveyDrawer)}
              className={`px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5 text-[11px] font-semibold ${
                showSurveyDrawer
                  ? 'bg-[#00f0ff] text-[#0a1628] border-[#00f0ff] shadow-lg shadow-[#00f0ff]/20'
                  : 'bg-[#071322] border-[#2a9bb0]/40 text-[#00f0ff] hover:bg-[#162f48]'
              }`}
              title="2D Survey Lines & Cross-Ties Manager"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                Lines ({Object.values(lineVisibility).filter(Boolean).length}/{activeSurvey.lines.length})
              </span>
            </button>
          )}

          {/* Turntable Auto-Rotate */}
          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className={`p-1.5 rounded border transition-colors flex items-center gap-1 text-[11px] ${
              isAnimating
                ? 'bg-[#2ecc71]/20 border-[#2ecc71] text-[#2ecc71]'
                : 'bg-[#071322] border-[#2a9bb0]/30 text-[#8aafc0] hover:text-white'
            }`}
            title="Toggle Turntable Animation"
          >
            {isAnimating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Tie Pillars & Labels Toggles */}
          <div className="flex items-center gap-2 bg-[#071322] px-2 py-1 rounded-lg border border-[#2a9bb0]/25 text-[10px]">
            <label className="flex items-center gap-1.5 text-[#8aafc0] hover:text-[#2ecc71] cursor-pointer select-none" title="Toggle 3D Vertical Tie Line Pillars & Intersection Nodes">
              <input
                type="checkbox"
                checked={showTiePillars}
                onChange={(e) => setShowTiePillars(e.target.checked)}
                className="rounded accent-[#2ecc71] cursor-pointer"
              />
              <span className={showTiePillars ? 'text-[#2ecc71] font-semibold' : ''}>Tie Pillars</span>
            </label>
            <label className="flex items-center gap-1.5 text-[#8aafc0] hover:text-[#00f0ff] cursor-pointer select-none border-l border-[#2a9bb0]/20 pl-2" title="Toggle 3D Line Name Labels">
              <input
                type="checkbox"
                checked={showLineLabels3D}
                onChange={(e) => setShowLineLabels3D(e.target.checked)}
                className="rounded accent-[#00f0ff] cursor-pointer"
              />
              <span className={showLineLabels3D ? 'text-[#00f0ff] font-semibold' : ''}>Labels</span>
            </label>
          </div>

          {/* Wireframe */}
          <button
            onClick={() => setIsWireframe(!isWireframe)}
            className={`px-2 py-1 rounded text-[11px] border transition-colors ${
              isWireframe ? 'bg-[#00f0ff] text-[#0a1628] font-bold border-[#00f0ff]' : 'bg-[#071322] text-[#8aafc0] border-[#2a9bb0]/30'
            }`}
          >
            Wireframe
          </button>

          {/* Snapshot */}
          <button
            onClick={handleTakeSnapshot}
            className="p-1.5 bg-[#071322] hover:bg-[#162f48] text-[#8aafc0] hover:text-white rounded border border-[#2a9bb0]/30 transition-colors"
            title="Export 3D Snapshot PNG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleFitToSurvey}
            className="p-1.5 bg-[#071322] hover:bg-[#162f48] text-[#8aafc0] hover:text-white rounded border border-[#2a9bb0]/30 transition-colors"
            title="Reset Camera Orientation"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-[#071322] hover:bg-[#162f48] text-[#8aafc0] hover:text-white rounded border border-[#2a9bb0]/30 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Viewport Canvas Area */}
      <div className="relative flex-1 bg-[#040913] select-none overflow-hidden touch-none overscroll-contain">
        <canvas
          ref={canvasRef}
          width={isFullscreen ? window.innerWidth : 980}
          height={isFullscreen ? window.innerHeight - 130 : initialHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-full h-full block touch-none ${
            mouseMode === 'pan'
              ? isPanning ? 'cursor-grabbing' : 'cursor-grab'
              : mouseMode === 'zoom'
              ? 'cursor-ns-resize'
              : mouseMode === 'measure'
              ? 'cursor-crosshair'
              : mouseMode === 'slice_drag'
              ? 'cursor-ew-resize'
              : isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        />

        {/* Top-Left Floating Spatial Probe HUD */}
        <div className="absolute top-3 left-3 bg-[#071322]/90 border border-[#2a9bb0]/40 rounded-lg p-2.5 font-mono text-[11px] text-[#e8f4f8] shadow-2xl backdrop-blur-md space-y-1 max-w-sm pointer-events-none z-10">
          <div className="text-[10px] text-[#8aafc0] uppercase tracking-wider font-sans font-bold flex items-center justify-between border-b border-[#2a9bb0]/20 pb-1 mb-1">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#00f0ff]" /> 3D Spatial Probe HUD
            </span>
            <span className="text-[#00f0ff] font-mono">{probeInfo?.twtMs || 0} ms</span>
          </div>

          {probeInfo?.worldX !== undefined && probeInfo?.worldY !== undefined && (
            <div className="flex justify-between gap-3 text-[10px]">
              <span className="text-[#8aafc0]">Easting (X):</span>
              <span className="text-[#2ecc71] font-bold">{probeInfo.worldX} m</span>
              <span className="text-[#8aafc0]">Northing (Y):</span>
              <span className="text-[#f0a500] font-bold">{probeInfo.worldY} m</span>
            </div>
          )}

          {probeInfo?.lineName && (
            <div className="flex justify-between gap-3 text-[10px]">
              <span className="text-[#8aafc0]">Nearest Line:</span>
              <span className="text-[#00f0ff] font-bold truncate max-w-[150px]">
                {probeInfo.lineName} {probeInfo.cmpIdx ? `(CMP ${probeInfo.cmpIdx})` : ''}
              </span>
            </div>
          )}

          {cube?.type === '3d' && (
            <div className="flex justify-between gap-3 text-[10px]">
              <span className="text-[#8aafc0]">Grid (IL / XL):</span>
              <span className="text-[#00f0ff] font-bold">
                {probeInfo?.il || 100} / {probeInfo?.xl || 200}
              </span>
            </div>
          )}

          <div className="flex justify-between gap-3 text-[10px]">
            <span className="text-[#8aafc0]">Amplitude:</span>
            <span
              className={`font-bold ${
                (probeInfo?.amplitude || 0) > 0 ? 'text-[#00f0ff]' : 'text-[#ff5555]'
              }`}
            >
              {probeInfo?.amplitude?.toFixed(3) || '0.000'}
            </span>
          </div>

          <div className="text-[9px] text-[#52798e] pt-0.5 border-t border-[#2a9bb0]/10 flex justify-between">
            <span>Yaw: {Math.round(yaw)}° | Pitch: {Math.round(pitch)}°</span>
            <span>Zoom: {zoom.toFixed(2)}x</span>
          </div>
        </div>

        {/* Bottom-Left Mouse Control Shortcuts & Tips Banner */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
          <button
            onClick={() => setShowMouseHelp(!showMouseHelp)}
            className="px-2 py-1 bg-[#071322]/90 hover:bg-[#162f48] border border-[#2a9bb0]/40 rounded-lg text-[#8aafc0] hover:text-[#00f0ff] text-[10px] flex items-center gap-1.5 backdrop-blur-sm transition-colors shadow-lg cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>Mouse Controls Help</span>
            {showMouseHelp ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>

          {showMouseHelp && (
            <div className="bg-[#071322]/95 border border-[#2a9bb0]/50 rounded-lg p-2.5 text-[10px] text-[#8aafc0] space-y-1 backdrop-blur-md shadow-2xl animate-in fade-in">
              <div className="font-bold text-white mb-1 text-[11px]">Mouse & Gesture Navigation:</div>
              <div>• <strong className="text-[#00f0ff]">Left Drag</strong>: 360° Free 3D Orbit (Yaw & Pitch)</div>
              <div>• <strong className="text-[#00f0ff]">Right Drag / Shift + Drag</strong>: Pan Scene</div>
              <div>• <strong className="text-[#00f0ff]">Wheel / Ctrl + Drag</strong>: Smooth Zoom In/Out</div>
              <div>• <strong className="text-[#2ecc71]">Alt + Drag</strong>: Directly Slide Slice with Mouse</div>
              <div>• <strong className="text-[#ff0055]">Double Click</strong>: Recenter and Focus Target</div>
            </div>
          )}
        </div>

        {/* Survey Lines Drawer (Slide-out panel on right side) */}
        {showSurveyDrawer && activeSurvey && (
          <div className="absolute top-0 right-0 bottom-0 w-80 bg-[#071322]/98 border-l border-[#2a9bb0]/40 p-4 shadow-2xl flex flex-col z-20 backdrop-blur-lg">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a9bb0]/30 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00f0ff]" />
                <h3 className="font-bold text-sm text-white">2D Survey Profiles</h3>
              </div>
              <button
                onClick={() => setShowSurveyDrawer(false)}
                className="p-1 hover:bg-[#162f48] text-[#8aafc0] hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-[#8aafc0] absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter profiles..."
                value={surveySearchQuery}
                onChange={(e) => setSurveySearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#091b30] border border-[#2a9bb0]/30 rounded-lg text-xs text-white placeholder-[#52798e] focus:outline-none focus:border-[#00f0ff]"
              />
            </div>

            {/* Quick Actions (Show All / Hide All) */}
            <div className="flex items-center justify-between mb-3 text-[11px]">
              <button
                onClick={() => {
                  const allTrue: Record<string, boolean> = {};
                  activeSurvey.lines.forEach((l) => (allTrue[l.id] = true));
                  setLineVisibility(allTrue);
                  setIsolatedLineId(null);
                }}
                className="text-[#00f0ff] hover:underline cursor-pointer"
              >
                Show All ({activeSurvey.lines.length})
              </button>
              <button
                onClick={() => {
                  const allFalse: Record<string, boolean> = {};
                  activeSurvey.lines.forEach((l) => (allFalse[l.id] = false));
                  setLineVisibility(allFalse);
                }}
                className="text-[#8aafc0] hover:text-white cursor-pointer"
              >
                Hide All
              </button>
            </div>

            {/* Line List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {activeSurvey.lines
                .filter((l) => l.name.toLowerCase().includes(surveySearchQuery.toLowerCase()))
                .map((line) => {
                  const isVisible = lineVisibility[line.id] !== false;
                  const isIsolated = isolatedLineId === line.id;
                  const isHovered = highlightedLineId === line.id;

                  return (
                    <div
                      key={line.id}
                      onMouseEnter={() => setHighlightedLineId(line.id)}
                      onMouseLeave={() => setHighlightedLineId(null)}
                      className={`p-2.5 rounded-lg border text-xs transition-all ${
                        isIsolated
                          ? 'bg-[#00f0ff]/15 border-[#00f0ff]'
                          : isHovered
                          ? 'bg-[#162f48] border-[#00f0ff]/60'
                          : 'bg-[#091b30] border-[#2a9bb0]/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: line.color || '#00f0ff' }}
                          />
                          <span className="font-semibold text-white truncate max-w-[140px]">
                            {line.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setLineVisibility((prev) => ({ ...prev, [line.id]: !isVisible }))
                            }
                            className={`p-1 rounded hover:bg-[#1a3d54] ${
                              isVisible ? 'text-[#00f0ff]' : 'text-[#52798e]'
                            }`}
                            title={isVisible ? 'Hide Line' : 'Show Line'}
                          >
                            {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => setIsolatedLineId(isIsolated ? null : line.id)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isIsolated
                                ? 'bg-[#00f0ff] text-[#071322]'
                                : 'bg-[#1a3d54] text-[#8aafc0] hover:text-white'
                            }`}
                            title="Solo / Isolate Profile"
                          >
                            Solo
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#8aafc0] font-mono">
                        <span>{line.dataset.nTraces} Traces</span>
                        <span>Az: {line.azimuthDeg}°</span>
                        <span>{line.lengthM}m</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Interactive Slicing & Visual Properties Bar */}
      <div className="bg-[#0b1c30] px-4 py-3 border-t border-[#2a9bb0]/25 flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Orthogonal Slices Controls (When 3D Cube or Hybrid) */}
        {cube && cube.type === '3d' && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Inline Slider */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInlineSlice}
                onChange={(e) => setShowInlineSlice(e.target.checked)}
                className="rounded accent-[#00f0ff] cursor-pointer"
                title="Toggle Inline Slice"
              />
              <span className="text-[#8aafc0] font-semibold">Inline:</span>
              <input
                type="range"
                min="0"
                max={cube.nInlines - 1}
                value={inlineIdx}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setInlineIdx(val);
                  onSliceChanged?.('inline', val);
                }}
                className="w-24 h-1.5 bg-[#1a3d54] rounded accent-[#00f0ff] cursor-pointer"
              />
              <span className="font-mono text-[#00f0ff] w-8">
                {cube.ilines ? cube.ilines[inlineIdx] : inlineIdx + 100}
              </span>
            </div>

            {/* Crossline Slider */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showCrosslineSlice}
                onChange={(e) => setShowCrosslineSlice(e.target.checked)}
                className="rounded accent-[#f0a500] cursor-pointer"
                title="Toggle Crossline Slice"
              />
              <span className="text-[#8aafc0] font-semibold">X-Line:</span>
              <input
                type="range"
                min="0"
                max={cube.nCrosslines - 1}
                value={crosslineIdx}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCrosslineIdx(val);
                  onSliceChanged?.('crossline', val);
                }}
                className="w-24 h-1.5 bg-[#1a3d54] rounded accent-[#f0a500] cursor-pointer"
              />
              <span className="font-mono text-[#f0a500] w-8">
                {cube.xlines ? cube.xlines[crosslineIdx] : crosslineIdx + 200}
              </span>
            </div>

            {/* Time Slice Slider */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showTimeSlice}
                onChange={(e) => setShowTimeSlice(e.target.checked)}
                className="rounded accent-[#2ecc71] cursor-pointer"
                title="Toggle Time/Depth Slice"
              />
              <span className="text-[#8aafc0] font-semibold">TWT:</span>
              <input
                type="range"
                min="0"
                max={cube.nSamples - 1}
                value={timeSliceSample}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setTimeSliceSample(val);
                  onSliceChanged?.('timeslice', val);
                }}
                className="w-24 h-1.5 bg-[#1a3d54] rounded accent-[#2ecc71] cursor-pointer"
              />
              <span className="font-mono text-[#2ecc71] w-12">
                {Math.round(timeSliceSample * cube.sampleRate)}ms
              </span>
            </div>
          </div>
        )}

        {/* Right Colormap & Opacity Controls */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Colormap Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[#8aafc0]">Colormap:</span>
            <select
              value={colorMap}
              onChange={(e) => setColorMap(e.target.value as any)}
              className="bg-[#071322] border border-[#2a9bb0]/40 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#00f0ff]"
            >
              <option value="RdBu">RdBu (Standard)</option>
              <option value="Seismic">Seismic (BWR)</option>
              <option value="Turbo">Turbo (High-Res)</option>
              <option value="Thermal">Thermal</option>
              <option value="Gray">Grayscale</option>
            </select>
          </div>

          {/* Gain Slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#8aafc0]">Gain:</span>
            <input
              type="range"
              min="0.4"
              max="3.0"
              step="0.1"
              value={gain}
              onChange={(e) => setGain(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-[#1a3d54] rounded accent-[#00f0ff]"
            />
            <span className="font-mono text-[#00f0ff] w-6">{gain.toFixed(1)}</span>
          </div>

          {/* Opacity Slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#8aafc0]">Opacity:</span>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={opacity3D}
              onChange={(e) => setOpacity3D(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-[#1a3d54] rounded accent-[#00f0ff]"
            />
            <span className="font-mono text-[#00f0ff] w-8">{Math.round(opacity3D * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
