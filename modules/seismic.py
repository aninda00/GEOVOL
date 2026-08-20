"""
modules/seismic.py

Correct segyio approach based on proven workflow:
    import segyio
    with segyio.open(file, 'r') as f:
        f.mmap()
        data = segyio.tools.cube(f)   # shape: (inlines, crosslines, samples)

Then slice directly:
    inline_section    = data[il_idx, :, :]     # shape (crosslines, samples)
    crossline_section = data[:, xl_idx, :]     # shape (inlines, samples)
    time_slice        = data[:, :, t_idx]      # shape (inlines, crosslines)
"""

import numpy as np
from scipy.signal import find_peaks, hilbert
from scipy.ndimage import uniform_filter1d


# ─────────────────────────────────────────────────────────────────────────────
# SYNTHETIC DEMO CUBE
# ─────────────────────────────────────────────────────────────────────────────

def _ricker_wavelet(frequency, sample_rate, length=60):
    dt   = sample_rate / 1000.0
    t    = np.linspace(-length / 2 * dt, length / 2 * dt, length)
    pft2 = (np.pi * frequency * t) ** 2
    return (1 - 2 * pft2) * np.exp(-pft2)


def generate_synthetic_cube(n_inlines=30, n_crosslines=30,
                             n_samples=1500, sample_rate=4):
    np.random.seed(42)
    cube = np.zeros((n_inlines, n_crosslines, n_samples))
    reflectors = [80, 200, 350, 500, 617, 750, 900]
    amplitudes = [0.6, -0.5, 0.8, -0.4, 1.2, -0.7, 0.5]
    for rs, amp in zip(reflectors, amplitudes):
        for il in range(n_inlines):
            for xl in range(n_crosslines):
                shift = int(il * 0.4 + xl * 0.3)
                pos   = min(rs + shift, n_samples - 30)
                wav   = amp * _ricker_wavelet(30, sample_rate)
                end   = min(pos + len(wav), n_samples)
                cube[il, xl, pos:end] += wav[:end - pos]
    cube += np.random.normal(0, 0.04, cube.shape)
    return cube.astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# LOAD SEG-Y — THE CORRECT WAY
# ─────────────────────────────────────────────────────────────────────────────

def load_segy_cube(filepath):
    """
    Load a SEG-Y file into a numpy cube.
    Always uses ignore_geometry=True to handle any file structure.
    Then uses segyio.tools.cube() to build the 3D array.
    shape: (n_inlines, n_crosslines, n_samples)
    """
    import segyio

    with segyio.open(filepath, 'r', ignore_geometry=True) as f:
        f.mmap()
        sample_rate  = segyio.tools.dt(f) / 1000.0
        n_samples    = f.samples.size
        n_traces     = f.tracecount

        # Read all inline/crossline header values to build geometry
        iline_vals = f.attributes(segyio.TraceField.INLINE_3D)[:]
        xline_vals = f.attributes(segyio.TraceField.CROSSLINE_3D)[:]

        ilines_unique = sorted(set(iline_vals.tolist()))
        xlines_unique = sorted(set(xline_vals.tolist()))
        n_il = len(ilines_unique)
        n_xl = len(xlines_unique)

        # Build lookup: inline/crossline number -> index
        il_to_idx = {il: i for i, il in enumerate(ilines_unique)}
        xl_to_idx = {xl: j for j, xl in enumerate(xlines_unique)}

        # Pre-allocate cube
        cube = np.zeros((n_il, n_xl, n_samples), dtype=np.float32)

        # Fill cube trace by trace
        for t in range(n_traces):
            il  = int(iline_vals[t])
            xl  = int(xline_vals[t])
            i   = il_to_idx.get(il)
            j   = xl_to_idx.get(xl)
            if i is not None and j is not None:
                cube[i, j, :] = f.trace[t].astype(np.float32)

    info = {
        "source":        "segy",
        "n_inlines":     n_il,
        "n_crosslines":  n_xl,
        "n_samples":     n_samples,
        "sample_rate":   sample_rate,
        "total_time_ms": (n_samples - 1) * sample_rate,
        "ilines":        ilines_unique,
        "xlines":        xlines_unique,
        "ram_mb":        round(cube.nbytes / 1024**2, 1),
    }
    return cube, info


