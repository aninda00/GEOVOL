# 🛢️ GeoVol 3D Studio — Reservoir Volumetrics & Seismic Analysis Platform

A professional-grade geoscience platform for calculating **OIIP (Oil Initially In Place)** and **GIIP (Gas Initially In Place)** from single 2D profiles, multi-line 2D surveys, and 3D seismic volumes. GeoVol features automated horizon candidate extraction, seed-based auto-tracking, LAS well log petrophysics, 10,000-run Monte Carlo uncertainty analysis, interactive 3D WebGL rendering, and publication-ready PDF/Excel report exports.

---

## 🗺️ Complete System Architecture & Pipeline Flow

```
+---------------------------------------------------------------------------------------------------+
|                                 GEOVOL WORKFLOW PIPELINE                                          |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ SEG-Y Files (.sgy) ]          [ LAS 2.0 Well Logs (.las) ]         [ Fluid & Recovery Params ] |
|  - 2D Single Profiles             - Gamma Ray (GR), Sonic (DT)         - Oil FVF (Bo)             |
|  - Multi-Line 2D Surveys          - Density (RHOB), Res (ILD)          - Gas FVF (Bg)             |
|  - 3D Volumes                     - Neutron (NPHI)                     - Gas Expansion Factor     |
|          │                                     │                                  │               |
|          ▼                                     ▼                                  │               |
|  ┌───────────────────────┐            ┌───────────────────────┐                   │               |
|  │  PANEL 1: SEISMIC QC  │            │ PANEL 3: PETROPHYSICS │                   │               |
|  │ ───────────────────── │            │ ───────────────────── │                   │               |
|  │ • IBM/IEEE Float Read │            │ • Vshale (Larionov)   │                   │               |
|  │ • EBCDIC/Binary Hdr   │            │ • Effective Phi (φe)  │                   │               |
|  │ • Average Trace & FFT │            │ • Archie Sw           │                   │               |
|  │ • Envelope & Reflect. │            │ • Cutoffs & Net Pay   │                   │               |
|  │ • 2D/3D Multi-Line IDW│            │ • P10/P50/P90 Stats   │                   │               |
|  └───────────┬───────────┘            └───────────┬───────────┘                   │               |
|              │                                    │                               │               |
|              ▼                                    │                               │               |
|  ┌───────────────────────┐                        │                               │               |
|  │ PANEL 2: HORIZON & GRV│                        │                               │               |
|  │ ───────────────────── │                        │                               │               |
|  │ • Seed Auto-Tracking  │                        │                               │               |
|  │ • Top & Base Surface  │                        │                               │               |
|  │ • Velocity Model (T-D)│                        │                               │               |
|  │ • Isochore Thickness  │                        │                               │               |
|  │ • GRV Numerical Int.  │                        │                               │               |
|  └───────────┬───────────┘                        │                               │               |
|              │                                    │                               │               |
|              └───────────────────┬────────────────┘                               │               |
|                                  │                                                │               |
|                                  ▼                                                ▼               |
|                      ┌──────────────────────────────────────────────────────────────┐             |
|                      │               PANEL 4: MONTE CARLO VOLUMETRICS               │             |
|                      │ ──────────────────────────────────────────────────────────── │             |
|                      │ • Lognormal GRV + PERT/Triangular Sampling                   │             |
|                      │ • 10,000 Stochastic Iterations                               │             |
|                      │ • P10 / P50 / P90 Distributions (OIIP & GIIP)                │             |
|                      │ • Pearson Correlation Sensitivity (Tornado Chart)            │             |
|                      └──────────────────────────────┬───────────────────────────────┘             |
|                                                     │                                             |
|                                                     ▼                                             |
|                      ┌──────────────────────────────────────────────────────────────┐             |
|                      │                PANEL 5: REPORT & DATA EXPORT                 │             |
|                      │ ──────────────────────────────────────────────────────────── │             |
|                      │ • Executive PDF Prospectus with Embedded Diagrams & Maps     │             |
|                      │ • Formatted Multi-Tab Excel Workbook (.xlsx)                 │             |
|                      │ • Horizon Surface Grids (CSV / GeoTIFF / XYZ ASCII)          │             |
|                      └──────────────────────────────────────────────────────────────┘             |
+---------------------------------------------------------------------------------------------------+
```

