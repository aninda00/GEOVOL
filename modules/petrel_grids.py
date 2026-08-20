"""
modules/petrel_grids.py
Read Petrel-exported horizon/depth map grids in all common formats:
  - ASCII XYZ   (.txt, .dat, .xyz)  — X Y Z columns
  - CSV         (.csv)              — with or without header
  - IRAP Classic (.irap, .gri)      — Roxar/IRAP binary/ascii
  - ZMAP+       (.zmap, .dat)       — Landmark/Halliburton
  - Petrel PTD  (.ptd)              — Petrel point data
  - OpendTect   (.dat)              — inline/crossline/z
Auto-detects format from file extension and content.
"""

import numpy as np
import pandas as pd
import io


# ── Auto-detect and load ────────────────────────────────────────────────────

def load_petrel_grid(file_obj, filename=""):
    """
    Master loader — auto-detects format and returns a standardised dict:
    {
        x:        2D array of X coordinates (or None if regular grid)
        y:        2D array of Y coordinates (or None if regular grid)
        z:        2D array of depth/time values
        nx:       number of columns
        ny:       number of rows
        x_min, x_max, y_min, y_max: extent
        z_min, z_max: depth range
        format:   detected format string
        unit:     "ms" or "m" (guessed from z range)
    }
    """
    ext = filename.lower().split(".")[-1] if "." in filename else ""

    # Read raw content
    if hasattr(file_obj, "read"):
        raw = file_obj.read()
        if isinstance(raw, bytes):
            try:
                content = raw.decode("utf-8")
            except Exception:
                content = raw.decode("latin-1")
    else:
        with open(file_obj, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

    # Detect format
    if ext in ["zmap"] or _is_zmap(content):
        return _load_zmap(content)
    elif ext in ["irap", "gri"] or _is_irap(content):
        return _load_irap(content)
    elif ext == "csv":
        return _load_xyz(content, delimiter=",")
    else:
        # Try XYZ / space-delimited (most common Petrel export)
        return _load_xyz(content)


def _is_zmap(content):
    return "@" in content[:200] and "GRID" in content[:500].upper()


def _is_irap(content):
    lines = content.strip().split("\n")
    if len(lines) < 2:
        return False
    try:
        first = lines[0].strip().split()
        return len(first) >= 4 and first[0].lstrip("-").replace(".", "").isdigit()
    except Exception:
        return False


# ── XYZ loader (most common Petrel ASCII export) ─────────────────────────────

def _load_xyz(content, delimiter=None):
    """
    Load X Y Z point cloud from ASCII text.
    Handles:
      - Space/tab/comma delimited
      - Comment lines starting with # or !
      - Headers (auto-skipped if non-numeric)
      - 3-column (X Y Z) or 4-column (IL XL X Y Z etc.)
    Returns interpolated regular grid.
    """
    lines = []
    for line in content.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("!") or line.startswith("*"):
            continue
        lines.append(line)

    if not lines:
        raise ValueError("No data found in file")

    # Try to parse — skip header lines
    rows = []
    for line in lines:
        parts = line.replace(",", " ").split()
        try:
            nums = [float(p) for p in parts]
            if len(nums) >= 3:
                rows.append(nums)
        except ValueError:
            continue  # skip header/text lines

    if not rows:
        raise ValueError("Could not parse any numeric data from file")

    arr = np.array(rows)

    # Detect column layout
    # Common Petrel exports: X Y Z  or  IL XL X Y Z  or  X Y Z attrib
    if arr.shape[1] == 3:
        x_col, y_col, z_col = 0, 1, 2
    elif arr.shape[1] == 4:
        x_col, y_col, z_col = 0, 1, 2   # 4th col = attribute, ignore
    elif arr.shape[1] >= 5:
        # Could be IL XL X Y Z — use last 3
        x_col, y_col, z_col = arr.shape[1]-3, arr.shape[1]-2, arr.shape[1]-1
    else:
        raise ValueError(f"Expected at least 3 columns, got {arr.shape[1]}")

    x_pts = arr[:, x_col]
    y_pts = arr[:, y_col]
    z_pts = arr[:, z_col]

    # Remove NaN/fill values
    fill_vals = [-999.25, -9999, -999999, 999999, 1e30]
    mask = np.ones(len(z_pts), dtype=bool)
    for fv in fill_vals:
        mask &= np.abs(z_pts - fv) > 1.0
    mask &= ~np.isnan(z_pts)
    x_pts, y_pts, z_pts = x_pts[mask], y_pts[mask], z_pts[mask]

    if len(z_pts) == 0:
        raise ValueError("All values were null/fill values")

    return _scatter_to_grid(x_pts, y_pts, z_pts, "xyz")


# ── IRAP Classic loader ───────────────────────────────────────────────────────

def _load_irap(content):
    """
    Load IRAP Classic ASCII grid format.
    Header: -996 ny xstep ystep / xmin xmax ymin ymax / nx rotation x0 y0 / ...
    """
    lines = [l.strip() for l in content.strip().split("\n") if l.strip()]

    # Parse header (first few lines until we get enough params)
    header_nums = []
    data_start  = 0
    for i, line in enumerate(lines):
        parts = line.split()
        try:
            nums = [float(p) for p in parts]
            header_nums.extend(nums)
            if len(header_nums) >= 12:
                data_start = i + 1
                break
        except ValueError:
            continue

    if len(header_nums) < 12:
        # Fall back to XYZ loader
        return _load_xyz(content)

    ny    = int(abs(header_nums[1]))
    xstep = header_nums[2]
    ystep = header_nums[3]
    xmin  = header_nums[4]
    xmax  = header_nums[5]
    ymin  = header_nums[6]
    ymax  = header_nums[7]
    nx    = int(abs(header_nums[8]))

    # Read data values
    data_vals = []
    for line in lines[data_start:]:
        parts = line.split()
        try:
            data_vals.extend([float(p) for p in parts])
        except ValueError:
            continue

    if len(data_vals) < nx * ny:
        # Try XYZ fallback
        return _load_xyz(content)

    z = np.array(data_vals[:nx * ny], dtype=np.float32)
    z = z.reshape((ny, nx))

    # Replace fill values
    fill_mask = (np.abs(z - 9999900.0) < 1000) | (np.abs(z + 999.25) < 1.0)
    z[fill_mask] = np.nan

    x = np.linspace(xmin, xmax, nx)
    y = np.linspace(ymin, ymax, ny)
    xx, yy = np.meshgrid(x, y)

    return _make_result(xx, yy, z, "irap_classic")


# ── ZMAP+ loader ──────────────────────────────────────────────────────────────

def _load_zmap(content):
    """Load ZMAP+ grid format (Landmark/Halliburton export)."""
    lines = content.split("\n")

    nx = ny = 1
    xmin = xmax = ymin = ymax = 0.0
    null_val = 1e30
    header_end = 0

    in_header = False
    for i, line in enumerate(lines):
        ls = line.strip()
        if ls.startswith("@") and not in_header:
            in_header = True
            continue
        if ls.startswith("@") and in_header:
            header_end = i + 1
            break
        if in_header:
            ls_upper = ls.upper()
            parts = [p.strip() for p in ls.replace(",", " ").split()]
            try:
                if "NODES" in ls_upper:
                    nx = int(parts[-1])
                elif "NROWS" in ls_upper or "NY" in ls_upper:
                    ny = int(parts[-1])
                elif "XMIN" in ls_upper or "X MINIMUM" in ls_upper:
                    xmin = float(parts[-1])
                elif "XMAX" in ls_upper or "X MAXIMUM" in ls_upper:
                    xmax = float(parts[-1])
                elif "YMIN" in ls_upper or "Y MINIMUM" in ls_upper:
                    ymin = float(parts[-1])
                elif "YMAX" in ls_upper or "Y MAXIMUM" in ls_upper:
                    ymax = float(parts[-1])
                elif "NULL" in ls_upper:
                    null_val = float(parts[-1])
            except (ValueError, IndexError):
                continue

    # Read data
    data_vals = []
    for line in lines[header_end:]:
        parts = line.strip().split()
        try:
            data_vals.extend([float(p) for p in parts])
        except ValueError:
            continue

    if len(data_vals) < nx * ny or nx * ny == 0:
        return _load_xyz(content)

    z = np.array(data_vals[:nx * ny], dtype=np.float32).reshape((ny, nx))
    z[np.abs(z - null_val) < abs(null_val) * 0.01] = np.nan

    x  = np.linspace(xmin, xmax, nx)
    y  = np.linspace(ymin, ymax, ny)
    xx, yy = np.meshgrid(x, y)

    return _make_result(xx, yy, z, "zmap")


# ── Scatter → regular grid interpolation ─────────────────────────────────────

def _scatter_to_grid(x_pts, y_pts, z_pts, fmt, grid_size=100):
    """Interpolate scattered XYZ points onto a regular grid using linear interpolation."""
    from scipy.interpolate import griddata

    # Build regular grid
    nx = ny = grid_size
    xi = np.linspace(x_pts.min(), x_pts.max(), nx)
    yi = np.linspace(y_pts.min(), y_pts.max(), ny)
    xx, yy = np.meshgrid(xi, yi)

    # Interpolate
    z_grid = griddata(
        points=(x_pts, y_pts),
        values=z_pts,
        xi=(xx, yy),
        method="linear",
    )

    # Fill NaN edges with nearest
    z_nearest = griddata(
        points=(x_pts, y_pts),
        values=z_pts,
        xi=(xx, yy),
        method="nearest",
    )
    z_grid = np.where(np.isnan(z_grid), z_nearest, z_grid)

    return _make_result(xx, yy, z_grid.astype(np.float32), fmt)


def _make_result(xx, yy, z, fmt):
    """Standardise output dict."""
    z_valid = z[~np.isnan(z)]
    z_min   = float(z_valid.min()) if len(z_valid) else 0.0
    z_max   = float(z_valid.max()) if len(z_valid) else 1.0

    # Guess unit: depths > 50 = meters, < 50 probably normalised
    unit = "ms" if z_max > 200 and z_max < 15000 else "m"

    return {
        "x":     xx,
        "y":     yy,
        "z":     z,
        "nx":    z.shape[1],
        "ny":    z.shape[0],
        "x_min": float(xx.min()),
        "x_max": float(xx.max()),
        "y_min": float(yy.min()),
        "y_max": float(yy.max()),
        "z_min": z_min,
        "z_max": z_max,
        "format": fmt,
        "unit":  unit,
        "n_points": int(np.sum(~np.isnan(z))),
    }


# ── GRV from Petrel grids ─────────────────────────────────────────────────────

def compute_grv_from_petrel_grids(top_grid, base_grid,
                                   cell_size_x=25.0, cell_size_y=25.0):
    """
    Compute GRV directly from two Petrel depth grids (top and base).
    Both grids must be on the same regular grid (same nx, ny).
    Works in depth (metres) — no velocity conversion needed.
    """
    top_z  = top_grid["z"]
    base_z = base_grid["z"]

    # Align grids if different sizes via interpolation
    if top_z.shape != base_z.shape:
        from scipy.interpolate import RegularGridInterpolator
        ny_t, nx_t = top_z.shape
        ny_b, nx_b = base_z.shape
        # Resample base to top grid
        xi_b = np.linspace(0, 1, nx_b)
        yi_b = np.linspace(0, 1, ny_b)
        xi_t = np.linspace(0, 1, nx_t)
        yi_t = np.linspace(0, 1, ny_t)
        interp = RegularGridInterpolator((yi_b, xi_b), base_z,
                                          method="linear", bounds_error=False,
                                          fill_value=np.nan)
        yy_t, xx_t = np.meshgrid(yi_t, xi_t, indexing="ij")
        base_z = interp(np.stack([yy_t.ravel(), xx_t.ravel()], axis=1)).reshape(ny_t, nx_t)

    # Isochore = base - top (positive = reservoir present)
    isochore_m = base_z - top_z
    isochore_m = np.where(isochore_m < 0, 0, isochore_m)
    isochore_m = np.where(np.isnan(isochore_m), 0, isochore_m)

    cell_area_m2  = cell_size_x * cell_size_y
    cell_vols_m3  = isochore_m * cell_area_m2
    total_grv_m3  = float(np.sum(cell_vols_m3))

    return {
        "grv_m3":        total_grv_m3,
        "grv_acre_ft":   total_grv_m3 / 1233.48,
        "grv_km3":       total_grv_m3 / 1e9,
        "isochore_m":    isochore_m,
        "avg_thickness_m": float(np.mean(isochore_m[isochore_m > 0])) if np.any(isochore_m > 0) else 0,
        "max_thickness_m": float(np.max(isochore_m)),
        "cell_area_m2":  cell_area_m2,
        "n_cells":       int(np.sum(isochore_m > 0)),
    }
