"""Backward-compatible settings import path.

New code should import from ``src.core.config``. Existing modules can continue
using ``src.config`` during the SaaS migration.
"""

from src.core.config import Settings, get_settings, settings

__all__ = ["Settings", "get_settings", "settings"]
