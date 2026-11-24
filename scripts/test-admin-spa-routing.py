"""Verify admin SPA routing and storefront crawler prerendering using local Nginx.

Run from the repository root with Python 3 and Nginx installed.
Only temporary files and loopback ports are used.
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import threading
import time
from urllib.request import Request, urlopen

class Backend(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(self.path.encode())
    def log_message(self, *_):
        pass

backend = ThreadingHTTPServer(('127.0.0.1', 0), Backend)
threading.Thread(target=backend.serve_forever, daemon=True).start()
with socket.socket() as port_socket:
    port_socket.bind(('127.0.0.1', 0))
    frontend_port = port_socket.getsockname()[1]
with tempfile.TemporaryDirectory(prefix='admin-nginx-') as temp:
    temp_path = Path(temp)
    (temp_path / 'index.html').write_text('ADMIN_SPA')
    conf = Path('client/nginx.conf').read_text()
    conf = conf.replace('listen 80;', f'listen 127.0.0.1:{frontend_port};')
    conf = conf.replace('/usr/share/nginx/html', temp)
    conf = conf.replace('server:5000', f'127.0.0.1:{backend.server_port}')
    full_conf = f'error_log {temp}/error.log;\npid {temp}/nginx.pid;\nevents {{}}\nhttp {{ access_log off; {conf} }}'
    config_path = temp_path / 'nginx.conf'
    config_path.write_text(full_conf)
    command = [shutil.which('nginx'), '-p', temp + '/', '-c', str(config_path)]
    subprocess.run(command + ['-t'], check=True, capture_output=True)
    process = subprocess.Popen(command + ['-g', 'daemon off;'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        def fetch(path, agent='Mozilla/5.0'):
            request = Request(f'http://127.0.0.1:{frontend_port}{path}', headers={'User-Agent': agent})
            with urlopen(request, timeout=2) as response:
                return response.read().decode()
        for attempt in range(40):
            try:
                fetch('/admin/settings')
                break
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError(process.stderr.read().decode())
                time.sleep(0.05)
        for path, agent, expected in [
            ('/admin/settings', 'Mozilla/5.0', 'ADMIN_SPA'),
            ('/admin/settings', 'Googlebot', 'ADMIN_SPA'),
            ('/admin/products/new', 'Googlebot', 'ADMIN_SPA'),
            ('/admin/products/new', 'Mozilla/5.0', 'ADMIN_SPA'),
            ('/admin', 'Googlebot', 'ADMIN_SPA'),
            ('/admin/settings?_escaped_fragment_=1', 'Mozilla/5.0', 'ADMIN_SPA'),
            ('/products', 'Googlebot', '/api/seo/prerender?path=/products'),
            ('/product/19jp19?utm_source=share', 'WhatsApp/2.24', '/api/seo/prerender?path=/product/19jp19'),
            ('/products/19jp19', 'meta-externalfetcher/1.1', '/api/seo/prerender?path=/products/19jp19'),
            ('/product/19jp19', 'Mozilla/5.0', 'ADMIN_SPA'),
        ]:
            actual = fetch(path, agent)
            print(f'{agent} {path}: {actual}')
            assert actual == expected, f'Expected {expected}, got {actual}'
    finally:
        process.terminate()
        process.communicate(timeout=5)
backend.shutdown()
