"""Panel 3 — Petrophysical Input"""
import streamlit as st
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from modules.petrophysics import (read_las, get_las_summary, detect_curves,
                                    extract_reservoir_params, get_las_dataframe,
                                    estimate_ntg_from_gr)
from modules.visualization import plot_log_tracks


def render():
    st.markdown("<div class='panel-title'>🧪 Panel 3 — Petrophysical Parameters</div>", unsafe_allow_html=True)

    st.markdown("""
    <div class='info-box'>
    Enter petrophysical parameters manually with P10/P50/P90 ranges, or upload a LAS file
    to extract them automatically from well log curves within your reservoir zone.
    </div>
    """, unsafe_allow_html=True)

    # ── Input Mode ───────────────────────────────────────────────────────────
    mode = st.radio(
        "Input Method",
        ["✏️  Manual Entry", "📂  Load LAS File"],
        horizontal=True,
        label_visibility="collapsed"
    )

    st.markdown("<hr>", unsafe_allow_html=True)

    petro = {}

    if "Manual" in mode:
        _render_manual(petro)
    else:
        _render_las(petro)

    # ── Save & Confirm ───────────────────────────────────────────────────────
    if petro:
        st.markdown("<hr>", unsafe_allow_html=True)
        if st.button("💾 Save Petrophysical Parameters", type="primary"):
            st.session_state["petro_params"] = petro
            st.success("✅ Parameters saved! Proceed to Volumetrics.")

        if st.session_state.get("petro_params"):
            st.markdown("<div class='success-box'>✅ Parameters saved and ready for Monte Carlo simulation.</div>", unsafe_allow_html=True)


