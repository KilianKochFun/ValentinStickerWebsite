#!/usr/bin/env python3
# Lokaler Test-Server, der GitHub-Pages-Verhalten nachbildet:
#   /profile      -> serviert profile.html
#   /profile?id=1 -> serviert profile.html (Query bleibt im JS lesbar)
#   /             -> serviert index.html
# Nutzung:
#   python3 scripts/serve.py          # Port 8000
#   python3 scripts/serve.py 8080     # anderer Port

import os
import sys
from http.server import SimpleHTTPRequestHandler, HTTPServer


class GHPagesHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Query-String abtrennen, damit der Dateisystem-Lookup nicht daran scheitert.
        clean = path.split("?", 1)[0].split("#", 1)[0]
        fs_path = super().translate_path(clean)

        # Wenn der Pfad direkt existiert (Datei oder Verzeichnis mit index.html) -> nichts tun.
        if os.path.isdir(fs_path):
            return fs_path
        if os.path.isfile(fs_path):
            return fs_path

        # Sonst: erweitern um .html versuchen (GitHub-Pages-Verhalten).
        html_variant = fs_path + ".html"
        if os.path.isfile(html_variant):
            return html_variant

        # Nichts gefunden - Default zurückgeben, SimpleHTTPRequestHandler liefert 404.
        return fs_path


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    print(f"Serving {root} on http://localhost:{port}  (GitHub-Pages-Fallback aktiv)")
    HTTPServer(("", port), GHPagesHandler).serve_forever()
