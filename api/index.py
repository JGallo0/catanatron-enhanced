import os
import sys

# Ensure the local catanatron package directory is importable in Vercel Python runtime
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATANATRON_PKG_DIR = os.path.join(ROOT_DIR, "catanatron")
if CATANATRON_PKG_DIR not in sys.path:
    sys.path.insert(0, CATANATRON_PKG_DIR)

from catanatron.web import create_app

app = create_app()


class _EnsureApiPrefixMiddleware:
    """Normalize PATH_INFO on Vercel in case the rewrite strips or alters /api."""

    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "") or ""
        if path and not path.startswith("/api"):
            environ["PATH_INFO"] = "/api" + (
                path if path.startswith("/") else "/" + path
            )
        return self.wsgi_app(environ, start_response)


app.wsgi_app = _EnsureApiPrefixMiddleware(app.wsgi_app)
