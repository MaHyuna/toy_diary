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
   # Select the printed border directly, including keyboard activation.
   border=page.locator('[data-decoration-id="border:top"]')
   border.click();expect(page.locator('#studio-inspector')).to_be_visible()
   expect(page.locator('body')).to_have_attribute('data-inspector','border')
   page.locator('#inspector-close').click();border.focus();page.keyboard.press('Enter')
   expect(page.locator('#studio-inspector')).to_be_visible()
   page.locator('#inspector-close').click()
   page.locator('[data-decoration-id="corner:tl"]').click()
   expect(page.locator('[data-corner-target="tl"]')).to_have_attribute('aria-pressed','true')
   page.get_by_label('모서리 크기 숫자',exact=True).fill('40')
   expect(page.get_by_label('모서리 크기',exact=True)).to_have_value('40')
   page.get_by_label('모서리 가로 안쪽 여백 숫자',exact=True).fill('3')
   page.get_by_label('모서리 세로 안쪽 여백 숫자',exact=True).fill('4')
   before=page.locator('[data-decoration-id="corner:tl"]').evaluate('(el)=>parseFloat(el.style.left)')
   page.get_by_label('테두리 여백 숫자',exact=True).fill('40')
   after=page.locator('[data-decoration-id="corner:tl"]').evaluate('(el)=>parseFloat(el.style.left)')
   assert after>before,(before,after)
   expect(page.get_by_label('테두리 여백',exact=True)).to_have_value('40')
   page.get_by_label('테두리 여백 숫자',exact=True).fill('16')
   # A global inset works even when an individual corner is selected.
   page.get_by_label('전체 모서리 안쪽 여백 숫자',exact=True).fill('8')
   expect(page.get_by_label('전체 모서리 안쪽 여백',exact=True)).to_have_value('8')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design.cornerX===8")
   d=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design")
   assert d['cornerY']==8 and d['cornerAnchor']=='border'
   assert all('x' not in value and 'y' not in value and 'anchor' not in value for value in d['cornerDetails'].values())
   assert d['cornerDetails']['tl']['size']==40
   page.locator('[data-corner-target="all"]').click();page.locator('[data-corner-reset]').click()
   for border in ['none','line','double','rounded','scallop','dashed','dotted']:
    page.locator(f'[data-border-pick="{border}"]').click();expect(page.locator('#render-error')).to_be_empty()
   page.locator('[data-border-pick="rounded"]').click()
   page.get_by_label('테두리 둥근 정도',exact=True).fill('70');page.locator('[data-design="borderPattern"]').select_option('dashed')
   page.locator('[data-radius-mode="individual"]').click()
   for key,value in [('tl','0'),('tr','64'),('bl','80'),('br','16')]:
    page.locator(f'[data-radius="{key}"][type=number]').fill(value)
    expect(page.locator(f'[data-radius="{key}"][type=range]')).to_have_value(value)
   page.locator('[data-radius-mode="all"]').click()
   expect(page.get_by_label('테두리 둥근 정도 숫자',exact=True)).to_have_value('')
   page.get_by_label('테두리 둥근 정도 숫자',exact=True).fill('70')
   page.locator('[data-radius-mode="individual"]').click()
   for key in ['tl','tr','bl','br']:expect(page.locator(f'[data-radius="{key}"][type=number]')).to_have_value('70')
   page.locator('[data-radius="tl"][type=number]').fill('0')
   page.locator('[data-radius="br"][type=number]').fill('16')
   page.locator('[data-corner-pick="angle"]').click();page.get_by_label('모서리 크기',exact=True).fill('24')
   page.locator('[data-corner-target="tl"]').click();page.locator('[data-corner-pick="round"]').click()
   page.get_by_label('모서리 가로 안쪽 여백',exact=True).fill('70');page.get_by_label('모서리 세로 안쪽 여백',exact=True).fill('24');page.get_by_label('모서리 회전',exact=True).fill('20')
   page.locator('[data-corner-target="tr"]').click();page.locator('[data-corner-pick="heart"]').click();page.locator('[data-corner="fill"]').select_option('outline')
   page.locator('[data-corner-target="bl"]').click();page.locator('[data-corner-pick="none"]').click()
   expect(page.locator('#render-error')).to_be_empty();expect(page.locator('main')).to_have_attribute('data-view','canvas')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design.cornerDetails?.bl?.shape==='none'")
   saved=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design")
   assert saved['borderRadii']=={'tl':0,'tr':70,'br':16,'bl':70}
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
