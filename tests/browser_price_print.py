"""Real-font alignment, containment and exported A4 page dimensions."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import base64,json,struct
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'demo-dist')));thread=Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1100},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'/planning/pricelist.html',wait_until='networkidle');expect(page.locator('#download')).to_be_enabled();expect(page.locator('#preview-format')).to_have_value('portrait');expect(page.locator('#output-badge')).to_have_text('A4 · 한 장');expect(page.locator('#render-error')).to_be_empty()
  fixture=page.evaluate("async()=>{const {createDefaultProject}=await import('./price-studio-defaults.js');return createDefaultProject();}")
  page.locator('#import').set_input_files({'name':'fixture.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});page.wait_for_timeout(500)
  original=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
  measured=page.evaluate('''async()=>{
   const {renderPoster}=await import('./price-studio-render.js?v=single-a4-11');
   const project=JSON.parse(localStorage.getItem('mongle-price-studio-v2')),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),draws=[],flowers=[];
   const fill=ctx.fillText.bind(ctx),ellipse=ctx.ellipse.bind(ctx);
   ctx.fillText=function(value,x,y,width){const m=this.measureText(value);draws.push({value,x,y,align:this.textAlign,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent});return fill(value,x,y,width);};
   ctx.ellipse=function(x,y,...rest){flowers.push({x,y});return ellipse(x,y,...rest);};
   const result=renderPoster(canvas,project,null,{fixedHeight:1273});
   const headings=project.sections.map((s,i)=>{const t=draws.find(d=>d.value===s.title);const flowerY=flowers.slice(i*5,i*5+5).reduce((n,v)=>n+v.y,0)/5;return Math.abs((t.top+t.bottom)/2-flowerY);});
   const extras=project.sections.find(s=>s.id==='extras');const rows=extras.items.map((item,i)=>{const box=result.elements.find(e=>e.id===`sec:extras:item:${i}:label`);const label=draws.find(d=>d.value===item.label&&d.y>=box.y&&d.y<=box.y+box.height);const value=draws.find(d=>d.value===item.value&&d.y>=box.y&&d.y<=box.y+box.height&&d.align==='right');return {centerDiff:Math.abs((label.top+label.bottom-value.top-value.bottom)/2),right:value.x};});
   const notes=project.sections.filter(s=>s.kind==='matrix').map(s=>{const title=result.elements.find(e=>e.id===`sec:${s.id}:title`),note=result.elements.find(e=>e.id===`sec:${s.id}:note`);return {titleY:title.y,noteY:note.y,noteX:note.x,titleX:title.x};});
   return {error:result.error,height:result.requiredHeight,headings,rows,notes};
  }''')
  assert not measured['error'],measured;assert max(measured['headings'])<1,measured['headings'];assert max(r['centerDiff'] for r in measured['rows'])<1,measured['rows'];assert len({r['right'] for r in measured['rows']})==1
  assert all(n['noteX']>n['titleX'] and abs(n['noteY']-n['titleY'])<20 for n in measured['notes'])
  # User's long labels, three-part prices, and long notice stay in their column.
  long=page.evaluate('''async()=>{const {renderSheetPoster}=await import('./price-studio-pages.js?v=single-a4-11');const p=JSON.parse(localStorage.getItem('mongle-price-studio-v2'));const s=p.sections.find(s=>s.id==='extras');s.items=[{label:'크라운 / 무스타슈 / 앞머리 / 가면',value:'5,000'},{label:'곰돌이 / 테디',value:'10,000'},{label:'하이바 / 귀툭튀 / 큰테디 / 베이비컷 / 디자인컷',value:'15,000'},{label:'발바닥 / 닭발',value:'5,000 / 5,000'},{label:'양말 / 장화 / 엉뽕',value:'10,000'},{label:'스파 / 머드팩',value:'10,000 / 20,000'},{label:'노령견 (10살 이상)',value:'10,000'},{label:'털 길이 (6mm / 1cm / 2cm )',value:'5,000 / 10,000 / 20,000'}];s.note='이중모, 털엉킴, 기장, 모량, 입질, 미용매너 등에 따라 추가비용이 발생할 수 있습니다. 상담 후 비용을 안내합니다.';const c=document.createElement('canvas'),r=renderSheetPoster(c,p,null);return {error:r.error,width:c.width,height:c.height,scale:r.fitScale,elements:r.elements,project:p,image:c.toDataURL().split(',')[1]};}''')
  assert not long['error'],long['error'];assert (long['width'],long['height'])==(1800,2546);assert all(e['y']>=0 and e['y']+e['height']<=1273 for e in long['elements']);Path('/tmp/pricelist-long-labels.png').write_bytes(base64.b64decode(long['image']))
  for i in range(8):
   label=next(e for e in long['elements'] if e['id']==f'sec:extras:item:{i}:label');value=next(e for e in long['elements'] if e['id']==f'sec:extras:item:{i}:value')
   assert label['x']+label['width']<value['x'];assert label['y']==value['y'] and label['height']==value['height']
  note=next(e for e in long['elements'] if e['id']=='sec:extras:note');assert note['x']+note['width']<=next(e['x']+e['width'] for e in long['elements'] if e['id']=='sec:extras')
  # Download the user's long menu as ONE exact A4 PNG, equal to its preview.
  page.locator('#import').set_input_files({'name':'user-menu.json','mimeType':'application/json','buffer':json.dumps(long['project'],ensure_ascii=False).encode()})
  expect(page.locator('#render-error')).to_be_empty();expect(page.locator('#output-badge')).to_have_text('A4 · 한 장')
  page.locator('#download').click()
  with page.expect_download() as download:page.locator('#export-current').click()
  raw=Path(download.value.path()).read_bytes();assert struct.unpack('>II',raw[16:24])==(1800,2546)
  assert raw==base64.b64decode(page.locator('#preview').evaluate('c=>c.toDataURL().split(",")[1]'))
  Path('/tmp/pricelist-single-a4.png').write_bytes(raw);page.locator('#export-close').click()
  # Even a much longer table stays on one sheet and retains every editable row.
  expanded=json.loads(json.dumps(original));seed=expanded['sections'][0]['rows'][0]
  expanded['design']['rowHeight']=50
  expanded['sections'][0]['rows']=[{**seed,'id':f'long-row-{i}','weight':f'{i+1}kg 미만'} for i in range(30)]
  page.locator('#import').set_input_files({'name':'long-menu.json','mimeType':'application/json','buffer':json.dumps(expanded,ensure_ascii=False).encode()})
  expect(page.locator('#output-badge')).to_have_text('A4 · 한 장');expect(page.locator('#render-error')).to_be_empty()
  expect(page.locator('#page-next')).to_have_count(0);expect(page.locator('#download-pages')).to_have_count(0)
  row_ids=page.locator('[data-element^="sec:group-0:row:long-row-"]').evaluate_all("els=>els.map(e=>e.dataset.element.split(':').at(-1))")
  assert row_ids==[f'long-row-{i}' for i in range(30)]
  # The last scaled row remains selectable and editable at the rendered location.
  last=page.locator('[data-element="sec:group-0:cell:long-row-29:col-5"]');last.click();page.locator('#canvas-edit').click();expect(page.locator('.canvas-input')).to_have_value(seed['prices'][5]);page.locator('.canvas-input').press('Enter')
  page.locator('#download').click()
  with page.expect_download() as download:page.locator('#export-current').click()
  assert struct.unpack('>II',Path(download.value.path()).read_bytes()[16:24])==(1800,2546)
  page.locator('#export-close').click()
  for width in [390,1440]:
   page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/pricelist-editor-{width}.png')
  # Already-saved content format and all custom values survive the update and switching paper.
  original['design']['format']='content';original['brand']['name']='내 미용실';page.add_init_script("localStorage.setItem('mongle-price-studio-v2',"+json.dumps(json.dumps(original))+");");page.reload(wait_until='networkidle');expect(page.locator('#preview-format')).to_have_value('content');page.locator('#preview-format').select_option('portrait');page.wait_for_timeout(450)
  saved=page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))");assert saved['sections']==original['sections'];assert saved['brand']==original['brand'];assert saved['design']['colors']==original['design']['colors'];assert saved['design']['format']=='portrait'
  page.goto(base+'/planning/pricelist.html?paper=a4',wait_until='networkidle');expect(page.locator('#preview-format')).to_have_value('portrait');assert 'paper=' not in page.url;expect(page.locator('#render-error')).to_be_empty()
  assert not errors,errors
  b.close();print('PASS real-font title/flower and list alignment, long label/value containment, inline notes, single-sheet A4 PNG export, scaled row editing, responsive editor and saved-data preservation')
finally:server.shutdown();thread.join();server.server_close()
