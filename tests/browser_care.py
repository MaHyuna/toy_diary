"""Visit photos and public care snapshots, using an isolated demo browser only."""
from datetime import date, timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re
import tempfile
import threading
from PIL import Image
from playwright.sync_api import expect, sync_playwright


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(Path(__file__).resolve().parents[1] / 'demo-dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_address[1]}/'


def stored(page):
    return page.evaluate('JSON.parse(localStorage.getItem("mongle-demo-v1")).data')


def open_editor(page, visit):
    page.goto(base + '?screen=owner', wait_until='networkidle')
    page.locator('#month').fill(visit['date'][:7])
    page.locator(f'[data-date="{visit["date"]}"]').click()
    button = page.locator('.calendar-day-panel .visit-open').filter(has=page.locator('time').filter(has_text=re.compile(f'^{re.escape(visit["time"])}$')))
    button = button.filter(has=page.get_by_text(visit['dogName'], exact=True))
    expect(button).to_have_count(1)
    button.click()
    page.locator('.care-visit-entry').get_by_role('button').click()
    editor = page.locator('.care-record-editor')
    expect(editor.get_by_role('heading', name='미용 기록 작성', exact=True)).to_be_visible()
    return editor


def step(editor, name):
    editor.locator('.care-steps').get_by_role('button', name=re.compile(name)).click()


def save_draft(editor):
    editor.get_by_role('button', name='초안 저장', exact=True).click()
    expect(editor.locator('.modal')).to_have_attribute('aria-busy', 'false')
    expect(editor.locator('.care-draft-status')).to_contain_text('초안 저장됨')
    expect(editor.get_by_role('button', name='초안 저장', exact=True)).to_be_disabled()


def publish(editor):
    step(editor, '소견')
    button = editor.get_by_role('button', name='보호자에게 공개', exact=True)
    if not button.count():
        button = editor.get_by_role('button', name='공개 내용 갱신', exact=True)
    button.click()
    expect(editor.locator('.modal')).to_have_attribute('aria-busy', 'false')
    expect(editor.locator('.care-status-message')).to_contain_text('보호자에게 공개했어요')
    expect(editor.get_by_role('link', name='공개 화면 보기', exact=True)).to_be_visible()
    return editor.get_by_role('link', name='공개 화면 보기', exact=True).get_attribute('href')


with sync_playwright() as p, tempfile.TemporaryDirectory() as folder:
    before_file, after_file = Path(folder) / 'before.jpg', Path(folder) / 'after.jpg'
    Image.new('RGB', (260, 360), (169, 191, 211)).save(before_file)
    Image.effect_noise((1800, 1400), 95).convert('RGB').save(after_file, quality=95)
    assert after_file.stat().st_size > 100000
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    context.add_init_script("sessionStorage.setItem('mongle-demo-owner-session','active')")
    owner = context.new_page()
    errors = []
    owner.on('pageerror', lambda error: errors.append(str(error)))
    owner.goto(base + '?screen=owner', wait_until='networkidle')
    fixtures = owner.evaluate('''() => {
      const key='mongle-demo-v1',wrapper=JSON.parse(localStorage.getItem(key)),visits=wrapper.data.appointments;
      const visit=visits.filter(a=>a.petId&&a.paymentStatus==='paid'&&visits.filter(other=>other.petId===a.petId&&other.status!=='cancelled').length>=3).sort((a,b)=>b.date.localeCompare(a.date))[0];
      visit.notes='PRIVATE_INTERNAL_DO_NOT_SHARE'; visit.phone='010-9876-5432';
      const pet=wrapper.data.pets.find(p=>p.id===visit.petId); pet.healthNotes='PRIVATE_PET_MASTER_DO_NOT_SHARE';
      const same=visits.filter(a=>a.petId===visit.petId&&a.id!==visit.id&&a.status!=='cancelled');
      const past=same.find(a=>a.date!==visit.date),hidden=same.find(a=>a.id!==past.id&&a.date!==visit.date);
      const other=visits.find(a=>a.petId&&a.petId!==visit.petId&&a.status!=='cancelled');
      localStorage.setItem(key,JSON.stringify(wrapper));return {visit,past,hidden,other};
    }''')
    financial_before = json.dumps(stored(owner)['appointments'], sort_keys=True)
    visit = fixtures['visit']
    editor = open_editor(owner, visit)
    editor.get_by_label('미용 전 사진 파일', exact=True).set_input_files(str(before_file))
    expect(editor.locator('.care-photo-item img')).to_have_count(1)
    editor.get_by_role('textbox', name='미용 전 상태', exact=True).fill('전 상태 V1 · 발끝 털을 확인했어요.')
    step(editor, '미용 후')
    editor.get_by_label('미용 후 사진 파일', exact=True).set_input_files(str(after_file))
    expect(editor.locator('.care-photo-item img')).to_have_count(1)
    editor.get_by_role('textbox', name='미용 후 결과', exact=True).fill('후 결과 · 발끝과 얼굴 털을 정리했어요.')
    step(editor, '소견')
    editor.get_by_role('textbox', name='미용사 소견', exact=True).fill('휴식 시간을 나누어 편안하게 진행했어요.')
    editor.get_by_role('textbox', name='집에서 관리할 것', exact=True).fill('산책 후 발을 잘 말려 주세요.\n빗질은 천천히 해 주세요.')
    recommended = (date.fromisoformat(visit['date']) + timedelta(days=28)).isoformat()
    editor.get_by_role('button', name='날짜 고르기', exact=True).click()
    editor.get_by_label('다음 방문 권장일 연도', exact=True).select_option(recommended[:4])
    editor.get_by_label('다음 방문 권장일 월', exact=True).select_option(recommended[5:7])
    editor.locator(f'[data-picker-date="{recommended}"]').click()
    expect(editor.get_by_role('button', name='보호자에게 공개', exact=True)).to_be_disabled()
    owner.evaluate('''()=>{window.originalCareSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='mongle-demo-v1')throw new DOMException('test quota','QuotaExceededError');return window.originalCareSetItem.call(this,k,v);};}''')
    editor.get_by_role('button', name='초안 저장', exact=True).click()
    expect(editor.locator('.form-error')).to_be_visible()
    expect(editor.get_by_role('textbox', name='집에서 관리할 것', exact=True)).to_have_value('산책 후 발을 잘 말려 주세요.\n빗질은 천천히 해 주세요.')
    assert not stored(owner).get('careRecords')
    owner.evaluate('()=>{Storage.prototype.setItem=window.originalCareSetItem;}')
    save_draft(editor)
    draft = next(record for record in stored(owner)['careRecords'] if record['appointmentId'] == visit['id'])
    assert not draft['published'] and draft['shareToken'] is None and len(draft['photos']) == 2
    assert all(len(photo['src']) <= 100000 for photo in draft['photos'])
    owner.reload(wait_until='networkidle')
    editor = open_editor(owner, visit)
    expect(editor.get_by_role('textbox', name='미용 전 상태', exact=True)).to_have_value('전 상태 V1 · 발끝 털을 확인했어요.')
    expect(editor.locator('.care-photo-item img')).to_have_count(1)
    public_url = publish(editor)
    token = next(record for record in stored(owner)['careRecords'] if record['appointmentId'] == visit['id'])['shareToken']
    assert re.fullmatch('[a-f0-9]{32}', token)
    owner.screenshot(path='/tmp/care-owner-editor.png', animations='disabled')

    # Add an older public visit, an unpublished visit for this pet, and another pet's public visit.
    for key, message, should_publish in [('past', '이전 방문 공개 기록', True), ('hidden', 'HIDDEN_DRAFT_HISTORY', False), ('other', 'OTHER_PET_PUBLIC_RECORD', True)]:
        another = open_editor(owner, fixtures[key])
        another.get_by_role('textbox', name='미용 전 상태', exact=True).fill(message)
        save_draft(another)
        if should_publish:
            publish(another)

    customer = context.new_page()
    customer.on('pageerror', lambda error: errors.append(str(error)))
    customer.goto(public_url, wait_until='networkidle')
    expect(customer.locator('.care-report')).to_be_visible()
    expect(customer.locator('.care-report-photo-stage-before img')).to_have_count(1)
    expect(customer.locator('.care-report-photo-stage-after img')).to_have_count(1)
    dimensions = customer.locator('.care-report-photo-stage-after img').evaluate('async image=>{await image.decode();return [image.naturalWidth,image.naturalHeight];}')
    assert max(dimensions) <= 960, dimensions
    expect(customer.locator('.care-report')).to_contain_text('전 상태 V1')
    expect(customer.locator('.care-report')).to_contain_text('산책 후 발을 잘 말려 주세요.')
    expect(customer.locator('.care-report')).not_to_contain_text('PRIVATE_')
    expect(customer.locator('.care-report')).not_to_contain_text('HIDDEN_DRAFT_HISTORY')
    expect(customer.locator('.care-report')).not_to_contain_text('OTHER_PET_PUBLIC_RECORD')
    assert customer.locator('input,textarea,.sidebar,.mobile-navigation').count() == 0
    assert not re.search(r'[\d,]+원', customer.locator('.care-site').inner_text())
    expect(customer.locator('.care-report-history button')).to_have_count(2)
    customer.locator('.care-report-history button[aria-pressed=false]').click()
    expect(customer.locator('.care-report')).to_contain_text('이전 방문 공개 기록')
    customer.locator('.care-report-history button[aria-pressed=false]').click()
    expect(customer.locator('.care-report')).to_contain_text('전 상태 V1')
    customer.get_by_role('button', name='미용 전 사진 크게 보기', exact=True).click()
    expect(customer.locator('dialog')).to_be_visible()
    customer.locator('dialog').press('Escape')
    expect(customer.locator('dialog')).not_to_be_visible()

    # Saving a later draft does not silently replace the customer-visible snapshot.
    editor = open_editor(owner, visit)
    editor.get_by_role('textbox', name='미용 전 상태', exact=True).fill('전 상태 V2 · 공개 전 수정한 초안')
    save_draft(editor)
    customer.goto(public_url, wait_until='networkidle')
    expect(customer.locator('.care-report')).to_contain_text('전 상태 V1')
    expect(customer.locator('.care-report')).not_to_contain_text('전 상태 V2')
    publish(editor)
    customer.reload(wait_until='networkidle')
    expect(customer.locator('.care-report')).to_contain_text('전 상태 V2')
    with customer.expect_download() as download:
        customer.get_by_role('button', name='기록 파일 저장', exact=True).click()
    portable = Path(download.value.path()).read_text()
    assert '전 상태 V2' in portable and 'data:image/jpeg;base64,' in portable
    assert 'PRIVATE_' not in portable and '010-9876-5432' not in portable
    assert '<script' not in portable.lower()
    for width in [390, 320]:
        customer.set_viewport_size({'width': width, 'height': 844})
        assert customer.evaluate('document.documentElement.scrollWidth<=innerWidth')
    customer.screenshot(path='/tmp/care-customer-mobile.png', animations='disabled')
    owner.set_viewport_size({'width': 390, 'height': 844})
    assert editor.locator('.modal').evaluate('element=>element.scrollWidth<=element.clientWidth')

    editor.get_by_role('button', name='공개 해제 · 이전 링크 차단', exact=True).click()
    expect(editor.get_by_role('button', name='보호자에게 공개', exact=True)).to_be_visible()
    customer.reload(wait_until='networkidle')
    expect(customer.get_by_role('heading', name='기록을 확인할 수 없어요', exact=True)).to_be_visible()
    expect(customer.locator('.care-report')).to_have_count(0)
    new_url = publish(editor)
    assert new_url != public_url
    customer.goto(public_url, wait_until='networkidle')
    expect(customer.get_by_role('heading', name='기록을 확인할 수 없어요', exact=True)).to_be_visible()
    customer.goto(new_url, wait_until='networkidle')
    expect(customer.locator('.care-report')).to_contain_text('전 상태 V2')
    assert json.dumps(stored(owner)['appointments'], sort_keys=True) == financial_before
    assert not errors, errors
    print('PASS staged visit photos, draft persistence/failure, explicit publication, same-pet public history, no private fields, draft isolation, safe file export, revoke/rotate links, mobile layout, unchanged financial records')
    browser.close()
server.shutdown()
