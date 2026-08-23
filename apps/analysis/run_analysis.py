#!/usr/bin/env python3
"""Run the Phase 2 analysis pipeline against local infra."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from diagnost_analysis.pipeline import analyze

if __name__ == "__main__":
    result = analyze()
    print(f"[run] done: {result}")
