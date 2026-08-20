"""
Panel 2 — Horizon Picking & GRV
Retrieves cube from st.cache_resource — never loses data on reconnect.
"""
import streamlit as st
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from modules.seismic import (
    pick_horizon_surface, compute_isochore, compute_grv,
)
from modules.cube_store import retrieve_cube, retrieve_demo_cube, DEMO_KEY
from modules.visualization import (
    plot_horizon_map, plot_isochore_map, plot_3d_reservoir,
)


def _get_cube():
    """Retrieve cube from cache_resource. Never stored in session_state."""
    info = st.session_state.get("segy_info", {})
    if info.get("source") == "synthetic":
        cube, _ = retrieve_demo_cube()
    else:
        fp = info.get("filepath", "")
        cube, _ = retrieve_cube(fp)
    return cube


def render():
    st.markdown("<div class='panel-title'>📐 Panel 2 — Horizon Picking & GRV</div>",
                unsafe_allow_html=True)

    if not st.session_state.get("segy_loaded"):
        st.markdown("<div class='warning-box'>⚠️ Load seismic data in Panel 1 first.</div>",
                    unsafe_allow_html=True)
        return

    # Retrieve cube from global cache — works even after browser reconnect
    cube = _get_cube()

    if cube is None:
        st.markdown("""
        <div class='warning-box'>
        ⚠️ Cube not found in cache (server may have restarted).
        Please go to Panel 1 and reload the file.
        </div>
        """, unsafe_allow_html=True)
        st.session_state["segy_loaded"] = False
        return

    info       = st.session_state["segy_info"]
    sr         = info["sample_rate"]
    total_ms   = info["total_time_ms"]
    ilines_all = info["ilines"]
    xlines_all = info["xlines"]
    n_il       = info["n_inlines"]
    n_xl       = info["n_crosslines"]

    st.markdown(f"""
    <div class='panel-card'>
    <div class='panel-title'>📦 Cube
        <span class='badge badge-success'>In Cache</span>
    </div>
    <div class='metric-row'>
        <div class='metric-card'><div class='metric-label'>Inlines</div>
            <div class='metric-value'>{n_il:,}</div>
            <div class='metric-unit'>{ilines_all[0]}→{ilines_all[-1]}</div></div>
        <div class='metric-card'><div class='metric-label'>Crosslines</div>
            <div class='metric-value'>{n_xl:,}</div>
            <div class='metric-unit'>{xlines_all[0]}→{xlines_all[-1]}</div></div>
        <div class='metric-card'><div class='metric-label'>Total Traces</div>
            <div class='metric-value'>{n_il*n_xl:,}</div></div>
        <div class='metric-card'><div class='metric-label'>TWT Range</div>
            <div class='metric-value'>0–{total_ms:.0f}</div>
            <div class='metric-unit'>ms</div></div>
    </div>
    </div>
    """, unsafe_allow_html=True)

    # ── Target depths ─────────────────────────────────────────────────────────
    st.markdown("### 🎯 Step 1 — Enter Target Depths")
    st.markdown("""
    <div style='background:rgba(240,165,0,0.08); border-left:4px solid #f0a500;
                border-radius:8px; padding:14px 18px; margin-bottom:16px;'>
    <b style='color:#f0a500;'>Type your pay zone depths.</b>
    <span style='color:#d4a843;'>
    e.g. Top = 2470 ms, Base = 2550 ms.
    Picks the strongest amplitude peak within ±window ms on every trace.
    </span>
    </div>
    """, unsafe_allow_html=True)

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        top_ms = st.number_input("Top horizon (ms)", 0.0, total_ms,
                                  min(2470.0, total_ms * 0.4), 1.0)
    with c2:
        base_ms = st.number_input("Base horizon (ms)", 0.0, total_ms,
                                   min(top_ms + 50, total_ms), 1.0)
    with c3:
        window_ms = st.number_input("Search window (±ms)", 4.0, 100.0, 20.0, 4.0)
    with c4:
        polarity = st.selectbox("Polarity", ["positive", "negative", "both"])

    if top_ms >= base_ms:
        st.markdown("<div class='warning-box'>⚠️ Top must be less than Base.</div>",
                    unsafe_allow_html=True)
        return

    top_s = int(top_ms  / sr)
    bas_s = int(base_ms / sr)
    win_s = max(1, int(window_ms / sr))

    st.markdown(f"""
    <div class='info-box'>
    Top: <b>{top_ms:.0f} ms</b> (sample {top_s})
    &nbsp;|&nbsp; Base: <b>{base_ms:.0f} ms</b> (sample {bas_s})
    &nbsp;|&nbsp; Interval: <b>{base_ms-top_ms:.0f} ms</b>
    &nbsp;|&nbsp; Approx: <b>{(top_ms/2000)*2500:.0f}–{(base_ms/2000)*2500:.0f} m</b> at 2500m/s
    </div>
    """, unsafe_allow_html=True)

    # ── GRV settings ──────────────────────────────────────────────────────────
    with st.expander("⚙️ Depth Conversion & GRV Settings"):
        c1, c2, c3 = st.columns(3)
        with c1: velocity = st.number_input("Velocity (m/s)", 1000.0, 6000.0, 2500.0)
        with c2: il_sp    = st.number_input("Inline spacing (m)", 5.0, 200.0, 25.0)
        with c3: xl_sp    = st.number_input("Crossline spacing (m)", 5.0, 200.0, 25.0)

    # ── Pick ──────────────────────────────────────────────────────────────────
    st.markdown("### 🚀 Step 2 — Pick Horizons")
    n_traces = n_il * n_xl
    est_sec  = max(5, int(n_traces / 800_000))

    st.markdown(f"""
    <div class='info-box'>
    ⏱️ Picking <b>{n_il:,} × {n_xl:,} = {n_traces:,} traces</b>
    &nbsp;|&nbsp; Estimated: <b>~{est_sec}–{est_sec*2} seconds</b>
    (vectorized NumPy per inline)
    </div>
    """, unsafe_allow_html=True)

    st.markdown("""
    <div class='warning-box'>
    ℹ️ Picking runs in the background. The browser may show
    "page not responding" — <b>this is normal and expected</b>.
    Do not close the tab. Results are saved to disk automatically
    and will appear when complete.
    </div>
    """, unsafe_allow_html=True)

    import threading, time
    OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    TOP_FILE   = os.path.join(OUTPUT_DIR, "horizon_top.npy")
    BASE_FILE  = os.path.join(OUTPUT_DIR, "horizon_base.npy")
    STATUS_FILE = os.path.join(OUTPUT_DIR, "pick_status.txt")

    def _run_picking(cube, top_s, bas_s, win_s, polarity,
                     top_file, base_file, status_file):
        """Runs in background thread — no Streamlit calls allowed here."""
        try:
            with open(status_file, "w") as f:
                f.write("running_top")

            top_h = pick_horizon_surface(cube, top_s, win_s, polarity)
            np.save(top_file, top_h)

            with open(status_file, "w") as f:
                f.write("running_base")

            base_h = pick_horizon_surface(cube, bas_s, win_s, polarity)
            np.save(base_file, base_h)

            with open(status_file, "w") as f:
                f.write("done")

        except Exception as e:
            with open(status_file, "w") as f:
                f.write(f"error:{e}")

    # Check current pick status
    pick_status = ""
    if os.path.exists(STATUS_FILE):
        with open(STATUS_FILE) as f:
            pick_status = f.read().strip()

    col_btn, col_clear = st.columns([2, 1])

    with col_btn:
        if st.button("🚀 Pick Both Horizons on Every Trace",
                     type="primary",
                     disabled=(pick_status in ["running_top", "running_base"])):

            # Clear old results
            for fp in [TOP_FILE, BASE_FILE, STATUS_FILE]:
                if os.path.exists(fp):
                    os.remove(fp)

            # Store params for after completion
            st.session_state["pick_params"] = {
                "top_ms": top_ms, "base_ms": base_ms,
                "velocity": velocity, "il_sp": il_sp, "xl_sp": xl_sp,
            }

            # Launch background thread
            t = threading.Thread(
                target=_run_picking,
                args=(cube, top_s, bas_s, win_s, polarity,
                      TOP_FILE, BASE_FILE, STATUS_FILE),
                daemon=True,
            )
            t.start()
            st.session_state["picking_thread_started"] = True
            st.rerun()

    with col_clear:
        if pick_status == "done" and st.button("🔄 Re-pick", key="repick_btn"):
            for fp in [TOP_FILE, BASE_FILE, STATUS_FILE]:
                if os.path.exists(fp):
                    os.remove(fp)
            st.rerun()

    # ── Show picking progress / results ──────────────────────────────────────
    if pick_status in ["running_top", "running_base"]:
        label = "Picking TOP horizon..." if pick_status == "running_top" \
                else "Picking BASE horizon..."
        st.info(f"⏳ **{label}** — running in background. "
                f"This page will auto-refresh every 3 seconds.")
        st.progress(0.5 if pick_status == "running_top" else 0.8,
                    text=label)
        # Auto-refresh every 3 seconds to check status
        time.sleep(3)
        st.rerun()

    elif pick_status.startswith("error:"):
        st.error(f"❌ Picking failed: {pick_status[6:]}")

    elif pick_status == "done":
        # Load results from disk
        if (os.path.exists(TOP_FILE) and os.path.exists(BASE_FILE)
                and st.session_state.get("horizon_top") is None):
            top_h  = np.load(TOP_FILE)
            base_h = np.load(BASE_FILE)
            params = st.session_state.get("pick_params", {})
            vel    = params.get("velocity", velocity)
            il_sp2 = params.get("il_sp", il_sp)
            xl_sp2 = params.get("xl_sp", xl_sp)

            iso_ms, _ = compute_isochore(top_h, base_h, sr)
            grv_data  = compute_grv(iso_ms, il_sp2, xl_sp2, vel)

            st.session_state.update({
                "horizon_top":       top_h,
                "horizon_base":      base_h,
                "isochore_ms":       iso_ms,
                "grv_data":          grv_data,
                "velocity":          vel,
                "inline_spacing":    il_sp2,
                "crossline_spacing": xl_sp2,
            })
            st.success(f"✅ Horizons picked on {top_h.shape[0]:,}×{top_h.shape[1]:,} traces!")
            st.rerun()

    # ── Results ───────────────────────────────────────────────────────────────
    # Recover from disk if session was reset after picking completed
    OUTPUT_DIR2 = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
    TOP_FILE2   = os.path.join(OUTPUT_DIR2, "horizon_top.npy")
    BASE_FILE2  = os.path.join(OUTPUT_DIR2, "horizon_base.npy")

    if (st.session_state.get("horizon_top") is None
            and os.path.exists(TOP_FILE2) and os.path.exists(BASE_FILE2)):
        top_h  = np.load(TOP_FILE2)
        base_h = np.load(BASE_FILE2)
        iso_ms, _ = compute_isochore(top_h, base_h, sr)
        grv_data  = compute_grv(iso_ms, il_sp, xl_sp, velocity)
        st.session_state.update({
            "horizon_top": top_h, "horizon_base": base_h,
            "isochore_ms": iso_ms, "grv_data": grv_data,
            "velocity": velocity, "inline_spacing": il_sp,
            "crossline_spacing": xl_sp,
        })
        st.rerun()

    if st.session_state.get("horizon_top") is not None:
        grv    = st.session_state["grv_data"]
        top_h  = st.session_state["horizon_top"]
        base_h = st.session_state["horizon_base"]
        vel    = st.session_state.get("velocity", 2500)
        ils    = ilines_all if len(ilines_all) == top_h.shape[0] else None
        xls    = xlines_all if len(xlines_all) == top_h.shape[1] else None

        st.markdown(f"""
        <div class='panel-card'>
        <div class='panel-title'>📊 Results
            <span class='badge badge-success'>{top_h.shape[0]:,}×{top_h.shape[1]:,}</span>
        </div>
        <div class='metric-row'>
            <div class='metric-card'><div class='metric-label'>GRV</div>
                <div class='metric-value'>{grv['grv_acre_ft']:,.0f}</div>
                <div class='metric-unit'>acre-ft</div></div>
            <div class='metric-card'><div class='metric-label'>GRV</div>
                <div class='metric-value'>{grv['grv_m3']/1e6:.2f}</div>
                <div class='metric-unit'>Mm³</div></div>
            <div class='metric-card'><div class='metric-label'>Avg Thickness</div>
                <div class='metric-value'>{grv['avg_thickness_m']:.1f}</div>
                <div class='metric-unit'>m</div></div>
            <div class='metric-card'><div class='metric-label'>Max Thickness</div>
                <div class='metric-value'>{grv['max_thickness_m']:.1f}</div>
                <div class='metric-unit'>m</div></div>
        </div>
        </div>
        """, unsafe_allow_html=True)

        tab1, tab2, tab3, tab4 = st.tabs([
            "Top Horizon Map", "Base Horizon Map",
            "Isochore Map", "🌐 3D Model"
        ])
        with tab1:
            st.plotly_chart(plot_horizon_map(top_h, sr, "Top Reservoir",
                ilines=ils, xlines=xls, velocity=vel, convert_to_depth=True),
                use_container_width=True)
        with tab2:
            st.plotly_chart(plot_horizon_map(base_h, sr, "Base Reservoir",
                ilines=ils, xlines=xls, velocity=vel, convert_to_depth=True),
                use_container_width=True)
        with tab3:
            st.plotly_chart(plot_isochore_map(grv["isochore_m"],
                ilines=ils, xlines=xls), use_container_width=True)
        with tab4:
            with st.spinner("Building 3D model..."):
                fig3d = plot_3d_reservoir(
                    top_h, base_h, sr,
                    st.session_state.get("inline_spacing", 25),
                    st.session_state.get("crossline_spacing", 25),
                    vel, ilines=ils, xlines=xls)
            st.plotly_chart(fig3d, use_container_width=True)

        # GRV uncertainty
        unc = st.slider("Structural uncertainty (±%)", 5, 40, 20)
        p50 = grv["grv_acre_ft"]
        st.session_state.update({
            "grv_p10": p50*(1-unc/100), "grv_p50": p50, "grv_p90": p50*(1+unc/100)
        })
        c1, c2, c3 = st.columns(3)
        for col, lbl, val, clr in [
            (c1, "P10", p50*(1-unc/100), "#e74c3c"),
            (c2, "P50", p50,             "#2ecc71"),
            (c3, "P90", p50*(1+unc/100), "#f39c12"),
        ]:
            with col:
                col.markdown(
                    f"<div class='metric-card' style='text-align:center;'>"
                    f"<div class='metric-label'>GRV {lbl}</div>"
                    f"<div class='metric-value' style='color:{clr};'>{val:,.0f}</div>"
                    f"<div class='metric-unit'>acre-ft</div></div>",
                    unsafe_allow_html=True)

        st.markdown("<br><div class='info-box'>👉 Go to <b>🧪 Petrophysics</b>.</div>",
                    unsafe_allow_html=True)