def _render_manual(petro):
    """Manual numerical entry with P10/P50/P90 for each parameter."""
    st.markdown("### ✏️ Manual Parameter Entry")
    st.markdown("""
    <div class='info-box'>
    Enter P10 (pessimistic), P50 (most likely), and P90 (optimistic) for each parameter.
    If uncertain, use the same value for all three.
    </div>
    """, unsafe_allow_html=True)

    # ── Porosity ─────────────────────────────────────────────────────────────
    st.markdown("<div style='color:#2a9bb0; font-weight:600; margin:12px 0 4px;'>Porosity (φ)</div>", unsafe_allow_html=True)
    c1, c2, c3 = st.columns(3)
    with c1:
        phi_p10 = st.number_input("φ P10 (pessimistic)", 0.01, 0.50, 0.14, 0.01, format="%.2f", key="phi_p10")
    with c2:
        phi_p50 = st.number_input("φ P50 (most likely)", 0.01, 0.50, 0.20, 0.01, format="%.2f", key="phi_p50")
    with c3:
        phi_p90 = st.number_input("φ P90 (optimistic)", 0.01, 0.50, 0.26, 0.01, format="%.2f", key="phi_p90")
    petro["phi"] = {"p10": phi_p10, "p50": phi_p50, "p90": phi_p90, "source": "manual"}

    # ── Water Saturation ─────────────────────────────────────────────────────
    st.markdown("<div style='color:#2a9bb0; font-weight:600; margin:12px 0 4px;'>Water Saturation (Sw)</div>", unsafe_allow_html=True)
    c1, c2, c3 = st.columns(3)
    with c1:
        sw_p10 = st.number_input("Sw P10 (optimistic — low Sw)", 0.05, 0.95, 0.25, 0.01, format="%.2f", key="sw_p10")
    with c2:
        sw_p50 = st.number_input("Sw P50 (most likely)", 0.05, 0.95, 0.35, 0.01, format="%.2f", key="sw_p50")
    with c3:
        sw_p90 = st.number_input("Sw P90 (pessimistic — high Sw)", 0.05, 0.95, 0.50, 0.01, format="%.2f", key="sw_p90")
    petro["sw"] = {"p10": sw_p10, "p50": sw_p50, "p90": sw_p90, "source": "manual"}

    # ── NTG ──────────────────────────────────────────────────────────────────
    st.markdown("<div style='color:#2a9bb0; font-weight:600; margin:12px 0 4px;'>Net-to-Gross (NTG)</div>", unsafe_allow_html=True)
    c1, c2, c3 = st.columns(3)
    with c1:
        ntg_p10 = st.number_input("NTG P10", 0.01, 1.0, 0.55, 0.01, format="%.2f", key="ntg_p10")
    with c2:
        ntg_p50 = st.number_input("NTG P50", 0.01, 1.0, 0.70, 0.01, format="%.2f", key="ntg_p50")
    with c3:
        ntg_p90 = st.number_input("NTG P90", 0.01, 1.0, 0.85, 0.01, format="%.2f", key="ntg_p90")
    petro["ntg"] = {"p10": ntg_p10, "p50": ntg_p50, "p90": ntg_p90, "source": "manual"}

    # ── Fluid Parameters ─────────────────────────────────────────────────────
    st.markdown("<hr>", unsafe_allow_html=True)
    st.markdown("### 🛢️ Fluid Parameters")
    st.markdown("<div class='warning-box'>Bo and Bg come from fluid sampling / PVT analysis, not well logs.</div>", unsafe_allow_html=True)

    col_oil, col_gas = st.columns(2)

    with col_oil:
        st.markdown("<div style='color:#f0a500; font-weight:600; margin-bottom:8px;'>Oil Formation Volume Factor (Bo)</div>", unsafe_allow_html=True)
        c1, c2, c3 = st.columns(3)
        with c1:
            bo_p10 = st.number_input("Bo P10", 0.8, 3.0, 1.25, 0.01, format="%.3f", key="bo_p10")
        with c2:
            bo_p50 = st.number_input("Bo P50", 0.8, 3.0, 1.35, 0.01, format="%.3f", key="bo_p50")
        with c3:
            bo_p90 = st.number_input("Bo P90", 0.8, 3.0, 1.45, 0.01, format="%.3f", key="bo_p90")
        st.caption("Unit: reservoir bbl / stock tank bbl")
        petro["bo"] = {"p10": bo_p10, "p50": bo_p50, "p90": bo_p90, "source": "manual"}

    with col_gas:
        st.markdown("<div style='color:#f0a500; font-weight:600; margin-bottom:8px;'>Gas Formation Volume Factor (Bg)</div>", unsafe_allow_html=True)
        c1, c2, c3 = st.columns(3)
        with c1:
            bg_p10 = st.number_input("Bg P10", 0.001, 0.1, 0.003, 0.001, format="%.4f", key="bg_p10")
        with c2:
            bg_p50 = st.number_input("Bg P50", 0.001, 0.1, 0.004, 0.001, format="%.4f", key="bg_p50")
        with c3:
            bg_p90 = st.number_input("Bg P90", 0.001, 0.1, 0.005, 0.001, format="%.4f", key="bg_p90")
        st.caption("Unit: reservoir cf / standard cf")
        petro["bg"] = {"p10": bg_p10, "p50": bg_p50, "p90": bg_p90, "source": "manual"}

    # Formula reminder
    st.markdown("""
    <div class='formula-box'>
    OIIP = (GRV × NTG × φ × (1 - Sw)) / Bo &nbsp;&nbsp;&nbsp; [MMstb]<br>
    GIIP = (GRV × NTG × φ × (1 - Sw)) / Bg &nbsp;&nbsp;&nbsp; [Bscf]
    </div>
    """, unsafe_allow_html=True)