---

## 🔬 Panel 1: Deep Dive into Seismic Engine Mechanisms

### 1. How the Average Amplitude & Frequency Box Works

The **Average Amplitude & Frequency Spectrum** box provides instantaneous quality control (QC) of the seismic frequency bandwidth, dynamic range, and vertical reflectivity profile across all traces in the dataset.

```
                           MATHEMATICAL SIGNAL FLOW
                           
  All Traces [T_1, T_2, ..., T_N]
                │
                ▼ Stacking / Ensemble Averaging: S(t) = (1/N) * Σ T_i(t)
     [ Mean Amplitude Trace S(t) ] ───────► (Shown in Cyan Line)
                │
                ▼ Discrete Hilbert Transform (31-tap FIR Filter)
     [ Quadrature Component Q(t) = H{S(t)} ]
                │
                ▼ Instantaneous Energy Envelope: E(t) = sqrt( S(t)^2 + Q(t)^2 )
     [ Complex Seismic Envelope E(t) ] ───► (Shown in Gold Dashed Line)
```

```
+──────────────────────────────────────────────────────────────────────────────+
| AVERAGE AMPLITUDE & FREQUENCY QC SPECTRUM                                    |
+──────────────────────────────────────────────────────────────────────────────+
| Amp                                                                          |
| +1.0 ┤      ╭───╮              ╭──────╮                 Legend:              |
|      │ ╭─╮  │   │  ╭──╮        │      │   ╭─╮        ─── Average Trace       |
|  0.0 ┼─┼─┼──┼───┼──┼──┼────────┼──────┼───┼─┼───     --- Envelope Trace      |
|      │   ╰──╯   ╰──╯  ╰──╯     ╰──────╯   ╰─╯        │ Pin Horizon Candidate |
| -1.0 ┤                                                                       |
|      └───┬────────┬────────┬────────┬────────┬─────────────────────────────► |
|         0ms     500ms    1000ms   1500ms   2000ms (Two-Way Travel Time)      |
|          ▲                 ▲                  ▲                              |
|         Pin 1            Pin 2              Pin 3                            |
|       (480ms)          (1120ms)           (1840ms)                           |
+──────────────────────────────────────────────────────────────────────────────+
```

#### Step-by-Step Computational Workflow:
1. **Trace Stacking / Mean Trace Calculation:**
   Given a dataset with $N$ traces and $M$ vertical time samples, the mean amplitude $S(s)$ at sample index $s$ is:
   $$\bar{S}(s) = \frac{1}{N} \sum_{t=1}^{N} \text{Data}(t, s)$$
   This suppresses random incoherent acquisition noise while amplifying laterally continuous stratigraphic reflectors.

2. **Instantaneous Complex Envelope ($\mathcal{H}$-Transform):**
   The real seismic trace $\bar{S}(t)$ is transformed into an analytic complex signal $Z(t) = \bar{S}(t) + i Q(t)$, where $Q(t) = \mathcal{H}\{\bar{S}(t)\}$ is computed using an odd-symmetric 31-tap Hilbert finite impulse response (FIR) filter:
   $$h(k) = \begin{cases} \frac{2}{\pi k} & \text{for odd } k \\ 0 & \text{for even } k \end{cases}$$
   The envelope magnitude $E(t)$ is then calculated:
   $$E(t) = \sqrt{\bar{S}(t)^2 + Q(t)^2}$$
   The envelope is strictly positive and represents instantaneous reflection energy regardless of phase.

3. **Bandwidth & Nyquist Frequency QC:**
   The temporal sampling rate $\Delta t$ determines the maximum resolvable seismic frequency (Nyquist limit):
   $$f_{\text{Nyquist}} = \frac{1000}{2 \cdot \Delta t} \text{ Hz}$$
   *(e.g., for $\Delta t = 4\text{ ms}$, $f_{\text{Nyquist}} = 125\text{ Hz}$; for $\Delta t = 2\text{ ms}$, $f_{\text{Nyquist}} = 250\text{ Hz}$)*.

