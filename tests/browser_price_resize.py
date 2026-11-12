"""Logo, current owner data and text width through real mouse/touch interactions."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json,base64
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(Path(__file__).resolve().parents[1]/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for mobile in [False,True]:
   ctx=browser.new_context(viewport={'width':390 if mobile else 1440,'height':1000},is_mobile=mobile,has_touch=mobile,accept_downloads=True)
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   expect(page.locator('#download-mobile' if mobile else '#download')).to_be_enabled()
   def data():return page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2"))')
   assert data()['sections'][2]['rows'][0]['prices']==['30000','20000','40000','55000','95000','105000']
   expect(page.locator('[data-element="brand:name"]')).to_have_count(0)
   target=page.locator('[data-element="sec:group-0:breeds"]');target.click()
   before=target.bounding_box();handle=page.locator('.canvas-width-handle');box=handle.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
   delta=before['width']*.65
   if mobile:
    cdp=ctx.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for i in range(1,11):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-delta*i/10,'y':y}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   else:
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x-delta,y,steps=10);page.mouse.up()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).canvas?.styles?.['sec:group-0:breeds']?.width < 400")
   width=data()['canvas']['styles']['sec:group-0:breeds']['width'];assert target.bounding_box()['height']>before['height']
   expect(page.locator('#render-error')).to_be_empty()
   page.reload(wait_until='networkidle');assert data()['canvas']['styles']['sec:group-0:breeds']['width']==width
   target.click();page.locator('.canvas-width-handle').press('ArrowRight')
   page.wait_for_function('(w)=>JSON.parse(localStorage.getItem("mongle-price-studio-v2")).canvas.styles["sec:group-0:breeds"].width>w',arg=width)
   if mobile:page.locator('#mobile-more').click()
   page.locator('#undo').click();expect(page.locator('#save-status')).to_contain_text('자동 저장됨');assert data()['canvas']['styles']['sec:group-0:breeds']['width']==width
   if mobile:page.locator('#mobile-more').click()
   previous=data()
   with page.expect_download() as backup:page.locator('#load-latest').click()
   assert json.loads(Path(backup.value.path()).read_text())==previous
   expect(page.locator('#message')).to_contain_text('최신 요금표를 적용')
   assert not data().get('canvas',{}).get('styles')
   Path(f'/tmp/latest-price-{mobile}.png').write_bytes(base64.b64decode(page.locator('#preview').evaluate('c=>c.toDataURL().split(",")[1]')))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors
   ctx.close()
  browser.close()
 print('PASS latest data, blank brand, mouse/touch width, wrapping, persistence, undo, backup and template application')
finally:server.shutdown();server.server_close()
