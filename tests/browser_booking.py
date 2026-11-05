"""Separated customer booking and owner-calendar demo workflow."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
import threading,json
from datetime import date,timedelta
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(Path(__file__).resolve().parents[1]/'demo-dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True);ctx.add_init_script("sessionStorage.setItem('mongle-demo-owner-session','active')");page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));base=f'http://127.0.0.1:{server.server_address[1]}/'
 page.goto(base+'?screen=booking',wait_until='networkidle');expect(page.get_by_role('heading',name='어떤 미용이 필요하세요?')).to_be_visible();assert page.locator('.sidebar,.mobile-navigation,.studio-name-field').count()==0
 page.screenshot(path='/tmp/customer-booking-service.png')
 page.get_by_role('button',name='다음',exact=True).tap();booking_date=page.evaluate('()=>{const d=new Date();d.setDate(d.getDate()+20);return d.toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"});}')
 page.get_by_label('다른 날짜 선택').fill(booking_date);expect(page.locator('.booking-slots button').first).to_be_visible();slot=page.locator('.booking-slots button').first.inner_text();page.locator('.booking-slots button').first.tap();page.get_by_role('button',name='다음',exact=True).tap()
 for name,value in [('아이 이름','화면 테스트 두부'),('견종','말티즈'),('몸무게 (kg)','3.2'),('보호자 이름','테스트 보호자'),('연락받을 전화번호','010-0000-0000')]:page.get_by_label(name,exact=True).fill(value)
 page.get_by_role('button',name='다음',exact=True).tap();page.get_by_role('checkbox').check();page.screenshot(path='/tmp/customer-booking-review.png');page.get_by_role('button',name='예약 신청 보내기').tap();expect(page.get_by_role('heading',name='방문 신청을 보냈어요')).to_be_visible()
 data=page.evaluate('JSON.parse(localStorage.getItem("mongle-demo-v1")).data');request=data['bookingRequests'][-1];assert request['status']=='pending';assert not any(a.get('externalId')==request['id'] for a in data['appointments'])
 # Customer price page contains no owner inputs or internal data.
 page.goto(base+'?screen=prices',wait_until='networkidle');expect(page.locator('.customer-price-list')).to_be_visible();assert page.locator('input,textarea,.pricing-mode,.sidebar').count()==0
 # Separate owner screen accepts the request and retains unpaid status.
 page.goto(base+'?screen=owner',wait_until='networkidle');expect(page.locator('.month-cells')).to_be_visible();page.screenshot(path='/tmp/owner-calendar.png');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');print('owner viewport',page.evaluate('[innerHeight,document.documentElement.scrollHeight]'),flush=True)
 page.get_by_role('button',name='고객 예약 신청').tap();expect(page.locator('.booking-request-list')).to_contain_text('화면 테스트 두부');page.get_by_role('button',name='예약 확정',exact=True).tap();expect(page.locator('.booking-request-list')).not_to_contain_text('화면 테스트 두부');page.get_by_label('닫기',exact=True).click() if page.get_by_label('닫기',exact=True).count()==1 else page.locator('.modal-close').click()
 day=page.locator(f'[data-date="{booking_date}"]');expect(day.locator('.month-revenue')).not_to_contain_text('매출');page.get_by_role('button',name='예약 예상',exact=True).click();expect(day).to_contain_text('예상');page.get_by_role('button',name='결제 매출',exact=True).click();day.tap();expect(page.locator('.grooming-visits')).to_contain_text('화면 테스트 두부');expect(page.locator('.day-money-summary')).to_be_visible();page.screenshot(path='/tmp/owner-booking-day.png')
 data=page.evaluate('JSON.parse(localStorage.getItem("mongle-demo-v1")).data');saved=next(a for a in data['appointments'] if a.get('externalId')==request['id']);assert saved['source']=='website' and saved['paymentStatus']=='unpaid'
 page.locator('.modal-close').click();page.get_by_role('button',name='예약 채널 · 연결',exact=True).click();expect(page.locator('.connection-panel')).to_contain_text('네이버 예약 · 미연결')
 with page.expect_download() as dl:page.get_by_role('button',name='이번 달 예약 ICS 다운로드').click()
 assert b'BEGIN:VCALENDAR' in Path(dl.value.path()).read_bytes()
 page.locator('.modal-close').click()
 page.get_by_role('button',name='더보기',exact=True).click();page.get_by_role('button',name='요금 관리',exact=True).click();expect(page.locator('.pricing-panel')).to_be_visible();assert page.locator('.pricing-mode').count()==0;page.get_by_label('1번째 서비스 기본 금액',exact=True).fill('70000');page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_label('1번째 서비스 기본 금액',exact=True)).to_have_value('70000')
 page.goto(base+'?screen=prices',wait_until='networkidle');expect(page.locator('.customer-price-list').first).to_contain_text('70,000원부터');assert page.locator('input,textarea').count()==0
 data=page.evaluate('JSON.parse(localStorage.getItem("mongle-demo-v1")).data');assert next(a for a in data['appointments'] if a.get('externalId')==request['id'])['price']==saved['price']
 page.goto(base+'?screen=owner',wait_until='networkidle');expect(page.locator('.month-cells')).to_be_visible()
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 page.set_viewport_size({'width':390,'height':667});page.locator('#month').fill('2026-08');expect(page.locator('[data-date="2026-08-31"]')).to_be_visible();assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1');assert page.locator('[data-date="2026-08-31"]').bounding_box()['y']+page.locator('[data-date="2026-08-31"]').bounding_box()['height']<=page.locator('.mobile-navigation').bounding_box()['y']
 assert not errors,errors
 print('PASS customer service/time/details/review → pending → owner approval → calendar; read-only prices, unpaid totals, channel status and ICS')
 b.close()
server.shutdown()