---

### 2. How Auto-Reflector Candidates Detection Works

The automated reflector detection engine identifies high-confidence reservoir boundaries (tops and bases) without requiring manual trace-by-trace inspection.

```
                           DETECTION ALGORITHM
                           
    Raw Envelope E(t)
          │
          ▼ 5-Point Moving Average Window: E_smooth(t) = (1/5) * Σ E(t + k)
    Smoothed Envelope E_smooth(t)
          │
          ▼ Dynamic Multi-Zone Background Normalization (8 Time Windows)
    Normalized Energy Profile E_norm(t)
          │
          ▼ 5-Point Local Extrema Peak Finder: E(t) > E(t±1) & E(t) > E(t±2)
    Detected Peak Sample Indices [p_1, p_2, ..., p_K]
          │
          ▼ Confidence Scoring & SNR Ranking
    Top 8 Reflector Horizon Candidates (Ranked with Time, Amplitude & Confidence)
```

```
+──────────────────────────────────────────────────────────────────────────────+
| AUTO-DETECTED REFLECTOR CANDIDATES LISTING                                   |
+──────────────────────────────────────────────────────────────────────────────+
|  [●] Candidate #1: Top Reservoir Sand A      TWT: 1120 ms    Conf: 94%   [+] |
|      Polarity: Positive Peak (+0.84)         SNR: 18.4 dB   Sample #280      |
|                                                                              |
|  [●] Candidate #2: Base Reservoir / OWC      TWT: 1240 ms    Conf: 89%   [+] |
|      Polarity: Negative Trough (-0.72)       SNR: 15.2 dB   Sample #310      |
|                                                                              |
|  [●] Candidate #3: Regional Unconformity     TWT: 760 ms     Conf: 82%   [+] |
|      Polarity: Positive Peak (+0.61)         SNR: 12.8 dB   Sample #190      |
+──────────────────────────────────────────────────────────────────────────────+
```

#### Detailed Criteria for Horizon Picking:
- **Depth-Dependent Gain Normalization:** Seismic signals attenuate with depth due to spherical divergence and inelastic absorption ($Q$-factor). GeoVol splits the trace into 8 overlapping temporal zones, calculates the local peak energy in each zone, and normalizes the signal. This ensures deep, attenuated reservoir reflectors receive equal picking weight compared to shallow water-bottom multiples.
- **Strict Peak Isolation:** A point is recognized as a candidate reflector if and only if it exceeds both adjacent points ($t \pm 1$) and secondary neighbors ($t \pm 2$), and its amplitude exceeds 3% of the global trace maximum.
- **Confidence Ranking:** The confidence score ($15\% - 99\%$) is computed from the normalized envelope continuity and local signal-to-noise ratio:
  $$\text{Confidence} = \min\left(99, \text{round}\left(E_{\text{norm}}(s) \times 85 + 15\right)\right)$$

---

### 3. SEG-Y Parser & Multi-Line 2D Survey Engine

GeoVol incorporates a web-native binary SEG-Y engine supporting both standard Revision 1.0 and legacy formats:

```
+──────────────────────────────────────────────────────────────────────────────+
| SEG-Y FILE BINARY ARCHITECTURE                                               |
+──────────────────────────────────────────────────────────────────────────────+
| Bytes 0000 - 3200 : 3200-Byte Textual Header (EBCDIC or ASCII, 40x80 lines)  |
| Bytes 3200 - 3600 : 400-Byte Binary File Header (Sample Rate dt, Format Code)|
| Bytes 3600 - End  : Sequential Traces:                                       |
|                     ┌──────────────────────────────────────────────────────┐ |
|                     │ 240-Byte Standard Trace Header (IL, XL, SP, CDP, X,Y)│ |
|                     ├──────────────────────────────────────────────────────┤ |
|                     │ N Samples × 4 Bytes Data (IBM Float or IEEE Float)   │ |
|                     └──────────────────────────────────────────────────────┘ |
+──────────────────────────────────────────────────────────────────────────────+
```

