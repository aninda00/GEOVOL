# 🛢️ GeoVol — Reservoir Volumetrics App

A professional-grade geoscience app for calculating **OIIP** and **GIIP** from 3D seismic data, with automated horizon picking, petrophysical input (manual or LAS file), Monte Carlo uncertainty analysis, and PDF/Excel report export.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the App
```bash
streamlit run geovol.py
```

The app opens in your browser at `http://localhost:8501`

---

## 📋 Workflow

| Panel | What You Do |
|-------|-------------|
| 1️⃣ Seismic Loader | Upload SEG-Y file (or use demo data) — app suggests horizon depths |
| 2️⃣ Horizon Picking | Confirm top & base reservoir → auto-picks horizons → calculates GRV |
| 3️⃣ Petrophysics | Enter φ, Sw, NTG manually OR upload LAS file |
| 4️⃣ Volumetrics | Run Monte Carlo → get P10/P50/P90 OIIP & GIIP |
| 5️⃣ Report & Export | Download PDF report, Excel workbook, horizon grids |

---

## 🗂️ Project Structure

```
geovol/
├── geovol.py              ← Main Streamlit app (run this)
├── requirements.txt       ← Python dependencies
├── modules/
│   ├── seismic.py         ← SEG-Y loading, horizon picking, GRV
│   ├── petrophysics.py    ← LAS reading, curve extraction
│   ├── volumetrics.py     ← OIIP/GIIP formulas, Monte Carlo
│   └── visualization.py  ← All Plotly charts
├── panels/
│   ├── panel1_seismic.py  ← UI: Seismic Loader
│   ├── panel2_horizon.py  ← UI: Horizon Picking
│   ├── panel3_petro.py    ← UI: Petrophysics
│   ├── panel4_volumetrics.py ← UI: Monte Carlo
│   └── panel5_report.py  ← UI: Export
├── data/                  ← Put your SEG-Y and LAS files here
└── output/                ← Reports saved here
```

---

## 📐 Formulas Used

```
OIIP (STB) = (GRV_acre_ft × 7758 × NTG × φ × (1 - Sw)) / Bo
GIIP (SCF) = (GRV_acre_ft × 43560 × NTG × φ × (1 - Sw)) / Bg
GRV = Σ(cell_area × isochore_thickness) over reservoir extent
```

---

## ⚙️ Technical Notes

- **Horizon picking**: SciPy `find_peaks` on amplitude envelope per trace
- **Monte Carlo**: 10,000 simulations (default), triangular + lognormal distributions
- **TWT → Depth**: `depth = (TWT_ms / 2000) × velocity_m/s`
- **No SEG-Y?** Enable "synthetic demo" mode — all 5 panels fully functional
- **Large files**: SEG-Y files >2GB may be slow; segyio reads efficiently with memory mapping

---

## 🔧 Troubleshooting

**segyio install fails on Windows:**
```bash
pip install segyio --pre
```

**lasio not found:**
```bash
pip install lasio
```

**reportlab (PDF export) missing:**
```bash
pip install reportlab
```

---

## ⚠️ Disclaimer

This tool is for exploration and educational purposes. All volumetric results must be verified by a qualified petroleum engineer before use in investment or development decisions.
# GEOVOL
