"""Editor snapshot publication uses isolated browser demo storage."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import threading
from playwright.sync_api import sync_playwright,expect
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(Path(__file__).resolve().parents[1] / 'demo-dist')));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1440,'height':1000});c.add_init_script("sessionStorage.setItem('mongle-demo-owner-session','active')");page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'owner/',wait_until='networkidle');page.get_by_role('button',name='요금표 디자인',exact=True).click();frame=page.frame_locator('iframe');expect(frame.locator('#download')).to_be_enabled();page.get_by_role('button',name='현재 요금표 게시',exact=True).click();expect(page.get_by_role('status').filter(has_text='고객 요금안내에 게시했어요')).to_be_visible(timeout=15000)
 poster=page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.pricePoster")
 assert '소형견 미용' in poster['description'] and '고양이 미용' in poster['description']
 page.goto(base+'customer/prices/',wait_until='networkidle');expect(page.locator('.price-poster-scroll img')).to_have_attribute('src',poster['image']);expect(page.locator('.poster-example')).to_have_count(0)
 page.get_by_text('요금표 글자로 보기',exact=True).click();expect(page.locator('.poster-text')).to_contain_text('소형견 미용')
 for width in [320,390,700,1440]:
  page.set_viewport_size({'width':width,'height':900});
  if width<=700:
   expect(page.locator('.price-category-tabs')).to_be_visible();expect(page.locator('.mobile-price-menu select')).to_have_count(0);expect(page.locator('.mobile-price-table tbody tr')).to_have_count(3);expect(page.locator('.mobile-price-table')).to_contain_text('20,000');page.set_viewport_size({'width':width,'height':360});page.evaluate("document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:260,behavior:'instant'})");page.wait_for_timeout(100);assert abs(page.locator('.price-category-tabs').bounding_box()['y'])<2;page.locator('.mobile-price-table-scroll').evaluate('el=>el.scrollLeft=el.scrollWidth');assert page.locator('.mobile-price-table-scroll').evaluate('el=>el.scrollLeft>0') or width==700;page.evaluate('window.scrollTo(0,0)');page.set_viewport_size({'width':width,'height':900});page.get_by_role('button',name='고양이 미용',exact=True).click();expect(page.locator('.mobile-price-services')).to_contain_text('50,000');page.get_by_role('button',name='소형견 미용',exact=True).click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/price-published-{width}.png',full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.goto(base+'owner/',wait_until='networkidle');page.get_by_role('button',name='더보기',exact=True).click();page.get_by_role('button',name='요금표 디자인',exact=True).click();publish=page.get_by_role('button',name='현재 요금표 게시',exact=True);expect(publish).to_be_in_viewport();expect(page.locator('iframe')).to_be_visible();page.screenshot(path='/tmp/mobile-price-editor.png');page.get_by_role('button',name='게시 내리기',exact=True).click();expect(page.get_by_role('status').filter(has_text='게시를 내렸어요')).to_be_visible()
 page.goto(base+'customer/prices/',wait_until='networkidle');expect(page.locator('.poster-example')).to_be_visible();assert not errors,errors
 b.close()
s.shutdown();print('PASS exact editor snapshot publication, text alternative, public display, mobile overflow, unpublish')