- **IBM 32-bit Float Decoder:** Decodes legacy IBM floating point format (base-16 exponent with sign bit and 24-bit fraction):
  $$\text{Value} = (-1)^{\text{sign}} \times \frac{\text{Mantissa}}{2^{24}} \times 16^{(\text{Exponent} - 64)}$$
- **Auto-Endian Detection:** Automatically detects Big-Endian vs. Little-Endian encoding by evaluating header integrity.
- **Multi-Line 2D Survey Spatial Intersections:** Computes geographic cross-tie intersections between arbitrary 2D lines using 2D parametric vector intersection math:
  $$P_A(u) = A_1 + u(A_2 - A_1), \quad P_B(v) = B_1 + v(B_2 - B_1), \quad u, v \in [0, 1]$$
- **Inverse Distance Weighting (IDW) 3D Gridding:** Synthesizes an interpolated 3D pseudo-volume from irregular multi-line 2D grids for volume slicing and continuous spatial modeling.

---

## 🏔️ Panel 2: Horizon Auto-Tracking & Gross Rock Volume (GRV)

```
                            HORIZON AUTO-TRACKING
                            
       Trace 1          Trace 2          Trace 3          Trace 4
          │                │                │                │
  ───┬────┼──────────┬─────┼──────────┬─────┼──────────┬─────┼──── Top Horizon
     │    │  h_1     │     │  h_2     │     │  h_3     │     │     (Isochore
     │    │          │     │          │     │          │     │      Thickness)
  ───┴────┼──────────┴─────┼──────────┴─────┼──────────┴─────┼──── Base Horizon
          │                │                │                │
```

1. **Seed-Guided Phase-Locked Auto-Tracker:**
   Starting from a user-selected seed sample or an auto-detected reflector, the tracking engine searches within an adaptive temporal search window ($[-W, +W]$ samples) on adjacent traces. It maximizes the objective function:
   $$\text{Score}(s) = \text{PolarityMatch}(s) - \lambda \cdot |s - s_{\text{seed}}|$$
2. **Time-to-Depth Conversion:**
   Two-Way Travel Time ($\text{TWT}$ in milliseconds) is converted to True Vertical Depth Subsea ($\text{TVDSS}$ in meters or feet) using constant, linear, or layer-cake interval velocity models:
   $$Z(x, y) = \frac{\text{TWT}(x, y)}{2000} \times V_{\text{interval}}$$
3. **Isochore & Numerical GRV Integration:**
   Gross Rock Volume is calculated by integrating across all grid cells bounded by the structural trap / fluid contact:
   $$h(x, y) = \max(0, Z_{\text{base}}(x, y) - Z_{\text{top}}(x, y))$$
   $$\text{GRV} = \sum_{x} \sum_{y} \Delta x \cdot \Delta y \cdot h(x, y)$$
   *(Converted into Acre-Feet: $1 \text{ m}^3 = 0.000810714 \text{ acre-ft}$)*.

---

## 🧪 Panel 3: Petrophysical Evaluation

GeoVol processes standard CWLS LAS 2.0 well log files (Gamma Ray, Density, Neutron, Sonic, Resistivity, Caliper):

```
+──────────────────────────────────────────────────────────────────────────────+
| PETROPHYSICAL INTERPRETATION PIPELINE                                        |
+──────────────────────────────────────────────────────────────────────────────+
| 1. Shale Volume (Vsh)    : Linear, Larionov (Tertiary/Older), or Stieber     |
|                            Vsh = (GR - GR_sand) / (GR_shale - GR_sand)       |
| 2. Total Porosity (φt)   : φ_density = (ρ_matrix - ρ_bulk) / (ρ_m - ρ_fluid) |
| 3. Effective Porosity(φe): φe = φt * (1 - Vsh)                               |
| 4. Water Saturation (Sw) : Archie Equation: Sw = ( (a * Rw) / (φe^m * Rt) )^(1/n)
| 5. Net Pay Cutoffs       : Net Pay = h * (Vsh < 0.35 & φe > 0.10 & Sw < 0.60) |
+──────────────────────────────────────────────────────────────────────────────+
```

---

## 🧪 Panel 3: Multi-Well Petrophysics & Spatial Log Correlation

