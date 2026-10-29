"""Optional browser regression: requires Playwright and /usr/bin/chromium."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
import threading,json
class H(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(H,directory=str(Path(__file__).resolve().parents[1]/'public')));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_address[1]}/planning/pricelist.html',wait_until='networkidle')
 expect(page.locator('#download-mobile')).to_be_enabled();assert page.locator('.canvas-shell').bounding_box()['height']>450
 page.screenshot(path='/tmp/mobile-ux-home.png')
 page.locator('#show-preview').tap();expect(page.locator('#mobile-sheet')).to_be_visible();page.locator('#sheet-items button').filter(has_text='4kg 미만 목욕 가격').first.tap();expect(page.locator('#sheet-value')).to_have_value('15000');assert not page.locator('.canvas-move').count()
 page.locator('#sheet-value').fill('17500');page.locator('#sheet-next').tap();expect(page.locator('#sheet-value')).to_have_value('15000');page.locator('#sheet-value').fill('18500');page.locator('#sheet-prev').tap();expect(page.locator('#sheet-value')).to_have_value('17500');page.locator('#sheet-value').blur()
 page.locator('#sheet-style summary').tap();page.locator('#canvas-bold').tap();page.locator('#canvas-color').fill('#ab2345');page.screenshot(path='/tmp/mobile-ux-sheet.png');page.locator('#sheet-close').tap()
 expect(page.locator('#save-status')).to_contain_text('자동 저장됨');page.reload(wait_until='networkidle');page.locator('#show-editor').tap();expect(page.locator('[data-cell="0:0"]')).to_have_value('17500');expect(page.locator('[data-cell="0:1"]')).to_have_value('18500');expect(page.locator('#show-preview')).to_be_visible()
 page.locator('#mobile-form-section').select_option('cat');expect(page.locator('.section-head')).to_contain_text('고양이');page.locator('#show-preview').tap();page.locator('#sheet-section').select_option('brand');page.locator('#sheet-items button').filter(has_text='매장 이름').tap();page.locator('#sheet-value').fill('모바일 미용실');page.locator('#sheet-close').tap()
 for w in [320,390,768,1440]:
  page.set_viewport_size({'width':w,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),w
 page.set_viewport_size({'width':1440,'height':1000});page.locator('[data-element="brand:name"]').click();expect(page.locator('.canvas-input')).to_have_value('모바일 미용실');assert not errors,errors
 print('PASS mobile picker, sequential prices, styles, refresh, form section navigation, desktop inline edit, 320–1440 overflow')
 b.close()
server.shutdown()
