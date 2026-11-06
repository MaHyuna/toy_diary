"""Capture prototype-only thumbnails after npm run build:demo. No app API or data access."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json,subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
flows=json.loads(subprocess.check_output(['node','--experimental-strip-types','--input-type=module','-e',"import {flows} from './src/prototype/flows.ts';process.stdout.write(JSON.stringify(flows))"],cwd=root,text=True))
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'demo-dist')));thread=Thread(target=server.serve_forever,daemon=True);thread.start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1200},device_scale_factor=1)
  page.goto(f'http://127.0.0.1:{server.server_port}/prototype/#flow=pricing&screen=price-list&mode=play',wait_until='networkidle')
  page.get_by_role('button',name='PC',exact=True).click()
  page.add_style_tag(content='.proto-device{height:420px!important;max-width:740px!important;overflow:hidden!important}.proto-screen{animation:none!important}.proto-screen-actions{display:none!important}.proto-screen{zoom:.6}.proto-app-header{zoom:.7}.proto-app-footer{display:none!important}')
  for flow in flows:
   for screen in flow['steps']:
    page.goto(f'http://127.0.0.1:{server.server_port}/prototype/#flow={flow["id"]}&screen={screen["id"]}&mode=play');page.wait_for_timeout(120)
    page.locator('.proto-device').screenshot(path=str(root/'public/prototype/screens'/f'{screen["id"]}.jpg'),type='jpeg',quality=80)
  b.close()
 print('Captured',sum(len(f['steps']) for f in flows),'prototype screen thumbnails')
finally:server.shutdown();thread.join();server.server_close()
