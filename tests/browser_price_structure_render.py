"""Recursive section layouts preserve text sizes and keep independent frames apart."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [390,1440]:
   page=browser.new_page(viewport={'width':width,'height':1000},is_mobile=width==390,has_touch=width==390)
   errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
   expect(page.locator('#download-mobile' if width==390 else '#download')).to_be_enabled()
   result=page.evaluate('''async()=>{
    const {createDefaultProject}=await import('./price-studio-data.js');
    const {renderPoster}=await import('./price-studio-render.js');
    const {sectionWidth,pairedSections,setSectionWidth}=await import('./price-studio-layout.js');
    const p=createDefaultProject();for(const key of ['name','title','contact','footer','logo'])p.brand[key]='';
    p.sections.find(s=>s.id==='group-2').visible=false;
    p.sections.find(s=>s.id==='cat').layoutWidth=200;
    p.canvas={styles:{'sec:extras:item:0:label':{fontSize:20},'sec:extras:item:0:value':{fontSize:22}},transforms:{}};
    p.structure={id:'root',direction:'column',children:[{sectionId:'group-0'},{id:'main-row',direction:'row',children:[{id:'left-column',direction:'column',children:[{sectionId:'extras'},{sectionId:'group-1'}]},{sectionId:'cat'}]},{sectionId:'group-2'}]};
    const r=renderPoster(document.createElement('canvas'),p,null),box=id=>r.elements.find(e=>e.id===id),leaves=r.elements.filter(e=>e.kind==='text'),overlaps=[];
    for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++){const a=leaves[i],b=leaves[j];if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5)overlaps.push([a.id,b.id]);}
    return {error:r.error,overlaps,extras:box('sec:extras'),cat:box('sec:cat'),second:box('sec:group-1'),first:box('sec:group-0'),hidden:box('sec:group-2')||null,label:box('sec:extras:item:0:label').textStyle.fontSize,value:box('sec:extras:item:0:value').textStyle.fontSize,calculatedWidth:sectionWidth(p,p.sections.find(s=>s.id==='extras'))};
   }''')
   assert not result['error'],result
   assert not result['overlaps'],result['overlaps']
   assert result['hidden'] is None
   assert result['label']==20 and result['value']==22
   assert result['extras']['y']==result['cat']['y']
   assert result['extras']['x']+result['extras']['width']<result['cat']['x']
   assert result['second']['y']>=result['extras']['y']+result['extras']['height']
   assert abs(result['calculatedWidth']-result['extras']['width'])<.001
   wrapped=page.evaluate('''async()=>{
    const {createDefaultProject}=await import('./price-studio-data.js'),{renderPoster}=await import('./price-studio-render.js'),{sectionWidth}=await import('./price-studio-layout.js');
    const p=createDefaultProject(),source=p.sections.find(s=>s.id==='extras');p.sections=['a','b','c','d'].map(id=>({...structuredClone(source),id,title:id.toUpperCase()}));
    for(const key of ['name','title','contact','footer','logo'])p.brand[key]='';
    p.canvas={styles:{'sec:a:item:0:label':{fontSize:20},'sec:a:item:0:value':{fontSize:22}},transforms:{}};
    p.structure={id:'root',direction:'column',children:[{id:'outer',direction:'row',children:[{id:'middle',direction:'row',children:[{id:'deep',direction:'row',children:[{sectionId:'a'},{sectionId:'b'}]},{sectionId:'c'}]},{sectionId:'d'}]}]};
    const r=renderPoster(document.createElement('canvas'),p,null),box=id=>r.elements.find(e=>e.id==='sec:'+id),leaves=r.elements.filter(e=>e.kind==='text'),overlaps=[];
    for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++){const a=leaves[i],b=leaves[j];if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5)overlaps.push([a.id,b.id]);}
    return {a:box('a'),b:box('b'),c:box('c'),d:box('d'),calculated:sectionWidth(p,p.sections[0]),error:r.error,overlaps,label:r.elements.find(e=>e.id==='sec:a:item:0:label').textStyle.fontSize,value:r.elements.find(e=>e.id==='sec:a:item:0:value').textStyle.fontSize};
   }''')
   assert not wrapped['error'],wrapped
   assert not wrapped['overlaps'],wrapped['overlaps']
   assert wrapped['a']['y']+wrapped['a']['height']<=wrapped['b']['y']
   assert wrapped['a']['x']==wrapped['b']['x']
   assert wrapped['a']['width']>=164 and wrapped['a']['width']==wrapped['calculated']
   assert wrapped['label']==20 and wrapped['value']==22
   assert not errors,errors
   page.close()
  browser.close()
 print('PASS recursive Row/Column: nested width math, hidden sections, original font sizes, and non-overlapping text frames on mobile/desktop')
finally:
 server.shutdown();server.server_close()
