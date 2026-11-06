"""List-first pricing navigation and persisted CRUD, using isolated demo data."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(Path(__file__).resolve().parents[1]/'demo-dist')))
thread=Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'/owner/?view=pricing',wait_until='networkidle')
  original=page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments")
  expect(page.get_by_role('grid',name='요금 분류 목록')).to_be_visible();expect(page.get_by_role('dialog')).to_have_count(0)
  expect(page.get_by_role('button',name='요금표 저장',exact=True)).to_have_count(0)
  for width in [320,390,1440]:
   page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/price-list-{width}.png')
  page.get_by_role('row').filter(has_text='소형견 미용').click();expect(page.get_by_role('region',name='소형견 미용',exact=True)).to_be_visible();expect(page.get_by_role('textbox')).to_have_count(0)
  page.get_by_role('button',name='분류 수정',exact=True).click();d=page.get_by_role('dialog');d.get_by_label('섹션 제목',exact=True).fill('소형견 수정');d.get_by_role('button',name='적용',exact=True).click()
  page.get_by_role('button',name='목록으로',exact=True).click();expect(page.get_by_role('dialog')).to_contain_text('변경사항을 버릴까요');page.get_by_role('button',name='취소',exact=True).click();expect(page.get_by_role('heading',name='소형견 수정',exact=True)).to_be_visible()
  page.get_by_role('button',name='목록으로',exact=True).click();page.get_by_role('button',name='변경 버리고 목록으로',exact=True).click();expect(page.get_by_role('grid')).to_contain_text('소형견 미용');expect(page.get_by_role('grid')).not_to_contain_text('소형견 수정')
  page.get_by_role('button',name='+ 섹션 등록',exact=True).click();d=page.get_by_role('dialog');d.get_by_label('섹션 제목',exact=True).fill('시니어 케어');d.get_by_role('button',name='적용',exact=True).click();page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_role('grid')).to_contain_text('시니어 케어')
  page.reload(wait_until='networkidle');page.get_by_label('요금 분류 검색',exact=True).fill('시니어');expect(page.get_by_role('row')).to_have_count(2);page.get_by_role('row').filter(has_text='시니어 케어').click()
  page.get_by_role('button',name='분류 수정',exact=True).click();d=page.get_by_role('dialog');d.get_by_label('섹션 제목',exact=True).fill('노령견 케어');d.get_by_role('button',name='적용',exact=True).click();page.get_by_role('button',name='요금표 저장',exact=True).click()
  page.get_by_label('요금 분류 검색',exact=True).fill('노령견');page.get_by_role('row').filter(has_text='노령견 케어').click();page.get_by_role('button',name='분류 삭제',exact=True).click();page.get_by_role('button',name='취소',exact=True).click();expect(page.get_by_role('heading',name='노령견 케어',exact=True)).to_be_visible()
  page.get_by_role('button',name='분류 삭제',exact=True).click();page.get_by_role('button',name='삭제 확인',exact=True).click();page.reload(wait_until='networkidle');expect(page.get_by_role('grid')).not_to_contain_text('노령견 케어')
  page.get_by_role('button',name='예약 요금 연결 관리',exact=True).click();expect(page.get_by_role('button',name='예약 항목 등록',exact=True)).to_be_visible();expect(page.get_by_role('textbox')).to_have_count(0);page.get_by_role('button',name='예약 항목 등록',exact=True).click();expect(page.get_by_role('textbox',name='소요 시간 (분)',exact=True)).to_be_visible();page.get_by_role('button',name='작성 취소',exact=True).click();expect(page.get_by_role('textbox')).to_have_count(0)
  assert page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments")==original
  page.goto(base+'/customer/prices/',wait_until='networkidle');expect(page.get_by_role('heading',name='소형견 미용',exact=True)).to_be_visible();expect(page.get_by_role('heading',name='노령견 케어',exact=True)).to_have_count(0)
  assert not errors,errors
  b.close();print('PASS list first, read-only detail, create/edit/delete/cancel, search, reload, responsive layout and preserved appointments')
finally:server.shutdown();thread.join();server.server_close()
