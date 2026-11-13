"""One-line sizing grows frames/sections while preserving both cells' typography."""
import json
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
   page=browser.new_page(viewport={'width':width,'height':1000},is_mobile=width==390,has_touch=width==390);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   expect(page.locator('#download-mobile' if width==390 else '#download')).to_be_enabled()
   seed=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
   section=next(s for s in seed['sections'] if s['id']=='extras');section['span']='half';section['items'][7]['label']='털길이 (6mm / 1cm / 2cm) 추가'
   seed['canvas']={'transforms':{},'styles':{'sec:extras:item:7:label':{'fontSize':18,'letterSpacing':.5,'padding':2,'lineHeight':1.7},'sec:extras:item:7:value':{'fontSize':20,'bold':True,'color':'#443322'}}}
   page.add_init_script("if(!sessionStorage.getItem('fit-seeded')){localStorage.setItem('mongle-price-studio-v2',JSON.stringify("+json.dumps(seed)+"));sessionStorage.setItem('fit-seeded','1');}")
   page.reload(wait_until='networkidle')
   before=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
   page.locator('[data-element="sec:extras:item:7:label"]').click()
   page.get_by_role('button',name='한 줄 맞춤',exact=True).click()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.find(s=>s.id==='extras').layoutWidth>390")
   after=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
   label='sec:extras:item:7:label';value='sec:extras:item:7:value'
   assert after['canvas']['styles'][value]==before['canvas']['styles'][value]
   assert {k:v for k,v in after['canvas']['styles'][label].items() if k!='width'}==before['canvas']['styles'][label]
   geometry=page.evaluate('''async()=>{const {renderSheetPoster}=await import('./price-studio-pages.js?v=decor-22'),{layoutText}=await import('./price-studio-text.js?v=decor-22');const p=JSON.parse(localStorage.getItem('mongle-price-studio-v2')),c=document.createElement('canvas'),r=renderSheetPoster(c,p,null),id='sec:extras:item:7:label',label=r.elements.find(e=>e.id===id),value=r.elements.find(e=>e.id==='sec:extras:item:7:value'),s=p.sections.find(s=>s.id==='extras'),ctx=c.getContext('2d');const l=layoutText(ctx,s.items[7].label,label.base.width,'400 18px StudioSans',23,p.canvas.styles[id]);const extras=r.elements.find(e=>e.id==='sec:extras'),cat=r.elements.find(e=>e.id==='sec:cat');return {lines:l.lines.length,label,value,extras,cat,error:r.error};}''')
   assert geometry['lines']==1,geometry
   assert geometry['label']['x']+geometry['label']['width']<=geometry['value']['x']
   assert geometry['extras']['y']==geometry['cat']['y']
   assert geometry['extras']['x']+geometry['extras']['width']<geometry['cat']['x']
   assert geometry['extras']['width']>geometry['cat']['width']
   assert geometry['label']['textStyle']['fontSize']==18 and geometry['value']['textStyle']['fontSize']==20
   expect(page.locator('#render-error')).to_be_empty()
   page.screenshot(path=f'/tmp/price-fit-preserve-{width}.png')
   page.reload(wait_until='networkidle')
   assert page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).canvas.styles")==after['canvas']['styles']
   # The sidebar and the on-canvas divider both allocate the remainder to the sibling.
   page.locator('[data-element="sec:extras:item:7:label"]').click()
   page.locator('[data-open-inspector="layout"]').click()
   page.get_by_label('선택한 섹션 비율 숫자',exact=True).fill('65')
   expect(page.get_by_label('선택한 섹션 비율',exact=True)).to_have_value('65')
   page.wait_for_function("Math.abs(JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.find(s=>s.id==='extras').layoutWidth-507)<.1")
   page.locator('#section-fill').click()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.find(s=>s.id==='cat').layoutWidth>0")
   page.locator('#section-equal').click()
   expect(page.get_by_label('선택한 섹션 비율',exact=True)).to_have_value('50')
   page.screenshot(path=f'/tmp/price-flex-controls-{width}.png')
   page.locator('#inspector-close').click()
   divider=page.locator('[data-split="extras"]');divider.scroll_into_view_if_needed()
   handle=divider.locator('span').bounding_box();x=handle['x']+handle['width']/2;y=handle['y']+handle['height']/2
   page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+30,y,steps=6);page.mouse.up()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.find(s=>s.id==='extras').layoutWidth>390")
   saved_width=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.find(s=>s.id==='extras').layoutWidth")
   divider.focus();page.keyboard.press('ArrowLeft')
   page.wait_for_function('(width)=>JSON.parse(localStorage.getItem("mongle-price-studio-v2")).sections.find(s=>s.id==="extras").layoutWidth<width',arg=saved_width)
   expect(page.locator('#render-error')).to_be_empty()
   page.locator('[data-element="sec:extras:item:7:label"]').click()
   page.get_by_role('button',name='행 글자 크기 복원',exact=True).click()
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).canvas.styles['sec:extras:item:7:label'].fontSize===undefined")
   restored=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).canvas.styles")
   assert 'fontSize' not in restored[value] and restored[value]['color']=='#443322'
   assert not errors,errors
   page.close()
  browser.close()
 print('PASS one-line fit preserves both fonts, widens section, keeps price separate, shares remaining width with adjacent section and persists on mobile/desktop')
finally:server.shutdown();server.server_close()
