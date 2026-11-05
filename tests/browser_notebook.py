"""Owner notice publication and customer notebook, isolated browser storage."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright,expect
s=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1] / 'demo-dist')))
threading.Thread(target=s.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{s.server_port}/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1000});c.add_init_script("sessionStorage.setItem('mongle-demo-owner-session','active')")
 page=c.new_page();page.goto(base+'?screen=owner',wait_until='networkidle')
 page.get_by_role('button',name='고객 공지 관리',exact=True).first.click()
 page.get_by_role('button',name='공지 추가',exact=True).click()
 form=page.locator('.notice-editor');form.get_by_label('제목',exact=True).fill('11월 휴무 안내');form.get_by_label('내용',exact=True).fill('매주 월요일은 쉬어갑니다. 예약에 참고해 주세요.');form.get_by_label('고객에게 공개',exact=True).check()
 page.get_by_role('button',name='공지 추가',exact=True).click();form.get_by_label('제목',exact=True).nth(1).fill('PRIVATE_DRAFT');form.locator('textarea').nth(1).fill('아직 공개하지 않은 공지')
 form.get_by_role('button',name='공지 저장',exact=True).click();expect(form.get_by_role('status')).to_be_visible()
 page.goto(base+'customer/',wait_until='networkidle');expect(page.get_by_role('heading',name='우리 아이 관리 기록',exact=True)).to_be_visible();expect(page.locator('.notebook-notices')).to_contain_text('11월 휴무 안내');expect(page.locator('body')).not_to_contain_text('PRIVATE_DRAFT')
 page.reload(wait_until='networkidle');expect(page.locator('.notebook-notices')).to_contain_text('11월 휴무 안내')
 expect(page.get_by_role('heading',name='우리 아이 관리 기록',exact=True)).to_be_visible()
 for width in [320,390,1440]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/notebook-{width}.png',full_page=True)
 page.goto(base+'?screen=owner',wait_until='networkidle');page.get_by_role('button',name='고객 공지 관리',exact=True).first.click();form=page.locator('.notice-editor');form.get_by_label('고객에게 공개',exact=True).first.uncheck();form.get_by_role('button',name='공지 저장',exact=True).click();expect(form.get_by_role('status')).to_be_visible()
 page.goto(base+'customer/',wait_until='networkidle');expect(page.locator('.notebook-notices')).not_to_contain_text('11월 휴무 안내')
 page.get_by_role('button',name='로그아웃',exact=True).click();expect(page.get_by_role('button',name='체험 보호자로 시작',exact=True)).to_be_visible()
 page.reload(wait_until='networkidle');expect(page.get_by_role('button',name='체험 보호자로 시작',exact=True)).to_be_visible()
 page.get_by_role('button',name='체험 보호자로 시작',exact=True).click();expect(page.get_by_role('heading',name='우리 아이 관리 기록',exact=True)).to_be_visible()
 b.close()
s.shutdown()
print('PASS notice edit/publish/persistence/unpublish, private draft, automatic guardian entry, reload, explicit logout, responsive 320/390/1440')
