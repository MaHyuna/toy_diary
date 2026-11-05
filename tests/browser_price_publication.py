"""Saved owner rates are the only source for public tables, quotes and design export."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(Path(__file__).resolve().parents[1]/'demo-dist')));t=Thread(target=s.serve_forever,daemon=True);t.start();base=f'http://127.0.0.1:{s.server_port}'
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.goto(base+'/owner/',wait_until='networkidle');page.get_by_role('button',name='요금 관리',exact=True).click();expect(page.locator('.pricing-edit-table')).to_have_count(3)
  for width in [320,390,1440]:
   page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('.pricing-edit-table').evaluate_all('tables=>tables.every(t=>t.scrollWidth<=t.clientWidth)');page.screenshot(path=f'/tmp/owner-pricing-table-{width}.png',full_page=True)
  field=page.get_by_label('1번째 서비스 기본 금액',exact=True);field.fill('71234');page.get_by_role('button',name='요금표 저장',exact=False).click();expect(page.get_by_text('저장된 요금표를 사용하고 있어요',exact=True)).to_be_visible()
  page.goto(base+'/customer/prices/',wait_until='networkidle');expect(page.locator('.mobile-price-table')).to_contain_text('71,234');expect(page.locator('.mobile-price-menu')).not_to_contain_text('가위컷');page.get_by_role('button',name='비숑 프리제 미용',exact=True).click();expect(page.locator('.mobile-price-table')).to_contain_text('81,234');expect(page.locator('.mobile-price-table')).to_contain_text('86,234')
  original=page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments")
  page.goto(base+'/owner/',wait_until='networkidle');page.get_by_role('button',name='요금표 디자인',exact=True).click();frame=page.frame_locator('iframe');expect(frame.locator('#message')).to_contain_text('요금 관리에 저장된 기준');expect(frame.locator('#download')).to_be_enabled();page.get_by_role('button',name='현재 요금표 게시',exact=True).click();expect(page.get_by_role('status').filter(has_text='일치하는 안내 이미지')).to_be_visible()
  page.goto(base+'/customer/prices/',wait_until='networkidle');expect(page.get_by_role('button',name='원본 디자인 보기',exact=True)).to_be_visible();page.get_by_role('button',name='원본 디자인 보기',exact=True).click();expect(page.locator('.price-original img')).to_be_visible()
  for width in [320,390,1440]:
   page.set_viewport_size({'width':width,'height':900});page.get_by_role('button',name='읽기 편하게 보기',exact=True).click() if page.get_by_role('button',name='읽기 편하게 보기',exact=True).count() else None
   expect(page.locator('.mobile-price-table')).to_contain_text('71,234');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.goto(base+'/owner/',wait_until='networkidle');page.get_by_role('button',name='요금 관리',exact=True).click();page.get_by_label('1번째 서비스 기본 금액',exact=True).fill('72345');page.get_by_role('button',name='요금표 저장',exact=False).click();expect(page.get_by_text('저장된 요금표를 사용하고 있어요',exact=True)).to_be_visible()
  page.goto(base+'/customer/prices/',wait_until='networkidle');expect(page.locator('.mobile-price-table')).to_contain_text('72,345');expect(page.get_by_role('button',name='원본 디자인 보기',exact=True)).to_have_count(0)
  assert page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments")==original
  b.close()
finally:s.shutdown();t.join();s.server_close()
print('PASS owner rate edit, matching public base/breed/weight prices, synchronized poster, stale image suppression, unchanged bookings and responsive tables')
