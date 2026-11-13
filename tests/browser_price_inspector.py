"""Canvas-first properties and reflowing layout on touch and desktop."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [390,1440]:
   page=browser.new_page(viewport={'width':width,'height':1000},is_mobile=width==390,has_touch=width==390);errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   expect(page.locator('#download-mobile' if width==390 else '#download')).to_be_enabled()
   page.locator('[data-element="sec:group-0:breeds"]').click()
   page.locator('[data-open-inspector="text"]').first.click()
   expect(page.locator('#studio-inspector')).to_be_visible();expect(page.locator('main')).to_have_attribute('data-view','canvas')
   expect(page.locator('#preview')).to_be_visible()
   page.locator('#canvas-font-family').select_option('Jua');page.locator('#canvas-font-size').fill('18')
   page.locator('#text-color-hex').fill('#347bb3')
   page.locator('#canvas-align').select_option('right')
   page.locator('.spacing-inspector summary').click()
   page.locator('#text-width').fill('300');page.locator('#text-tracking').fill('1.5')
   page.locator('#canvas-box-align').select_option('right')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).canvas?.styles?.['sec:group-0:breeds']?.boxAlign==='right'")
   expect(page.locator('main')).to_have_attribute('data-view','canvas')
   if width==390:
    page.locator('#canvas-edit').click();expect(page.locator('#mobile-sheet')).to_be_visible();expect(page.locator('#studio-inspector')).to_be_hidden()
    page.locator('#sheet-close').click();page.locator('[data-open-inspector="text"]').first.click()
   # Toggling, outside taps and Escape dismiss; dragging blank space does not.
   launcher=page.locator('[data-open-inspector="text"]').first
   launcher.click();expect(page.locator('#studio-inspector')).to_be_hidden()
   launcher.click();expect(page.locator('#studio-inspector')).to_be_visible()
   shell=page.locator('.canvas-shell').bounding_box();x=shell['x']+3;y=shell['y']+30
   page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y+25,steps=5);page.mouse.up()
   expect(page.locator('#studio-inspector')).to_be_visible()
   page.mouse.click(x,y);expect(page.locator('#studio-inspector')).to_be_hidden()
   launcher.click();page.keyboard.press('Escape');expect(page.locator('#studio-inspector')).to_be_hidden()
   launcher.click()
   # A new selection updates properties while keeping the inspector and canvas visible.
   page.locator('[data-element="sec:group-0:title"]').click()
   expect(page.locator('#studio-inspector')).to_be_visible();expect(page.locator('#selection-label')).to_contain_text('소형견')
   page.locator('[data-inspector-tab="design"]').click()
   page.locator('[data-paint="global:background"][data-paint-value="#fffaf0"]').click()
   page.locator('[data-design="markerShape"]').select_option('paw')
   expect(page.locator('main')).to_have_attribute('data-view','canvas')
   page.screenshot(path=f'/tmp/price-inspector-design-{width}.png')
   canvas=page.locator('.canvas-shell').bounding_box();panel=page.locator('#studio-inspector').bounding_box()
   assert canvas['height']>180,canvas
   if width==390:assert canvas['y']+canvas['height']<=panel['y']+1,(canvas,panel,page.evaluate("[...document.querySelector('.preview-area').children,document.querySelector('main')].map(e=>({cls:e.className,id:e.id,rect:e.getBoundingClientRect().toJSON(),flex:getComputedStyle(e).flex,height:getComputedStyle(e).height,margin:getComputedStyle(e).margin}))"))
   else:assert canvas['x']+canvas['width']<=panel['x'],(canvas,panel)
   page.locator('[data-inspector-tab="layout"]').click()
   page.locator('[data-layout-preset="stack"]').click()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.every(s=>s.span==='full')")
   page.locator('[data-layout-preset="columns"]').click()
   page.get_by_label('고양이 미용 레이아웃 너비',exact=True).select_option('full')
   page.locator('.layout-row[data-section="extras"] .layout-select').click()
   page.locator('#section-position').select_option('right')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.find(s=>s.id==='extras').layoutAlign==='right'")
   # Pointer reorder uses the stable inspector capture, also available on touch devices.
   handle=page.locator('.layout-row[data-section="cat"] .layout-drag')
   handle.scroll_into_view_if_needed();a=handle.bounding_box();target=page.locator('.layout-row[data-section="group-2"]').bounding_box()
   page.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2);page.mouse.down();page.mouse.move(target['x']+10,target['y']+target['height']/2,steps=8);page.mouse.up()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections[2].id==='cat'")
   page.screenshot(path=f'/tmp/price-inspector-layout-{width}.png')
   check=page.evaluate('''async()=>{const {renderSheetPoster}=await import('./price-studio-pages.js?v=workspace-18');const p=JSON.parse(localStorage.getItem('mongle-price-studio-v2')),logo=new Image();logo.src=p.brand.logo;await logo.decode();const r=renderSheetPoster(document.createElement('canvas'),p,logo),leaves=r.elements.filter(e=>e.kind==='text'),overlaps=[];for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++){const a=leaves[i],b=leaves[j];if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5)overlaps.push([a.id,b.id]);}return {error:r.error,overlaps,breed:r.elements.find(e=>e.id==='sec:group-0:breeds'),sections:p.sections};}''')
   assert not check['error'] and not check['overlaps'],check
   assert check['breed']['x']>400,check['breed']
   page.locator('#inspector-close').click();expect(page.locator('#studio-inspector')).to_be_hidden();expect(page.locator('main')).to_have_attribute('data-view','canvas')
   # Explicit data-entry view remains available and opening decoration returns to a live canvas.
   page.locator('#view-form').click();expect(page.locator('.editor')).to_be_visible()
   page.locator('#show-editor' if width==390 else '[data-tab="design"]').click();expect(page.locator('#studio-inspector')).to_be_visible();expect(page.locator('#preview')).to_be_visible()
   page.locator('#inspector-close').click();page.locator('#use-default-logo').click();expect(page.get_by_label('로고 크기 슬라이더')).to_be_visible();expect(page.locator('main')).to_have_attribute('data-view','canvas')
   page.get_by_label('로고 크기 슬라이더').fill('400')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design.logoSize===400")
   page.reload(wait_until='networkidle');expect(page.locator('#render-error')).to_be_empty()
   assert page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).canvas.styles['sec:group-0:breeds'].fontFamily")=='Jua'
   assert not errors,errors
   page.close()
  browser.close()
 print('PASS live canvas inspector on mobile/desktop, font and colors, text/frame alignment, layout presets, width, drag reorder, no overlaps and persistence')
finally:server.shutdown();server.server_close()
