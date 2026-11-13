"""Browser workflow regression; requires Playwright, Pillow and Chromium."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect
import threading, json, zipfile, base64, io
from PIL import Image

class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(Path(__file__).resolve().parents[1]/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 url=f'http://127.0.0.1:{server.server_address[1]}/planning/pricelist.html'
 page.goto(url,wait_until='networkidle')
 def saved(): expect(page.locator('#save-status')).to_contain_text('자동 저장됨')
 def data(): return page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2"))')
 expect(page.locator('#download-mobile')).to_be_enabled();assert page.locator('.canvas-shell').bounding_box()['height']>=300
 legacy=data();legacy['brand']['name']='몽글 미용실';legacy['canvas']={'transforms':{'sec:group-0':{'x':10,'y':90,'scale':.7}},'styles':{'sec:group-0:title':{'color':'#ab2345','bold':True}}}
 page.add_init_script("if(!sessionStorage.getItem('restore-test')){localStorage.setItem('mongle-price-studio-v2',"+json.dumps(json.dumps(legacy))+");sessionStorage.setItem('restore-test','1');}")
 page.reload(wait_until='networkidle');saved();legacy['canvas']['transforms']={};assert data()==legacy
 name=page.locator('[data-element="brand:name"]');name.tap();expect(page.locator('#mobile-sheet')).to_be_hidden();expect(page.locator('.canvas-edit-handle')).to_be_visible();assert page.locator('.canvas-move,.canvas-resize,.drag-handle').count()==0
 page.locator('.canvas-edit-handle').tap();page.locator('#sheet-value').fill('모바일 미용실');page.locator('#sheet-close').tap();saved()
 expect(page.locator('#mobile-sheet')).to_be_hidden();page.screenshot(path='/tmp/workflow-poster.png')
 # Daily price editing: no horizontal table, all service fields fit the phone.
 page.locator('#view-form').tap();expect(page.locator('.weight-card').first).to_be_visible();assert page.locator('.matrix-scroll').count()==0
 page.locator('[data-cell="0:0"]').fill('17500');page.locator('[data-cell="0:0"]').press('Enter');expect(page.locator('[data-cell="0:1"]')).to_be_focused();page.locator('[data-cell="0:1"]').fill('18500');saved()
 for field in page.locator('.weight-card').first.locator('[data-cell]').all():
  box=field.bounding_box();assert box['width']>=90 and box['height']>=44 and box['x']+box['width']<=390
 page.locator('.weight-card').nth(1).locator(':scope > summary').tap();page.locator('[data-cell="1:0"]').fill('23000');saved();page.locator('main').evaluate('e=>e.scrollTop=0');page.screenshot(path='/tmp/workflow-prices.png')
 page.reload(wait_until='networkidle');page.locator('#view-form').tap();expect(page.locator('[data-cell="0:0"]')).to_have_value('17500');expect(page.locator('[data-cell="0:1"]')).to_have_value('18500')
 page.locator('#mobile-form-section').select_option('cat');expect(page.locator('.section-head')).to_contain_text('고양이');page.get_by_label('항목 1 금액',exact=True).fill('55000');saved()
 # Occasional styling is separate from the daily price screen.
 page.locator('#show-editor').tap();expect(page.locator('[data-tab="design"]')).to_have_attribute('aria-selected','true');page.get_by_label('섹션 제목 색',exact=True).fill('#553344');saved()
 page.locator('#view-canvas').tap();page.locator('#focus-section').select_option('group-0');page.wait_for_timeout(350);assert page.locator('#poster-stage').bounding_box()['width']>700
 cell=page.locator('[data-element="sec:group-0:cell:row-0-0:col-0"]');cell.tap();expect(page.locator('#mobile-sheet')).to_be_hidden();page.locator('.canvas-edit-handle').tap();expect(page.locator('#sheet-value')).to_have_value('17500');page.locator('#sheet-next').tap();expect(page.locator('#sheet-value')).to_have_value('18500');page.locator('#sheet-close').tap()
 page.locator('#focus-section').select_option('all');page.wait_for_timeout(350)
 page.locator('#canvas-add').tap();page.locator('[data-canvas-add="text"]').tap();expect(page.locator('#mobile-sheet')).to_be_hidden();page.locator('.canvas-edit-handle').tap();page.locator('#sheet-value').fill('예약 안내');page.locator('#sheet-close').tap();saved()
 # Export controls operate independently of the editable composition.
 original_canvas=page.locator('#preview').evaluate('c=>c.toDataURL()')
 page.locator('#download-mobile').tap();expect(page.locator('#export-menu')).to_be_visible();expect(page.locator('#export-preview')).to_be_visible()
 page.locator('#print-format').select_option('png');page.locator('#print-dpi').select_option('150')
 expect(page.locator('#export-error')).to_be_empty();page.screenshot(path='/tmp/workflow-export.png')
 with page.expect_download() as dl:page.locator('#export-current').tap()
 raw=Path(dl.value.path()).read_bytes();assert Image.open(io.BytesIO(raw)).size==(1240,1754)
 page.locator('#print-layout').select_option('natural')
 with page.expect_download() as dl:page.locator('#export-current').tap()
 assert Image.open(dl.value.path()).width==1240
 assert page.locator('#preview').evaluate('c=>c.toDataURL()')==original_canvas
 page.locator('#export-close').tap()
 for w in [320,390,768,1440]:
  page.set_viewport_size({'width':w,'height':844})
  for mode in ['canvas','form']:
   page.locator('#view-'+mode).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(w,mode)
 page.locator('#view-canvas').click();page.locator('[data-element="brand:name"]').dblclick();expect(page.locator('.canvas-input')).to_have_value('모바일 미용실');page.locator('.canvas-input').press('Enter')
 # Uploads retain original bytes and resolution, including transparent PNGs.
 page.locator('#view-form').click();page.locator('[data-tab="brand"]').click()
 page.locator('[data-brand="name"]').fill('   ');saved()
 for fmt,mime in [('JPEG','image/jpeg'),('PNG','image/png'),('WEBP','image/webp')]:
  image=Image.new('RGBA' if fmt!='JPEG' else 'RGB',(1400,900),(120,60,90,100) if fmt!='JPEG' else (120,60,90))
  buffer=io.BytesIO();image.save(buffer,format=fmt);raw=buffer.getvalue()
  page.locator('#logo-file').set_input_files({'name':'logo.'+fmt.lower(),'mimeType':mime,'buffer':raw})
  expected='data:'+mime+';base64,'+base64.b64encode(raw).decode()
  page.wait_for_function('(expected)=>JSON.parse(localStorage.getItem("mongle-price-studio-v2")).brand.logo===expected',arg=expected)
  assert page.locator('.logo-box img').evaluate('i=>[i.naturalWidth,i.naturalHeight]')==[1400,900]
  page.reload(wait_until='networkidle');expect(page.locator('#download-mobile')).to_be_enabled()
  assert data()['brand']['logo']==expected
  page.locator('#view-canvas').click()
  expect(page.locator('[data-element="brand:name"]')).to_have_count(0)
  expect(page.locator('[data-element="brand:logo"]')).to_be_visible()
  page.locator('#view-form').click();page.locator('[data-tab="brand"]').click()
 assert not errors,errors
 print('PASS restored layout, explicit editing, readable mobile price cards, persistence, styling, section focus, addition, independent print export and 320–1440 layouts')
 browser.close()
server.shutdown()
