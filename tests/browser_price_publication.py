"""Owner uses Spectrum to edit the same reference data rendered in the customer menu."""
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
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.goto(base+'/owner/?view=pricing',wait_until='networkidle');field=page.get_by_label('소형견 미용 4kg 미만 목욕 금액',exact=True);expect(field).to_have_value('15000')
  original=page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data");field.fill('17123');expect(page.get_by_label('중형견 미용 4kg 미만 목욕 금액',exact=True)).to_have_value('20000');expect(field).to_have_value('17123')
  page.evaluate("()=>{window.priceSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='mongle-demo-v1')throw Error('quota');return window.priceSetItem.call(this,k,v);};}")
  page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_role('alert')).to_be_visible();expect(field).to_have_value('17123');page.evaluate('()=>{Storage.prototype.setItem=window.priceSetItem;}');page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_role('status')).to_contain_text('요금표를 저장')
  for width in [320,390,1440]:
   page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/shared-owner-price-{width}.png',full_page=True)
  after=page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data");assert after['pricing']==original['pricing'];assert after['appointments']==original['appointments']
  page.goto(base+'/customer/prices/',wait_until='networkidle');expect(page.locator('.mobile-price-table').first).to_contain_text('17,123');expect(page.get_by_role('heading',name='특수견 미용',exact=True)).to_be_visible();expect(page.get_by_role('region',name='고양이 미용',exact=True)).to_contain_text('50,000');assert page.locator('.price-category-tabs').count()==0
  page.goto(base+'/owner/?view=pricing',wait_until='networkidle');expect(page.get_by_label('소형견 미용 4kg 미만 목욕 금액',exact=True)).to_have_value('17123');page.get_by_role('button',name='요금표 디자인',exact=True).click();frame=page.frame_locator('iframe');expect(frame.locator('#message')).to_contain_text('요금 관리에 저장된 기준');expect(frame.locator('#download')).to_be_enabled();page.get_by_role('button',name='현재 요금표 게시',exact=True).click();expect(page.get_by_role('status').filter(has_text='일치하는 안내 이미지')).to_be_visible();b.close()
finally:s.shutdown();t.join();s.server_close()
print('PASS original customer matrix, same editable owner cells, independent groups, failed-save preservation, reload and matching publication; existing bookings and preset rates preserved')
