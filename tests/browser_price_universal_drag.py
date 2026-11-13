"""The same pointer gesture sorts the tree and changes canvas Row/Column layout."""
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

def state(page):return page.evaluate("JSON.parse(localStorage.getItem('mongle-price-studio-v2'))")
def table(p,id):return next(s for s in p['sections'] if s['id']==id)
def columns(p,s):return s.get('columns',p['columns'])
def open_branch(page,id):
 if ':' in id and not id.startswith('sec:'):id='sec:'+id
 page.locator(f'.layers details[data-branch="{id}"]').evaluate('(e)=>e.open=true')
def tree_node(page,kind,section,index=None):
 query=f'.layers [data-drag-kind="{kind}"][data-drag-section="{section}"]'
 if index is not None:query+=f'[data-drag-index="{index}"]'
 return page.locator(query)
def drag(page,source,target,*,position='after',alt=False,touch=False):
 source.scroll_into_view_if_needed();target.scroll_into_view_if_needed()
 a=source.bounding_box();b=target.bounding_box()
 if target.evaluate('(e)=>!!e.closest("#canvas-overlay")&&e.dataset.dragKind==="section"'):
  sid=target.get_attribute('data-drag-section')
  b=page.evaluate('''async id=>{const {renderSheetPoster}=await import('./price-studio-pages.js');const p=JSON.parse(localStorage.getItem('mongle-price-studio-v2')),logo=new Image();logo.src=p.brand.logo;if(p.brand.logo)await logo.decode();const r=renderSheetPoster(document.createElement('canvas'),p,p.brand.logo?logo:null),e=r.elements.find(e=>e.id==='sec:'+id),b=document.getElementById('poster-stage').getBoundingClientRect();return {x:b.x+e.x/r.width*b.width,y:b.y+e.y/r.height*b.height,width:e.width/r.width*b.width,height:e.height/r.height*b.height};}''',sid)
 assert a and b,(a,b)
 x=a['x']+min(a['width']/2,20);y=a['y']+a['height']/2
 if position in ['left','right']:
  tx=b['x']+b['width']*(.15 if position=='left' else .85);ty=b['y']+b['height']/2
 else:tx=b['x']+b['width']/2;ty=b['y']+b['height']*(.15 if position=='before' else .85)
 document_before=state(page)
 if alt:page.keyboard.down('Alt')
 if touch:
  cdp=page.context.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':tx,'y':ty}]})
 else:page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx,ty,steps=12)
 expect(page.locator('.editor-drop-indicator:not([hidden])')).to_be_visible()
 assert state(page)==document_before,'Hovering during a drag changed saved content before drop'
 if touch:cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 else:page.mouse.up()
 if alt:page.keyboard.up('Alt')
 # Save is debounced, and this also lets transient click suppression expire.
 page.wait_for_timeout(420)

def flat(node):return [node['sectionId']] if 'sectionId' in node else sum((flat(c) for c in node['children']),[])
def groups(node):return [] if 'sectionId' in node else [node]+sum((groups(c) for c in node['children']),[])

