"""Mobile properties can expand to 90%, drag, persist height and dismiss on a dimmed backdrop."""
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
  page=browser.new_page(viewport={'width':390,'height':900},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('PRICE_STUDIO_URL',f'http://127.0.0.1:{server.server_port}/planning/pricelist.html'),wait_until='networkidle')
  expect(page.locator('#download-mobile')).to_be_enabled()
  page.locator('[data-open-inspector="layout"]').click()
  panel=page.locator('#studio-inspector');grip=page.locator('#inspector-resize-handle')
  expect(panel).to_be_visible();expect(page.locator('#inspector-backdrop')).to_be_visible()
  assert .68<panel.bounding_box()['height']/900<.72
  page.locator('#inspector-expand').click()
  assert .89<panel.bounding_box()['height']/900<.91
  assert panel.locator('.inspector-scroll').bounding_box()['height']>600
  page.screenshot(path='/tmp/price-inspector-90-mobile.png')
  handle=grip.bounding_box();x=handle['x']+handle['width']/2;y=handle['y']+15
  cdp=page.context.new_cdp_session(page)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+400}]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  ratio=panel.bounding_box()['height']/900
  assert .43<ratio<.48,ratio
  saved=page.evaluate("localStorage.getItem('price-inspector-height')")
  expect(grip).to_have_attribute('aria-valuenow',str(round(float(saved)*100)))
  page.locator('#inspector-backdrop').click(position={'x':12,'y':80})
  expect(panel).to_be_hidden();expect(page.locator('#inspector-backdrop')).to_be_hidden()
  page.reload(wait_until='networkidle');page.locator('[data-open-inspector="layout"]').click()
  assert abs(panel.bounding_box()['height']/900-ratio)<.01
  grip.focus();page.keyboard.press('End')
  assert panel.bounding_box()['height']/900>.89
  page.keyboard.press('Home')
  assert .29<panel.bounding_box()['height']/900<.31
  page.keyboard.press('Escape');expect(panel).to_be_hidden()
  # Small controls give the artwork more room; the settings fields keep readable type.
  assert page.locator('[data-open-inspector="layout"]').bounding_box()['height']<=36
  assert page.locator('#download-mobile').bounding_box()['height']<=38
  page.set_viewport_size({'width':1440,'height':1000})
  page.locator('[data-open-inspector="layout"]').click()
  expect(page.locator('#inspector-backdrop')).to_be_hidden()
  expect(grip).to_be_hidden()
  expect(panel).to_have_attribute('aria-modal','false')
  page.locator('#inspector-close').click()
  # Zoom changes the viewport scale, never document font sizes or paper geometry.
  paper=page.evaluate("localStorage.getItem('mongle-price-studio-v2')")
  zoom=page.locator('[data-zoom-fit]')
  expect(zoom).to_have_text('100%')
  page.locator('[data-zoom-step="1"]').click();expect(zoom).to_have_text('125%')
  page.locator('[data-zoom-step="-1"]').click();expect(zoom).to_have_text('100%')
  shell=page.locator('.canvas-shell');shell.scroll_into_view_if_needed()
  r=shell.bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+100)
  page.keyboard.down('Control');page.mouse.wheel(0,-150);page.keyboard.up('Control')
  page.wait_for_function("parseInt(document.querySelector('[data-zoom-fit]').textContent)>125")
  zoom.click();expect(zoom).to_have_text('100%')
  for _ in range(4):page.locator('[data-zoom-step="1"]').click()
  shell.evaluate('(el)=>{el.scrollLeft=100;el.scrollTop=200;}')
  initial=shell.evaluate('(el)=>({x:el.scrollLeft,y:el.scrollTop})')
  r=shell.bounding_box();x=r['x']+r['width']/2;y=max(50,r['y']+100)
  page.keyboard.down('Space');page.mouse.move(x,y);page.mouse.down();page.mouse.move(x-60,y-70,steps=6);page.mouse.up();page.keyboard.up('Space')
  pan=shell.evaluate('(el)=>({x:el.scrollLeft,y:el.scrollTop})')
  assert pan['x']>initial['x']+40 and pan['y']>initial['y']+50,(initial,pan)
  assert page.evaluate("localStorage.getItem('mongle-price-studio-v2')")==paper
  assert not errors,errors
  browser.close()
 print('PASS mobile sheet 30–90% touch resize, one-tap expansion, keyboard, persistence, backdrop dismissal and compact buttons; desktop remains non-modal; zoom +/- / Ctrl-wheel / Space-pan preserve document')
finally:server.shutdown();server.server_close()
