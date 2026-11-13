from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import xml.etree.ElementTree as ET
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [390,1440]:
   page=browser.new_page(viewport={'width':width,'height':1000},is_mobile=width==390,has_touch=width==390);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   expect(page.locator('#download-mobile' if width==390 else '#download')).to_be_enabled()
   page.locator('[data-open-inspector="design"]').click();page.locator('[data-inspector-tab="border"]').click()
   for border in ['none','line','double','rounded','scallop','dashed','dotted']:
    page.locator(f'[data-border-pick="{border}"]').click();expect(page.locator('#render-error')).to_be_empty()
   page.locator('[data-border-pick="rounded"]').click()
   page.get_by_label('테두리 둥근 정도',exact=True).fill('70');page.locator('[data-design="borderPattern"]').select_option('dashed')
   page.locator('[data-corner-pick="angle"]').click();page.get_by_label('모서리 크기',exact=True).fill('24')
   page.locator('[data-corner-target="tl"]').click();page.locator('[data-corner-pick="round"]').click()
   page.get_by_label('모서리 가로 위치',exact=True).fill('70');page.get_by_label('모서리 세로 위치',exact=True).fill('24');page.get_by_label('모서리 회전',exact=True).fill('20')
   page.locator('[data-corner-target="tr"]').click();page.locator('[data-corner-pick="heart"]').click();page.locator('[data-corner="fill"]').select_option('outline')
   page.locator('[data-corner-target="bl"]').click();page.locator('[data-corner-pick="none"]').click()
   expect(page.locator('#render-error')).to_be_empty();expect(page.locator('main')).to_have_attribute('data-view','canvas')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design.cornerDetails?.bl?.shape==='none'")
   saved=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design")
   assert saved['borderRadius']==70 and saved['cornerDetails']['tl']['x']==70 and saved['cornerDetails']['tr']['fill']=='outline'
   page.screenshot(path=f'/tmp/price-borders-{width}.png')
   page.locator('#inspector-close').click();page.reload(wait_until='networkidle')
   assert page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design")==saved
   if width==1440:
    page.locator('#download').click();page.locator('#print-format').select_option('svg')
    with page.expect_download(timeout=60000) as download:page.locator('#export-current').click()
    xml=ET.parse(download.value.path()).getroot();ns='{http://www.w3.org/2000/svg}'
    corners={e.attrib.get('data-element') for e in xml.iter() if e.attrib.get('data-element','').startswith('corner:')}
    assert corners=={'corner:tl','corner:tr','corner:br'},corners
    assert any(e.attrib.get('stroke-dasharray') for e in xml.iter(ns+'path'))
    assert not list(xml.iter(ns+'text'))
   assert not errors,errors
   page.close()
  browser.close()
 print('PASS border presets/radius/dashes, independent corner types/position/rotation/outlines, persistence, SVG and mobile/desktop canvas')
finally:server.shutdown();server.server_close()