try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1440,'height':1200});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('PRICE_STUDIO_URL',f'http://127.0.0.1:{server.server_port}/planning/pricelist.html'),wait_until='networkidle')
  assert not errors,errors
  expect(page.locator('#download')).to_be_enabled()
  print('PASS editor boot',flush=True)
  original=state(page)

  # Services reorder inside one table, with each row's price moving with its ID.
  open_branch(page,'group-0');open_branch(page,'group-0:services')
  first=table(original,'group-0');source_id=columns(original,first)[0]['id']
  expected={r['weight']:r['prices'][0] for r in first['rows']}
  drag(page,tree_node(page,'column','group-0',0),tree_node(page,'column','group-0',2))
  after=state(page);s=table(after,'group-0');assert columns(after,s)[2]['id']==source_id
  assert {r['weight']:r['prices'][2] for r in s['rows']}==expected
  assert table(after,'group-1')==table(original,'group-1')
  print('PASS tree service reorder isolated to one table',flush=True)

  # Alt-copy a service into a different table; matching weight bands retain prices.
  open_branch(page,'group-1');open_branch(page,'group-1:services')
  before=state(page);s=table(before,'group-0');source_col=columns(before,s)[0];source_values={r['weight']:r['prices'][0] for r in s['rows']}
  target=table(before,'group-1');count=len(columns(before,target))
  drag(page,tree_node(page,'column','group-0',0),tree_node(page,'column','group-1',1),alt=True)
  after=state(page);target=table(after,'group-1');assert len(columns(after,target))==count+1
  assert columns(after,target)[1]['name']==source_col['name'];assert table(after,'group-0')==table(before,'group-0')
  for row in target['rows']:
   if row['weight'] in source_values:assert row['prices'][1]==source_values[row['weight']]
  print('PASS service Alt-copy between tables',flush=True)

  # Editing a header in one table does not rename the other table or template.
  page.locator('.layers [data-select="group-0"]').click();page.locator('#view-form').click()
  details=page.locator('details.setting-block').filter(has=page.locator('[data-col="0:name"]'))
  details.evaluate('(e)=>e.open=true')
  page.locator('[data-col="0:name"]').fill('첫 표 전용 서비스')
  page.wait_for_function("JSON.parse(localStorage.getItem('mongle-price-studio-v2')).sections.find(s=>s.id==='group-0').columns[0].name==='첫 표 전용 서비스'")
  after=state(page);assert columns(after,table(after,'group-1'))[0]['name']!='첫 표 전용 서비스'
  assert after['columns'][0]['name']!='첫 표 전용 서비스'
  page.locator('#view-canvas').click()
  print('PASS table-local header edit',flush=True)
  before=state(page);cols=columns(before,table(before,'group-0'));moving_id=cols[0]['id']
  direct=lambda col:page.locator(f'#canvas-overlay .canvas-hit[data-element="sec:group-0:col:{col}"]')
  drag(page,direct(cols[0]['id']),direct(cols[2]['id']))
  assert columns(state(page),table(state(page),'group-0'))[2]['id']==moving_id
  print('PASS direct canvas service-header drag',flush=True)

  # Reordering sections in the tree creates a Column arrangement around the target.
  drag(page,tree_node(page,'section','cat'),tree_node(page,'section','group-1'),position='before')
  after=state(page);order=[s['id'] for s in after['sections']];assert order.index('cat')<order.index('group-1')
  assert order==flat(after['structure'])
  print('PASS tree section move',flush=True)

  # Item label/amount pairs move together and retain the same semantic values.
  open_branch(page,'extras');open_branch(page,'extras:items')
  before=state(page);items=table(before,'extras')['items']
  drag(page,tree_node(page,'item','extras',0),tree_node(page,'item','extras',2))
  after=state(page);moved=table(after,'extras')['items'];assert moved[2]==items[0] and moved[0]==items[1]
  print('PASS tree item pair reorder',flush=True)

  # Bring the two relevant sections next to each other before the canvas gesture.
  page.locator('.layers .layer-branch').evaluate_all('(nodes)=>nodes.forEach(n=>n.open=false)')
  drag(page,tree_node(page,'section','cat'),tree_node(page,'section','extras'),position='before')

  # On the canvas, middle left/right drops create Row; upper/lower drops create Column.
  canvas=lambda id:page.locator(f'#canvas-overlay .editor-object-drag[data-drag-kind="section"][data-drag-section="{id}"]')
  body=lambda id:page.locator(f'#canvas-overlay .canvas-hit[data-element="sec:{id}:title"]')
  drag(page,body('cat'),canvas('extras'),position='right')
  after=state(page);assert any(g['direction']=='row' and 'cat' in flat(g) and 'extras' in flat(g) for g in groups(after['structure']))
  print('PASS canvas Row layout',flush=True)
  drag(page,canvas('cat'),canvas('extras'),position='before')
  after=state(page);assert any(g['direction']=='column' and flat(g).index('cat')<flat(g).index('extras') for g in groups(after['structure']) if 'cat' in flat(g) and 'extras' in flat(g))
  print('PASS canvas Column layout',flush=True)
  before=state(page);count=len(before['sections']);original_cat=table(before,'cat')
  drag(page,canvas('cat'),canvas('extras'),position='after',alt=True)
  after=state(page);assert len(after['sections'])==count+1
  copies=[s for s in after['sections'] if s['id'] not in {s['id'] for s in before['sections']}]
  assert len(copies)==1 and copies[0]['items']==original_cat['items']
  expect(page.locator('#render-error')).to_be_empty()
  assert not errors,errors
  page.screenshot(path='/tmp/price-universal-drag-desktop.png')
  page.reload(wait_until='networkidle');expect(page.locator('#render-error')).to_be_empty()
  assert state(page)['structure']==after['structure']
  print('PASS canvas Alt-copy and layout persistence',flush=True)
  # A whole nested frame moves as one unit, with its children and prices intact.
  before=state(page)
  choices=[g for g in groups(before['structure']) if g['id']!=before['structure']['id'] and len(flat(g))>1 and len(flat(g))<len(before['sections'])]
  assert choices,'The preceding Row/Column operations should create a movable nested frame'
  frame=choices[-1];leaf_ids=flat(frame);outside=next(s['id'] for s in before['sections'] if s['id'] not in leaf_ids)
  contents={s['id']:s for s in before['sections']}
  page.locator('.layers .layer-branch').evaluate_all('(nodes)=>nodes.forEach(n=>n.open=false)')
  source=page.locator(f'.layers summary[data-drag-kind="group"][data-drag-group="{frame["id"]}"]')
  drag(page,source,tree_node(page,'section',outside),position='after')
  after=state(page);order=flat(after['structure'])
  assert len(order)==len(set(order))==len(before['sections'])
  assert {s['id']:s for s in after['sections']}==contents
  assert any(flat(g)==leaf_ids for g in groups(after['structure']))
  start=order.index(leaf_ids[0]);assert order[start:start+len(leaf_ids)]==leaf_ids
  assert order.index(outside)<start
  expect(page.locator('#render-error')).to_be_empty();assert not errors,errors
  print('PASS whole-group tree drag preserves all child sections and prices',flush=True)
  mobile=browser.new_page(viewport={'width':390,'height':1000},is_mobile=True,has_touch=True)
  mobile_errors=[];mobile.on('pageerror',lambda e:mobile_errors.append(str(e)))
  mobile.goto(os.environ.get('PRICE_STUDIO_URL',f'http://127.0.0.1:{server.server_port}/planning/pricelist.html'),wait_until='networkidle')
  expect(mobile.locator('#download-mobile')).to_be_enabled()
  mobile.locator('#drag-copy-mode').click();expect(mobile.locator('#drag-copy-mode')).to_have_attribute('aria-pressed','true')
  before=state(mobile);count=len(before['sections'])
  source=mobile.locator('#canvas-overlay .canvas-hit[data-element="sec:cat:title"]')
  target=mobile.locator('#canvas-overlay .editor-object-drag[data-drag-kind="section"][data-drag-section="extras"]')
  drag(mobile,source,target,position='right',touch=True)
  after=state(mobile);assert len(after['sections'])==count+1
  assert len([s for s in after['sections'] if s.get('items')==table(before,'cat')['items']])==2
  expect(mobile.locator('#render-error')).to_be_empty();assert not mobile_errors,mobile_errors
  print('PASS mobile touch-copy mode without keyboard modifier',flush=True)
  browser.close()
 print('PASS universal desktop tree/canvas drag, service isolation, Row/Column and copy')
finally:server.shutdown();server.server_close()
