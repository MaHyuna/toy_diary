"""Edit the poster-shaped menu with Spectrum controls, preserving all data and geometry."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root/'demo-dist')));thread=Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'/owner/?view=pricing',wait_until='networkidle')
  page.get_by_role('button',name='요금표 수정',exact=True).click()
  initial=page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments")
  expect(page.locator('.mobile-price-table').first.locator('thead th')).to_have_text(['몸무게','목욕','부분미용','부분+목욕','전체 클리핑','스포팅','가위컷'])
  page.get_by_role('button',name='소형견 미용 섹션 편집',exact=True).click();dialog=page.get_by_role('dialog')
  dialog.get_by_label('견종 안내',exact=True).fill('말티즈 · 푸들')
  dialog.get_by_label('기타 설명',exact=True).fill('방문 전에 털 상태를 알려 주세요.')
  dialog.get_by_role('button',name='+ 체중 행 추가',exact=True).click();dialog.get_by_label('4번째 체중 기준').fill('8~10kg 미만');dialog.get_by_role('button',name='적용',exact=True).click()
  expect(page.get_by_role('textbox',name='소형견 미용 8~10kg 미만 목욕 금액',exact=True)).to_have_value('상담')
  page.get_by_role('button',name='+ 섹션 추가',exact=True).first.click();dialog=page.get_by_role('dialog');dialog.get_by_label('섹션 제목',exact=True).fill('스페셜 케어')
  dialog.get_by_role('button',name='섹션 형식',exact=False).click();page.get_by_role('option',name='항목·금액 목록 (고양이·추가 요금 등)',exact=True).click()
  dialog.get_by_label('1번째 항목 이름',exact=True).fill('피부 관리');dialog.get_by_label('1번째 항목 금액',exact=True).fill('상담');dialog.get_by_role('button',name='+ 항목 추가',exact=True).click();dialog.get_by_label('2번째 항목 이름',exact=True).fill('발 관리');dialog.get_by_label('2번째 항목 금액',exact=True).fill('10000');dialog.get_by_role('button',name='적용',exact=True).click()
  expect(page.get_by_role('heading',name='스페셜 케어',exact=True)).to_be_visible()
  page.get_by_role('button',name='스페셜 케어 섹션 편집',exact=True).click();dialog=page.get_by_role('dialog');dialog.get_by_label('섹션 제목').fill('취소할 수정');dialog.get_by_role('button',name='취소',exact=True).click();expect(page.get_by_role('heading',name='스페셜 케어',exact=True)).to_be_visible()
  page.get_by_role('button',name='서비스 열 편집',exact=True).click();dialog=page.get_by_role('dialog');dialog.get_by_role('button',name='+ 서비스 열 추가',exact=True).click();dialog.get_by_label('7번째 서비스 이름').fill('특수컷');dialog.get_by_role('button',name='적용',exact=True).click()
  expect(page.get_by_role('textbox',name='중형견 미용 4kg 미만 특수컷 금액',exact=True)).to_have_value('상담')
  page.get_by_role('button',name='서비스 열 편집',exact=True).click();dialog=page.get_by_role('dialog');dialog.get_by_role('button',name='7번째 서비스 열 삭제',exact=True).click();dialog.get_by_role('button',name='적용',exact=True).click()
  expect(page.get_by_role('textbox',name='소형견 미용 4kg 미만 목욕 금액',exact=True)).to_have_value('15000')
  page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_role('status')).to_contain_text('요금표를 저장')
  page.reload(wait_until='networkidle');page.get_by_role('button',name='요금표 수정',exact=True).click();expect(page.get_by_role('heading',name='스페셜 케어',exact=True)).to_be_visible()
  page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='소형견 미용 4kg 미만 목욕 금액 수정',exact=True).click();dialog=page.get_by_role('dialog');dialog.get_by_role('textbox',name='소형견 미용 4kg 미만 목욕 금액',exact=True).fill('17500');dialog.get_by_role('button',name='적용',exact=True).click();expect(page.get_by_role('button',name='소형견 미용 4kg 미만 목욕 금액 수정',exact=True)).to_contain_text('17,500');page.get_by_role('button',name='요금표 저장',exact=True).click();expect(page.get_by_role('status')).to_contain_text('요금표를 저장')
  page.get_by_role('button',name='요금표 수정',exact=True).click()
  # Deletion requires a second explicit action, and draft changes can be reverted.
  page.get_by_role('button',name='스페셜 케어 섹션 편집',exact=True).click();dialog=page.get_by_role('dialog');dialog.get_by_role('button',name='섹션 삭제',exact=True).click();dialog.get_by_role('button',name='섹션 삭제 확인',exact=True).click();expect(page.get_by_role('heading',name='스페셜 케어',exact=True)).to_have_count(0)
  page.get_by_role('button',name='변경 되돌리기',exact=True).click();expect(page.get_by_role('heading',name='스페셜 케어',exact=True)).to_be_visible()
  for role in ['owner/?view=pricing','customer/prices/']:
   page.goto(base+'/'+role,wait_until='networkidle')
   if role.startswith('owner'):page.get_by_role('button',name='전체 요금표 보기',exact=True).click()
   for width in [320,390,768,1440]:
    page.set_viewport_size({'width':width,'height':1000});page.wait_for_timeout(100)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(role,width)
    table=page.locator('.mobile-price-table').first
    expect(table.locator('thead th')).to_have_text(['몸무게','목욕','부분미용','부분+목욕','전체 클리핑','스포팅','가위컷'])
    expect(table.locator('tbody tr').first.locator('th')).to_have_text('4kg 미만')
    if width==1440:
     boxes=[page.get_by_role('region',name=n,exact=True).bounding_box() for n in ['기타 추가금액','고양이 미용']];assert abs(boxes[0]['y']-boxes[1]['y'])<2
    page.screenshot(path=f'/tmp/price-sheet-{role.split("/")[0]}-{width}.png',full_page=True)
   expect(page.get_by_role('region',name='스페셜 케어',exact=True)).to_contain_text('피부 관리')
  assert page.evaluate("JSON.parse(localStorage.getItem('mongle-demo-v1')).data.appointments")==initial
  # Imported canvas and exported poster retain added sections, text and the two-column list layout.
  page.goto(base+'/owner/?view=pricing',wait_until='networkidle');page.get_by_role('button',name='요금표 디자인 편집',exact=True).click();frame=page.frame_locator('iframe');expect(frame.locator('#message')).to_contain_text('요금 관리에 저장된 기준')
  # save() writes the same project locally; inspect via the exported backup instead of implementation state.
  with page.expect_download() as download:frame.locator('#export-json').evaluate('(el)=>el.click()')
  project=json.loads(Path(download.value.path()).read_text())
  lists=[s for s in project['sections'] if s['title'] in ['기타 추가금액','고양이 미용']];assert all(s['span']=='half' for s in lists)
  assert any(s['title']=='스페셜 케어' for s in project['sections']);assert project['sections'][0]['content']=='방문 전에 털 상태를 알려 주세요.'
  page.get_by_role('button',name='현재 요금표 게시',exact=True).click();expect(page.get_by_role('status').filter(has_text='일치하는 안내 이미지')).to_be_visible()
  assert not errors,errors
  print('PASS section/row/item/column editing, cancel/delete/revert, reload, mobile cell editor, same matrix geometry, poster publication and preserved reservations')
  b.close()
finally:server.shutdown();thread.join();server.server_close()
