"""Real guardian login and owner-approved notebook using a temporary database."""
from pathlib import Path
from tempfile import TemporaryDirectory
from http.server import ThreadingHTTPServer
from threading import Thread
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import Store,make_handler
from playwright.sync_api import sync_playwright,expect
with TemporaryDirectory() as folder:
 store=Store(Path(folder)/'guardian.sqlite');customer=store.create_customer({'name':'테스트 보호자','phone':'01012345678'});pet=store.create_pet({'customerId':customer['id'],'name':'별이','breed':'말티즈'})
 handler=make_handler(store,Path(__file__).resolve().parents[1]/'dist',owner_password='owner-test-password',secure_cookies=False);handler.log_message=lambda *args:None
 server=ThreadingHTTPServer(('127.0.0.1',0),handler);thread=Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{server.server_port}'
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base+'/customer/',wait_until='networkidle');expect(page.get_by_text('받은 미용 기록 링크',exact=True)).to_have_count(0);page.get_by_role('button',name='처음 이용해요',exact=True).click();page.get_by_label('보호자 이름',exact=True).fill('테스트 보호자');page.get_by_label('휴대폰 번호',exact=True).fill('01012345678');page.get_by_label('비밀번호',exact=True).fill('correct-horse-123');page.get_by_role('button',name='가입하고 매장 연결 기다리기').click();expect(page.get_by_role('heading',name='매장 연결을 기다리고 있어요')).to_be_visible()
   owner=p.request.new_context(base_url=base)
   assert owner.post('/api/auth/login',data={'password':'owner-test-password'}).ok
   links=owner.get('/api/guardian-links').json();assert owner.put('/api/guardian-links',data={'accountId':links['accounts'][0]['id'],'customerId':customer['id'],'linked':True}).ok
   page.get_by_role('button',name='연결 상태 다시 확인').click();expect(page.get_by_role('button',name='별이 말티즈')).to_be_visible();expect(page.get_by_role('heading',name='첫 미용 기록을 기다리고 있어요')).to_be_visible()
   for width in [320,390,1440]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.reload(wait_until='networkidle');expect(page.get_by_role('button',name='별이 말티즈')).to_be_visible();page.get_by_role('button',name='로그아웃',exact=True).click();expect(page.get_by_role('button',name='로그인',exact=True).first).to_be_visible();expect(page.get_by_role('button',name='별이 말티즈')).to_have_count(0)
   page.get_by_label('휴대폰 번호',exact=True).fill('01012345678');page.get_by_label('비밀번호',exact=True).fill('correct-horse-123');page.get_by_role('button',name='로그인',exact=True).last.click();expect(page.get_by_role('button',name='별이 말티즈')).to_be_visible();assert not errors,errors;browser.close();owner.dispose()
 finally:server.shutdown();thread.join();server.server_close()
print('PASS guardian signup, pending link, owner approval, pet notebook, responsive layout, persistent session and logout')
