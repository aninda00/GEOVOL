"""
Panel 1 — Seismic Loader & QC

Memory architecture:
- Cube stored via @st.cache_resource (global, survives reconnects)
- session_state only holds lightweight metadata + filepath key
- Switching panels NEVER loses the cube
- Browser "page not responding" during picking NEVER loses the cube
"""
import streamlit as st
import numpy as np
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from modules.seismic import (
    load_segy_cube, get_segy_header_only, get_textual_header,
    generate_synthetic_cube,
    get_inline_section, get_crossline_section, get_time_slice,
    compute_mean_amplitude_trace, compute_envelope_trace,
    suggest_horizons,
)
from modules.cube_store import (
    store_cube, retrieve_cube, cube_is_cached,
    store_demo_cube, retrieve_demo_cube, demo_is_cached,
    DEMO_KEY,
)
from modules.visualization import plot_seismic_section, plot_amplitude_spectrum
import plotly.graph_objects as go


def _get_cube():
    """Retrieve cube from cache_resource using the stored key."""
    info = st.session_state.get("segy_info", {})
    source = info.get("source")
    if source == "synthetic":
        cube, _ = retrieve_demo_cube()
    else:
        fp = info.get("filepath", "")
        cube, _ = retrieve_cube(fp)
    return cube


def render():
    st.markdown("<div class='panel-title'>🔬 Panel 1 — Seismic Loader & QC</div>",
                unsafe_allow_html=True)

    mode = st.radio("Data Source",
                    ["📁  Local File Path", "🧪  Synthetic Demo Data"],
                    horizontal=True, label_visibility="collapsed")
    st.markdown("<hr>", unsafe_allow_html=True)
    use_demo = "Demo" in mode

    # ── DEMO ──────────────────────────────────────────────────────────────────
    if use_demo:
        st.markdown("""
        <div class='warning-box'>
        🧪 Synthetic demo — all features work. Switch to Local File Path for real data.
        </div>
        """, unsafe_allow_html=True)

        if demo_is_cached():
            st.markdown("<div class='success-box'>✅ Demo cube already in cache.</div>",
                        unsafe_allow_html=True)
            # Restore session info if needed
            if not st.session_state.get("segy_loaded"):
                _, info = retrieve_demo_cube()
                if info:
                    st.session_state["segy_loaded"] = True
                    st.session_state["segy_info"]   = info

        if st.button("🧪 Load Demo Data", type="primary", key="demo_btn"):
            cube = generate_synthetic_cube()
            n_il, n_xl, n_s = cube.shape
            sr   = 4.0
            mt   = compute_mean_amplitude_trace(cube)
            env  = compute_envelope_trace(mt)
            sugg, _, _ = suggest_horizons(cube, sr)
            info = {
                "source": "synthetic", "filepath": DEMO_KEY,
                "n_inlines": n_il, "n_crosslines": n_xl,
                "n_samples": n_s, "sample_rate": sr,
                "total_time_ms": (n_s - 1) * sr,
                "ilines": list(range(n_il)),
                "xlines": list(range(n_xl)),
                "ram_mb": round(cube.nbytes / 1024**2, 1),
            }
            # Store in cache_resource — NOT in session_state
            store_demo_cube(cube, info)

            # Only lightweight data in session_state
            st.session_state["segy_loaded"]        = True
            st.session_state["segy_info"]          = info
            st.session_state["mean_trace"]         = mt
            st.session_state["envelope"]           = env
            st.session_state["suggested_horizons"] = sugg
            st.rerun()

    # ── REAL FILE ─────────────────────────────────────────────────────────────
    else:
        st.markdown("### 📁 Enter SEG-Y File Path")
        st.markdown("""
        <div class='info-box'>
        Paste the full path to your <b>.sgy / .segy</b> file.
        The cube is stored in <b>Streamlit's global cache</b> — it survives
        page switches and browser reconnects without being lost.
        </div>
        """, unsafe_allow_html=True)

        fp_input = st.text_input(
            "Full file path",
            value=st.session_state.get("last_filepath", ""),
            placeholder=r"C:\Users\YourName\Data\seismic_cube.sgy",
        )
        with st.expander("💡 How to copy file path on Windows"):
            st.markdown("Hold **Shift** + right-click the file → **Copy as path** → paste here")

        if not fp_input:
            return

        fp_input = fp_input.strip().strip('"').strip("'")

        if not os.path.exists(fp_input):
            st.markdown(f"<div class='warning-box'>⚠️ File not found: <code>{fp_input}</code></div>",
                        unsafe_allow_html=True)
            return

        fsize_gb = os.path.getsize(fp_input) / 1024**3
        st.markdown(f"""
        <div class='success-box'>
        ✅ <b>{os.path.basename(fp_input)}</b> &nbsp;|&nbsp; {fsize_gb:.2f} GB
        </div>
        """, unsafe_allow_html=True)
        st.session_state["last_filepath"] = fp_input

        # Check if already cached
        if cube_is_cached(fp_input):
            st.markdown("""
            <div class='success-box'>
            ✅ <b>Cube already loaded in cache</b> — available across all panels.
            </div>
            """, unsafe_allow_html=True)
            if not st.session_state.get("segy_loaded"):
                _, cached_info = retrieve_cube(fp_input)
                if cached_info:
                    st.session_state["segy_loaded"] = True
                    st.session_state["segy_info"]   = cached_info

        # Text header
        with st.expander("📋 SEG-Y Text Header (EBCDIC)"):
            with st.spinner("Reading..."):
                try:
                    txt = get_textual_header(fp_input)
                    st.code(txt, language=None)
                except Exception as e:
                    st.warning(f"Could not read text header: {e}")

        # Header scan
        st.markdown("### 📋 Step 1 — Quick Header Scan")
        if st.button("⚡ Scan Headers (no data loaded)", key="scan_btn"):
            with st.spinner("Reading headers..."):
                try:
                    hdr = get_segy_header_only(fp_input)
                    st.session_state["hdr_info"] = hdr
                    st.rerun()
                except Exception as e:
                    st.error(f"Header scan failed: {e}")

        if st.session_state.get("hdr_info"):
            h = st.session_state["hdr_info"]
            n_il = h.get("n_inlines", 0)
            n_xl = h.get("n_crosslines", 0)
            n_s  = h.get("n_samples", 0)
            sr   = h.get("sample_rate", 4.0)
            ram_est_gb = (n_il * n_xl * n_s * 4) / 1024**3

            st.markdown(f"""
            <div class='panel-card'>
            <div class='panel-title'>📦 Cube Dimensions</div>
            <div class='metric-row'>
                <div class='metric-card'><div class='metric-label'>Inlines</div>
                    <div class='metric-value'>{n_il:,}</div>
                    <div class='metric-unit'>{h["ilines"][0]}→{h["ilines"][-1]}</div></div>
                <div class='metric-card'><div class='metric-label'>Crosslines</div>
                    <div class='metric-value'>{n_xl:,}</div>
                    <div class='metric-unit'>{h["xlines"][0]}→{h["xlines"][-1]}</div></div>
                <div class='metric-card'><div class='metric-label'>Samples/Trace</div>
                    <div class='metric-value'>{n_s:,}</div></div>
                <div class='metric-card'><div class='metric-label'>Sample Rate</div>
                    <div class='metric-value'>{sr:.1f}</div>
                    <div class='metric-unit'>ms</div></div>
                <div class='metric-card'><div class='metric-label'>TWT Range</div>
                    <div class='metric-value'>0–{h["total_time_ms"]:.0f}</div>
                    <div class='metric-unit'>ms</div></div>
                <div class='metric-card'><div class='metric-label'>Est. RAM</div>
                    <div class='metric-value'>{ram_est_gb:.1f}</div>
                    <div class='metric-unit'>GB (float32)</div></div>
            </div>
            </div>
            """, unsafe_allow_html=True)

            if ram_est_gb > 12:
                st.markdown(f"""
                <div class='warning-box'>
                ⚠️ This cube needs ~{ram_est_gb:.1f} GB RAM. Your system has 16 GB.
                Loading may cause memory pressure. Consider exporting a smaller
                sub-volume from Petrel/OpendTect if this fails.
                </div>
                """, unsafe_allow_html=True)

            # Load button
            st.markdown("### 🔄 Step 2 — Load Cube")
            st.markdown(f"""
            <div class='info-box'>
            Loads using <b>segyio</b> with <code>ignore_geometry=True</code>,
            then stores in <b>st.cache_resource</b> (global Streamlit cache).
            Once loaded, the cube persists across all panels and survives
            browser reconnects — it will <b>never be lost</b> mid-session.
            </div>
            """, unsafe_allow_html=True)

            if not cube_is_cached(fp_input):
                if st.button("🔄 Load Full Cube into Cache",
                              type="primary", key="load_btn"):
                    prog = st.progress(0, text="Opening SEG-Y file...")
                    try:
                        prog.progress(10, text="Reading trace headers...")
                        with st.spinner("Loading cube — may take a few minutes..."):
                            cube, info = load_segy_cube(fp_input)

                        prog.progress(80, text="Computing amplitude scan...")
                        mt   = compute_mean_amplitude_trace(cube)
                        env  = compute_envelope_trace(mt)
                        sugg, _, _ = suggest_horizons(cube, info["sample_rate"])
                        info["filepath"] = fp_input
                        prog.progress(95, text="Storing in cache...")

                        # ── KEY: store in cache_resource, NOT session_state ──
                        store_cube(fp_input, cube, info)

                        # Only metadata in session_state
                        st.session_state["segy_loaded"]        = True
                        st.session_state["segy_info"]          = info
                        st.session_state["mean_trace"]         = mt
                        st.session_state["envelope"]           = env
                        st.session_state["suggested_horizons"] = sugg

                        prog.progress(100, text="✅ Done!")
                        st.success(
                            f"✅ Cube loaded into cache! "
                            f"Shape: {cube.shape[0]:,}×{cube.shape[1]:,}×{cube.shape[2]:,} "
                            f"| RAM: {info['ram_mb']:.0f} MB"
                        )
                        st.rerun()

                    except MemoryError:
                        st.error("❌ Not enough RAM. Export a smaller area from "
                                 "Petrel/OpendTect and try again.")
                    except Exception as e:
                        st.error(f"❌ Load failed: {e}")

    # ─────────────────────────────────────────────────────────────────────────
    # DISPLAY — retrieve cube from cache_resource
    # ─────────────────────────────────────────────────────────────────────────
    if not st.session_state.get("segy_loaded"):
        return

    info = st.session_state["segy_info"]
    fp   = info.get("filepath", DEMO_KEY)

    # Retrieve from cache — works even after browser reconnect
    cube, _ = (retrieve_demo_cube() if info["source"] == "synthetic"
               else retrieve_cube(fp))

    if cube is None:
        st.markdown("""
        <div class='warning-box'>
        ⚠️ Cube not found in cache (server may have restarted).
        Please reload the file.
        </div>
        """, unsafe_allow_html=True)
        st.session_state["segy_loaded"] = False
        return

    sr         = info["sample_rate"]
    total_ms   = info["total_time_ms"]
    ilines_all = info["ilines"]
    xlines_all = info["xlines"]
    n_il       = info["n_inlines"]
    n_xl       = info["n_crosslines"]
    n_s        = info["n_samples"]

    st.markdown(f"""
    <div class='panel-card'>
    <div class='panel-title'>📦 Loaded Cube
        <span class='badge badge-success'>In Cache</span>
    </div>
    <div class='metric-row'>
        <div class='metric-card'><div class='metric-label'>Inlines</div>
            <div class='metric-value'>{n_il:,}</div>
            <div class='metric-unit'>{ilines_all[0]}→{ilines_all[-1]}</div></div>
        <div class='metric-card'><div class='metric-label'>Crosslines</div>
            <div class='metric-value'>{n_xl:,}</div>
            <div class='metric-unit'>{xlines_all[0]}→{xlines_all[-1]}</div></div>
        <div class='metric-card'><div class='metric-label'>Samples/Trace</div>
            <div class='metric-value'>{n_s:,}</div>
            <div class='metric-unit'>full depth</div></div>
        <div class='metric-card'><div class='metric-label'>TWT Range</div>
            <div class='metric-value'>0–{total_ms:.0f}</div>
            <div class='metric-unit'>ms</div></div>
        <div class='metric-card'><div class='metric-label'>Sample Rate</div>
            <div class='metric-value'>{sr:.1f}</div>
            <div class='metric-unit'>ms</div></div>
        <div class='metric-card'><div class='metric-label'>RAM</div>
            <div class='metric-value'>{info.get("ram_mb",0)/1024:.1f}</div>
            <div class='metric-unit'>GB</div></div>
    </div>
    </div>
    """, unsafe_allow_html=True)

    # ── Section Viewer ────────────────────────────────────────────────────────
    st.markdown("### 📺 Seismic Section Viewer")
    tab_il, tab_xl, tab_ts = st.tabs([
        "📏 Inline Section", "📐 Crossline Section", "🕒 Time Slice"
    ])

    il_min = ilines_all[0];  il_max = ilines_all[-1]
    xl_min = xlines_all[0];  xl_max = xlines_all[-1]
    il_mid = ilines_all[n_il // 2]
    xl_mid = xlines_all[n_xl // 2]
    il_stp = max(1, ilines_all[1] - ilines_all[0]) if n_il > 1 else 1
    xl_stp = max(1, xlines_all[1] - xlines_all[0]) if n_xl > 1 else 1

    with tab_il:
        st.markdown(f"<div class='info-box'>{n_il:,} inlines: <b>{il_min} → {il_max}</b></div>",
                    unsafe_allow_html=True)
        il_num = st.number_input(f"Inline ({il_min}→{il_max})",
                                  il_min, il_max, il_mid, il_stp, key="il_sel")
        il_idx = (ilines_all.index(il_num) if il_num in ilines_all
                  else min(range(n_il), key=lambda i: abs(ilines_all[i] - il_num)))

        section = get_inline_section(cube, il_idx)
        top_s = base_s = None
        if st.session_state.get("horizon_top") is not None:
            th = st.session_state["horizon_top"]
            bh = st.session_state["horizon_base"]
            if il_idx < th.shape[0]:
                top_s  = int(np.nanmean(th[il_idx, :]))
                base_s = int(np.nanmean(bh[il_idx, :]))

        st.caption(f"Inline {ilines_all[il_idx]} — {section.shape[0]} traces × {section.shape[1]} samples")
        fig = plot_seismic_section(section, sr,
                                   title=f"Inline {ilines_all[il_idx]}",
                                   top_sample=top_s, base_sample=base_s)
        st.plotly_chart(fig, use_container_width=True)

    with tab_xl:
        st.markdown(f"<div class='info-box'>{n_xl:,} crosslines: <b>{xl_min} → {xl_max}</b></div>",
                    unsafe_allow_html=True)
        xl_num = st.number_input(f"Crossline ({xl_min}→{xl_max})",
                                  xl_min, xl_max, xl_mid, xl_stp, key="xl_sel")
        xl_idx = (xlines_all.index(xl_num) if xl_num in xlines_all
                  else min(range(n_xl), key=lambda i: abs(xlines_all[i] - xl_num)))

        section = get_crossline_section(cube, xl_idx)
        top_s = base_s = None
        if st.session_state.get("horizon_top") is not None:
            th = st.session_state["horizon_top"]
            bh = st.session_state["horizon_base"]
            if xl_idx < th.shape[1]:
                top_s  = int(np.nanmean(th[:, xl_idx]))
                base_s = int(np.nanmean(bh[:, xl_idx]))

        st.caption(f"Crossline {xlines_all[xl_idx]} — {section.shape[0]} traces × {section.shape[1]} samples")
        fig = plot_seismic_section(section, sr,
                                   title=f"Crossline {xlines_all[xl_idx]}",
                                   top_sample=top_s, base_sample=base_s)
        st.plotly_chart(fig, use_container_width=True)

    with tab_ts:
        st.markdown(f"<div class='info-box'>Time range: <b>0 → {total_ms:.0f} ms</b></div>",
                    unsafe_allow_html=True)
        ts_ms  = st.number_input(f"Time slice (ms, 0→{total_ms:.0f})",
                                  0.0, total_ms,
                                  min(2470.0, total_ms * 0.4),
                                  sr, key="ts_sel")
        ts_idx = min(int(ts_ms / sr), n_s - 1)
        slc    = get_time_slice(cube, ts_idx)
        vmax   = float(np.percentile(np.abs(slc), 98)) or 1.0

        fig = go.Figure(data=go.Heatmap(
            z=slc, x=xlines_all, y=ilines_all,
            colorscale="RdBu", reversescale=True,
            zmid=0, zmin=-vmax, zmax=vmax,
            colorbar=dict(
                title=dict(text="Amplitude", font=dict(color="#8aafc0")),
                tickfont=dict(color="#8aafc0"),
            ),
        ))
        fig.update_layout(
            paper_bgcolor="#162840", plot_bgcolor="#0a1628",
            font=dict(family="Space Grotesk, sans-serif", color="#e8f4f8", size=12),
            title=dict(text=f"Time Slice @ {ts_ms:.0f} ms",
                       font=dict(color="#e8f4f8", size=14)),
            xaxis=dict(title="Crossline", color="#8aafc0",
                       gridcolor="rgba(42,155,176,0.15)", tickformat=".0f"),
            yaxis=dict(title="Inline",    color="#8aafc0",
                       gridcolor="rgba(42,155,176,0.15)", tickformat=".0f"),
            height=520, margin=dict(l=70, r=20, t=50, b=50),
        )
        st.plotly_chart(fig, use_container_width=True)

    # ── Horizon Suggestions ───────────────────────────────────────────────────
    st.markdown("### 🎯 Horizon Depth Suggestions")
    if st.button("🔍 Scan for Horizon Candidates", key="scan_sugg_btn"):
        mt   = compute_mean_amplitude_trace(cube)
        env  = compute_envelope_trace(mt)
        sugg, _, _ = suggest_horizons(cube, sr)
        st.session_state.update({
            "mean_trace": mt, "envelope": env,
            "suggested_horizons": sugg,
        })
        st.rerun()

    if st.session_state.get("mean_trace") is not None:
        c1, c2 = st.columns(2)
        with c1:
            fig = plot_amplitude_spectrum(
                st.session_state["mean_trace"],
                st.session_state["envelope"], sr,
                suggestions=st.session_state.get("suggested_horizons"),
            )
            st.plotly_chart(fig, use_container_width=True)
        with c2:
            sugg = st.session_state.get("suggested_horizons", [])
            if sugg:
                rows = "".join(
                    f"<tr><td>#{i+1}</td><td><b>{s['time_ms']:.0f} ms</b></td>"
                    f"<td>{s['amplitude']:.4f}</td>"
                    f"<td><span style='color:{'#2ecc71' if s['confidence']>70 else '#f39c12' if s['confidence']>40 else '#e74c3c'};font-weight:600;'>"
                    f"{s['confidence']}%</span></td></tr>"
                    for i, s in enumerate(sugg)
                )
                st.markdown(f"""<br>
                <table class='results-table'>
                    <thead><tr><th>#</th><th>Time (ms)</th>
                    <th>Amplitude</th><th>Confidence</th></tr></thead>
                    <tbody>{rows}</tbody>
                </table>""", unsafe_allow_html=True)

    st.markdown("""
    <br><div class='info-box'>
    👉 <b>Next:</b> Go to <b>📐 Horizon Picking</b> — type your target depth
    and GeoVol picks the horizon on every trace.
    </div>""", unsafe_allow_html=True)
