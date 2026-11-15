import hashlib
import http.server
import json
import os
import shutil
import socketserver
import tempfile
import uuid

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(DIRECTORY, 'wardrobe.json')
BACKUP_FILE = os.path.join(DIRECTORY, 'wardrobe.backup.json')
VERSION_FILE = os.path.join(DIRECTORY, 'wardrobe.version')
MAX_BYTES = 1_048_576

# Keep in sync with worker/src/model.js
HOUSES = {'Milano', 'Reggio', 'Sardegna'}
SECTIONS = {
    'sec1-top-rail', 'sec1-bottom-rail', 'sec2-top-shelf', 'sec2-middle-rail',
    'sec2-drawer2-col1', 'sec2-drawer2-col2',
    'sec2-drawer3-col1', 'sec2-drawer3-col2', 'sec2-drawer3-col3',
}
TYPES = {'jacket', 'shirt', 'hoodie', 'sweater', 'tshirt', 'pants', 'shorts'}
REQUIRED_KEYS = ('id', 'house', 'section', 'name')


def validate_payload(data):
    """The payload must be a list of clothing dicts matching the wardrobe model."""
    if not isinstance(data, list):
        return 'Il payload deve essere una lista di capi.'
    seen = set()
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            return f'Elemento {i}: deve essere un oggetto.'
        for key in REQUIRED_KEYS:
            if not isinstance(item.get(key), str) or not item[key].strip():
                return f'Elemento {i}: campo {key} mancante.'
        if len(item['id'].strip()) > 80:
            return f'Elemento {i}: id troppo lungo.'
        if len(item['name']) > 200:
            return f'Elemento {i}: nome troppo lungo.'
        if item['house'] not in HOUSES:
            return f'Elemento {i}: casa non valida.'
        if item['section'] not in SECTIONS:
            return f'Elemento {i}: sezione non valida.'
        if item['id'].strip() in seen:
            return f'Elemento {i}: id duplicato.'
        seen.add(item['id'].strip())
        if 'type' in item:
            if not isinstance(item['type'], str):
                return f'Elemento {i}: campo type non valido.'
            if item['type'] and item['type'] not in TYPES:
                return f'Elemento {i}: tipo non valido.'
        if 'color' in item:
            color = item['color']
            if not isinstance(color, str) or (color and not _hex(color)):
                return f'Elemento {i}: colore non valido.'
        for key in ('brand', 'notes'):
            if key in item and not isinstance(item[key], str):
                return f'Elemento {i}: campo {key} non valido.'
            if isinstance(item.get(key), str) and len(item[key]) > 500:
                return f'Elemento {i}: campo {key} troppo lungo.'
    return None


def _hex(color):
    if len(color) not in (4, 7) or not color.startswith('#'):
        return False
    try:
        int(color[1:], 16)
    except ValueError:
        return False
    return True


def content_hash(data):
    blob = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(blob).hexdigest()


def read_db():
    with open(DB_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if os.path.exists(VERSION_FILE):
        with open(VERSION_FILE, 'r', encoding='utf-8') as f:
            version = f.read().strip()
    else:
        version = content_hash(data)
    return data, version


def save_db(data):
    """Atomic write with a backup of the previous version."""
    if os.path.exists(DB_FILE):
        shutil.copy2(DB_FILE, BACKUP_FILE)
    version = uuid.uuid4().hex
    _atomic_write(DB_FILE, json.dumps(data, ensure_ascii=False, indent=4))
    _atomic_write(VERSION_FILE, version)
    return version


def _atomic_write(path, text):
    fd, tmp_path = tempfile.mkstemp(dir=DIRECTORY, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(text)
        os.replace(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


class ArmadioHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # The page only calls /api on localhost when it sees this header, so a
        # static file server is never probed and does not log a 404.
        self.send_header('X-Armadio-Server', '1')
        super().end_headers()

    def _send_json(self, status, payload, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?', 1)[0] != '/api/load':
            super().do_GET()
            return
        if not os.path.exists(DB_FILE):
            self._send_json(404, {'error': 'wardrobe.json non trovato'})
            return
        try:
            data, version = read_db()
        except json.JSONDecodeError as e:
            self._send_json(500, {'error': f'wardrobe.json non è un JSON valido: {e}'})
            return
        self._send_json(200, {'items': data, 'version': version}, {'ETag': f'"{version}"'})

    def do_POST(self):
        if self.path.split('?', 1)[0] != '/api/save':
            self._send_json(404, {'error': 'not_found', 'message': 'Percorso non trovato.'})
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
        except ValueError:
            length = 0
        if length > MAX_BYTES:
            self._send_json(413, {'error': 'too_large', 'message': 'Il payload supera 1 MB.'})
            return

        try:
            raw = self.rfile.read(length)
            if len(raw) > MAX_BYTES:
                self._send_json(413, {'error': 'too_large', 'message': 'Il payload supera 1 MB.'})
                return
            body = json.loads(raw.decode('utf-8'))
        except (ValueError, json.JSONDecodeError) as e:
            self._send_json(400, {'error': 'invalid', 'message': f'JSON non valido: {e}'})
            return

        force = False
        client_version = None
        if isinstance(body, dict) and 'items' in body:
            force = body.get('force') is True
            client_version = body.get('version')
            if client_version is not None and not isinstance(client_version, str):
                self._send_json(400, {'error': 'invalid', 'message': 'version non valida.'})
                return
            data = body.get('items')
        elif isinstance(body, list):
            # Single-user local dev: a bare list still overwrites the file.
            data = body
            force = True
        else:
            self._send_json(400, {'error': 'invalid', 'message': 'Il payload deve essere un oggetto con items e version.'})
            return

        error = validate_payload(data)
        if error:
            self._send_json(400, {'error': 'invalid', 'message': error})
            return

        try:
            current, version = read_db() if os.path.exists(DB_FILE) else ([], None)
        except json.JSONDecodeError as e:
            self._send_json(500, {'error': f'wardrobe.json non è un JSON valido: {e}'})
            return

        if not force and version is not None and client_version != version:
            self._send_json(409, {
                'error': 'conflict',
                'message': "L'armadio è stato modificato su un altro dispositivo.",
                'items': current,
                'version': version,
            }, {'ETag': f'"{version}"'})
            return

        # An empty local state must not create or replace a wardrobe by accident.
        if not force and len(data) == 0 and version is None:
            self._send_json(409, {
                'error': 'conflict',
                'message': 'Archivio vuoto non salvato.',
                'items': current,
                'version': version,
            })
            return

        try:
            new_version = save_db(data)
            self._send_json(200, {'status': 'ok', 'items': len(data), 'version': new_version}, {'ETag': f'"{new_version}"'})
        except Exception as e:
            self._send_json(500, {'error': str(e)})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), ArmadioHandler) as httpd:
        print(f'Armadio in ascolto su http://localhost:{PORT}')
        httpd.serve_forever()
