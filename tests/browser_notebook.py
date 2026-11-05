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
 expect(page.get_by_role('dialog')).to_have_count(0)
 def compose(title,body,published):
  page.get_by_role('button',name='공지 쓰기',exact=True).click();form=page.locator('.notice-compose');form.get_by_label('제목',exact=True).fill(title);form.get_by_label('내용',exact=True).fill(body)
  if published:form.get_by_label('고객에게 공개',exact=True).check()
  form.get_by_role('button',name='공지 저장',exact=True).click();expect(page.locator('.notice-read h2')).to_have_text(title);page.get_by_role('button',name='공지 목록',exact=True).click()
 compose('11월 휴무 안내','매주 월요일은 쉬어갑니다. 예약에 참고해 주세요.',True)
 compose('PRIVATE_DRAFT','아직 공개하지 않은 공지',False)
 expect(page.locator('.notice-board-table tbody tr')).to_have_count(2)
 page.get_by_role('searchbox',name='공지 검색').fill('휴무');expect(page.locator('.notice-board-table tbody tr')).to_have_count(1);page.get_by_role('searchbox',name='공지 검색').fill('')
 for width in [320,390,1440]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/notice-board-{width}.png',full_page=True)
 page.locator('.notice-title').filter(has_text='PRIVATE_DRAFT').click();page.get_by_role('button',name='수정',exact=True).click();page.locator('.notice-compose textarea').fill('저장 실패에도 남아야 할 초안')
 page.evaluate("()=>{window.noticeSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='mongle-demo-v1')throw Error('quota');return window.noticeSetItem.call(this,k,v);};}")
 page.get_by_role('button',name='공지 저장',exact=True).click();expect(page.get_by_role('alert')).to_be_visible();expect(page.locator('.notice-compose textarea')).to_have_value('저장 실패에도 남아야 할 초안');page.evaluate('()=>{Storage.prototype.setItem=window.noticeSetItem;}');page.get_by_role('button',name='공지 저장',exact=True).click();expect(page.locator('.notice-read h2')).to_have_text('PRIVATE_DRAFT')
 page.goto(base+'customer/',wait_until='networkidle');expect(page.get_by_role('heading',name='우리 아이 관리 기록',exact=True)).to_be_visible();expect(page.locator('.notebook-notices')).to_contain_text('11월 휴무 안내');expect(page.locator('body')).not_to_contain_text('PRIVATE_DRAFT')
 page.reload(wait_until='networkidle');expect(page.locator('.notebook-notices')).to_contain_text('11월 휴무 안내')
 expect(page.get_by_role('heading',name='우리 아이 관리 기록',exact=True)).to_be_visible()
 for width in [320,390,1440]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=f'/tmp/notebook-{width}.png',full_page=True)
 page.goto(base+'owner/?view=notices',wait_until='networkidle');page.locator('.notice-title').filter(has_text='11월 휴무 안내').click();page.get_by_role('button',name='공개 해제',exact=True).click();expect(page.get_by_role('status')).to_contain_text('비공개')
 page.get_by_role('button',name='공지 목록',exact=True).click();page.locator('.notice-title').filter(has_text='PRIVATE_DRAFT').click();page.get_by_role('button',name='공지 삭제',exact=True).click();page.get_by_role('button',name='삭제 확인',exact=True).click();expect(page.locator('.notice-board-table tbody tr')).to_have_count(1);page.reload(wait_until='networkidle');expect(page.locator('.notice-board-table tbody tr')).to_have_count(1)
 page.goto(base+'customer/',wait_until='networkidle');expect(page.locator('.notebook-notices')).not_to_contain_text('11월 휴무 안내')
 page.get_by_role('button',name='로그아웃',exact=True).click();expect(page.get_by_role('button',name='체험 보호자로 시작',exact=True)).to_be_visible()
 page.reload(wait_until='networkidle');expect(page.get_by_role('button',name='체험 보호자로 시작',exact=True)).to_be_visible()
 page.get_by_role('button',name='체험 보호자로 시작',exact=True).click();expect(page.get_by_role('heading',name='우리 아이 관리 기록',exact=True)).to_be_visible()
 b.close()
s.shutdown()
print('PASS notice edit/publish/persistence/unpublish, private draft, automatic guardian entry, reload, explicit logout, responsive 320/390/1440')
