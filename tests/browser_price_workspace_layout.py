"""Inspector and layer breakpoints reserve exactly the space used by visible panels."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import os,json
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
MEASURE='''()=>{const main=document.querySelector('main'),preview=document.querySelector('.preview-area'),layers=document.querySelector('.layers'),panel=document.getElementById('studio-inspector'),r=el=>{const x=el.getBoundingClientRect();return {x:x.x,y:x.y,width:x.width,height:x.height,right:x.right,bottom:x.bottom}},style=getComputedStyle(main),ls=getComputedStyle(layers),visible=ls.display!=='none',box=r(main),p=r(preview),l=r(layers),i=r(panel);const expected=box.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-(visible?l.width+parseFloat(style.columnGap||0):0);const wraps=[...document.querySelectorAll('.property-launchers button span,.inspector-tabs button span,.viewport-controls button')].filter(el=>el.getClientRects().length).map(el=>{const range=document.createRange();range.selectNodeContents(el);return {text:el.textContent,height:range.getBoundingClientRect().height,font:parseFloat(getComputedStyle(el).fontSize),white:getComputedStyle(el).whiteSpace};});return {main:box,preview:p,layers:l,inspector:i,layersVisible:visible,expected,grid:style.gridTemplateColumns,wraps,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth};}'''
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  failures=[]
  for width in [741,820,893,1000,1024,1200,1440,1920,390]:
   page=browser.new_page(viewport={'width':width,'height':1000},is_mobile=width==390,has_touch=width==390);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(os.environ.get('PRICE_STUDIO_URL',f'http://127.0.0.1:{server.server_port}/planning/pricelist.html'),wait_until='networkidle')
   expect(page.locator('#download-mobile' if width==390 else '#download')).to_be_enabled()
   before=page.evaluate("localStorage.getItem('mongle-price-studio-v2')")
   page.locator('[data-open-inspector="brand"]').click()
   for collapsed in [False,True]:
    if collapsed:page.evaluate("document.body.classList.add('layers-collapsed')")
    m=page.evaluate(MEASURE)
    if width>740:
     if abs(m['preview']['width']-m['expected'])>3:failures.append({'width':width,'collapsed':collapsed,'issue':'preview does not fill available grid content','geometry':m})
     if m['preview']['right']>m['inspector']['x']-5:failures.append({'width':width,'collapsed':collapsed,'issue':'preview overlaps desktop inspector','geometry':m})
     if m['preview']['width']<min(280,width*.32):failures.append({'width':width,'collapsed':collapsed,'issue':'preview is squeezed into a narrow column','geometry':m})
     for label in m['wraps']:
      if label['height']>label['font']*1.8:failures.append({'width':width,'collapsed':collapsed,'issue':'toolbar text wraps vertically','label':label})
    else:
     expect(page.locator('#inspector-backdrop')).to_be_visible()
     assert abs(m['preview']['width']-width)<=20,m
     assert m['inspector']['width']>=width-2,m
    if m['documentWidth']>width+2:failures.append({'width':width,'collapsed':collapsed,'issue':'page overflows horizontally','geometry':m})
   page.screenshot(path=f'/tmp/price-workspace-layout-{width}.png')
   assert page.evaluate("localStorage.getItem('mongle-price-studio-v2')")==before
   assert not errors,errors
   page.close()
  browser.close()
  if failures:
   Path('/tmp/price-workspace-layout-failures.json').write_text(json.dumps(failures,ensure_ascii=False,indent=2))
   print(json.dumps([{'width':f['width'],'collapsed':f['collapsed'],'issue':f['issue'],'preview':f.get('geometry',{}).get('preview',{}).get('width'),'expected':f.get('geometry',{}).get('expected'),'label':f.get('label')} for f in failures],ensure_ascii=False,indent=2))
   raise AssertionError(f'{len(failures)} workspace layout regressions; details /tmp/price-workspace-layout-failures.json')
 print('PASS workspace widths 390,741,820,893,1000,1024,1200,1440,1920: inspector separation, full canvas allocation, collapsed layers, compact unwrapped toolbar and unchanged document')
finally:server.shutdown();server.server_close()
