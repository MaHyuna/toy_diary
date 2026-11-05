"""Agenda closing must never cancel a reservation."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(Path(__file__).resolve().parents[1]/'demo-dist')));thread=Thread(target=server.serve_forever,daemon=True);thread.start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.goto(f'http://127.0.0.1:{server.server_port}/owner/',wait_until='networkidle')
  panel=page.locator('.calendar-day-panel');expect(panel).to_be_visible();before=page.locator('.month-calendar').bounding_box()['width'];snapshot=page.evaluate("localStorage.getItem('mongle-demo-v1')")
  page.get_by_role('button',name='일정 닫기',exact=True).click();expect(panel).to_have_count(0);assert page.locator('.month-calendar').bounding_box()['width']>before+200;assert page.evaluate("localStorage.getItem('mongle-demo-v1')")==snapshot
  visit_date=page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments.find(a=>a.date.startsWith(document.querySelector('#month').value)&&a.paymentStatus==='unpaid'&&a.status!=='cancelled').date")
  day=page.locator('[data-date="'+visit_date+'"]')
  day.click();expect(panel).to_be_visible();cancel=panel.get_by_role('button',name='예약 취소',exact=False).first
  expect(cancel).to_be_visible();expect(cancel).to_have_text('예약 취소');cancel.click();expect(page.get_by_role('dialog')).to_be_visible();expect(page.get_by_role('dialog')).to_contain_text('취소');page.get_by_role('dialog').get_by_role('button',name='닫기',exact=True).click();assert page.evaluate("localStorage.getItem('mongle-demo-v1')")==snapshot
  page.screenshot(path='/tmp/agenda-controls-desktop.png');page.set_viewport_size({'width':390,'height':844});page.locator('[data-date="'+visit_date+'"]').click();expect(page.get_by_role('button',name='일정 닫기',exact=True)).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.get_by_role('button',name='일정 닫기',exact=True).click();expect(panel).to_have_count(0);b.close()
finally:server.shutdown();thread.join();server.server_close()
print('PASS close/reopen agenda, full-width calendar, explicit reservation cancellation and unchanged records')
