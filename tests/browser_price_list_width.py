from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for mobile in [False,True]:
   page=browser.new_page(viewport={'width':390 if mobile else 1440,'height':1000},is_mobile=mobile,has_touch=mobile)
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   fixture=page.evaluate("async()=>{const {createDefaultProject}=await import('./price-studio-defaults.js');const p=createDefaultProject();p.sections[3].items=[{label:'털길이 (6mm / 1cm / 2cm)',value:'5,000 / 10,000 / 15,000 / 20,000'}];p.canvas={transforms:{},styles:{'sec:extras:item:0:label':{width:110}}};return p;}")
   page.locator('#import').set_input_files({'name':'regression.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()})
   target=page.locator('[data-element="sec:extras:item:0:label"]');target.click()
   handle=page.locator('.canvas-width-handle');box=handle.bounding_box();before=target.bounding_box()
   page.mouse.move(box['x']+16,box['y']+16);page.mouse.down();page.mouse.move(box['x']+100,box['y']+16,steps=8);page.mouse.up()
   assert target.bounding_box()['width']>before['width']
   page.locator('.canvas-fit-handle').click()
   expect(page.locator('#save-status')).to_contain_text('자동 저장됨')
   check=page.evaluate("""async()=>{const {renderPoster}=await import('./price-studio-render.js?v=list-width-14');const p=JSON.parse(localStorage.getItem('mongle-price-studio-v2')),c=document.createElement('canvas'),ctx=c.getContext('2d'),draws=[];ctx.fillText=(text,x,y)=>draws.push({text,x,y});const r=renderPoster(c,p,null);return {draws,boxes:r.elements.filter(e=>e.id.startsWith('sec:extras:item:0:')),items:p.sections[3].items,error:r.error};}""")
   assert any(d['text']==fixture['sections'][3]['items'][0]['label'] for d in check['draws']),check
   assert any(d['text']==fixture['sections'][3]['items'][0]['value'] for d in check['draws']),check
   label,value=check['boxes'];assert label['x']+label['width']<value['x']
   assert check['items']==fixture['sections'][3]['items'];assert not check['error']
   page.reload(wait_until='networkidle');expect(target).to_be_visible()
   page.screenshot(path=f'/tmp/list-width-{mobile}.png')
   page.close()
  browser.close()
 print('PASS reported long label, wider drag, one-line label/amount, no overlap and unchanged data')
finally:server.shutdown();server.server_close()
