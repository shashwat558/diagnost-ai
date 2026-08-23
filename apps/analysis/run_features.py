#!/usr/bin/env python3
"""Run the Phase 3 feature-request extraction pass."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from diagnost_analysis.feature_scan import scan_features

if __name__ == "__main__":
    result = scan_features()
    print(f"[run] done: {result}")
