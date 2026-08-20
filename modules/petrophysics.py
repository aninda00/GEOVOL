"""
modules/petrophysics.py
LAS file reading, curve detection, reservoir zone filtering,
and petrophysical parameter extraction with P10/P50/P90.
"""

import numpy as np
import pandas as pd


# Common curve name aliases
POROSITY_ALIASES = ['PHIE', 'PHIT', 'NPHI', 'DPHI', 'POR', 'PORE', 'PHI',
                    'PHISC', 'PHID', 'PHIS', 'CPHIE', 'TPHI']
SW_ALIASES = ['SW', 'SWT', 'SWE', 'SWIRR', 'SWA', 'SW_ARCHIE', 'SWARCH',
              'SWFINAL', 'SW_FINAL', 'SWI', 'SWTOTAL']
NTG_ALIASES = ['NTG', 'NET', 'NETGROSS', 'NET_GROSS', 'VSH', 'VCL', 'VSHALE']
GR_ALIASES = ['GR', 'GRC', 'CGR', 'SGR', 'GRTC']
DEPTH_ALIASES = ['DEPT', 'DEPTH', 'MD', 'TVD', 'TVDSS']


def read_las(filepath_or_bytes):
    """
    Read a LAS file and return a lasio LASFile object.
    Accepts file path string or bytes-like object.
    """
    try:
        import lasio
        if hasattr(filepath_or_bytes, 'read'):
            import io
            content = filepath_or_bytes.read()
            return lasio.read(io.StringIO(content.decode('utf-8', errors='replace')))
        else:
            return lasio.read(filepath_or_bytes)
    except ImportError:
        raise ImportError("lasio not installed. Run: pip install lasio")
    except Exception as e:
        raise ValueError(f"Could not read LAS file: {e}")


def get_las_summary(las):
    """Extract summary info from a LASFile object."""
    curves = {c.mnemonic: {"unit": c.unit, "desc": c.descr} for c in las.curves}
    depth_curve = _find_curve(las, DEPTH_ALIASES)
    depth = las[depth_curve] if depth_curve else None

    return {
        "well_name": las.well.WELL.value if hasattr(las.well, 'WELL') else "Unknown",
        "curves": curves,
        "curve_names": list(curves.keys()),
        "n_samples": len(las.index),
        "depth_min": float(depth.min()) if depth is not None else None,
        "depth_max": float(depth.max()) if depth is not None else None,
        "depth_curve": depth_curve,
    }


def _find_curve(las, aliases):
    """Find first matching curve from alias list."""
    curve_names = [c.mnemonic.upper() for c in las.curves]
    for alias in aliases:
        if alias.upper() in curve_names:
            # Return original case
            for c in las.curves:
                if c.mnemonic.upper() == alias.upper():
                    return c.mnemonic
    return None


def detect_curves(las):
    """Auto-detect petrophysical curves in a LAS file."""
    detected = {
        "porosity": _find_curve(las, POROSITY_ALIASES),
        "sw": _find_curve(las, SW_ALIASES),
        "ntg": _find_curve(las, NTG_ALIASES),
        "gr": _find_curve(las, GR_ALIASES),
        "depth": _find_curve(las, DEPTH_ALIASES),
    }
    return detected


def extract_reservoir_params(las, top_depth, base_depth,
                              porosity_curve=None, sw_curve=None, ntg_curve=None):
    """
    Extract petrophysical parameters from LAS within reservoir zone.
    Returns dict with mean, P10, P50, P90 for each parameter.
    """
    detected = detect_curves(las)

    # Use detected or override
    phi_name = porosity_curve or detected["porosity"]
    sw_name = sw_curve or detected["sw"]
    ntg_name = ntg_curve or detected["ntg"]
    depth_name = detected["depth"] or "DEPT"

    try:
        depth = las[depth_name]
    except Exception:
        depth = las.index

    mask = (depth >= top_depth) & (depth <= base_depth)

    if not np.any(mask):
        return None, "No data found in the specified depth range."

    results = {}

    for param, curve_name, default_val in [
        ("porosity", phi_name, None),
        ("sw", sw_name, None),
        ("ntg", ntg_name, None),
    ]:
        if curve_name:
            try:
                values = las[curve_name][mask]
                # Remove NaN and out-of-range
                values = values[~np.isnan(values)]
                if param == "porosity":
                    values = values[(values > 0) & (values <= 1.0)]
                    if len(values) == 0:
                        # Try percentage → fraction
                        values = las[curve_name][mask]
                        values = values[~np.isnan(values)]
                        values = values[(values > 0) & (values <= 100)] / 100.0
                elif param in ["sw", "ntg"]:
                    values = values[(values >= 0) & (values <= 1.0)]

                if len(values) > 0:
                    results[param] = {
                        "curve": curve_name,
                        "mean": float(np.mean(values)),
                        "p10": float(np.percentile(values, 10)),
                        "p50": float(np.percentile(values, 50)),
                        "p90": float(np.percentile(values, 90)),
                        "n_points": len(values),
                        "values": values,
                        "found": True,
                    }
                else:
                    results[param] = {"found": False, "curve": curve_name, "error": "No valid values in range"}
            except Exception as e:
                results[param] = {"found": False, "curve": curve_name, "error": str(e)}
        else:
            results[param] = {"found": False, "curve": None, "error": "Curve not found in LAS"}

    return results, None


def get_las_dataframe(las, top_depth=None, base_depth=None):
    """Convert LAS to pandas DataFrame, optionally filtered to depth range."""
    df = las.df().reset_index()
    df.columns = [c.upper() for c in df.columns]

    if top_depth is not None and base_depth is not None:
        depth_col = None
        for alias in [c.upper() for c in DEPTH_ALIASES]:
            if alias in df.columns:
                depth_col = alias
                break
        if depth_col:
            df = df[(df[depth_col] >= top_depth) & (df[depth_col] <= base_depth)]

    return df


def estimate_ntg_from_gr(las, top_depth, base_depth, gr_clean=30, gr_shale=120):
    """
    Estimate NTG from GR curve using linear shale volume method.
    NTG = 1 - Vshale
    """
    detected = detect_curves(las)
    gr_name = detected.get("gr")
    depth_name = detected.get("depth") or "DEPT"

    if not gr_name:
        return None

    try:
        depth = las[depth_name]
        gr = las[gr_name]
        mask = (depth >= top_depth) & (depth <= base_depth)
        gr_zone = gr[mask]
        gr_zone = gr_zone[~np.isnan(gr_zone)]

        vsh = (gr_zone - gr_clean) / (gr_shale - gr_clean)
        vsh = np.clip(vsh, 0, 1)
        ntg = 1 - vsh

        return {
            "curve": "GR-derived",
            "mean": float(np.mean(ntg)),
            "p10": float(np.percentile(ntg, 10)),
            "p50": float(np.percentile(ntg, 50)),
            "p90": float(np.percentile(ntg, 90)),
            "n_points": len(ntg),
            "values": ntg,
            "found": True,
        }
    except Exception:
        return None