```
+──────────────────────────────────────────────────────────────────────────────+
| MULTI-WELL LOG CORRELATION FENCE DIAGRAM                                     |
+──────────────────────────────────────────────────────────────────────────────+
|   WELL ALPHA-01             WELL BETA-02             WELL GAMMA-03           |
| (E:452.1k, N:6784.2k)    (E:454.3k, N:6786.1k)    (E:449.8k, N:6782.5k)      |
|                                                                              |
|      GR     Φ    Sw           GR     Φ    Sw           GR     Φ    Sw        |
|     ┌───┐ ┌───┐ ┌───┐        ┌───┐ ┌───┐ ┌───┐        ┌───┐ ┌───┐ ┌───┐      |
|     │ ~ │ │ | │ │ | │        │ ~ │ │ | │ │ | │        │ ~ │ │ | │ │ | │      |
| ════╪═══╪═╪═══╪═╪═══╪════════╪═══╪═╪═══╪═╪═══╪════════╪═══╪═╪═══╪═╪═══╪══════ TOP RESERVOIR SAND
|     │▓▓▓│ │▓▓▓│ │▓▓▓│        │▓▓▓│ │▓▓▓│ │▓▓▓│        │▓▓▓│ │▓▓▓│ │▓▓▓│      |
|     │▓▓▓│ │▓▓▓│ │▓▓▓│        │▓▓▓│ │▓▓▓│ │▓▓▓│        │▓▓▓│ │▓▓▓│ │▓▓▓│ (Pay)|
|     │▓▓▓│ │▓▓▓│ │▓▓▓│        │▓▓▓│ │▓▓▓│ │▓▓▓│        │▓▓▓│ │▓▓▓│ │▓▓▓│      |
| ════╪═══╪═╪═══╪═╪═══╪════════╪═══╪═╪═══╪═╪═══╪════════╪═══╪═╪═══╪═╪═══╪══════ BASE RESERVOIR / OWC
|     │ ~ │ │ | │ │ | │        │ ~ │ │ | │ │ | │        │ ~ │ │ | │ │ | │      |
|     └───┘ └───┘ └───┘        └───┘ └───┘ └───┘        └───┘ └───┘ └───┘      |
|   Φ=24.5% Sw=21% 35m       Φ=27.2% Sw=18% 42m       Φ=20.5% Sw=29% 28m       |
+──────────────────────────────────────────────────────────────────────────────+
```

### 1. Multi-LAS Parsing & Well Header Extraction
When multiple `.las` or `.las2` files are uploaded, the parser extracts both the curve series ($\text{GR}, \phi_e, S_w, R_t, \rho_b, \Delta t$) and the `~WELL` / `~PARAMETER` section metadata:
- **Surface Coordinates**: Easting ($X$), Northing ($Y$), Longitude, Latitude.
- **Seismic Ties**: 3D Inline, Crossline, 2D Line Name, CDP / Shotpoint.
- **Reference Datums**: Kelly Bushing ($\text{KB}$) Elevation, Ground Level ($\text{GL}$), Water Depth ($\text{WD}$).

### 2. Spatial Property Synthesis & Weighting Models
To translate discrete well observations into field-scale parameters for Monte Carlo volumetrics, three spatial averaging schemes are available:

1. **Net-Thickness Weighted Average** (Default):
   $$\bar{\phi} = \frac{\sum_{i=1}^{N} h_{\text{net},i} \cdot \phi_i}{\sum_{i=1}^{N} h_{\text{net},i}}, \quad \bar{S}_w = \frac{\sum_{i=1}^{N} h_{\text{net},i} \cdot \phi_i \cdot S_{w,i}}{\sum_{i=1}^{N} h_{\text{net},i} \cdot \phi_i}, \quad \overline{\text{NTG}} = \frac{\sum_{i=1}^{N} h_{\text{net},i}}{\sum_{i=1}^{N} h_{\text{gross},i}}$$

