"""Typography uses measured frames; extreme edits must reflow without overlap."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
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
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   page.locator('[data-element="sec:group-0:breeds"]').click();page.locator('[data-open-inspector="text"]').first.click();page.locator('.spacing-inspector summary').click()
   for label,value in [('자간','2'),('행간 배수','2.2'),('상자 안쪽 여백','12'),('상자 너비','240'),('용지 여백','65'),('섹션 안쪽 여백','28'),('두 열 사이 간격','40'),('섹션 사이 간격','55'),('표 행 최소 높이','45')]:
    field=page.get_by_label(label,exact=True);field.fill(value);field.press('Tab')
   page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).design.columnGap===40")
   page.locator('.spacing-inspector summary').click();page.screenshot(path=f'/tmp/spacing-controls-{mobile}.png')
   page.reload(wait_until='networkidle');expect(page.locator('#render-error')).to_be_empty()
   result=page.evaluate('''async()=>{
    const {renderPoster}=await import('./price-studio-render.js?v=spacing-15');const {validateProject}=await import('./price-studio-data.js?v=spacing-15');
    const p=JSON.parse(localStorage.getItem('mongle-price-studio-v2')),original=JSON.stringify(p.sections),c=document.createElement('canvas');
    for(const id of ['brand:name','brand:title','brand:contact','sec:group-0:title','sec:group-0:col:col-0','sec:group-0:row:row-0-0','sec:group-0:cell:row-0-0:col-0','sec:extras:item:7:label','sec:extras:item:7:value'])p.canvas.styles[id]={fontSize:30,letterSpacing:2,lineHeight:2,padding:12};
    p.brand.name='꽃길만 걷개';p.brand.title='예약 미용 안내';
    const r=renderPoster(c,validateProject(p),null),leaves=r.elements.filter(e=>e.kind==='text'),overlaps=[];
    for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++){const a=leaves[i],b=leaves[j];if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5)overlaps.push([a.id,b.id]);}
    return {overlaps,error:r.error,unchanged:original===JSON.stringify(p.sections),style:p.canvas.styles['sec:group-0:breeds'],design:p.design};
   }''')
   assert not result['overlaps'],result['overlaps'];assert not result['error'],result['error'];assert result['unchanged']
   assert result['style']['lineHeight']==2.2 and result['style']['padding']==12 and result['style']['letterSpacing']==2
   assert result['design']['pageMargin']==65
   assert not errors,errors
   page.screenshot(path=f'/tmp/spacing-{mobile}.png');page.close()
  browser.close()
 print('PASS desktop/mobile spacing controls, persistence, unchanged data and non-overlapping frames for large text in all element types')
finally:server.shutdown();server.server_close()
