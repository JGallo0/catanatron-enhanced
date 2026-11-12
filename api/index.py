import json
import os
import re
import sys
import traceback
from urllib.parse import parse_qsl, urlencode

# Ensure the local catanatron package directory is highest-priority in Vercel Python runtime
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_DIR = os.path.dirname(os.path.abspath(__file__))
for candidate in (ROOT_DIR, API_DIR, os.path.join(ROOT_DIR, "catanatron")):
    if os.path.isdir(candidate):
        if candidate in sys.path:
            sys.path.remove(candidate)
        sys.path.insert(0, candidate)


def _redact_secrets(text: str) -> str:
    return re.sub(r"://([^:@/\s]+):([^@/\s]+)@", r"://\1:***@", text or "")


def _make_startup_error_app(exc: Exception):
    traceback.print_exc()
    err_type = type(exc).__name__
    err_msg = _redact_secrets(str(exc))

    def _error_wsgi(environ, start_response):
        payload = json.dumps(
            {
                "ok": False,
                "error": err_type,
                "description": err_msg,
            }
        ).encode("utf-8")
        start_response(
            "500 Internal Server Error",
            [
                ("Content-Type", "application/json; charset=utf-8"),
                ("Content-Length", str(len(payload))),
                ("Cache-Control", "no-store"),
            ],
        )
        return [payload]

    return _error_wsgi


_STARTUP_OK = True
try:
    from catanatron.web import create_app

    app = create_app()
except Exception as startup_exc:
    _STARTUP_OK = False
    app = _make_startup_error_app(startup_exc)


class _VercelRoutingMiddleware:
    """Restore original /api/<subpath> when Vercel rewrites /api/(.*) -> /api/index?__path=$1."""

    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        query_string = environ.get("QUERY_STRING", "") or ""
        if "__path=" in query_string:
            pairs = parse_qsl(query_string, keep_blank_values=True)
            subpath = None
            remaining = []
            for k, v in pairs:
                if k == "__path" and subpath is None:
                    subpath = v
                else:
                    remaining.append((k, v))
            if subpath is not None:
                clean = subpath.lstrip("/")
                environ["PATH_INFO"] = f"/api/{clean}" if clean else "/api"
                environ["QUERY_STRING"] = urlencode(remaining)
                return self.wsgi_app(environ, start_response)

        path = environ.get("PATH_INFO", "") or ""
        if path in ("/api/index", "/api/index.py", "/index", "/index.py"):
            # Check Vercel forwarded headers if __path wasn't in query
            raw_uri = (
                environ.get("HTTP_X_NOW_ROUTE_MATCHES")
                or environ.get("REQUEST_URI")
                or ""
            )
            if "1=" in raw_uri:
                for part in raw_uri.split("&"):
                    if part.startswith("1="):
                        sub = part.split("=", 1)[1].lstrip("/")
                        environ["PATH_INFO"] = f"/api/{sub}"
                        break
        elif path and not path.startswith("/api"):
            environ["PATH_INFO"] = "/api" + (
                path if path.startswith("/") else "/" + path
            )

        return self.wsgi_app(environ, start_response)


if _STARTUP_OK:
    app.wsgi_app = _VercelRoutingMiddleware(app.wsgi_app)