2. **Inverse Distance Weighting (IDW Spatial Correlation)**:
   Weights each well by its inverse squared distance $d_i^2$ to the seismic reservoir centroid:
   $$w_i = \frac{1}{(d_i)^2} = \frac{1}{(X_i - X_{\text{centroid}})^2 + (Y_i - Y_{\text{centroid}})^2}, \quad \bar{P} = \frac{\sum w_i P_i}{\sum w_i}$$

3. **Arithmetic Mean**:
   $$\bar{P} = \frac{1}{N} \sum_{i=1}^{N} P_i$$

### 3. Datum Alignment Modes:
- **Structural (True Subsea TVD)**: Preserves real regional structural dip, fault block displacements, and anticlinal geometry.
- **Stratigraphic (Flatten on Top Sand)**: Flattens the top reservoir marker across all wells to enable clear comparative analysis of internal facies transitions, channel sand quality, and thickness variations.

---

## 🧭 Panel 3.1: 3D Directional Well Deviation Surveys & Minimum Curvature Engine

GeoVol incorporates an ISO 19389 / API standard **Minimum Curvature Method** trajectory calculation engine to accurately position deviated, s-curve, and horizontal well paths in 3D seismic coordinates.

```
+──────────────────────────────────────────────────────────────────────────────+
| 3D DIRECTIONAL TRAJECTORY CALCULATION (MINIMUM CURVATURE METHOD)             |
+──────────────────────────────────────────────────────────────────────────────+
|  Surface Wellhead (X_0, Y_0, KB)                                             |
|        │                                                                     |
|        │ Vertical Section (MD = TVD, Inc = 0°)                               |
|        │                                                                     |
|        ╰───╮ Kick-Off Point (KOP)                                            |
|            │                                                                 |
|            │  Station 1: (MD_1, Inc_1, Azim_1)                               |
|            ╰──────╮                                                          |
|                   │  Dogleg Angle β (Curved Arc Sphere)                      |
|                   ╰─────────╮                                                |
|                             │  Station 2: (MD_2, Inc_2, Azim_2)              |
|                             ╰───────────────► Target Bottom Hole             |
|  ◄─────── Horizontal Displacement (HD) ───────► (X_BHL, Y_BHL, TVD_BHL)      |
+──────────────────────────────────────────────────────────────────────────────+
```

### 1. Mathematical Formulation (Minimum Curvature Method):
For two consecutive survey stations $1$ and $2$ separated by measured depth increment $\Delta \text{MD} = \text{MD}_2 - \text{MD}_1$:

1. **Subtended Dogleg Angle ($\beta$):**
   $$\cos(\beta) = \cos(I_2 - I_1) - \sin(I_1)\sin(I_2)\left[1 - \cos(A_2 - A_1)\right]$$
   $$\beta = \arccos\left(\cos(\beta)\right)$$

2. **Ratio Factor ($F$) for Spherical Arc Smoothing:**
   $$F = \frac{2}{\beta} \tan\left(\frac{\beta}{2}\right) \quad \left(\text{with } F \to 1 \text{ as } \beta \to 0\right)$$

3. **Incremental Coordinate Displacements:**
   $$\Delta \text{TVD} = \frac{\Delta \text{MD}}{2} \left[\cos(I_1) + \cos(I_2)\right] \times F$$
   $$\Delta \text{Northing} (\Delta Y) = \frac{\Delta \text{MD}}{2} \left[\sin(I_1)\cos(A_1) + \sin(I_2)\cos(A_2)\right] \times F$$
   $$\Delta \text{Easting} (\Delta X) = \frac{\Delta \text{MD}}{2} \left[\sin(I_1)\sin(A_1) + \sin(I_2)\sin(A_2)\right] \times F$$

4. **Dogleg Severity (DLS in degrees per 30m / 100ft):**
   $$\text{DLS} = \frac{\beta \times 30}{\Delta \text{MD}}$$

5. **Subsea True Vertical Depth ($\text{TVDSS}$):**
   $$\text{TVDSS} = \text{TVD} - \text{KB}$$

---

## 🗺️ Real Saldanadi Gas Field Dataset Integration

