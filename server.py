import http.server
import json
import os
import shutil
import socketserver
import tempfile

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(DIRECTORY, 'wardrobe.json')
BACKUP_FILE = os.path.join(DIRECTORY, 'wardrobe.backup.json')

REQUIRED_KEYS = {'id', 'house', 'section', 'name'}


def validate_payload(data):
    """The payload must be a list of clothing dicts, each with the required keys."""
    if not isinstance(data, list):
        return 'Il payload deve essere una lista di capi.'
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            return f'Elemento {i}: deve essere un oggetto.'
        missing = REQUIRED_KEYS - item.keys()
        if missing:
            return f'Elemento {i}: campi mancanti {sorted(missing)}.'
    return None


def save_db(data):
    """Atomic write with a backup of the previous version."""
    if os.path.exists(DB_FILE):
        shutil.copy2(DB_FILE, BACKUP_FILE)
    fd, tmp_path = tempfile.mkstemp(dir=DIRECTORY, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        os.replace(tmp_path, DB_FILE)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


class ArmadioHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/api/load':
            if not os.path.exists(DB_FILE):
                self._send_json(404, {'error': 'wardrobe.json non trovato'})
                return
            try:
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self._send_json(200, data)
            except json.JSONDecodeError as e:
                self._send_json(500, {'error': f'wardrobe.json non è un JSON valido: {e}'})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path != '/api/save':
            self.send_response(404)
            self.end_headers()
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, json.JSONDecodeError) as e:
            self._send_json(400, {'error': f'JSON non valido: {e}'})
            return

        error = validate_payload(data)
        if error:
            self._send_json(400, {'error': error})
            return

        try:
            save_db(data)
            self._send_json(200, {'status': 'ok', 'items': len(data)})
        except Exception as e:
            self._send_json(500, {'error': str(e)})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), ArmadioHandler) as httpd:
        print(f'Armadio in ascolto su http://localhost:{PORT}')
        httpd.serve_forever()
