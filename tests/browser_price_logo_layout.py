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
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [390,1440]:
   page=browser.new_page(viewport={'width':width,'height':1000})
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   page.locator('#use-default-logo').click();expect(page.get_by_label('로고 크기 슬라이더')).to_be_visible()
   snapshot='''async()=>{const {renderSheetPoster}=await import('./price-studio-pages.js?v=logo-layout-16');const p=JSON.parse(localStorage.getItem('mongle-price-studio-v2')),logo=new Image();logo.src=p.brand.logo;await logo.decode();const c=document.createElement('canvas'),r=renderSheetPoster(c,p,logo),table=r.elements.find(e=>e.id==='sec:group-0:table'),crop=document.createElement('canvas');crop.width=table.width*2;crop.height=table.height*2;crop.getContext('2d').drawImage(c,table.x*2,table.y*2,crop.width,crop.height,0,0,crop.width,crop.height);return {image:crop.toDataURL(),height:c.height,table,scale:r.fitScale,sections:p.sections};}'''
   page.get_by_label('로고 크기 슬라이더').fill('100')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design.logoSize===100")
   before=page.evaluate(snapshot)
   page.get_by_label('로고 크기 슬라이더').fill('500')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design.logoSize===500")
   after=page.evaluate(snapshot)
   assert before['image']==after['image'],'Table pixels changed when logo grew'
   assert before['scale']==after['scale']==1
   assert after['height']>before['height'];assert after['table']['x']==before['table']['x'];assert after['sections']==before['sections']
   page.locator('#inspector-close').click();page.locator('#preview-format').select_option('fit');expect(page.locator('#output-badge')).to_have_text('A4 · 축소')
   assert page.locator('#preview').evaluate('c=>c.height')==2546
   page.locator('#use-default-logo').click();expect(page.locator('#output-badge')).to_have_text('크기 유지')
   expect(page.locator('#render-error')).to_be_empty()
   page.reload(wait_until='networkidle');expect(page.locator('#preview-format')).to_have_value('portrait')
   page.close()
  browser.close()
 print('PASS logo growth preserves table pixels, text size, margins and prices; paper extends; explicit A4 fit remains available')
finally:server.shutdown();server.server_close()
