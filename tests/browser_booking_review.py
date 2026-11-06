"""Spectrum 2 public booking + owner pricing against an isolated real server.
Run: npm run build && python tests/browser_booking_review.py
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from http.server import ThreadingHTTPServer
import sys,re
from playwright.sync_api import sync_playwright,expect
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import Store,make_handler,today
from tests.menu_fixture import configure
root=Path(__file__).resolve().parents[1]
with TemporaryDirectory(prefix='mongle-spectrum-') as folder,sync_playwright() as p:
 store=Store(Path(folder)/'test.sqlite');configure(store)
 handler=make_handler(store,root/'dist',owner_password='test-owner-password',secure_cookies=False);handler.log_message=lambda *a:None
 server=ThreadingHTTPServer(('127.0.0.1',0),handler);thread=Thread(target=server.serve_forever,daemon=True);thread.start()
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  base=f'http://127.0.0.1:{server.server_port}'
  page.goto(base+'/customer/booking/',wait_until='networkidle');page.set_default_timeout(10000)
  def pick(label,text):
   page.get_by_role('button',name=re.compile(label)).click()
   page.get_by_role('option',name=re.compile(text)).click()
  page.get_by_role('textbox',name='몸무게 (kg)',exact=True).fill('3.2');page.get_by_role('textbox',name='몸무게 (kg)',exact=True).press('Tab')
  pick('미용 서비스','목욕')
  page.get_by_role('button',name='다음',exact=True).click()
  pick('방문 시간','09:00')
  page.get_by_role('button',name='다음',exact=True).click()
  for label,value in [('아이 이름','테스트 두부'),('견종','말티즈'),('보호자 이름','테스트 보호자'),('연락받을 전화번호','01000000000')]:page.get_by_role('textbox',name=label,exact=True).fill(value)
  note='발을 만질 때 예민해요.\n짧게 다듬어 주세요.'
  page.get_by_role('textbox',name='원하는 스타일 · 미리 전할 말 (선택)').fill(note)
  page.get_by_role('button',name='다음',exact=True).click();expect(page.get_by_role('heading',name='예상 합계 15,000원')).to_be_visible()
  page.screenshot(path='/tmp/spectrum-initial-review.png',full_page=True)
  page.get_by_text('예약 상담·연락을 위한 이름, 전화번호, 반려견 정보 수집에 동의합니다.',exact=True).click();page.get_by_role('button',name='정보 수정',exact=True).click()
  expect(page.get_by_role('textbox',name='아이 이름',exact=True)).to_have_value('테스트 두부')
  page.get_by_role('textbox',name='연락받을 전화번호',exact=True).fill('123');page.get_by_role('button',name='수정 내용 확인').click();expect(page.get_by_role('alert')).to_contain_text('연락처')
  page.get_by_role('textbox',name='연락받을 전화번호',exact=True).fill('01000000000');page.get_by_role('button',name='수정 내용 확인').click();expect(page.get_by_role('checkbox')).not_to_be_checked()
  expect(page.get_by_role('region',name='아이와 보호자 정보 확인')).to_contain_text(note)
  page.get_by_role('button',name='일정 변경').click();pick('방문 시간','09:30');page.get_by_role('button',name='수정 내용 확인').click()
  page.get_by_role('button',name='서비스 변경').click();pick('미용 서비스','전체 미용');page.get_by_role('button',name='다음',exact=True).click();expect(page.get_by_role('button',name='수정 내용 확인')).to_be_disabled();pick('방문 시간','09:00');page.get_by_role('button',name='수정 내용 확인').click()
  expect(page.get_by_role('heading',name='예상 합계 35,000원')).to_be_visible()
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   page.screenshot(path=f'/tmp/spectrum-booking-{width}.png',full_page=True)
  page.get_by_text('예약 상담·연락을 위한 이름, 전화번호, 반려견 정보 수집에 동의합니다.',exact=True).click();page.get_by_role('button',name='예약 신청 보내기').click();expect(page.get_by_role('heading',name='방문 신청을 보냈어요')).to_be_visible()
  requests=store.booking_requests();assert len(requests)==1 and requests[0]['notes']==note and requests[0]['price']==35000 and requests[0]['status']=='pending'
  # Owner configuration is never public.
  assert page.request.get(base+'/api/menu-booking').status==401
  assert page.request.put(base+'/api/menu-booking',data={'rules':[]}).status==401
  page.request.post(base+'/api/auth/login',data={'password':'test-owner-password'})
  page.goto(base+'/owner/?view=pricing',wait_until='networkidle')
  page.screenshot(path='/tmp/spectrum-owner-debug.png',full_page=True)
  expect(page.get_by_role('heading',name='요금 관리',exact=True)).to_be_visible()
  field=page.get_by_role('textbox',name='소형견 미용 4kg 미만 목욕 금액',exact=True)
  field.fill('18000');page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_role('status')).to_contain_text('요금표를 저장')
  assert store.booking_catalog()['offers'][0]['price']==18000
  assert requests[0]['price']==35000
  settings=page.get_by_role('region',name='예약 요금 연결',exact=True)
  settings.get_by_role('button',name='소형견 미용 목욕 4kg 미만 연결 해제',exact=True).click()
  expect(settings.get_by_role('status')).to_contain_text('예약에 사용할 요금 항목을 저장')
  assert len(store.menu_booking()['rules'])==3
  pick('예약에 사용할 요금표 항목',r'소형견 미용 · 목욕 · 4kg 미만')
  settings.get_by_role('button',name='예약 항목 연결',exact=True).click()
  expect(settings.get_by_role('button',name='소형견 미용 목욕 4kg 미만 연결 해제',exact=True)).to_be_visible()
  assert len(store.menu_booking()['rules'])==4
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(150)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('owner',width)
   page.screenshot(path=f'/tmp/spectrum-owner-pricing-{width}.png',full_page=True)
  # Date picker keyboard and popover uses the official component.
  page.goto(base+'/customer/booking/',wait_until='networkidle');page.get_by_role('textbox',name='몸무게 (kg)',exact=True).fill('3.2');page.get_by_role('textbox',name='몸무게 (kg)',exact=True).press('Tab');pick('미용 서비스','목욕');page.get_by_role('button',name='다음',exact=True).click()
  page.screenshot(path='/tmp/spectrum-date-picker.png',full_page=True)
  assert not errors,errors
  print('PASS Spectrum booking edits, pending persistence, published price updates, admin authorization and four viewport sizes')
 finally:
  browser.close();server.shutdown();server.server_close();thread.join()
