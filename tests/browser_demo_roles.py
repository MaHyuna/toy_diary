"""Separate Pages owner/customer demo entries, sessions, and explicit logout."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(Path(__file__).resolve().parents[1]/'demo-dist')))
thread=Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844})
  page.goto(base+'/owner/',wait_until='networkidle');expect(page.locator('.app-shell')).to_be_visible();expect(page.get_by_role('heading',name='우리 아이 관리 기록')).to_have_count(0)
  page.reload(wait_until='networkidle');expect(page.locator('.app-shell')).to_be_visible()
  page.goto(base+'/customer/',wait_until='networkidle');expect(page.get_by_role('heading',name='우리 아이 관리 기록')).to_be_visible();expect(page.locator('.app-shell')).to_have_count(0)
  page.goto(base+'/owner/',wait_until='networkidle');page.get_by_role('button',name='사장님 로그아웃',exact=True).click();expect(page.get_by_role('button',name='예시 데이터로 사장님 체험')).to_be_visible()
  page.goto(base+'/customer/',wait_until='networkidle');expect(page.get_by_role('heading',name='우리 아이 관리 기록')).to_be_visible();page.get_by_role('button',name='로그아웃',exact=True).click();expect(page.get_by_role('button',name='체험 보호자로 시작')).to_be_visible()
  page.goto(base+'/owner/',wait_until='networkidle');expect(page.get_by_role('button',name='예시 데이터로 사장님 체험')).to_be_visible();page.get_by_role('button',name='예시 데이터로 사장님 체험').click();expect(page.locator('.app-shell')).to_be_visible()
  page.goto(base+'/customer/',wait_until='networkidle');expect(page.get_by_role('button',name='체험 보호자로 시작')).to_be_visible();b.close()
finally:server.shutdown();thread.join();server.server_close()
print('PASS separate owner/customer entry, role views, automatic entry, refresh and independent logout')
