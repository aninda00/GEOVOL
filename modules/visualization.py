"""
modules/visualization.py
All Plotly charts: seismic sections, horizon maps,
Monte Carlo histograms, tornado charts, 3D surfaces.
"""

import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

# ── Color theme ─────────────────────────────────────────────────────────────
BG = "#0a1628"
BG_CARD = "#162840"
TEAL = "#2a9bb0"
ACCENT = "#f0a500"
TEXT = "#e8f4f8"
TEXT2 = "#8aafc0"
GRID = "rgba(42,155,176,0.15)"

LAYOUT_BASE = dict(
    paper_bgcolor=BG_CARD,
    plot_bgcolor=BG,
    font=dict(family="Space Grotesk, sans-serif", color=TEXT, size=12),
    margin=dict(l=50, r=30, t=50, b=40),
)


# ── Seismic Section ──────────────────────────────────────────────────────────

def plot_seismic_section(section_data, sample_rate, title="Seismic Section",
                          top_sample=None, base_sample=None):
    """
    Plot a 2D seismic section (inline or crossline).
    section_data: 2D array (n_traces × n_samples)
    Always shows the FULL time range (e.g. 0–6000ms) with no clipping.
    """
    n_traces, n_samples = section_data.shape
    times = np.arange(n_samples) * sample_rate
    total_time_ms = times[-1]

    # Dynamic height: 120px per 1000ms so 6000ms → 720px, always readable
    height = max(500, min(900, int(total_time_ms * 0.12) + 100))

    fig = go.Figure()

    fig.add_trace(go.Heatmap(
        z=section_data.T,
        x=list(range(n_traces)),
        y=times,
        colorscale="RdBu",
        reversescale=True,
        zmid=0,
        zmin=-np.percentile(np.abs(section_data), 98),
        zmax=np.percentile(np.abs(section_data), 98),
        colorbar=dict(
            title=dict(text="Amplitude", font=dict(color=TEXT2)),
            tickfont=dict(color=TEXT2),
            bgcolor=BG_CARD,
        ),
        showscale=True,
    ))

    # Overlay horizon lines
    if top_sample is not None:
        fig.add_hline(
            y=top_sample * sample_rate,
            line=dict(color=ACCENT, width=2, dash="dash"),
            annotation_text="  Top Reservoir",
            annotation_font_color=ACCENT,
            annotation_font_size=11,
        )
    if base_sample is not None:
        fig.add_hline(
            y=base_sample * sample_rate,
            line=dict(color="#e74c3c", width=2, dash="dash"),
            annotation_text="  Base Reservoir",
            annotation_font_color="#e74c3c",
            annotation_font_size=11,
        )

    # Tick every 500ms so the full section is easy to read
    tick_interval = 500 if total_time_ms >= 3000 else 250
    tickvals = list(range(0, int(total_time_ms) + tick_interval, tick_interval))

    fig.update_layout(
        **LAYOUT_BASE,
        title=dict(text=f"{title}  (0 – {total_time_ms:.0f} ms)", font=dict(color=TEXT, size=14)),
        xaxis=dict(title="Trace", gridcolor=GRID, color=TEXT2),
        yaxis=dict(
            title="Two-Way Time (ms)",
            gridcolor=GRID,
            color=TEXT2,
            range=[total_time_ms, 0],
            tickvals=tickvals,
            ticktext=[str(v) for v in tickvals],
            autorange=False,
        ),
        height=height,
    )
    return fig