def get_segy_header_only(filepath):
    """Read only headers — no trace data. Always uses ignore_geometry=True."""
    import segyio, os

    with segyio.open(filepath, 'r', ignore_geometry=True) as f:
        sample_rate = segyio.tools.dt(f) / 1000.0
        n_samples   = f.samples.size
        n_traces    = f.tracecount

        iline_vals  = f.attributes(segyio.TraceField.INLINE_3D)[:]
        xline_vals  = f.attributes(segyio.TraceField.CROSSLINE_3D)[:]

        ilines = sorted(set(iline_vals.tolist()))
        xlines = sorted(set(xline_vals.tolist()))

    return {
        "n_inlines":     len(ilines),
        "n_crosslines":  len(xlines),
        "n_samples":     n_samples,
        "n_traces":      n_traces,
        "sample_rate":   sample_rate,
        "total_time_ms": (n_samples - 1) * sample_rate,
        "ilines":        ilines,
        "xlines":        xlines,
        "file_size_mb":  round(os.path.getsize(filepath) / 1024**2, 1),
    }


def get_textual_header(filepath):
    """Read EBCDIC text header. Always uses ignore_geometry=True."""
    import segyio
    with segyio.open(filepath, 'r', ignore_geometry=True) as f:
        try:
            return segyio.tools.wrap(f.text[0])
        except Exception:
            return "Could not read text header"


# ─────────────────────────────────────────────────────────────────────────────
# SLICE THE CUBE — inline, crossline, time slice
# ─────────────────────────────────────────────────────────────────────────────

def get_inline_section(cube, il_index):
    """
    Extract one inline section from cube.
    cube shape: (n_il, n_xl, n_samples)
    Returns shape: (n_xl, n_samples)  — ready for imshow with .T
    """
    return cube[il_index, :, :]


def get_crossline_section(cube, xl_index):
    """
    Extract one crossline section from cube.
    Returns shape: (n_il, n_samples)  — ready for imshow with .T
    """
    return cube[:, xl_index, :]


def get_time_slice(cube, t_index):
    """
    Extract horizontal time/depth slice.
    Returns shape: (n_il, n_xl)
    """
    return cube[:, :, t_index]


# ─────────────────────────────────────────────────────────────────────────────
# AMPLITUDE & HORIZON SUGGESTION
# ─────────────────────────────────────────────────────────────────────────────

def compute_mean_amplitude_trace(cube):
    """Average all traces to get representative 1D amplitude trace."""
    return np.mean(cube, axis=(0, 1))


def compute_envelope_trace(trace):
    """Amplitude envelope via Hilbert transform."""
    return np.abs(hilbert(trace))