def _render_las(petro):
    """LAS file upload and curve extraction."""
    st.markdown("### 📂 LAS File Input")

    uploaded_las = st.file_uploader("Upload LAS File", type=["las", "LAS"],
                                     help="Standard LAS 2.0 or 3.0 format")

    # Multiple wells
    st.markdown("""
    <div class='info-box'>💡 You can load multiple LAS files. GeoVol will average petrophysical
    parameters across all wells within the reservoir zone.</div>
    """, unsafe_allow_html=True)

    if uploaded_las is None:
        st.markdown("<div class='warning-box'>⚠️ No LAS file uploaded — using synthetic example values.</div>", unsafe_allow_html=True)
        _inject_demo_petro(petro)
        return

    try:
        las = read_las(uploaded_las)
        summary = get_las_summary(las)
        detected = detect_curves(las)
    except Exception as e:
        st.error(f"Could not read LAS file: {e}")
        return

    # Well summary
    st.markdown(f"""
    <div class='success-box'>
    ✅ LAS file loaded: <b>{summary['well_name']}</b> &nbsp;|&nbsp;
    {summary['n_samples']} samples &nbsp;|&nbsp;
    Depth: {summary['depth_min']:.0f}m – {summary['depth_max']:.0f}m &nbsp;|&nbsp;
    {len(summary['curve_names'])} curves
    </div>
    """, unsafe_allow_html=True)

    # Curve detection
    st.markdown("#### Detected Curves")
    det_rows = ""
    for param, curve in detected.items():
        status = f"<span style='color:#2ecc71;'>✅ {curve}</span>" if curve else "<span style='color:#e74c3c;'>❌ Not found</span>"
        det_rows += f"<tr><td>{param.upper()}</td><td>{status}</td></tr>"

    st.markdown(f"""
    <table class='results-table'>
        <thead><tr><th>Parameter</th><th>Detected Curve</th></tr></thead>
        <tbody>{det_rows}</tbody>
    </table>
    """, unsafe_allow_html=True)

    # Manual curve override
    with st.expander("🔧 Override curve selections"):
        curve_names = summary["curve_names"]
        options = ["— Auto —"] + curve_names
        phi_override = st.selectbox("Porosity curve", options, key="phi_override")
        sw_override = st.selectbox("Water Saturation curve", options, key="sw_override")
        ntg_override = st.selectbox("NTG curve (optional)", options, key="ntg_override")

    phi_curve = (phi_override if phi_override != "— Auto —" else None) or detected.get("porosity")
    sw_curve = (sw_override if sw_override != "— Auto —" else None) or detected.get("sw")
    ntg_curve = (ntg_override if ntg_override != "— Auto —" else None) or detected.get("ntg")

    # Depth range for extraction
    st.markdown("#### Reservoir Zone Depth")
    depth_min = summary["depth_min"] or 0
    depth_max = summary["depth_max"] or 5000

    c1, c2 = st.columns(2)
    with c1:
        top_depth = st.number_input("Top reservoir depth (m)", depth_min, depth_max,
                                    value=depth_min + (depth_max - depth_min) * 0.3, key="las_top")
    with c2:
        base_depth = st.number_input("Base reservoir depth (m)", depth_min, depth_max,
                                     value=depth_min + (depth_max - depth_min) * 0.6, key="las_base")

    # Extract parameters
    if st.button("🔍 Extract Parameters from LAS", type="primary"):
        with st.spinner("Extracting petrophysical parameters..."):
            params, error = extract_reservoir_params(las, top_depth, base_depth,
                                                      phi_curve, sw_curve, ntg_curve)
            if error:
                st.error(error)
                return

            # If NTG not found, estimate from GR
            if params.get("ntg", {}).get("found") is False:
                ntg_est = estimate_ntg_from_gr(las, top_depth, base_depth)
                if ntg_est:
                    params["ntg"] = ntg_est
                    st.info("ℹ️ NTG estimated from GR curve (VSh method)")

            st.session_state["las_params"] = params
            st.session_state["las_obj"] = las
            st.session_state["las_top_depth"] = top_depth
            st.session_state["las_base_depth"] = base_depth
            st.rerun()

    # Display extracted results
    if st.session_state.get("las_params"):
        params = st.session_state["las_params"]
        st.markdown("#### 📊 Extracted Parameters (Reservoir Zone)")

        for param_key, label, unit in [
            ("porosity", "Porosity (φ)", "fraction"),
            ("sw", "Water Saturation (Sw)", "fraction"),
            ("ntg", "Net-to-Gross (NTG)", "fraction"),
        ]:
            p = params.get(param_key, {})
            if p.get("found"):
                st.markdown(f"<div style='color:#2a9bb0; font-weight:600; margin:10px 0 4px;'>{label}</div>", unsafe_allow_html=True)
                c1, c2, c3, c4 = st.columns(4)
                with c1:
                    st.metric("P10", f"{p['p10']:.3f}")
                with c2:
                    st.metric("P50", f"{p['p50']:.3f}")
                with c3:
                    st.metric("P90", f"{p['p90']:.3f}")
                with c4:
                    st.metric("Mean", f"{p['mean']:.3f}")

                # Store in petro
                if param_key == "porosity":
                    petro["phi"] = {"p10": p["p10"], "p50": p["p50"], "p90": p["p90"], "source": "las"}
                elif param_key == "sw":
                    petro["sw"] = {"p10": p["p10"], "p50": p["p50"], "p90": p["p90"], "source": "las"}
                elif param_key == "ntg":
                    petro["ntg"] = {"p10": p["p10"], "p50": p["p50"], "p90": p["p90"], "source": "las"}
            else:
                st.markdown(f"<div class='warning-box'>⚠️ {label}: {p.get('error', 'Not found')} — enter manually below.</div>", unsafe_allow_html=True)

        # Well log tracks
        st.markdown("#### 📈 Well Log Tracks")
        las_df = get_las_dataframe(las, top_depth=st.session_state.get("las_top_depth"),
                                    base_depth=st.session_state.get("las_base_depth"))
        depth_col = detected.get("depth") or "DEPT"
        plot_curves = [c for c in [phi_curve, sw_curve, ntg_curve, detected.get("gr")] if c and c.upper() in las_df.columns]
        if plot_curves:
            fig = plot_log_tracks(las_df, depth_col.upper() if depth_col else "DEPT",
                                   plot_curves, top_depth, base_depth)
            if fig:
                st.plotly_chart(fig, use_container_width=True)

    # Bo/Bg always manual
    st.markdown("<hr>", unsafe_allow_html=True)
    st.markdown("### 🛢️ Fluid Parameters (Manual — required)")
    c1, c2 = st.columns(2)
    with c1:
        bo_p50 = st.number_input("Bo P50 (rb/stb)", 0.8, 3.0, 1.35, 0.01, format="%.3f")
        bo_range = st.slider("Bo uncertainty range (±%)", 1, 20, 8)
        petro["bo"] = {
            "p10": bo_p50 * (1 - bo_range / 100),
            "p50": bo_p50,
            "p90": bo_p50 * (1 + bo_range / 100),
            "source": "manual"
        }
    with c2:
        bg_p50 = st.number_input("Bg P50 (rcf/scf)", 0.001, 0.1, 0.004, 0.001, format="%.4f")
        bg_range = st.slider("Bg uncertainty range (±%)", 1, 20, 10)
        petro["bg"] = {
            "p10": bg_p50 * (1 - bg_range / 100),
            "p50": bg_p50,
            "p90": bg_p50 * (1 + bg_range / 100),
            "source": "manual"
        }

    # Fill missing with defaults
    for key, defaults in [("phi", (0.14, 0.20, 0.26)),
                          ("sw",  (0.25, 0.35, 0.50)),
                          ("ntg", (0.55, 0.70, 0.85))]:
        if key not in petro:
            petro[key] = {"p10": defaults[0], "p50": defaults[1], "p90": defaults[2], "source": "default"}


def _inject_demo_petro(petro):
    """Inject demo petrophysical values when no LAS is provided."""
    petro["phi"] = {"p10": 0.14, "p50": 0.20, "p90": 0.26, "source": "demo"}
    petro["sw"]  = {"p10": 0.25, "p50": 0.35, "p90": 0.50, "source": "demo"}
    petro["ntg"] = {"p10": 0.55, "p50": 0.70, "p90": 0.85, "source": "demo"}
    petro["bo"]  = {"p10": 1.25, "p50": 1.35, "p90": 1.45, "source": "demo"}
    petro["bg"]  = {"p10": 0.003, "p50": 0.004, "p90": 0.005, "source": "demo"}
