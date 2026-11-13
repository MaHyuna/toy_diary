"""Additional Korean font files must match preview and outlined SVG/PDF output."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'public')))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/planning/pricelist.html',wait_until='networkidle')
  result=page.evaluate('''async()=>{
   const {installFontOptions,FONT_FAMILIES}=await import('./price-studio-fonts.js');
   const {outlineFonts,OutlineCanvas}=await import('./price-studio-svg.js');
   const {createDefaultProject}=await import('./price-studio-data.js');
   const {outlinedSVG,exportPrint}=await import('./price-studio-print.js');
   await installFontOptions();const fonts=await outlineFonts(),paths={},widths={},ctx=document.createElement('canvas').getContext('2d');
   for(const family of ['StudioSans','StudioSerif','StudioHand']){
    ctx.font='20px '+family;widths[family]=ctx.measureText('꽃길만 걷개 15,000').width;
    for(const weight of [400,700]){const c=new OutlineCanvas(fonts);c.context.font=weight+' 20px '+family;c.context.fillText('꽃길만 걷개 15,000',20,30);paths[family+weight]=c.markup;}
   }
   const outputs=[];
   for(const family of ['StudioSerif','StudioHand']){
    const p=createDefaultProject();p.brand.name='';p.brand.title='';p.brand.footer='';p.brand.contact='';p.design.corners=false;
    p.sections=[{id:'text',kind:'text',title:'글꼴 테스트',content:'꽃길만 걷개 / 가나다 15,000',breeds:'',note:'',span:'full',visible:true,style:{}}];
    p.canvas={transforms:{},styles:{'sec:text:content':{fontFamily:family,fontSize:18,bold:true}}};
    const {svg}=await outlinedSVG(p,null,{format:'svg'}),xml=new DOMParser().parseFromString(svg,'image/svg+xml');
    const {blob}=await exportPrint(p,null,{format:'pdf'}),header=new TextDecoder().decode((await blob.arrayBuffer()).slice(0,8));
    outputs.push({family,texts:xml.querySelectorAll('text').length,paths:xml.querySelectorAll('[data-element="sec:text:content"]').length,pdf:header,size:blob.size});
   }
   return {families:Object.keys(FONT_FAMILIES),options:[...document.getElementById('canvas-font-family').options].map(o=>o.value),widths,distinct:new Set(Object.values(paths)).size,outputs};
  }''')
  assert 'StudioSerif' in result['options'] and 'StudioHand' in result['options']
  assert len(set(result['widths'].values()))==3,result
  assert result['distinct']==6,result
  for out in result['outputs']:
   assert out['texts']==0 and out['paths']>0 and out['pdf'].startswith('%PDF-') and out['size']>1000,out
  assert not errors,errors
  browser.close()
 print('PASS additional Korean fonts load with distinct preview metrics, all glyphs outline, regular/bold differ, SVG and PDF export')
finally:server.shutdown();server.server_close()
