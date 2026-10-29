"""Optional browser regression: requires Playwright and /usr/bin/chromium."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
import threading,json,zipfile,base64,io
from PIL import Image
class H(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(H,directory=str(Path(__file__).resolve().parents[1]/'public')));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_address[1]}/planning/pricelist.html',wait_until='networkidle')
 expect(page.locator('#download-mobile')).to_be_enabled();assert page.locator('.canvas-shell').bounding_box()['height']>450
 # Existing saved positions are reset, while content and typography are retained.
 page.evaluate('''()=>{const key='mongle-price-studio-v2',p=JSON.parse(localStorage.getItem(key));p.canvas={transforms:{'sec:group-0':{x:10,y:90,scale:.7},'brand:header':{x:12,y:30,scale:.8}},styles:{'sec:group-0:title':{color:'#ab2345',bold:true}}};localStorage.setItem(key,JSON.stringify(p));}''')
 legacy=page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2"))');page.add_init_script("if(!sessionStorage.getItem('restore-test')){localStorage.setItem('mongle-price-studio-v2',"+json.dumps(json.dumps(legacy))+");sessionStorage.setItem('restore-test','1');}");page.reload(wait_until='networkidle');expect(page.locator('#save-status')).to_contain_text('자동 저장됨');restored=page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2"))');legacy['canvas']['transforms']={};assert restored==legacy
 name=page.locator('[data-element="brand:name"]');name.tap();expect(page.locator('#mobile-sheet')).to_be_hidden();expect(page.locator('.canvas-edit-handle')).to_be_visible();assert page.locator('.canvas-move,.canvas-resize,.drag-handle').count()==0
 # Touch dragging neither moves the selected item nor changes the saved document.
 box=name.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2;cdp=ctx.new_cdp_session(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 for dy in [8,16,24]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+dy}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2"))')==restored;expect(page.locator('#mobile-sheet')).to_be_hidden()
 page.wait_for_timeout(420);name.tap();name.tap();expect(page.locator('#mobile-sheet')).to_be_visible();page.locator('#sheet-close').tap();expect(page.locator('#mobile-sheet')).to_be_hidden()
 page.screenshot(path='/tmp/mobile-ux-home.png')
 page.locator('#show-preview').tap();expect(page.locator('#mobile-sheet')).to_be_visible();page.locator('#sheet-items button').filter(has_text='4kg 미만 목욕 가격').first.tap();page.locator('.canvas-edit-handle').tap();expect(page.locator('#sheet-value')).to_have_value('15000');assert page.locator('.canvas-move,.canvas-resize').count()==0
 page.locator('#sheet-value').fill('17500');page.locator('#sheet-next').tap();expect(page.locator('#sheet-value')).to_have_value('15000');page.locator('#sheet-value').fill('18500');page.locator('#sheet-prev').tap();expect(page.locator('#sheet-value')).to_have_value('17500');page.locator('#sheet-value').blur()
 page.locator('#sheet-style summary').tap();page.locator('#canvas-bold').tap();page.locator('#canvas-color').fill('#ab2345');page.screenshot(path='/tmp/mobile-ux-sheet.png');page.locator('#sheet-close').tap()
 expect(page.locator('#save-status')).to_contain_text('자동 저장됨');page.reload(wait_until='networkidle');page.locator('#show-editor').tap();expect(page.locator('[data-cell="0:0"]')).to_have_value('17500');expect(page.locator('[data-cell="0:1"]')).to_have_value('18500');expect(page.locator('#show-preview')).to_be_visible()
 page.locator('#mobile-form-section').select_option('cat');expect(page.locator('.section-head')).to_contain_text('고양이');page.locator('#show-preview').tap();page.locator('#sheet-section').select_option('brand');page.locator('#sheet-items button').filter(has_text='매장 이름').tap();page.locator('.canvas-edit-handle').tap();page.locator('#sheet-value').fill('모바일 미용실');page.locator('#sheet-close').tap()
 for w in [320,390,768,1440]:
  page.set_viewport_size({'width':w,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),w
 # Canvas additions preserve existing prices, focus the inserted field, and persist.
 page.set_viewport_size({'width':390,'height':844});page.locator('#canvas-add').tap();page.locator('#add-target').select_option('group-0');page.locator('[data-canvas-add="row"]').tap();page.locator('.canvas-edit-handle').tap();expect(page.locator('#sheet-value')).to_have_value('새 구간');page.locator('#sheet-value').fill('10kg 미만')
 page.locator('#sheet-add').tap();page.locator('[data-canvas-add="column"]').tap();page.locator('.canvas-edit-handle').tap();expect(page.locator('#sheet-value')).to_have_value('새 서비스');page.locator('#sheet-value').fill('스파');page.locator('#sheet-close').tap();expect(page.locator('#mobile-sheet')).to_be_hidden()
 page.locator('#canvas-add').tap();page.locator('#add-target').select_option('cat');expect(page.locator('[data-canvas-add="row"]')).to_be_hidden();page.locator('[data-canvas-add="item"]').tap();page.locator('.canvas-edit-handle').tap();expect(page.locator('#sheet-value')).to_have_value('새 항목');page.locator('#sheet-value').fill('장모 관리');page.locator('#sheet-add').tap();page.locator('[data-canvas-add="text"]').tap();page.locator('.canvas-edit-handle').tap();expect(page.locator('#sheet-value')).to_have_value('안내 사항');page.locator('#sheet-value').fill('예약 안내');page.locator('#sheet-close').tap();expect(page.locator('#mobile-sheet')).to_be_hidden();expect(page.locator('#save-status')).to_contain_text('자동 저장됨')
 data=page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2"))');assert data['sections'][0]['rows'][0]['prices'][0]=='17500';assert data['sections'][0]['rows'][-1]['weight']=='10kg 미만';assert all(len(r['prices'])==7 for group in data['sections'] if group['kind']=='matrix' for r in group['rows']);assert data['sections'][-1]['title']=='예약 안내'
 page.reload(wait_until='networkidle');assert page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2"))')==data
 page.emulate_media(reduced_motion='reduce');page.locator('#canvas-add').tap();page.locator('#add-menu-close').tap();expect(page.locator('#canvas-add-menu')).not_to_be_visible();page.locator('#show-preview').tap();page.locator('#sheet-close').tap();expect(page.locator('#mobile-sheet')).to_be_hidden()
 page.set_viewport_size({'width':1440,'height':1000});page.locator('[data-element="brand:name"]').dblclick();expect(page.locator('.canvas-input')).to_have_value('모바일 미용실');page.locator('.canvas-input').press('Enter');page.locator('[data-element="sec:group-0:cell:row-0-0:col-0"]').click();page.locator('#canvas-add').click();page.locator('[data-canvas-add="row"]').click();page.locator('.canvas-edit-handle').click();expect(page.locator('.canvas-input')).to_have_value('새 구간');page.locator('.canvas-input').press('Enter');page.locator('#undo').click();expect(page.locator('#save-status')).to_contain_text('자동 저장됨');assert len(page.evaluate('JSON.parse(localStorage.getItem("mongle-price-studio-v2")).sections[0].rows'))==4;assert not errors,errors
 page.locator('#format').select_option('portrait');expect(page.locator('#render-error')).to_be_empty();expect(page.locator('#page-controls')).to_be_visible();images=[]
 while True:
  assert page.locator('#preview').evaluate('c=>[c.width,c.height]')==[1800,2546]
  images.append(base64.b64decode(page.locator('#preview').evaluate('c=>c.toDataURL().split(",")[1]')))
  if page.locator('#page-next').is_disabled():break
  page.locator('#page-next').click()
 assert len(images)>=2
 page.screenshot(path='/tmp/a4-last-page.png')
 with page.expect_download() as dl:page.locator('#download-pages').click()
 path=dl.value.path()
 with zipfile.ZipFile(path) as archive:
  assert len(archive.namelist())==len(images)
  for i,name in enumerate(archive.namelist()):
   raw=archive.read(name);assert raw==images[i];assert Image.open(io.BytesIO(raw)).size==(1800,2546)
 page.reload(wait_until='networkidle');expect(page.locator('#format')).to_have_value('portrait');expect(page.locator('#render-error')).to_be_empty();page.locator('#format').select_option('content');expect(page.locator('#page-controls')).to_be_hidden();assert not errors,errors
 print('PASS A4 automatic pagination, fixed page dimensions, page navigation, ZIP pixel equality and restored format')
 print('PASS mobile picker, sequential prices, styles, refresh, form section navigation, desktop inline edit, 320–1440 overflow')
 b.close()
server.shutdown()