def plot_amplitude_spectrum(mean_trace, envelope, sample_rate, suggestions=None):
    """Plot mean amplitude trace with envelope and suggested horizons."""
    times = np.arange(len(mean_trace)) * sample_rate

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=mean_trace, y=times,
        mode='lines',
        line=dict(color=TEAL, width=1.2),
        name='Mean Trace',
        opacity=0.8,
    ))

    fig.add_trace(go.Scatter(
        x=envelope, y=times,
        mode='lines',
        line=dict(color=ACCENT, width=1.5),
        name='Envelope',
    ))

    fig.add_trace(go.Scatter(
        x=-envelope, y=times,
        mode='lines',
        line=dict(color=ACCENT, width=1.5, dash='dot'),
        showlegend=False,
        opacity=0.5,
    ))

    if suggestions:
        for s in suggestions:
            fig.add_hline(
                y=s["time_ms"],
                line=dict(color="#2ecc71", width=1, dash="dot"),
                annotation_text=f"  {s['time_ms']:.0f}ms",
                annotation_font_color="#2ecc71",
                annotation_font_size=10,
            )

    fig.update_layout(
        **LAYOUT_BASE,
        title=dict(text="Mean Amplitude Trace & Suggested Horizons", font=dict(color=TEXT, size=14)),
        xaxis=dict(title="Amplitude", gridcolor=GRID, color=TEXT2),
        yaxis=dict(title="Time (ms)", gridcolor=GRID, color=TEXT2, autorange="reversed"),
        height=450,
        legend=dict(bgcolor="rgba(0,0,0,0.3)", bordercolor=GRID),
    )
    return fig


# ── Horizon Maps ─────────────────────────────────────────────────────────────

