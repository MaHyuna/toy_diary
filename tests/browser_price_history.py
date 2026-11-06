"""Price history, concurrent tabs and restore on isolated static demo storage."""
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
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1440,'height':1000});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'/owner/?view=pricing',wait_until='networkidle');original=page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments")
  page.get_by_role('button',name='요금표 수정',exact=True).click();field=page.get_by_role('textbox',name='소형견 미용 4kg 미만 목욕 금액',exact=True);field.fill('17000');page.get_by_label('변경 사유 (선택)',exact=True).fill('첫 요금 저장');page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_role('status')).to_contain_text('저장했어요')
  other=context.new_page();other.goto(base+'/owner/?view=pricing',wait_until='networkidle');other.get_by_role('button',name='요금표 수정',exact=True).click()
  page.get_by_role('button',name='요금표 수정',exact=True).click();field.fill('18000');page.get_by_label('변경 사유 (선택)',exact=True).fill('목욕 요금 조정');page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_role('status')).to_contain_text('저장했어요')
  otherfield=other.get_by_role('textbox',name='소형견 미용 4kg 미만 목욕 금액',exact=True);otherfield.fill('19000');other.get_by_role('button',name='요금표 저장',exact=True).click();expect(other.get_by_role('alert')).to_contain_text('다른 화면');expect(otherfield).to_have_value('19000');other.close()
  page.get_by_role('button',name='변경 이력',exact=True).click();grid=page.get_by_role('grid',name='요금표 버전 목록');expect(grid).to_contain_text('목욕 요금 조정');expect(grid).to_contain_text('v2 · 현재 적용')
  grid.get_by_role('row').filter(has_text='v2 ·').click();changes=page.get_by_role('grid',name='요금표 변경 내용');expect(changes).to_contain_text('17000');expect(changes).to_contain_text('18000');expect(page.get_by_role('textbox')).to_have_count(0)
  page.get_by_role('button',name='이력 목록',exact=True).click();grid.get_by_role('row').filter(has_text='첫 요금 저장').click()
  for width in [320,390,1440]:
   page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/price-history-{width}.png')
  page.get_by_role('button',name='이 버전으로 복원',exact=True).click();dialog=page.get_by_role('dialog');expect(dialog).to_contain_text('현재 v2');dialog.get_by_role('button',name='취소',exact=True).click();expect(page.get_by_role('dialog')).to_have_count(0)
  page.get_by_role('button',name='이 버전으로 복원',exact=True).click();dialog=page.get_by_role('dialog');dialog.get_by_label('복원 사유 (선택)',exact=True).fill('가격 조정 철회');dialog.get_by_role('button',name='복원 확정',exact=True).click();expect(page.get_by_role('status')).to_contain_text('v3로 복원')
  page.reload(wait_until='networkidle');page.get_by_role('button',name='변경 이력',exact=True).click();expect(grid).to_contain_text('v3 · 현재 적용');expect(grid).to_contain_text('v1에서 복원');expect(grid).to_contain_text('목욕 요금 조정')
  page.goto(base+'/customer/prices/',wait_until='networkidle');expect(page.locator('.mobile-price-table').first).to_contain_text('17,000');assert page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments")==original
  assert not errors,errors
  b.close();print('PASS immutable history, change reasons/diffs, stale-tab rejection, restore confirmation, new restore version, reload/customer sync and reservation preservation')
finally:server.shutdown();thread.join();server.server_close()
