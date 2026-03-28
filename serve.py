"""
맞불 개발 서버 — JS/CSS 캐시 없이 항상 최신 파일 제공
사용: python serve.py
접속: http://localhost:8080/
"""
import http.server
import socketserver

PORT = 8080

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        # 200 요청은 조용히, 그 외(404 등)만 출력
        if args[1] != '200':
            super().log_message(fmt, *args)

with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    httpd.allow_reuse_address = True
    print(f'서버 시작: http://localhost:{PORT}/')
    print(f'종료: Ctrl+C')
    httpd.serve_forever()