The platform comes pre-configured with real data from the **Saldanadi Gas Field**:
- **SALDANADI-1 (SLD-1)**: Vertical discovery well (KB = 26.94m, TD = 3000m, Easting = 619,837m, Northing = 2,618,485m).
- **SALDANADI-2 (SLD-2)**: Deviated appraisal well with 34 survey stations reaching **29.0° maximum inclination** and **320.6m horizontal displacement** into the south-western flank.
- **SALDANADI-3 (SLD-3)**: High-angle deviated appraisal well with 48 survey stations reaching **39.4° maximum inclination** and **807.5m horizontal displacement** targeting the southern fault block.

---

## 🎲 Panel 4: Volumetric Modeling & Monte Carlo Engine

```
+──────────────────────────────────────────────────────────────────────────────+
| 10,000-RUN MONTE CARLO STOCHASTIC SIMULATION                                 |
+──────────────────────────────────────────────────────────────────────────────+
| Probability Density                                                          |
|       │                     ╭──────────╮                                     |
|       │                   ╭─╯          ╰─╮                                   |
|       │                 ╭─╯              ╰─╮                                 |
|       │               ╭─╯                  ╰─╮                               |
|       │             ╭─╯                      ╰─╮                             |
|       └─────────────┼───────────┼──────────────┼───────────────────────────► |
|                    P10         P50            P90                     Volume |
|                  (Low/P90)   (Median)      (High/P10)               (MMstb)  |
+──────────────────────────────────────────────────────────────────────────────+
```

### Volumetric Governing Equations:

#### 🛢️ Oil Initially In Place (OIIP / STOIIP):
$$\text{OIIP (STB)} = \frac{\text{GRV (acre-ft)} \times 7758 \times \text{NTG} \times \phi_e \times (1 - S_w)}{B_o}$$
$$\text{OIIP (MMstb)} = \frac{\text{OIIP (STB)}}{10^6}$$

#### 💨 Gas Initially In Place (GIIP):
$$\text{GIIP (SCF)} = \frac{\text{GRV (acre-ft)} \times 43560 \times \text{NTG} \times \phi_e \times (1 - S_w)}{B_g}$$
$$\text{GIIP (Bscf)} = \frac{\text{GIIP (SCF)}}{10^9}$$

Where:
- $7758$ = Conversion constant (barrels per acre-foot)
- $43560$ = Conversion constant (cubic feet per acre-foot)
- $\text{NTG}$ = Net-to-Gross reservoir ratio
- $\phi_e$ = Effective Porosity
- $S_w$ = Water Saturation (hence $(1 - S_w) = S_{\text{hydrocarbon}}$)
- $B_o$ = Oil Formation Volume Factor ($\text{rb/stb}$)
- $B_g$ = Gas Formation Volume Factor ($\text{rcf/scf}$)

### Statistical Distributions & Sampling:
- **GRV**: Sampled from a **Lognormal Distribution** parameterizing positive skewness.
- **$\text{NTG}, \phi_e, S_w, B_o, B_g$**: Sampled from **PERT / Triangular Distributions** bounded by user P10, P50, and P90 percentiles.
- **Sensitivity Tornado Chart**: Computes Pearson correlation coefficients ($r$) between each input parameter and the output fluid volume to identify primary drivers of subsurface uncertainty.

---

## 📑 Panel 5: Report & Data Export

- **PDF Executive Prospectus**: Formatted technical dossier with embedded seismic cross-sections, 3D structure maps, petrophysical histograms, and Monte Carlo cumulative probability ($S$-curves).
- **Excel Prospect Model**: Multi-tab `.xlsx` spreadsheet containing all raw parameters, probability matrices, and formula references.
- **Horizon Surfaces**: Exportable in ASCII XYZ, CSV grid, and GIS formats.

---

## 🛠️ Technology Stack

- **Frontend & Rendering**: React 18, TypeScript, Tailwind CSS, WebGL 3D Canvas, SVG Vector Charting.
- **Signal Processing**: Custom JavaScript / WebAssembly-ready seismic DSP engine (Hilbert FIR, FFT, IDW spatial interpolator).
- **Format Decoders**: Native binary SEG-Y reader (IBM/IEEE-754 float decoders), CWLS LAS 2.0 well log parser.
- **Build System**: Vite, ESLint, TypeScript Strict Mode.
