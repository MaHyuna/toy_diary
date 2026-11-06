"""Verify the separate artifact's routes and that it never touches application data."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import subprocess,json,os
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
  page.locator('.scenario-catalog').evaluate('(el)=>el.open=true')
  assert page.locator('.flow-board-canvas img').count()==0
  expect(page.get_by_role('region',name='전체 화면 흐름보드')).to_contain_text('진입 경로')
  expect(page.get_by_role('region',name='전체 화면 흐름보드')).to_contain_text('처리·검증 규칙')
  assert page.locator('.text-node.tone-customer').count()>0 and page.locator('.text-node.tone-owner').count()>0 and page.locator('.text-node.tone-system').count()>0
  assert page.locator('.text-node').evaluate_all('(nodes)=>nodes.every(el=>el.scrollHeight<=el.clientHeight+2)')
  assert page.locator('.text-node').evaluate_all('(nodes)=>nodes.every((a,i)=>nodes.every((b,j)=>i===j||a.offsetLeft+a.offsetWidth<=b.offsetLeft||b.offsetLeft+b.offsetWidth<=a.offsetLeft||a.offsetTop+a.offsetHeight<=b.offsetTop||b.offsetTop+b.offsetHeight<=a.offsetTop))')
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':1000})
   for label,flow_id in [('예약·미용','visit'),('요금표·이력','pricing'),('고객 수첩','customer'),('공지 관리','notice')]:
    page.locator('.scenario-catalog').evaluate('(el)=>el.open=true')
    button=page.get_by_role('navigation',name='사용자 흐름 선택').get_by_role('button',name=label,exact=True)
    assert button.bounding_box()['height']<=56;button.click();expect(page.locator('.proto-flow-options button[aria-pressed="true"]')).to_contain_text(label);assert 'flow='+flow_id in page.url
    assert page.get_by_role('listbox').count()==0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if width==390:page.screenshot(path='/tmp/prototype-flow-selector-mobile.png')
  for flow in (flows if not os.environ.get('MONGLE_PROTO_FOCUSED') else []):
   ids={s['id'] for s in flow['steps']}
   for screen in flow['steps']:
    assert all(a['to'] in ids for a in screen['actions'])
    page.goto(base+f"/prototype/#flow={flow['id']}&screen={screen['id']}&mode=play")
    expect(page.locator('.proto-screen-title h2')).to_have_text(screen['name'])
    for width in [390,1440]:
     page.set_viewport_size({'width':width,'height':1000});page.wait_for_timeout(50);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(screen['id'],width)
    first=screen['actions'][0];page.locator('.proto-screen-actions').get_by_role('button',name=first['label'],exact=True).click();expect(page.locator('.proto-screen-title h2')).to_have_text(next(s['name'] for s in flow['steps'] if s['id']==first['to']))
  # Modal preview preserves the board and supports keyboard history without editing shortcuts.
  page.goto(base+'/prototype/#flow=pricing&screen=price-list&mode=map')
  page.get_by_role('button',name='100%',exact=True).click()
  link=page.get_by_role('link',name='요금 분류 목록 화면 열기',exact=True);link.scroll_into_view_if_needed()
  board=page.locator('.flow-board-viewport');before=board.evaluate('(el)=>({x:el.scrollLeft,y:el.scrollTop})');zoom=page.get_by_label('흐름도 배율').inner_text()
  link.click();dialog=page.get_by_role('dialog');expect(dialog).to_be_visible();expect(dialog.get_by_role('button',name='← 이전 화면',exact=True)).to_be_disabled()
  expect(page.locator('.flow-board-viewport')).to_have_count(1)
  dialog.get_by_role('button',name='다음 화면 →',exact=True).focus();page.keyboard.press('ArrowRight');expect(dialog.locator('.proto-screen-title h2')).to_have_text('요금 분류 상세')
  page.keyboard.press('ArrowRight');expect(dialog.locator('.proto-screen-title h2')).to_have_text('요금표 수정')
  field=dialog.get_by_label('소형견 · 4kg 미만 · 목욕 (원)',exact=True);field.focus();page.keyboard.press('ArrowRight');page.keyboard.press('ArrowLeft');expect(dialog.locator('.proto-screen-title h2')).to_have_text('요금표 수정')
  dialog.get_by_role('button',name='다음 화면 →',exact=True).focus();page.keyboard.press('ArrowLeft');expect(dialog.locator('.proto-screen-title h2')).to_have_text('요금 분류 상세')
  dialog.get_by_role('button',name='← 이전 화면',exact=True).click();expect(dialog.locator('.proto-screen-title h2')).to_have_text('요금 분류 목록')
  page.keyboard.press('Escape');expect(dialog).to_have_count(0);assert board.evaluate('(el)=>({x:el.scrollLeft,y:el.scrollTop})')==before;assert page.get_by_label('흐름도 배율').inner_text()==zoom
  expect(link).to_be_focused()
  for width in [390,1440]:
   page.set_viewport_size({'width':width,'height':900});link.click();expect(dialog).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/prototype-modal-{width}.png');dialog.get_by_role('button',name='닫기 · 흐름도로',exact=True).click();expect(dialog).to_have_count(0)
  # Shared modal URLs open directly and can always close to a board.
  page.goto(base+'/prototype/#flow=booking&screen=booking-date&mode=modal');expect(dialog).to_be_visible();page.reload();expect(dialog).to_be_visible();page.keyboard.press('Escape');expect(dialog).to_have_count(0)
  page.goto(base+'/prototype/#flow=booking&screen=booking-date&mode=play')
  def act(name):page.locator('.proto-screen-actions').get_by_role('button',name=name,exact=True).click()
  page.get_by_label('예약 날짜',exact=True).fill('2026-11-15');act('항목 선택')
  expect(page.get_by_label('예약 요청사항',exact=True)).to_have_count(0)
  page.get_by_text('요청사항이 있어요',exact=True).click();page.get_by_label('예약 요청사항',exact=True).fill('발을 조심해 주세요')
  page.get_by_text('스파 · 15,000원 · 20분',exact=True).click();act('예상 요금·정책 확인')
  expect(page.locator('.proto-screen')).to_contain_text('60,000원');expect(page.locator('.proto-screen')).to_contain_text('2026-11-15')
  act('예약금 결제');act('결제 실패');act('결제 재시도');act('결제 성공');act('사장님 검토 화면 보기')
  expect(page.locator('.proto-app-header')).to_contain_text('사장님');act('일정 변경 요청')
  page.get_by_label('변경 요청 사유',exact=True).fill('');act('변경 요청 보내기');expect(page.get_by_role('status')).to_contain_text('필수 사유')
  page.get_by_label('변경 요청 사유',exact=True).fill('시간 조정 필요');act('변경 요청 보내기');act('다른 날짜 선택')
  page.get_by_role('button',name='11월 18일 선택',exact=True).click();expect(page.get_by_label('변경 날짜',exact=True)).to_have_value('2026-11-18');act('변경 신청 제출');act('사장님 재검토')
  expect(page.locator('.proto-screen')).to_contain_text('2026-11-18');act('예약 확정');act('확정 후 변경·취소 안내');act('취소·환불 확인');act('예약 유지')
  expect(page.locator('.proto-screen-title h2')).to_have_text('확정 후 변경·취소 요청')
  page.goto(base+'/prototype/#flow=pricing&screen=price-edit&mode=play');page.get_by_label('소형견 · 4kg 미만 · 목욕 (원)',exact=True).fill('17000');page.get_by_role('button',name='요금표 저장',exact=True).click();page.get_by_role('button',name='소형견 미용 보기',exact=True).click();expect(page.locator('.proto-price-sheet')).to_contain_text('17000')
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path='/tmp/prototype-play-mobile.png',full_page=True)
  page.reload(wait_until='networkidle');expect(page.locator('.proto-screen-title h2')).to_have_text('요금 분류 상세');expect(page.locator('.proto-price-sheet')).to_contain_text('18000')
  page.get_by_role('button',name='전체 흐름보드',exact=True).click();assert page.locator('.flow-screen-node').count()==11
  page.set_viewport_size({'width':320,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert page.evaluate("localStorage.getItem('mongle-demo-v1')")=='prototype-must-not-touch';assert not calls,calls;assert not errors,errors
  assert page.get_by_role('link',name='실제 서비스 열기 ↗',exact=True).get_attribute('href')=='../owner/?view=pricing'
  b.close();print('PASS all prototype screens/transitions, role flows, editable price example, hash reload, 320/390/1440px, no API or storage mutation')
finally:server.shutdown();thread.join();server.server_close()
