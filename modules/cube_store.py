"""
modules/cube_store.py

The correct solution to Streamlit memory problems with large numpy arrays:

PROBLEM:
- st.session_state gets RESET when the browser disconnects (long operations
  cause "page not responding" → websocket timeout → session cleared)
- Storing a 10GB cube in session_state means it's lost whenever the browser
  shows "page not responding"

SOLUTION:
- @st.cache_resource stores objects in the GLOBAL Streamlit cache
- This survives websocket disconnects, page switches, and browser reconnects
- Only lightweight metadata (filepath, info dict) goes in session_state
- The cube itself lives in cache_resource and is retrieved by filepath key

From Streamlit docs:
  "st.cache_resource: Cached objects are shared across all users, sessions,
   and reruns. They persist as long as the Streamlit server is running."
"""

import streamlit as st
import numpy as np


@st.cache_resource(show_spinner=False)
def _get_cube_store():
    """
    Global in-memory store for seismic cubes.
    Lives outside all sessions — never lost on reconnect.
    Returns a dict: {filepath: {"cube": np.ndarray, "info": dict}}
    """
    return {}


def store_cube(filepath_key: str, cube: np.ndarray, info: dict):
    """Store a cube in the global cache. Key is the file path."""
    store = _get_cube_store()
    store[filepath_key] = {"cube": cube, "info": info}


def retrieve_cube(filepath_key: str):
    """
    Retrieve cube from global cache by filepath key.
    Returns (cube, info) or (None, None) if not found.
    """
    store = _get_cube_store()
    entry = store.get(filepath_key)
    if entry:
        return entry["cube"], entry["info"]
    return None, None


def cube_is_cached(filepath_key: str) -> bool:
    """Check if a cube is already in cache."""
    store = _get_cube_store()
    return filepath_key in store


def clear_cube(filepath_key: str):
    """Remove a cube from cache to free memory."""
    store = _get_cube_store()
    if filepath_key in store:
        del store[filepath_key]


def get_cache_info():
    """Return info about what's currently cached."""
    store = _get_cube_store()
    result = {}
    for key, entry in store.items():
        cube = entry["cube"]
        result[key] = {
            "shape": cube.shape,
            "ram_mb": round(cube.nbytes / 1024**2, 1),
        }
    return result


# ── Demo cube store ────────────────────────────────────────────────────────

DEMO_KEY = "__DEMO__"


def store_demo_cube(cube: np.ndarray, info: dict):
    store_cube(DEMO_KEY, cube, info)


def retrieve_demo_cube():
    return retrieve_cube(DEMO_KEY)


def demo_is_cached() -> bool:
    return cube_is_cached(DEMO_KEY)
