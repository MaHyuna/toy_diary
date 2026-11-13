"""Layer rows use consistent compact hierarchy and accessible eye visibility controls."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import os
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':1000},is_mobile=width==390,has_touch=width==390);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(os.environ.get('PRICE_STUDIO_URL',f'http://127.0.0.1:{server.server_port}/planning/pricelist.html'),wait_until='networkidle')
   expect(page.locator('#download-mobile' if width==390 else '#download')).to_be_enabled()
   if width==390:page.locator('#canvas-layers').click()
   section_list=page.locator('#section-list')
   expect(section_list).to_be_visible()
   assert section_list.locator('input[type=checkbox]').count()==0
   assert section_list.locator('[data-move]').count()==0
   original=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
   branch=page.locator('[data-branch="group-0"]');summary=branch.locator(':scope > summary')
   summary.click(position={'x':5,'y':15});expect(branch).to_have_attribute('open','')
   summary.click(position={'x':5,'y':15});expect(branch).not_to_have_attribute('open','')
   eye=page.locator('[data-layer-visibility="group-0"]')
   expect(eye).to_have_attribute('aria-pressed','true')
   expect(eye).to_have_attribute('aria-label','소형견 미용 숨기기')
   eye.click()
   expect(eye).to_have_attribute('aria-pressed','false')
   expect(eye).to_have_attribute('aria-label','소형견 미용 보이기')
   expect(branch).not_to_have_attribute('open','')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections[0].visible===false")
   expect(page.locator('[data-element="sec:group-0:title"]')).not_to_be_attached()
   page.reload(wait_until='networkidle')
   if width==390:page.locator('#canvas-layers').click()
   eye=page.locator('[data-layer-visibility="group-0"]');expect(eye).to_have_attribute('aria-pressed','false')
   eye.click()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections[0].visible===true")
   expect(page.locator('[data-element="sec:group-0:title"]')).to_be_attached()
   extras=page.locator('[data-branch="extras"]');extras.locator(':scope > summary').click(position={'x':5,'y':15})
   page.locator('[data-tree-element="sec:extras:note"]').click()
   expect(page.locator('[data-element="sec:extras:note"]')).to_have_attribute('aria-pressed','true')
   if width==390 and not section_list.is_visible():page.locator('#canvas-layers').click()
   sizes=section_list.locator('summary,.tree-leaf').evaluate_all('''nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>({text:el.textContent.trim(),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,scroll:el.scrollWidth,icons:el.querySelectorAll('svg').length}))''')
   for item in sizes:
    assert item['height']<=(36 if width==390 else 34),item
    assert item['scroll']<=item['width']+2,item
   assert section_list.locator('svg').count()>5
   page.screenshot(path=f'/tmp/price-layers-ui-{width}.png')
   current=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
   assert current==original
   assert not errors,errors
   page.close()
  browser.close()
 print('PASS compact SVG layer hierarchy, no checkbox/arrows, native expansion, exact leaf canvas selection, eye hide/show persistence, desktop + mobile drawer')
finally:server.shutdown();server.server_close()
