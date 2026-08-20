import streamlit as st
import numpy as np
import pandas as pd

st.set_page_config(
    page_title="GeoVol — Reservoir Volumetrics",
    page_icon="🛢️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
        --teal-dark: #0d3d4a;
        --teal-mid: #1a6b7a;
        --teal-light: #2a9bb0;
        --accent: #f0a500;
        --accent-light: #ffc840;
        --bg-dark: #0a1628;
        --bg-mid: #0f2139;
        --bg-card: #162840;
        --bg-card2: #1c3350;
        --text-primary: #e8f4f8;
        --text-secondary: #8aafc0;
        --success: #2ecc71;
        --warning: #f39c12;
        --danger: #e74c3c;
        --border: rgba(42, 155, 176, 0.25);
    }

    html, body, [class*="css"] {
        font-family: 'Space Grotesk', sans-serif;
        background-color: var(--bg-dark);
        color: var(--text-primary);
    }

    .stApp { background-color: var(--bg-dark); }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, var(--bg-mid) 0%, var(--teal-dark) 100%);
        border-right: 1px solid var(--border);
    }

    /* Header */
    .geovol-header {
        background: linear-gradient(135deg, var(--teal-dark) 0%, var(--bg-mid) 60%, var(--bg-dark) 100%);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 28px 36px;
        margin-bottom: 24px;
        position: relative;
        overflow: hidden;
    }
    .geovol-header::before {
        content: '';
        position: absolute;
        top: -40px; right: -40px;
        width: 200px; height: 200px;
        background: radial-gradient(circle, rgba(42,155,176,0.15) 0%, transparent 70%);
        border-radius: 50%;
    }
    .geovol-title {
        font-size: 2.2rem;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.5px;
        margin: 0;
    }
    .geovol-title span { color: var(--accent); }
    .geovol-subtitle {
        color: var(--text-secondary);
        font-size: 0.95rem;
        margin-top: 6px;
        font-weight: 400;
    }

    /* Panel cards */
    .panel-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 24px;
        margin-bottom: 20px;
    }
    .panel-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--teal-light);
        letter-spacing: 0.3px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Metric cards */
    .metric-row { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
    .metric-card {
        flex: 1;
        min-width: 140px;
        background: var(--bg-card2);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 18px 20px;
        text-align: center;
    }
    .metric-label {
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 6px;
    }
    .metric-value {
        font-family: 'JetBrains Mono', monospace;
        font-size: 1.6rem;
        font-weight: 600;
        color: var(--accent);
    }
    .metric-unit {
        font-size: 0.75rem;
        color: var(--text-secondary);
        margin-top: 4px;
    }

    /* Status badges */
    .badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.5px;
    }
    .badge-success { background: rgba(46,204,113,0.15); color: var(--success); border: 1px solid rgba(46,204,113,0.3); }
    .badge-warning { background: rgba(243,156,18,0.15); color: var(--warning); border: 1px solid rgba(243,156,18,0.3); }
    .badge-info { background: rgba(42,155,176,0.15); color: var(--teal-light); border: 1px solid rgba(42,155,176,0.3); }
    .badge-danger { background: rgba(231,76,60,0.15); color: var(--danger); border: 1px solid rgba(231,76,60,0.3); }

    /* Step indicator */
    .step-indicator {
        display: flex;
        align-items: center;
        gap: 0;
        margin-bottom: 28px;
        flex-wrap: wrap;
    }
    .step {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 500;
        transition: all 0.2s;
    }
    .step-active { background: rgba(42,155,176,0.2); color: var(--teal-light); border: 1px solid var(--teal-light); }
    .step-done { background: rgba(46,204,113,0.1); color: var(--success); border: 1px solid rgba(46,204,113,0.3); }
    .step-pending { background: transparent; color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.1); }
    .step-arrow { color: var(--text-secondary); font-size: 0.8rem; padding: 0 4px; }

    /* Info boxes */
    .info-box {
        background: rgba(42,155,176,0.08);
        border: 1px solid rgba(42,155,176,0.25);
        border-left: 3px solid var(--teal-light);
        border-radius: 8px;
        padding: 14px 18px;
        margin: 12px 0;
        font-size: 0.88rem;
        color: var(--text-secondary);
    }
    .warning-box {
        background: rgba(243,156,18,0.08);
        border: 1px solid rgba(243,156,18,0.25);
        border-left: 3px solid var(--warning);
        border-radius: 8px;
        padding: 14px 18px;
        margin: 12px 0;
        font-size: 0.88rem;
        color: #d4a843;
    }
    .success-box {
        background: rgba(46,204,113,0.08);
        border: 1px solid rgba(46,204,113,0.25);
        border-left: 3px solid var(--success);
        border-radius: 8px;
        padding: 14px 18px;
        margin: 12px 0;
        font-size: 0.88rem;
        color: #5dd98a;
    }

    /* Streamlit overrides */
    .stButton > button {
        background: linear-gradient(135deg, var(--teal-mid), var(--teal-dark));
        color: white;
        border: 1px solid var(--teal-light);
        border-radius: 8px;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 500;
        padding: 10px 24px;
        transition: all 0.2s;
    }
    .stButton > button:hover {
        background: linear-gradient(135deg, var(--teal-light), var(--teal-mid));
        transform: translateY(-1px);
        box-shadow: 0 4px 15px rgba(42,155,176,0.3);
    }
    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, var(--accent), #d4920a);
        border-color: var(--accent);
    }

    div[data-testid="stNumberInput"] input,
    div[data-testid="stTextInput"] input,
    div[data-testid="stSelectbox"] select,
    .stSlider {
        background: var(--bg-card2) !important;
        border-color: var(--border) !important;
        color: var(--text-primary) !important;
    }

    .stTabs [data-baseweb="tab-list"] {
        background: var(--bg-card);
        border-radius: 10px;
        padding: 4px;
        gap: 4px;
    }
    .stTabs [data-baseweb="tab"] {
        background: transparent;
        color: var(--text-secondary);
        border-radius: 8px;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 500;
    }
    .stTabs [aria-selected="true"] {
        background: var(--teal-mid) !important;
        color: white !important;
    }

    [data-testid="stExpander"] {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 10px;
    }

    .stDataFrame { background: var(--bg-card); }

    /* Divider */
    hr { border-color: var(--border); margin: 20px 0; }

    /* Formula display */
    .formula-box {
        background: var(--bg-dark);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 14px 18px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.85rem;
        color: var(--accent-light);
        margin: 10px 0;
    }

    /* Results table */
    .results-table { width: 100%; border-collapse: collapse; }
    .results-table th {
        background: var(--bg-card2);
        color: var(--teal-light);
        padding: 10px 14px;
        text-align: left;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
    }
    .results-table td {
        padding: 10px 14px;
        border-bottom: 1px solid var(--border);
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.88rem;
    }
    .results-table tr:hover td { background: rgba(42,155,176,0.05); }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg-dark); }
    ::-webkit-scrollbar-thumb { background: var(--teal-mid); border-radius: 3px; }
