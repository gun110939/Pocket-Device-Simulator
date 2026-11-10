"""Test fixture pages for the end-to-end tests (python3 tests/fixture_server.py [port]).
Every page sends X-Frame-Options: DENY and frame-ancestors 'none' so framing has to be unblocked,
and echoes the request's User-Agent, Cookie, Sec-Fetch-Dest and Accept-Language headers."""
import http.server, sys, time
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        ua=self.headers.get('User-Agent',''); ck=self.headers.get('Cookie',''); al=self.headers.get('Accept-Language','')
        dest=self.headers.get('Sec-Fetch-Dest','')
        p=self.path
        if p.startswith('/slow'): time.sleep(2.5)
        if p.startswith('/slowimg'):
            time.sleep(5)
            self.send_response(200); self.send_header('Content-Type','image/svg+xml'); self.end_headers()
            self.wfile.write(b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'); return
        if p.startswith('/loop'):
            # like many real sites: rewrites its own URL on every load (tracking id) and finishes loading slowly
            self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers()
            self.wfile.write(b'<!doctype html><meta name=viewport content="width=device-width"><h1>LOOP</h1><img src="/slowimg"><script>history.replaceState(null, "", "/loop?visit=" + Math.random().toString(36).slice(2, 8));</script>'); return
        if p.startswith('/dark'):
            self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers()
            self.wfile.write(b'<!doctype html><style>body{background:#fff}@media (prefers-color-scheme: dark){body{background:rgb(1,2,3)}}@media (prefers-reduced-motion: reduce){body{color:rgb(9,9,9)}}</style><body>dark test</body>'); return
        if p.startswith('/redir'):
            self.send_response(302); self.send_header('Location','/setck?after=redirect'); self.send_header('Set-Cookie','session=fromredirect; Path=/; HttpOnly')
            self.end_headers(); return
        if p.startswith('/setck'):
            q=p.split('?',1)[1] if '?' in p else 'x=1'
            self.send_response(200); self.send_header('Content-Type','text/plain'); self.send_header('Set-Cookie', q+'; Path=/; HttpOnly')
            self.end_headers(); self.wfile.write(('set '+q+' | had: '+ck).encode()); return
        if p.startswith('/kbd'):
            body='''<h1>KBD</h1><form id="f" onsubmit="event.preventDefault();document.getElementById('sent').textContent='sent:'+t.value"><input id="t" type="text" style="font-size:20px"><input id="e" type="email"><input id="n" type="number"></form><textarea id="ta"></textarea><p id="sent"></p><div style="height:900px"></div><input id="low" type="text">'''
        elif p.startswith('/safe'):
            body='''<style>html{background:#123}body{margin:0;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom)}</style><h1 style="color:#fff">SAFE</h1>'''
        elif p.startswith('/touch'):
            body='''<h1>TOUCH</h1><button id="b" style="font-size:30px">tap me</button> clicks=<span id="n">0</span>
<div id="h" style="overflow-x:auto;white-space:nowrap;width:300px;border:1px solid"><div style="width:2000px;height:80px;background:linear-gradient(90deg,red,blue)">wide</div></div>
<div style="height:3000px;background:linear-gradient(#fde68a,#93c5fd)">tall</div>
<script>window.__log=[];for(const t of ['touchstart','touchmove','touchend','mousedown','mouseup','click'])addEventListener(t,e=>__log.push(t),true);
b.onclick=()=>n.textContent=+n.textContent+1;</script>'''
        elif p.startswith('/cross'):
            body=f'<a id="x" href="http://localhost:8765/page2">cross</a>'
        else:
            body=f'''<h1>{"PAGE2" if p.startswith("/page2") else "HOME"}</h1>
<p id="hua">{ua}</p><p id="hck">cookie={ck}</p><p id="hdest">dest={dest}</p><p id="hal">{al}</p>
<a id="top" href="/page2" target="_top">top link</a> <a id="cross" href="http://localhost:8765/page2">cross</a>
<pre id="js"></pre><div style="height:3000px;background:linear-gradient(#fde68a,#93c5fd)">tall</div><footer>END</footer>
<script>document.getElementById('js').textContent=JSON.stringify({{ua:navigator.userAgent,platform:navigator.platform,mtp:navigator.maxTouchPoints,
dpr:devicePixelRatio,sw:screen.width,sh:screen.height,iw:innerWidth,ih:innerHeight,coarse:matchMedia('(pointer: coarse)').matches,
touch:'ontouchstart' in window,fe:window.frameElement,uad:!!navigator.userAgentData,mobileMQ:matchMedia('(max-width: 500px)').matches}})</script>'''
        vp='width=device-width, viewport-fit=cover' if p.startswith('/safe') else 'width=device-width'
        html=f'<!doctype html><meta name=viewport content="{vp}"><title>T {p}</title><body>{body}</body>'.encode()
        self.send_response(200)
        self.send_header('Content-Type','text/html'); self.send_header('X-Frame-Options','DENY')
        self.send_header('Content-Security-Policy',"frame-ancestors 'none'")
        self.send_header('Set-Cookie','sid=abc; SameSite=Lax; Path=/')
        self.end_headers(); self.wfile.write(html)
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8765), H).serve_forever()
