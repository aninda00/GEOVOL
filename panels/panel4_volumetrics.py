"""Panel 4 — Volumetrics & Monte Carlo"""
import streamlit as st
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from modules.volumetrics import run_monte_carlo, summarize_results
from modules.visualization import plot_mc_histogram, plot_tornado_chart, plot_summary_bar


def render():
    st.markdown("<div class='panel-title'>📊 Panel 4 — Volumetrics & Monte Carlo</div>", unsafe_allow_html=True)

    # Check prerequisites
    missing = []
    if not st.session_state.get("segy_loaded"):
        missing.append("Seismic data (Panel 1)")
    if st.session_state.get("horizon_top") is None:
        missing.append("Horizons (Panel 2)")
    if st.session_state.get("petro_params") is None:
        missing.append("Petrophysical parameters (Panel 3)")

    if missing:
        st.markdown(f"<div class='warning-box'>⚠️ Please complete: {', '.join(missing)}</div>", unsafe_allow_html=True)
        return

    petro = st.session_state["petro_params"]
    grv_p10 = st.session_state.get("grv_p10", 1000)
    grv_p50 = st.session_state.get("grv_p50", 1500)
    grv_p90 = st.session_state.get("grv_p90", 2000)

    # ── Input Summary ────────────────────────────────────────────────────────
    st.markdown("### 📋 Input Parameters Summary")

    def src_badge(src):
        colors = {"las": "#2ecc71", "manual": "#2a9bb0", "demo": "#f39c12", "default": "#8aafc0"}
        c = colors.get(src, "#8aafc0")
        return f"<span class='badge' style='background:rgba(0,0,0,0.2); color:{c}; border:1px solid {c};'>{src.upper()}</span>"

    rows = ""
    param_map = {
        "GRV": ("grv", grv_p10, grv_p50, grv_p90, "acre-ft", None),
        "Porosity (φ)": ("phi", petro["phi"]["p10"], petro["phi"]["p50"], petro["phi"]["p90"], "fraction", petro["phi"].get("source")),
        "Water Sat (Sw)": ("sw", petro["sw"]["p10"], petro["sw"]["p50"], petro["sw"]["p90"], "fraction", petro["sw"].get("source")),
        "NTG": ("ntg", petro["ntg"]["p10"], petro["ntg"]["p50"], petro["ntg"]["p90"], "fraction", petro["ntg"].get("source")),
        "Bo": ("bo", petro["bo"]["p10"], petro["bo"]["p50"], petro["bo"]["p90"], "rb/stb", petro["bo"].get("source")),
        "Bg": ("bg", petro["bg"]["p10"], petro["bg"]["p50"], petro["bg"]["p90"], "rcf/scf", petro["bg"].get("source")),
    }

    for label, (key, p10, p50, p90, unit, source) in param_map.items():
        badge = src_badge(source) if source else ""
        if unit == "acre-ft":
            fmt = f"{p10:,.0f} / {p50:,.0f} / {p90:,.0f}"
        elif unit == "fraction":
            fmt = f"{p10:.3f} / {p50:.3f} / {p90:.3f}"
        else:
            fmt = f"{p10:.4f} / {p50:.4f} / {p90:.4f}"
        rows += f"<tr><td>{label}</td><td style='font-family:JetBrains Mono,monospace;'>{fmt}</td><td>{unit}</td><td>{badge}</td></tr>"

    st.markdown(f"""
    <table class='results-table'>
        <thead><tr><th>Parameter</th><th>P10 / P50 / P90</th><th>Unit</th><th>Source</th></tr></thead>
        <tbody>{rows}</tbody>
    </table>
    """, unsafe_allow_html=True)

    # ── Simulation Settings ──────────────────────────────────────────────────
    st.markdown("### ⚙️ Simulation Settings")
    c1, c2, c3 = st.columns(3)
    with c1:
        n_sims = st.select_slider("Number of simulations",
                                   options=[1000, 5000, 10000, 50000, 100000],
                                   value=10000)
    with c2:
        calc_oil = st.checkbox("Calculate OIIP (Oil)", value=True)
    with c3:
        calc_gas = st.checkbox("Calculate GIIP (Gas)", value=True)

    with st.expander("🌱 Random seed & advanced"):
        seed = st.number_input("Random seed", 0, 99999, 42,
                                help="Set for reproducible results")

    # ── Run Simulation ───────────────────────────────────────────────────────
    if st.button("🚀 Run Monte Carlo Simulation", type="primary"):
        with st.spinner(f"Running {n_sims:,} simulations..."):
            mc_results = run_monte_carlo(
                grv_p10=grv_p10, grv_p50=grv_p50, grv_p90=grv_p90,
                ntg_p10=petro["ntg"]["p10"], ntg_p50=petro["ntg"]["p50"], ntg_p90=petro["ntg"]["p90"],
                phi_p10=petro["phi"]["p10"], phi_p50=petro["phi"]["p50"], phi_p90=petro["phi"]["p90"],
                sw_p10=petro["sw"]["p10"],  sw_p50=petro["sw"]["p50"],  sw_p90=petro["sw"]["p90"],
                bo_p10=petro["bo"]["p10"],  bo_p50=petro["bo"]["p50"],  bo_p90=petro["bo"]["p90"],
                bg_p10=petro["bg"]["p10"],  bg_p50=petro["bg"]["p50"],  bg_p90=petro["bg"]["p90"],
                n_simulations=n_sims,
                calc_oil=calc_oil,
                calc_gas=calc_gas,
                seed=int(seed),
            )
            st.session_state["oiip_results"] = mc_results.get("oiip")
            st.session_state["giip_results"] = mc_results.get("giip")
            st.session_state["mc_results"] = mc_results

        st.success(f"✅ {n_sims:,} simulations completed!")
        st.rerun()

    # ── Display Results ──────────────────────────────────────────────────────
    if st.session_state.get("mc_results"):
        mc = st.session_state["mc_results"]

        # Big results cards
        st.markdown("### 🎯 Volumetric Results")

        result_cards = ""
        for fluid, label, unit, color in [
            ("oiip", "OIIP", "MMstb", "#2a9bb0"),
            ("giip", "GIIP", "Bscf", "#f0a500"),
        ]:
            if fluid not in mc:
                continue
            r = mc[fluid]
            result_cards += f"""
            <div style='flex:1; min-width:280px; background:var(--bg-card2); border:1px solid {color}40;
                        border-top:3px solid {color}; border-radius:12px; padding:20px; margin:8px;'>
                <div style='font-size:1rem; font-weight:600; color:{color}; margin-bottom:14px;'>{label} ({unit})</div>
                <div style='display:flex; gap:16px; justify-content:space-around;'>
                    <div style='text-align:center;'>
                        <div style='font-size:0.72rem; color:#8aafc0; text-transform:uppercase; letter-spacing:1px;'>P10 Low</div>
                        <div style='font-family:JetBrains Mono,monospace; font-size:1.5rem; color:#e74c3c; font-weight:600;'>{r['p10']:.1f}</div>
                    </div>
                    <div style='text-align:center;'>
                        <div style='font-size:0.72rem; color:#8aafc0; text-transform:uppercase; letter-spacing:1px;'>P50 Best</div>
                        <div style='font-family:JetBrains Mono,monospace; font-size:1.8rem; color:#2ecc71; font-weight:700;'>{r['p50']:.1f}</div>
                    </div>
                    <div style='text-align:center;'>
                        <div style='font-size:0.72rem; color:#8aafc0; text-transform:uppercase; letter-spacing:1px;'>P90 High</div>
                        <div style='font-family:JetBrains Mono,monospace; font-size:1.5rem; color:#f39c12; font-weight:600;'>{r['p90']:.1f}</div>
                    </div>
                </div>
                <div style='margin-top:12px; display:flex; justify-content:space-between; font-size:0.8rem; color:#8aafc0;'>
                    <span>Mean: <b style='color:#e8f4f8;'>{r['mean']:.1f} {unit}</b></span>
                    <span>StdDev: <b style='color:#e8f4f8;'>{r['std']:.1f} {unit}</b></span>
                </div>
            </div>"""

        st.markdown(f"<div style='display:flex; flex-wrap:wrap; gap:8px; margin:16px 0;'>{result_cards}</div>",
                    unsafe_allow_html=True)

        # Charts
        tab1, tab2, tab3 = st.tabs(["📊 Distributions", "🌪️ Sensitivity (Tornado)", "📈 Summary"])

        with tab1:
            col1, col2 = st.columns(2)
            with col1:
                if "oiip" in mc:
                    fig = plot_mc_histogram(mc, "oiip")
                    if fig: st.plotly_chart(fig, use_container_width=True)
            with col2:
                if "giip" in mc:
                    fig = plot_mc_histogram(mc, "giip")
                    if fig: st.plotly_chart(fig, use_container_width=True)

        with tab2:
            col1, col2 = st.columns(2)
            with col1:
                if "oiip" in mc:
                    st.markdown("<div style='color:#2a9bb0; font-weight:600; margin-bottom:8px;'>OIIP Sensitivity</div>", unsafe_allow_html=True)
                    fig = plot_tornado_chart(mc, "oiip")
                    if fig: st.plotly_chart(fig, use_container_width=True)
            with col2:
                if "giip" in mc:
                    st.markdown("<div style='color:#f0a500; font-weight:600; margin-bottom:8px;'>GIIP Sensitivity</div>", unsafe_allow_html=True)
                    fig = plot_tornado_chart(mc, "giip")
                    if fig: st.plotly_chart(fig, use_container_width=True)

            st.markdown("""
            <div class='info-box'>
            <b>Reading the tornado chart:</b> Bars show correlation between each input and the output.
            Positive (right) = increasing this parameter increases volumes.
            Negative (left) = increasing this parameter decreases volumes (e.g. higher Sw = less hydrocarbons).
            Longer bar = more influence on the result.
            </div>
            """, unsafe_allow_html=True)

        with tab3:
            fig = plot_summary_bar(mc)
            if fig: st.plotly_chart(fig, use_container_width=True)

            # Summary table
            df_summary = summarize_results(mc)
            st.dataframe(df_summary, use_container_width=True, hide_index=True)

        st.markdown("""
        <br>
        <div class='info-box'>
        👉 <b>Next step:</b> Go to <b>📄 Report & Export</b> to download your results as PDF and Excel.
        </div>
        """, unsafe_allow_html=True)
