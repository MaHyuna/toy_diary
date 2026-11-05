"""PC month/day workspace, keyboard flow, and compact mobile regression."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
import threading
class H(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(H,directory=str(Path(__file__).resolve().parents[1]/'demo-dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
def assert_previews_fit(page):
 issues=page.locator('.month-day').evaluate_all('''cells=>cells.flatMap(cell=>{const box=cell.getBoundingClientRect(),events=[...cell.querySelectorAll('.calendar-cell-event')],count=Number(cell.querySelector('.month-booking-count')?.textContent.replace(/\\D/g,'')||0),more=Number(cell.querySelector('.calendar-cell-more')?.textContent.replace(/\\D/g,'')||0);return [...events.filter(event=>{const b=event.getBoundingClientRect();return b.top<box.top||b.bottom>box.bottom+1||b.right>box.right+1;}).map(()=>cell.dataset.date+' clipped'),...(events.length&&events.length+more!==count?[cell.dataset.date+' incorrect remaining count']:[])];})''')
 assert not issues,issues
def assert_agenda_space(page):
 panel=page.locator('.calendar-day-panel').bounding_box();header=page.locator('.calendar-day-panel-header').bounding_box();body=page.locator('.calendar-day-panel-body').bounding_box()
 assert header['height']<=80,(panel,header)
 assert body['height']>=panel['height']*.8,(panel,body)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_address[1]}/?screen=owner',wait_until='networkidle')
 panel=page.locator('.calendar-day-panel');expect(panel).to_be_visible();expect(page.locator('.calendar-cell-event').first).to_be_visible()
 month=page.locator('.month-calendar').bounding_box();agenda=panel.bounding_box();assert month['x']+month['width']<=agenda['x']+1;assert month['width']>600 and agenda['width']>=290
 assert_agenda_space(page)
 first=page.locator('.month-day').filter(has=page.locator('.calendar-cell-event')).first;first.click();selected=first.get_attribute('data-date');expect(first).to_have_attribute('aria-pressed','true');assert page.locator('.grooming-day-sheet').count()==0;expect(panel.locator('.visit-open').first).to_be_visible()
 # Entering a visit uses the wide body, then returns to the same day panel.
 panel.locator('.visit-open-price b').first.click();expect(page.locator('.detail-summary')).to_be_visible();page.locator('.modal-close').click();expect(panel).to_be_visible();expect(page.locator(f'[data-date="{selected}"]')).to_have_attribute('aria-pressed','true')
 # Arrow-key selection and cross-month focus stay inside the calendar workflow.
 current=page.locator(f'[data-date="{selected}"]');current.focus();current.press('ArrowRight');new=page.locator('.month-day[aria-pressed="true"]');assert new.get_attribute('data-date')!=selected;expect(new).to_be_focused();assert page.locator('.grooming-day-sheet').count()==0
 new.press('Enter');assert page.locator('.grooming-day-sheet').count()==0;expect(panel.locator('h2')).to_be_focused()
 # The day panel add action opens an explicit form with the selected date.
 chosen=page.locator('.month-day[aria-pressed="true"]').get_attribute('data-date');panel.get_by_role('button',name='예약 추가',exact=False).first.click();expect(page.get_by_role('heading',name='새 예약',exact=True)).to_be_visible();expect(page.get_by_label('예약 날짜',exact=False)).to_have_value(chosen);page.locator('.modal-close').click()
 first.click();page.wait_for_timeout(200);assert_previews_fit(page);page.screenshot(path='/tmp/owner-after-desktop.png')
 # Keyboard movement must also retain focus across month loading, not only within a month.
 last=page.locator('.month-day').last;last_date=last.get_attribute('data-date');last.focus();last.press('ArrowRight');expect(page.locator('.month-day[aria-pressed="true"]')).to_be_focused();assert page.locator('.month-day[aria-pressed="true"]').get_attribute('data-date')[:7]!=last_date[:7]
 page.locator('.month-day[aria-pressed="true"]').press('ArrowLeft');expect(page.locator(f'[data-date="{last_date}"]')).to_be_focused();first.click()
 page.set_viewport_size({'width':1920,'height':1080});page.wait_for_timeout(200);assert_previews_fit(page);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path='/tmp/owner-after-wide.png')
 for width,height in [(1100,800),(1366,768),(1440,800)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200);expect(panel).to_be_visible();assert_agenda_space(page);assert_previews_fit(page);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # The floating + stays fixed while the final booking clears it after scrolling.
  body=panel.locator('.calendar-day-panel-body');body.evaluate('el=>el.scrollTop=el.scrollHeight');last_visit=body.locator('.grooming-visit').last.bounding_box();add=panel.get_by_role('button',name='예약 추가',exact=True).bounding_box();assert last_visit['y']+last_visit['height']<=add['y']-6,(last_visit,add)
 # Mobile retains the first-screen calendar and detail sheet, without PC previews.
 for width,height in [(390,844),(320,667),(768,900)]:
  page.set_viewport_size({'width':width,'height':height});expect(panel).not_to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.locator('.month-day').first.click();expect(page.locator('.grooming-day-sheet')).to_be_visible();page.locator('.modal-close').click()
 page.set_viewport_size({'width':390,'height':667});page.locator('#month').fill('2026-08');expect(page.locator('[data-date="2026-08-31"]')).to_be_visible();assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1');assert page.locator('[data-date="2026-08-31"]').bounding_box()['y']+page.locator('[data-date="2026-08-31"]').bounding_box()['height']<=page.locator('.mobile-navigation').bounding_box()['y']+1
 caption=page.locator('.grooming-calendar-caption > span').last.bounding_box();fab=page.locator('.quick-add').bounding_box();assert caption['x']+caption['width']<=fab['x'] or caption['y']+caption['height']<=fab['y'] or caption['y']>=fab['y']+fab['height']
 page.screenshot(path='/tmp/owner-after-mobile.png')
 page.emulate_media(reduced_motion='reduce');page.set_viewport_size({'width':1440,'height':1000});expect(panel).to_be_visible()
 # A populated six-week month must adapt its previews to a short desktop window.
 page.evaluate('''()=>{const k='mongle-demo-v1',w=JSON.parse(localStorage.getItem(k)),date=w.data.appointments[0].date;w.data.appointments=w.data.appointments.filter(a=>a.date===date).map(a=>({...a,date:'2026-08-15',paidDate:a.paidDate?'2026-08-15':null}));localStorage.setItem(k,JSON.stringify(w));}''');page.reload(wait_until='networkidle');page.locator('#month').fill('2026-08');expect(page.locator('[data-date="2026-08-15"] .month-booking-count')).to_be_visible()
 for width,height in [(1440,1000),(1440,800),(1100,800)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200);assert_previews_fit(page);assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1')
 # A payment received after the visit must be explained even on a day with zero bookings.
 payment=page.evaluate('''()=>{const k='mongle-demo-v1',w=JSON.parse(localStorage.getItem(k)),v=w.data.appointments[0],month=v.date.slice(0,7),target=month+'-02';w.data.appointments=w.data.appointments.filter(a=>a.date!==target&&a.paidDate!==target&&a.id!==v.id);w.data.appointments.push({...v,date:month+'-01',paidDate:target,paymentStatus:'paid',status:'completed',paymentMethod:'card'});localStorage.setItem(k,JSON.stringify(w));return {date:target,price:v.price};}''')
 payment_date=payment['date'];page.reload(wait_until='networkidle');expect(page.locator('.month-day').first).to_be_visible();page.locator('#month').fill(payment_date[:7]);page.locator(f'[data-date="{payment_date}"]').click();expect(panel.locator('.visit-open')).to_have_count(0);expect(panel.locator('.day-payment-row')).to_have_count(1);expect(panel.locator('.day-payment-row')).to_contain_text(f"{payment['price']:,}원");expect(panel.locator('.calendar-no-visits')).to_contain_text('이날 방문 예약은 없어요')
 assert not errors,errors
 print('PASS PC two-panel calendar, inline daily agenda, detail return, keyboard navigation, selected-date registration, 1100–1920 layouts, mobile sheet/6-week/no-scroll and reduced motion')
 browser.close()
server.shutdown()
