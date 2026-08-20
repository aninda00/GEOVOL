"""
modules/volumetrics.py
OIIP / GIIP calculation with Monte Carlo uncertainty analysis.
"""

import numpy as np
import pandas as pd


# ── Deterministic Formulas ──────────────────────────────────────────────────

def calculate_oiip(grv_acre_ft, ntg, porosity, sw, bo):
    """
    OIIP in stock tank barrels (STB).
    OIIP = (GRV × NTG × φ × (1 - Sw)) / Bo
    Works with both scalars and NumPy arrays.
    """
    bo = np.where(np.asarray(bo) <= 0, 1e-9, bo)
    return (grv_acre_ft * 7758.0 * ntg * porosity * (1 - sw)) / bo


def calculate_giip(grv_acre_ft, ntg, porosity, sw, bg):
    """
    GIIP in standard cubic feet (SCF).
    GIIP = (GRV × NTG × φ × (1 - Sw)) / Bg
    Works with both scalars and NumPy arrays.
    """
    bg = np.where(np.asarray(bg) <= 0, 1e-9, bg)
    return (grv_acre_ft * 43560.0 * ntg * porosity * (1 - sw)) / bg


# ── Monte Carlo Simulation ──────────────────────────────────────────────────

def _triangular_samples(p10, p50, p90, n):
    """
    Sample from a triangular distribution defined by P10, P50, P90.
    Uses scipy's PERT distribution approximation.
    """
    from scipy.stats import triang
    # Triangular: low=P10, mode=P50, high=P90
    low, mode, high = p10, p50, p90
    if low >= high:
        return np.full(n, mode)
    c = (mode - low) / (high - low)
    c = np.clip(c, 0.01, 0.99)
    samples = triang.rvs(c, loc=low, scale=(high - low), size=n)
    return np.clip(samples, low, high)


def _lognormal_samples(p10, p50, p90, n):
    """Fit lognormal to P10/P50/P90 and sample."""
    from scipy.stats import lognorm
    import warnings
    try:
        ln_p10 = np.log(p10)
        ln_p90 = np.log(p90)
        sigma = (ln_p90 - ln_p10) / (2 * 1.28)  # approx from normal
        mu = np.log(p50)
        samples = np.random.lognormal(mu, abs(sigma), n)
        return samples
    except Exception:
        return _triangular_samples(p10, p50, p90, n)


def run_monte_carlo(
    grv_p10, grv_p50, grv_p90,
    ntg_p10, ntg_p50, ntg_p90,
    phi_p10, phi_p50, phi_p90,
    sw_p10, sw_p50, sw_p90,
    bo_p10, bo_p50, bo_p90,
    bg_p10, bg_p50, bg_p90,
    n_simulations=10000,
    calc_oil=True,
    calc_gas=True,
    seed=42,
):
    """
    Run Monte Carlo simulation for OIIP and GIIP.
    All GRV values in acre-ft.

    Returns dict with arrays of results and summary statistics.
    """
    np.random.seed(seed)

    # Sample all parameters
    grv_s = _lognormal_samples(grv_p10, grv_p50, grv_p90, n_simulations)
    ntg_s = _triangular_samples(ntg_p10, ntg_p50, ntg_p90, n_simulations)
    phi_s = _triangular_samples(phi_p10, phi_p50, phi_p90, n_simulations)
    sw_s  = _triangular_samples(sw_p10,  sw_p50,  sw_p90,  n_simulations)
    bo_s  = _triangular_samples(bo_p10,  bo_p50,  bo_p90,  n_simulations)
    bg_s  = _triangular_samples(bg_p10,  bg_p50,  bg_p90,  n_simulations)

    # Clip to physical ranges
    ntg_s = np.clip(ntg_s, 0.01, 1.0)
    phi_s = np.clip(phi_s, 0.01, 0.50)
    sw_s  = np.clip(sw_s,  0.05, 0.95)
    bo_s  = np.clip(bo_s,  0.8,  3.0)
    bg_s  = np.clip(bg_s,  0.001, 0.1)

    results = {}

    if calc_oil:
        oiip_array = calculate_oiip(grv_s, ntg_s, phi_s, sw_s, bo_s)
        oiip_mmstb = oiip_array / 1e6

        results["oiip"] = {
            "raw": oiip_mmstb,
            "p10": float(np.percentile(oiip_mmstb, 10)),
            "p50": float(np.percentile(oiip_mmstb, 50)),
            "p90": float(np.percentile(oiip_mmstb, 90)),
            "mean": float(np.mean(oiip_mmstb)),
            "std": float(np.std(oiip_mmstb)),
            "unit": "MMstb",
        }

    if calc_gas:
        giip_array = calculate_giip(grv_s, ntg_s, phi_s, sw_s, bg_s)
        giip_bscf = giip_array / 1e9

        results["giip"] = {
            "raw": giip_bscf,
            "p10": float(np.percentile(giip_bscf, 10)),
            "p50": float(np.percentile(giip_bscf, 50)),
            "p90": float(np.percentile(giip_bscf, 90)),
            "mean": float(np.mean(giip_bscf)),
            "std": float(np.std(giip_bscf)),
            "unit": "Bscf",
        }

    # Sensitivity: correlation of each input with output
    inputs = {
        "GRV": grv_s,
        "NTG": ntg_s,
        "Porosity": phi_s,
        "Sw": sw_s,
        "Bo/Bg": bo_s,
    }

    sensitivity = {}
    for key_fluid in ["oiip", "giip"]:
        if key_fluid not in results:
            continue
        output = results[key_fluid]["raw"]
        corrs = {}
        for inp_name, inp_arr in inputs.items():
            try:
                corr = float(np.corrcoef(inp_arr, output)[0, 1])
            except Exception:
                corr = 0.0
            corrs[inp_name] = round(corr, 3)
        sensitivity[key_fluid] = corrs

    results["sensitivity"] = sensitivity
    results["n_simulations"] = n_simulations
    results["inputs_summary"] = {
        "grv": {"p10": grv_p10, "p50": grv_p50, "p90": grv_p90},
        "ntg": {"p10": ntg_p10, "p50": ntg_p50, "p90": ntg_p90},
        "phi": {"p10": phi_p10, "p50": phi_p50, "p90": phi_p90},
        "sw":  {"p10": sw_p10,  "p50": sw_p50,  "p90": sw_p90},
        "bo":  {"p10": bo_p10,  "p50": bo_p50,  "p90": bo_p90},
        "bg":  {"p10": bg_p10,  "p50": bg_p50,  "p90": bg_p90},
    }

    return results


def summarize_results(mc_results):
    """Format Monte Carlo results into a clean summary DataFrame."""
    rows = []
    for fluid in ["oiip", "giip"]:
        if fluid not in mc_results:
            continue
        r = mc_results[fluid]
        rows.append({
            "Parameter": "OIIP" if fluid == "oiip" else "GIIP",
            "P10 (Low)": f"{r['p10']:.2f} {r['unit']}",
            "P50 (Best)": f"{r['p50']:.2f} {r['unit']}",
            "P90 (High)": f"{r['p90']:.2f} {r['unit']}",
            "Mean": f"{r['mean']:.2f} {r['unit']}",
        })
    return pd.DataFrame(rows)
