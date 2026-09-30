"""
Vercel serverless entrypoint for the MindAlign FastAPI backend.

Vercel only deploys a Python file as a function when it can statically find a
top-level `app` / `handler` binding. An import wrapped in try/except is NOT
detected, which left /api/* without a function (requests fell through to
index.html), so the import below must stay unconditional and top-level.
"""
import os
import sys

# Vercel loads this file as a top-level module (no package context), so make the
# sibling modules (main, database, guardrails) importable by name.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app  # noqa: E402,F401
