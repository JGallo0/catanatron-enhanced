import os
import sys

# Ensure the local catanatron package directory is importable in Vercel Python runtime
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATANATRON_PKG_DIR = os.path.join(ROOT_DIR, "catanatron")
if CATANATRON_PKG_DIR not in sys.path:
    sys.path.insert(0, CATANATRON_PKG_DIR)

from catanatron.web import create_app

app = create_app()
