from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import xml.etree.ElementTree as ET
import os
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
   page.goto(os.environ.get('PRICE_STUDIO_URL',f'http://127.0.0.1:{server.server_port}/planning/pricelist.html'),wait_until='networkidle')
   expect(page.locator('#download-mobile' if width==390 else '#download')).to_be_enabled()
   before=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
   page.locator('[data-element="sec:extras:note"]').click()
   drop=page.locator('.canvas-row-drop');expect(drop).to_be_visible()
   # Put both the source handle and full-row drop target inside the scroll viewport.
   page.locator('.canvas-shell').evaluate('(el)=>el.scrollTop=el.scrollHeight')
   handle=page.locator('.canvas-flow-handle').bounding_box();target=drop.bounding_box()
   x=handle['x']+handle['width']/2;y=handle['y']+handle['height']/2;tx=target['x']+target['width']*.65;ty=target['y']+target['height']/2
   if width==390:
    # Actual touch pointer events exercise pointer capture and touch-action behavior.
    cdp=page.context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':tx,'y':ty}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   else:
    # Drag the selected notice itself; the handle is an alternative, not required.
    source=page.locator('[data-element="sec:extras:note"]').bounding_box();x=source['x']+source['width']/2;y=source['y']+source['height']/2
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx,ty,steps=8);page.mouse.up()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.length===6")
   after=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
   note=after['sections'][-1];assert note['kind']=='text' and note['span']=='full' and note['hideHeading']
   assert note['content']==before['sections'][3]['note'] and after['sections'][3]['note']==''
   assert after['sections'][4]==before['sections'][4]
   target_id=f"sec:{note['id']}:content"
   expect(page.locator(f'[data-element="{target_id}"]')).to_have_attribute('aria-pressed','true')
   expect(page.locator('#render-error')).to_be_empty()
   page.screenshot(path=f'/tmp/price-flow-{width}.png')
   # Undo restores the original region and redo restores the standalone section.
   page.evaluate("document.getElementById('undo').click()")
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.length===5")
   assert page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections[3].note")==before['sections'][3]['note']
   page.evaluate("document.getElementById('redo').click()")
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.length===6")
   page.reload(wait_until='networkidle')
   expect(page.locator(f'[data-element="{target_id}"]')).to_be_attached()
   geometry=page.evaluate('''async()=>{const {renderSheetPoster}=await import('./price-studio-pages.js?v=decor-23');const p=JSON.parse(localStorage.getItem('mongle-price-studio-v2')),r=renderSheetPoster(document.createElement('canvas'),p,null),n=p.sections.at(-1),box=id=>r.elements.find(e=>e.id===id);return {note:box('sec:'+n.id),content:box('sec:'+n.id+':content'),left:box('sec:extras'),right:box('sec:cat'),footer:box('brand:contact'),title:box('sec:'+n.id+':title')||null,error:r.error};}''')
   assert geometry['note']['width']==804 and geometry['content']['width']==756
   assert geometry['note']['y']>=max(geometry['left']['y']+geometry['left']['height'],geometry['right']['y']+geometry['right']['height'])
   assert geometry['footer']['y']>=geometry['note']['y']+geometry['note']['height']
   assert geometry['title'] is None and not geometry['error']
   if width==1440:
    page.locator('#download').click();page.locator('#print-format').select_option('svg')
    with page.expect_download(timeout=60000) as download:page.locator('#export-current').click()
    xml=ET.parse(download.value.path()).getroot()
    assert any(el.attrib.get('data-element')==target_id for el in xml.iter())
    assert not any(el.attrib.get('data-element')=='sec:extras:note' for el in xml.iter())
    assert not any('canvas-row-drop' in str(el.attrib) for el in xml.iter())
   assert not errors,errors
   page.close()
  browser.close()
 print('PASS mouse + touch drag to full-width row, preserved contents, automatic reflow, undo/redo, persistence and SVG')
finally:server.shutdown();server.server_close()