</style>
""", unsafe_allow_html=True)

# ── Session state init ──────────────────────────────────────────────────────
def init_session():
    defaults = {
        "segy_loaded": False,
        "segy_info": None,
        "suggested_horizons": None,
        "horizon_top": None,
        "horizon_base": None,
        "grv": None,
        "petro_params": None,
        "oiip_results": None,
        "giip_results": None,
        "active_panel": "seismic",
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

init_session()

# ── Sidebar Navigation ──────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div style='text-align:center; padding: 20px 0 10px;'>
        <div style='font-size:2.5rem;'>🛢️</div>
        <div style='font-size:1.3rem; font-weight:700; color:#e8f4f8; margin-top:6px;'>GeoVol</div>
        <div style='font-size:0.78rem; color:#8aafc0; margin-top:2px;'>Reservoir Volumetrics v1.0</div>
    </div>
    <hr style='border-color:rgba(42,155,176,0.25);'/>
    """, unsafe_allow_html=True)

    panel = st.radio(
        "Navigation",
        options=["🔬 Seismic Loader", "📐 Horizon Picking", "🧪 Petrophysics", "📊 Volumetrics", "📄 Report & Export"],
        label_visibility="collapsed"
    )

    st.markdown("<hr style='border-color:rgba(42,155,176,0.25);'/>", unsafe_allow_html=True)

    # Progress tracker
    st.markdown("<div style='font-size:0.78rem; color:#8aafc0; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;'>Workflow Progress</div>", unsafe_allow_html=True)

    steps = [
        ("Seismic Loaded", st.session_state.segy_loaded),
        ("Horizons Picked", st.session_state.horizon_top is not None),
        ("Petrophyics Set", st.session_state.petro_params is not None),
        ("Volumes Calculated", st.session_state.oiip_results is not None),
    ]
    for label, done in steps:
        icon = "✅" if done else "⏳"
        color = "#2ecc71" if done else "#8aafc0"
        st.markdown(f"<div style='font-size:0.82rem; color:{color}; margin:6px 0;'>{icon} {label}</div>", unsafe_allow_html=True)

    st.markdown("<hr style='border-color:rgba(42,155,176,0.25);'/>", unsafe_allow_html=True)
    st.markdown("<div style='font-size:0.72rem; color:#4a6a7a; text-align:center;'>Built with Segyio · Lasio · NumPy<br>Plotly · SciPy · Streamlit</div>", unsafe_allow_html=True)

# ── Main Header ─────────────────────────────────────────────────────────────
st.markdown("""
<div class='geovol-header'>
    <div class='geovol-title'>Geo<span>Vol</span> — Reservoir Volumetrics</div>
    <div class='geovol-subtitle'>3D Seismic Horizon Picking · OIIP & GIIP · Monte Carlo Uncertainty · Professional Reports</div>
</div>
""", unsafe_allow_html=True)

# ── Panel Routing ────────────────────────────────────────────────────────────
if "Seismic" in panel:
    from panels.panel1_seismic import render
    render()
elif "Horizon" in panel:
    from panels.panel2_horizon import render
    render()
elif "Petro" in panel:
    from panels.panel3_petro import render
    render()
elif "Volumetrics" in panel:
    from panels.panel4_volumetrics import render
    render()
elif "Report" in panel:
    from panels.panel5_report import render
    render()