def _downsample_2d(arr, max_size=500):
    """
    Downsample a 2D array to at most max_size × max_size for display.
    Uses block-mean averaging — preserves structural features.
    The browser can only render ~500-800 pixels anyway.
    Sending 927×927 = 860k points to the browser causes it to freeze.
    """
    n_il, n_xl = arr.shape
    if n_il <= max_size and n_xl <= max_size:
        return arr, n_il, n_xl   # already small enough

    step_il   = max(1, n_il // max_size)
    step_xl   = max(1, n_xl // max_size)
    il_blocks = n_il // step_il
    xl_blocks = n_xl // step_xl
    trimmed   = arr[:il_blocks * step_il, :xl_blocks * step_xl]
    ds        = trimmed.reshape(il_blocks, step_il,
                                xl_blocks, step_xl).mean(axis=(1, 3))
    return ds.astype(np.float32), il_blocks, xl_blocks


def plot_horizon_map(horizon_surface, sample_rate, title="Horizon Map",
                     colorscale="rainbow", ilines=None, xlines=None,
                     velocity=2500, convert_to_depth=False):
    """
    Horizon map — server-side downsampled to max 500×500 before
    sending to browser. Prevents browser freeze on large grids.
    Still shows real coordinates, Petrel colorscale and contours.
    """
    from scipy.ndimage import gaussian_filter

    n_il, n_xl = horizon_surface.shape

    # Convert units
    if convert_to_depth:
        surface_values = -(horizon_surface * sample_rate / 2000.0) * velocity
        unit_label = "Depth (m)"
    else:
        surface_values = horizon_surface * sample_rate
        unit_label = "Time (ms)"

    # Smooth to remove picking noise
    smoothed = gaussian_filter(surface_values.astype(float), sigma=1.5).astype(np.float32)

    # Downsample for display — KEY fix for browser freeze
    ds_surface, n_ds_il, n_ds_xl = _downsample_2d(smoothed, max_size=500)
    was_ds = (n_ds_il < n_il or n_ds_xl < n_xl)

    # Coordinates
    y_coords = np.array(ilines, dtype=float) if (ilines and len(ilines) == n_il) \
               else np.arange(n_il, dtype=float)
    x_coords = np.array(xlines, dtype=float) if (xlines and len(xlines) == n_xl) \
               else np.arange(n_xl, dtype=float)
    y_ds = np.linspace(y_coords[0], y_coords[-1], n_ds_il)
    x_ds = np.linspace(x_coords[0], x_coords[-1], n_ds_xl)

    # Petrel rainbow colorscale
    petrel_cs = [
        [0.00, "#ff00ff"], [0.10, "#8a2be2"], [0.20, "#0000cd"],
        [0.30, "#1e90ff"], [0.40, "#00ced1"], [0.50, "#00ff7f"],
        [0.60, "#adff2f"], [0.70, "#ffd700"], [0.80, "#ff8c00"],
        [0.90, "#ff4500"], [1.00, "#ff0000"],
    ]
    vmin = float(np.nanmin(ds_surface))
    vmax = float(np.nanmax(ds_surface))

    ds_note = f" — display {n_ds_il}×{n_ds_xl} (full {n_il}×{n_xl})" if was_ds else ""

    fig = go.Figure()
    fig.add_trace(go.Heatmap(
        z=ds_surface, x=x_ds, y=y_ds,
        colorscale=petrel_cs, zmin=vmin, zmax=vmax,
        colorbar=dict(
            title=dict(text=unit_label, font=dict(color=TEXT2, size=11)),
            tickfont=dict(color=TEXT2, size=10),
            tickformat=".0f", thickness=15, len=0.85,
        ),
        hoverongaps=False,
        hovertemplate=f"XL: %{{x:.0f}}<br>IL: %{{y:.0f}}<br>{unit_label}: %{{z:.1f}}<extra></extra>",
    ))

    # Contour lines
    cs = max(1.0, (vmax - vmin) / 12) if vmax > vmin else 1.0
    fig.add_trace(go.Contour(
        z=ds_surface, x=x_ds, y=y_ds, showscale=False,
        contours=dict(coloring="none", showlines=True,
                      start=vmin, end=vmax, size=cs),
        line=dict(color="rgba(0,0,0,0.45)", width=0.6),
        hoverinfo="skip",
    ))

    fig.update_layout(
        paper_bgcolor=BG_CARD, plot_bgcolor=BG,
        font=dict(family="Space Grotesk, sans-serif", color=TEXT, size=12),
        margin=dict(l=60, r=20, t=50, b=50),
        title=dict(text=f"{title}{ds_note}", font=dict(color=TEXT, size=14)),
        xaxis=dict(title="Crossline", gridcolor=GRID, color=TEXT2, tickformat=".0f"),
        yaxis=dict(title="Inline", gridcolor=GRID, color=TEXT2, tickformat=".0f",
                   scaleanchor="x", scaleratio=1.0),
        height=520,
    )
    return fig


def plot_isochore_map(isochore_m, ilines=None, xlines=None):
    """Isochore map — downsampled to max 500×500 to prevent browser freeze."""
    from scipy.ndimage import gaussian_filter

    n_il, n_xl = isochore_m.shape

    smoothed = gaussian_filter(isochore_m.astype(float), sigma=1.5).astype(np.float32)
    smoothed = np.where(smoothed < 0, 0, smoothed)

    # Downsample for display
    ds_surface, n_ds_il, n_ds_xl = _downsample_2d(smoothed, max_size=500)
    was_ds = (n_ds_il < n_il or n_ds_xl < n_xl)

    y_coords = np.array(ilines, dtype=float) if (ilines and len(ilines) == n_il) \
               else np.arange(n_il, dtype=float)
    x_coords = np.array(xlines, dtype=float) if (xlines and len(xlines) == n_xl) \
               else np.arange(n_xl, dtype=float)
    y_ds = np.linspace(y_coords[0], y_coords[-1], n_ds_il)
    x_ds = np.linspace(x_coords[0], x_coords[-1], n_ds_xl)

    vmin = 0
    vmax = float(np.nanmax(ds_surface))
    ds_note = f" — display {n_ds_il}×{n_ds_xl}" if was_ds else ""

    isochore_cs = [
        [0.00, "#0a1628"], [0.15, "#1a4a5a"], [0.35, "#2a9bb0"],
        [0.60, "#adff2f"], [0.80, "#f0a500"], [1.00, "#e74c3c"],
    ]

    fig = go.Figure()
    fig.add_trace(go.Heatmap(
        z=ds_surface, x=x_ds, y=y_ds,
        colorscale=isochore_cs, zmin=vmin, zmax=vmax,
        colorbar=dict(
            title=dict(text="Thickness (m)", font=dict(color=TEXT2, size=11)),
            tickfont=dict(color=TEXT2, size=10), thickness=15, len=0.85,
        ),
        hovertemplate="XL: %{x:.0f}<br>IL: %{y:.0f}<br>Thickness: %{z:.1f} m<extra></extra>",
    ))

    if vmax > 0:
        cs = max(0.1, vmax / 10)
        fig.add_trace(go.Contour(
            z=ds_surface, x=x_ds, y=y_ds, showscale=False,
            contours=dict(coloring="none", showlines=True,
                          start=vmin, end=vmax, size=cs),
            line=dict(color="rgba(0,0,0,0.5)", width=0.6),
            hoverinfo="skip",
        ))

    fig.update_layout(
        paper_bgcolor=BG_CARD, plot_bgcolor=BG,
        font=dict(family="Space Grotesk, sans-serif", color=TEXT, size=12),
        margin=dict(l=60, r=20, t=50, b=50),
        title=dict(text=f"Reservoir Isochore (Thickness) Map{ds_note}",
                   font=dict(color=TEXT, size=14)),
        xaxis=dict(title="Crossline", gridcolor=GRID, color=TEXT2, tickformat=".0f"),
        yaxis=dict(title="Inline",    gridcolor=GRID, color=TEXT2, tickformat=".0f",
                   scaleanchor="x", scaleratio=1.0),
        height=520,
    )
    return fig


# ── Monte Carlo Charts ────────────────────────────────────────────────────────

def plot_mc_histogram(mc_results, fluid="oiip"):
    """Plot Monte Carlo result histogram with P10/P50/P90 lines."""
    if fluid not in mc_results:
        return None

    r = mc_results[fluid]
    values = r["raw"]
    unit = r["unit"]
    label = "OIIP" if fluid == "oiip" else "GIIP"
    color = TEAL if fluid == "oiip" else ACCENT

    fig = go.Figure()

    fig.add_trace(go.Histogram(
        x=values,
        nbinsx=80,
        name=label,
        marker=dict(color=color, opacity=0.75, line=dict(color=BG, width=0.3)),
    ))

    for pct, val, lbl, clr in [
        (10, r["p10"], "P10", "#e74c3c"),
        (50, r["p50"], "P50", "#2ecc71"),
        (90, r["p90"], "P90", "#f39c12"),
    ]:
        fig.add_vline(
            x=val,
            line=dict(color=clr, width=2, dash="dash"),
            annotation_text=f"P{pct}: {val:.1f}",
            annotation_font_color=clr,
            annotation_font_size=11,
        )

    fig.update_layout(
        **LAYOUT_BASE,
        title=dict(text=f"{label} Monte Carlo Distribution ({len(values):,} simulations)", font=dict(color=TEXT, size=14)),
        xaxis=dict(title=f"{label} ({unit})", gridcolor=GRID, color=TEXT2),
        yaxis=dict(title="Frequency", gridcolor=GRID, color=TEXT2),
        height=380,
        showlegend=False,
    )
    return fig


def plot_tornado_chart(mc_results, fluid="oiip"):
    """Plot tornado chart showing sensitivity of output to each input."""
    if "sensitivity" not in mc_results or fluid not in mc_results["sensitivity"]:
        return None

    sens = mc_results["sensitivity"][fluid]
    label = "OIIP" if fluid == "oiip" else "GIIP"

    params = list(sens.keys())
    corrs = list(sens.values())

    # Sort by absolute correlation
    sorted_idx = np.argsort(np.abs(corrs))
    params = [params[i] for i in sorted_idx]
    corrs = [corrs[i] for i in sorted_idx]

    colors = [ACCENT if c > 0 else "#e74c3c" for c in corrs]

    fig = go.Figure(go.Bar(
        x=corrs,
        y=params,
        orientation='h',
        marker=dict(color=colors, opacity=0.85),
        text=[f"{c:+.3f}" for c in corrs],
        textposition='outside',
        textfont=dict(color=TEXT2, size=11),
    ))

    fig.add_vline(x=0, line=dict(color=TEXT2, width=1))

    fig.update_layout(
        **LAYOUT_BASE,
        title=dict(text=f"{label} Sensitivity (Correlation Coefficients)", font=dict(color=TEXT, size=14)),
        xaxis=dict(title="Pearson Correlation", gridcolor=GRID, color=TEXT2,
                   range=[-1.1, 1.1]),
        yaxis=dict(gridcolor=GRID, color=TEXT2),
        height=320,
        showlegend=False,
    )
    return fig


def plot_summary_bar(mc_results):
    """Side-by-side P10/P50/P90 bar chart for all fluids."""
    fluids = []
    p10s, p50s, p90s = [], [], []
    units = []

    for fluid, label in [("oiip", "OIIP (MMstb)"), ("giip", "GIIP (Bscf)")]:
        if fluid in mc_results:
            r = mc_results[fluid]
            fluids.append(label)
            p10s.append(r["p10"])
            p50s.append(r["p50"])
            p90s.append(r["p90"])

    if not fluids:
        return None

    fig = go.Figure()
    for vals, name, color in [
        (p10s, "P10 (Low)", "#e74c3c"),
        (p50s, "P50 (Best)", "#2ecc71"),
        (p90s, "P90 (High)", "#f39c12"),
    ]:
        fig.add_trace(go.Bar(
            name=name,
            x=fluids,
            y=vals,
            marker_color=color,
            opacity=0.85,
            text=[f"{v:.1f}" for v in vals],
            textposition='outside',
            textfont=dict(color=TEXT),
        ))

    fig.update_layout(
        **LAYOUT_BASE,
        title=dict(text="Volumetric Results Summary", font=dict(color=TEXT, size=14)),
        barmode='group',
        xaxis=dict(gridcolor=GRID, color=TEXT2),
        yaxis=dict(title="Volume", gridcolor=GRID, color=TEXT2),
        legend=dict(bgcolor="rgba(0,0,0,0.3)", bordercolor=GRID),
        height=360,
    )
    return fig


# ── 3D Visualization ──────────────────────────────────────────────────────────

def plot_3d_reservoir(top_horizon, base_horizon, sample_rate,
                       inline_spacing=25, crossline_spacing=25, velocity=2500,
                       ilines=None, xlines=None):
    """
    Petrel-quality 3D reservoir visualization.
    - Real UTM-style coordinates if ilines/xlines provided
    - Depth-colored top surface (warm=shallow, cool=deep) matching Petrel style
    - Stratigraphic side walls showing layering
    - Proper structural complexity from horizon picking
    """
    n_il, n_xl = top_horizon.shape

    # ── Coordinates ──────────────────────────────────────────────────────────
    if ilines is not None and len(ilines) == n_il:
        il_coords = np.array(ilines, dtype=float)
    else:
        il_coords = np.arange(n_il) * inline_spacing

    if xlines is not None and len(xlines) == n_xl:
        xl_coords = np.array(xlines, dtype=float)
    else:
        xl_coords = np.arange(n_xl) * crossline_spacing

    xl_grid, il_grid = np.meshgrid(xl_coords, il_coords)

    # ── TWT → depth conversion ────────────────────────────────────────────────
    top_depth  = (top_horizon  * sample_rate / 2000.0) * velocity   # positive = depth below surface
    base_depth = (base_horizon * sample_rate / 2000.0) * velocity

    # Negate for plotting (Z axis: negative = deeper, matching Petrel convention)
    z_top  = -top_depth
    z_base = -base_depth

    # Smooth slightly to reduce seismic picking noise on surface
    from scipy.ndimage import uniform_filter
    z_top_smooth  = -uniform_filter(top_depth,  size=3)
    z_base_smooth = -uniform_filter(base_depth, size=3)

    # ── Petrel-style depth colorscale ─────────────────────────────────────────
    # Warm (orange/red/yellow) = shallow, Cool (green/blue/purple) = deep
    # Matches Petrel's default "Rainbow" depth colormap
    petrel_colorscale = [
        [0.00, "#ff0000"],   # red      — shallowest
        [0.10, "#ff4500"],   # orange-red
        [0.20, "#ff8c00"],   # dark orange
        [0.30, "#ffd700"],   # gold
        [0.40, "#adff2f"],   # green-yellow
        [0.50, "#00ff7f"],   # spring green
        [0.60, "#00ced1"],   # dark turquoise
        [0.70, "#1e90ff"],   # dodger blue
        [0.80, "#0000cd"],   # medium blue
        [0.90, "#8a2be2"],   # blue-violet
        [1.00, "#ff00ff"],   # magenta   — deepest
    ]

    depth_min = float(np.nanmin(top_depth))
    depth_max = float(np.nanmax(top_depth))

    fig = go.Figure()

    # ── 1. Top reservoir surface — depth colored like Petrel ─────────────────
    fig.add_trace(go.Surface(
        x=xl_grid,
        y=il_grid,
        z=z_top_smooth,
        surfacecolor=top_depth,          # color by actual depth value
        colorscale=petrel_colorscale,
        cmin=depth_min,
        cmax=depth_max,
        opacity=1.0,
        name="Top Reservoir",
        showscale=True,
        colorbar=dict(
            title=dict(text="Elevation Depth (m)", font=dict(color=TEXT2, size=11)),
            tickfont=dict(color=TEXT2, size=10),
            tickformat=".0f",
            len=0.6,
            thickness=15,
            x=1.02,
        ),
        lighting=dict(
            ambient=0.6,
            diffuse=0.8,
            specular=0.3,
            roughness=0.5,
            fresnel=0.2,
        ),
        contours=dict(
            z=dict(
                show=True,
                usecolormap=True,
                highlightcolor="white",
                project_z=False,
                width=1,
            )
        ),
    ))

    # ── 2. Base reservoir surface ─────────────────────────────────────────────
    fig.add_trace(go.Surface(
        x=xl_grid,
        y=il_grid,
        z=z_base_smooth,
        colorscale=[[0, "#1a3a2a"], [1, "#2d6a4f"]],
        opacity=0.55,
        name="Base Reservoir",
        showscale=False,
        lighting=dict(ambient=0.5, diffuse=0.7),
    ))

    # ── 3. Side walls — stratigraphic layering (Petrel style) ────────────────
    n_layers = 8
    layer_colors = [
        "#8B4513", "#A0522D", "#CD853F", "#DEB887",
        "#D2691E", "#BC8A5F", "#8B6914", "#6B4226",
    ]

    # Inline-direction side walls (front and back)
    for xl_edge_idx, side_name in [(0, "front"), (n_xl - 1, "back")]:
        xl_val = xl_coords[xl_edge_idx]
        il_line = il_coords
        top_line  = z_top_smooth[:, xl_edge_idx]
        base_line = z_base_smooth[:, xl_edge_idx]

        # Draw N stacked layers between top and base
        for layer_i in range(n_layers):
            frac_top  = layer_i / n_layers
            frac_base = (layer_i + 1) / n_layers
            z_layer_top  = top_line  + frac_top  * (base_line - top_line)
            z_layer_base = top_line  + frac_base * (base_line - top_line)

            fig.add_trace(go.Surface(
                x=np.full((2, n_il), xl_val),
                y=np.vstack([il_line, il_line]),
                z=np.vstack([z_layer_top, z_layer_base]),
                colorscale=[[0, layer_colors[layer_i]], [1, layer_colors[layer_i]]],
                showscale=False,
                opacity=0.85,
                name=f"Layer {layer_i+1}",
                lighting=dict(ambient=0.7, diffuse=0.6),
            ))

    # ── 4. Crossline-direction side walls ────────────────────────────────────
    for il_edge_idx in [0, n_il - 1]:
        il_val = il_coords[il_edge_idx]
        xl_line = xl_coords
        top_line  = z_top_smooth[il_edge_idx, :]
        base_line = z_base_smooth[il_edge_idx, :]

        for layer_i in range(n_layers):
            frac_top  = layer_i / n_layers
            frac_base = (layer_i + 1) / n_layers
            z_layer_top  = top_line  + frac_top  * (base_line - top_line)
            z_layer_base = top_line  + frac_base * (base_line - top_line)

            fig.add_trace(go.Surface(
                x=np.vstack([xl_line, xl_line]),
                y=np.full((2, n_xl), il_val),
                z=np.vstack([z_layer_top, z_layer_base]),
                colorscale=[[0, layer_colors[layer_i]], [1, layer_colors[layer_i]]],
                showscale=False,
                opacity=0.85,
                lighting=dict(ambient=0.7, diffuse=0.6),
            ))

    # ── Layout ────────────────────────────────────────────────────────────────
    z_range_pad = (depth_max - depth_min) * 0.3
    il_range = [float(il_coords.min()), float(il_coords.max())]
    xl_range = [float(xl_coords.min()), float(xl_coords.max())]

    fig.update_layout(
        paper_bgcolor=BG,
        plot_bgcolor=BG,
        font=dict(family="Space Grotesk, sans-serif", color=TEXT, size=11),
        margin=dict(l=0, r=0, t=40, b=0),
        title=dict(
            text="3D Reservoir Model  —  Elevation Depth (m)",
            font=dict(color=TEXT, size=14)
        ),
        scene=dict(
            bgcolor="#000814",
            xaxis=dict(
                title="Crossline",
                backgroundcolor="#050f1a",
                gridcolor="rgba(255,255,255,0.08)",
                showbackground=True,
                color=TEXT2,
                range=xl_range,
            ),
            yaxis=dict(
                title="Inline",
                backgroundcolor="#050f1a",
                gridcolor="rgba(255,255,255,0.08)",
                showbackground=True,
                color=TEXT2,
                range=il_range,
            ),
            zaxis=dict(
                title="Depth (m)",
                backgroundcolor="#050f1a",
                gridcolor="rgba(255,255,255,0.08)",
                showbackground=True,
                color=TEXT2,
                range=[-depth_max - z_range_pad, -depth_min + z_range_pad],
            ),
            camera=dict(
                eye=dict(x=-1.6, y=-1.6, z=0.7),    # Petrel-like viewing angle
                up=dict(x=0, y=0, z=1),
            ),
            aspectmode="manual",
            aspectratio=dict(
                x=(xl_coords.max() - xl_coords.min()) / max(il_coords.max() - il_coords.min(), 1),
                y=1.0,
                z=0.35,   # vertically exaggerated like Petrel default
            ),
        ),
        height=600,
        showlegend=False,
    )

    return fig


def plot_log_tracks(las_df, depth_col, curves, top_depth=None, base_depth=None):
    """Plot well log tracks side by side."""
    n_tracks = len(curves)
    if n_tracks == 0:
        return None

    fig = make_subplots(rows=1, cols=n_tracks, shared_yaxes=True,
                        subplot_titles=curves,
                        horizontal_spacing=0.02)

    colors_list = [TEAL, ACCENT, "#2ecc71", "#e74c3c", "#9b59b6"]

    for i, curve in enumerate(curves, 1):
        if curve not in las_df.columns:
            continue
        color = colors_list[(i - 1) % len(colors_list)]
        fig.add_trace(
            go.Scatter(
                x=las_df[curve],
                y=las_df[depth_col],
                mode='lines',
                line=dict(color=color, width=1.2),
                name=curve,
            ),
            row=1, col=i
        )

    # Shade reservoir zone
    if top_depth and base_depth:
        for i in range(1, n_tracks + 1):
            fig.add_hrect(
                y0=top_depth, y1=base_depth,
                fillcolor="rgba(240,165,0,0.1)",
                line=dict(color=ACCENT, width=1, dash="dot"),
                row=1, col=i,
            )

    fig.update_yaxes(autorange="reversed", gridcolor=GRID, color=TEXT2)
    fig.update_xaxes(gridcolor=GRID, color=TEXT2)
    fig.update_layout(
        **LAYOUT_BASE,
        title=dict(text="Well Log Tracks", font=dict(color=TEXT, size=14)),
        height=500,
        showlegend=False,
    )
    return fig
