"""Verify the separate artifact's routes and that it never touches application data."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import subprocess,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
flows=json.loads(subprocess.check_output(['node','--experimental-strip-types','--input-type=module','-e',"import {flows} from './src/prototype/flows.ts';process.stdout.write(JSON.stringify(flows))"],cwd=root,text=True))
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'demo-dist')));thread=Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1100});errors=[];calls=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:calls.append(r.url) if '/api/' in r.url else None)
  page.goto(base+'/prototype/',wait_until='networkidle');page.evaluate("localStorage.setItem('mongle-demo-v1','prototype-must-not-touch')")
  expect(page.get_by_role('region',name='전체 화면 흐름보드')).to_be_visible();expect(page.locator('.flow-connectors')).to_be_visible();assert page.locator('.flow-connectors path[marker-end]').count()>10
  page.get_by_role('button',name='흐름도 확대',exact=True).click();page.get_by_role('button',name='너비에 맞추기',exact=True).click();page.screenshot(path='/tmp/prototype-board-desktop.png',full_page=True)
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':1000})
   for label,flow_id in [('예약·미용','visit'),('요금표·이력','pricing'),('고객 수첩','customer'),('공지 관리','notice')]:
    button=page.get_by_role('navigation',name='사용자 흐름 선택').get_by_role('button',name=label,exact=True)
    button.click();expect(button).to_have_attribute('aria-pressed','true');assert 'flow='+flow_id in page.url
    assert button.bounding_box()['height']<=56;assert page.get_by_role('listbox').count()==0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if width==390:page.screenshot(path='/tmp/prototype-flow-selector-mobile.png')
  for flow in flows:
   ids={s['id'] for s in flow['steps']}
   for screen in flow['steps']:
    assert all(a['to'] in ids for a in screen['actions'])
    page.goto(base+f"/prototype/#flow={flow['id']}&screen={screen['id']}&mode=play")
    expect(page.locator('.proto-screen-title h2')).to_have_text(screen['name'])
    for width in [390,1440]:
     page.set_viewport_size({'width':width,'height':1000});page.wait_for_timeout(50);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(screen['id'],width)
    first=screen['actions'][0];page.locator('.proto-screen-actions').get_by_role('button',name=first['label'],exact=True).click();expect(page.locator('.proto-screen-title h2')).to_have_text(next(s['name'] for s in flow['steps'] if s['id']==first['to']))
  page.goto(base+'/prototype/#flow=pricing&screen=price-edit&mode=play');page.get_by_label('소형견 · 4kg 미만 · 목욕 (원)',exact=True).fill('17000');page.get_by_role('button',name='요금표 저장',exact=True).click();page.get_by_role('button',name='소형견 미용 보기',exact=True).click();expect(page.locator('.proto-price-sheet')).to_contain_text('17000')
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path='/tmp/prototype-play-mobile.png',full_page=True)
  page.reload(wait_until='networkidle');expect(page.locator('.proto-screen-title h2')).to_have_text('요금 분류 상세');expect(page.locator('.proto-price-sheet')).to_contain_text('18000')
  page.get_by_role('button',name='전체 흐름보드',exact=True).click();assert page.locator('.flow-screen-node').count()==11
  page.set_viewport_size({'width':320,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert page.evaluate("localStorage.getItem('mongle-demo-v1')")=='prototype-must-not-touch';assert not calls,calls;assert not errors,errors
  assert page.get_by_role('link',name='실제 서비스 열기 ↗',exact=True).get_attribute('href')=='../owner/?view=pricing'
  b.close();print('PASS all prototype screens/transitions, role flows, editable price example, hash reload, 320/390/1440px, no API or storage mutation')
finally:server.shutdown();thread.join();server.server_close()