def suggest_horizons(cube_or_trace, sample_rate, n_suggestions=8,
                     is_trace=False):
    """
    Suggest strong reflector depths using zone-normalised envelope picking.
    Works on either a full cube or a pre-computed mean trace.
    """
    mean_trace = cube_or_trace if is_trace else compute_mean_amplitude_trace(cube_or_trace)
    envelope   = compute_envelope_trace(mean_trace)
    n          = len(mean_trace)

    smoothed = uniform_filter1d(envelope, size=5)

    # Zone-normalised to prevent shallow events masking deep ones
    zone_size   = max(30, n // 8)
    zone_step   = zone_size // 2
    norm_env    = np.zeros(n)
    zone_counts = np.zeros(n)
    for start in range(0, n, zone_step):
        end  = min(start + zone_size, n)
        zone = smoothed[start:end]
        zmax = zone.max()
        if zmax > 0:
            norm_env[start:end]    += zone / zmax
            zone_counts[start:end] += 1
    zone_counts          = np.where(zone_counts == 0, 1, zone_counts)
    norm_env            /= zone_counts

    peaks_g, _ = find_peaks(smoothed,  prominence=0.03 * smoothed.max(), distance=8)
    peaks_n, _ = find_peaks(norm_env,  prominence=0.05,                  distance=8)
    all_peaks  = np.unique(np.concatenate([peaks_g, peaks_n]))

    if len(all_peaks) == 0:
        all_peaks = np.linspace(20, n - 20, n_suggestions).astype(int)

    gmax   = smoothed.max() if smoothed.max() > 0 else 1
    scores = 0.5 * smoothed[all_peaks] / gmax + 0.5 * norm_env[all_peaks]
    top    = all_peaks[np.argsort(scores)[::-1][:n_suggestions]]
    top    = np.sort(top)

    suggestions = []
    for pk in top:
        t    = float(pk) * sample_rate
        amp  = float(smoothed[pk])
        conf = min(100, int((0.4 * amp / gmax + 0.6 * float(norm_env[pk])) * 100))
        suggestions.append({
            "sample":    int(pk),
            "time_ms":   round(t, 1),
            "amplitude": round(amp, 4),
            "confidence": conf,
        })
    return suggestions, mean_trace, envelope


# ─────────────────────────────────────────────────────────────────────────────
# HORIZON PICKING
# ─────────────────────────────────────────────────────────────────────────────

def _pick_one_trace(trace, target_s, win_s, polarity):
    n    = len(trace)
    s    = max(0, target_s - win_s)
    e    = min(n, target_s + win_s)
    zone = trace[s:e]
    if len(zone) == 0:
        return target_s
    if polarity == "positive":
        peaks, _ = find_peaks(zone)
        if len(peaks):
            return s + peaks[np.argmax(zone[peaks])]
    elif polarity == "negative":
        peaks, _ = find_peaks(-zone)
        if len(peaks):
            return s + peaks[np.argmin(zone[peaks])]
    else:
        pp, _ = find_peaks(zone)
        pn, _ = find_peaks(-zone)
        peaks  = np.concatenate([pp, pn])
        if len(peaks):
            return s + peaks[np.argmax(np.abs(zone[peaks]))]
    return target_s


def pick_horizon_surface(cube, target_sample, window_samples=12,
                          polarity="positive"):
    """
    Pick horizon on every trace using vectorized NumPy.
    Runs in a background thread — NO Streamlit calls here.
    cube shape: (n_il, n_xl, n_samples)
    Returns: horizon shape (n_il, n_xl)
    """
    n_il, n_xl, n_s = cube.shape
    s_start = max(0, target_sample - window_samples)
    s_end   = min(n_s, target_sample + window_samples)

    horizon = np.full((n_il, n_xl), float(target_sample), dtype=np.float32)

    for il in range(n_il):
        zone = cube[il, :, s_start:s_end]  # (n_xl, window)
        if polarity == "positive":
            peak_offsets = np.argmax(zone, axis=1)
        elif polarity == "negative":
            peak_offsets = np.argmin(zone, axis=1)
        else:
            peak_offsets = np.argmax(np.abs(zone), axis=1)
        horizon[il, :] = s_start + peak_offsets

    return horizon


# ─────────────────────────────────────────────────────────────────────────────
# GRV
# ─────────────────────────────────────────────────────────────────────────────

def compute_isochore(top_horizon, base_horizon, sample_rate):
    diff = np.where(base_horizon > top_horizon, base_horizon - top_horizon, 0)
    return diff * sample_rate, diff


def compute_grv(isochore_ms, inline_spacing_m=25, crossline_spacing_m=25,
                velocity_ms=2500):
    iso_m        = (isochore_ms / 2000.0) * velocity_ms
    cell_area    = inline_spacing_m * crossline_spacing_m
    total_m3     = float(np.nansum(iso_m * cell_area))
    return {
        "grv_m3":          total_m3,
        "grv_ft3":         total_m3 * 35.3147,
        "grv_acre_ft":     total_m3 / 1233.48,
        "grv_km3":         total_m3 / 1e9,
        "isochore_m":      iso_m,
        "cell_area_m2":    cell_area,
        "n_cells":         int(np.sum(~np.isnan(iso_m))),
        "avg_thickness_m": float(np.nanmean(iso_m)),
        "max_thickness_m": float(np.nanmax(iso_m)),
    }
