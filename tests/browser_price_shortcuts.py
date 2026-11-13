"""Standard editor shortcuts preserve selected contents and native typing behavior."""
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
state=lambda page:page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
def wait_count(page,count):page.wait_for_function('(count)=>JSON.parse(localStorage.getItem("mongle-price-studio-v2")).sections.length===count',arg=count)
def section(p,id):return next(s for s in p['sections'] if s['id']==id)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('PRICE_STUDIO_URL',f'http://127.0.0.1:{server.server_port}/planning/pricelist.html'),wait_until='networkidle')
  expect(page.locator('#download')).to_be_enabled();before=state(page);count=len(before['sections'])
  # Duplicate the selected section, not the entire sheet.
  page.locator('.layers [data-select="cat"]').click();page.keyboard.press('Control+d');wait_count(page,count+1)
  after=state(page);copies=[s for s in after['sections'] if s['id'] not in {s['id'] for s in before['sections']}]
  assert len(copies)==1 and copies[0]['items']==section(before,'cat')['items']
  page.keyboard.press('Control+z');wait_count(page,count)
  page.keyboard.press('Control+Shift+z');wait_count(page,count+1)
  page.keyboard.press('Control+z');wait_count(page,count)
  page.keyboard.press('Control+y');wait_count(page,count+1)
  print('PASS Ctrl+D, Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y',flush=True)
  # Copy a table snapshot and paste after a different selected section.
  before=state(page);page.locator('.layers [data-select="group-0"]').click();page.keyboard.press('Control+c')
  page.locator('.layers [data-select="group-1"]').click();page.keyboard.press('Control+v');wait_count(page,len(before['sections'])+1)
  after=state(page);copied=next(s for s in after['sections'] if s['id'] not in {s['id'] for s in before['sections']})
  original=section(before,'group-0');assert copied['rows']==original['rows'];assert copied.get('columns',after['columns'])==original.get('columns',before['columns'])
  assert section(after,'group-0')==original
  print('PASS Ctrl+C/V table snapshot preserves services and prices',flush=True)
  # Copy just the selected notice and preserve its typography in a standalone section.
  before=state(page);page.locator('[data-element="sec:extras:note"]').click();page.keyboard.press('Control+c')
  page.locator('.layers [data-select="cat"]').click();page.keyboard.press('Control+v');wait_count(page,len(before['sections'])+1)
  after=state(page);notice=next(s for s in after['sections'] if s['id'] not in {s['id'] for s in before['sections']})
  assert notice['kind']=='text' and notice['hideHeading'] and notice['content']==section(before,'extras')['note']
  assert section(after,'extras')['note']==section(before,'extras')['note']
  assert after['canvas']['styles']['sec:'+notice['id']+':content']['fontSize']==before['design']['bodySize']-1
  print('PASS text-only clipboard preserves text and font size',flush=True)
  # Cut is deferred until a successful paste, and can be undone as a single edit.
  before=state(page);page.locator('[data-element="sec:extras:note"]').click();page.keyboard.press('Control+x')
  assert state(page)==before
  page.locator('.layers [data-select="cat"]').click();page.keyboard.press('Control+v');wait_count(page,len(before['sections'])+1)
  assert section(state(page),'extras')['note']==''
  page.keyboard.press('Control+z');wait_count(page,len(before['sections']))
  assert section(state(page),'extras')['note']==section(before,'extras')['note']
  print('PASS deferred cut/paste and undo',flush=True)
  # Native input editing retains its own undo/paste behavior and does not duplicate sections.
  page.locator('.layers [data-select="cat"]').click();page.locator('#view-form').click()
  field=page.locator('[data-field="title"]');field.fill('');field.press_sequentially('Native undo text')
  value=field.input_value();page.keyboard.press('Control+z');assert field.input_value()!=value
  assert len(state(page)['sections'])==len(before['sections'])
  page.keyboard.press('Control+c');page.keyboard.press('Control+v');assert len(state(page)['sections'])==len(before['sections'])
  field.fill('고양이 미용');page.locator('#view-canvas').click()
  page.wait_for_timeout(450);saved=state(page);page.reload(wait_until='networkidle')
  assert state(page)==saved;expect(page.locator('#render-error')).to_be_empty();assert not errors,errors
  print('PASS native input shortcuts and persistence',flush=True)
  browser.close()
 print('PASS standard clipboard, duplicate and undo/redo editor shortcuts')
finally:server.shutdown();server.server_close()
