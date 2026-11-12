"""Original bundled logo, accessible sizing and existing menu preservation."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import base64,json,hashlib
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [390,1440]:
   page=browser.new_page(viewport={'width':width,'height':1000},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   def data():return page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2"))')
   expect(page.locator('[data-element="brand:logo"]')).to_be_visible()
   original=data();assert original['design']['logoSize']==300
   decoded=base64.b64decode(original['brand']['logo'].split(',')[1]);assert len(decoded)==770144
   # Apply the built-in logo to an existing customized menu; keep the menu intact.
   original['sections'][0]['rows'][0]['prices'][0]='17500';original['brand']['logo']='';original['design']['logoSize']=76
   page.locator('#import').set_input_files({'name':'existing.json','mimeType':'application/json','buffer':json.dumps(original).encode()})
   expect(page.locator('[data-element="brand:logo"]')).to_have_count(0)
   page.locator('#use-default-logo').click();expect(page.locator('#message')).to_contain_text('원본 로고를 적용')
   assert data()['sections']==original['sections']
   assert page.locator('.logo-box img').evaluate('i=>[i.naturalWidth,i.naturalHeight]')==[1254,1254]
   slider=page.get_by_label('로고 크기 슬라이더');slider.fill('450')
   expect(page.get_by_label('로고 크기 숫자')).to_have_value('450')
   page.wait_for_function('JSON.parse(localStorage.getItem("mongle-price-studio-v2")).design.logoSize===450')
   page.reload(wait_until='networkidle');assert data()['design']['logoSize']==450
   expect(page.locator('#render-error')).to_be_empty()
   assert base64.b64decode(data()['brand']['logo'].split(',')[1])==decoded
   page.locator('[data-element="brand:logo"]').click();page.locator('.canvas-edit-handle').click()
   page.get_by_label('로고 크기 숫자').fill('500');expect(slider).to_have_value('500')
   page.locator('#view-canvas').click();expect(page.locator('#render-error')).to_be_empty()
   page.locator('#download-mobile' if width==390 else '#download').click()
   with page.expect_download() as dl:page.locator('#export-current').click()
   image=Path(dl.value.path()).read_bytes();assert image==base64.b64decode(page.locator('#preview').evaluate('c=>c.toDataURL().split(",")[1]'))
   Path(f'/tmp/default-logo-{width}.png').write_bytes(image)
   assert not errors,errors
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.close()
  browser.close()
 print('PASS original 1254px PNG bytes, default/restore logo, 500px sizing, persistence, menu preservation and PNG export')
finally:server.shutdown();server.server_close()
