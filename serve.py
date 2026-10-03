# Local dev server: http://localhost:8765
#
# Serves the game from this folder and the AI model from D:\W\.spike-model-cache,
# and marks every response no-store so the browser keeps no copy: the developer's
# C: drive is full, and the browser's cache lives there.
#
#   python serve.py
import http.server
import os
import socketserver

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.environ.get('PAWTALES_MODELS', 'D:/W/.spike-model-cache')
PORT = 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.mjs': 'application/javascript',
        '.js': 'application/javascript',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
    }

    def translate_path(self, path):
        path = path.split('?', 1)[0]
        if path.startswith('/models/'):
            return os.path.join(MODELS, path[len('/models/'):])
        return os.path.join(HERE, path.lstrip('/'))

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), Handler) as s:
    print('Camp Hollow Pines: http://localhost:%d' % PORT, flush=True)
    s.serve_forever()
