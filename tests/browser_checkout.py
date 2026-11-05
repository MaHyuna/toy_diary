"""Visit context, editable notes, and an atomic final-price checkout."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(Path(__file__).resolve().parents[1] / 'demo-dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.add_init_script("sessionStorage.setItem('mongle-demo-owner-session','active')")
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'http://127.0.0.1:{server.server_address[1]}/?screen=owner', wait_until='networkidle')
    visit = page.evaluate('''() => {
      const key='mongle-demo-v1', wrapper=JSON.parse(localStorage.getItem(key));
      const visit=wrapper.data.appointments.find(a=>a.dogName==='구름이 (체험)'&&a.paymentStatus==='unpaid');
      const owner=wrapper.data.customers.find(c=>c.id===visit.customerId);
      owner.phone='010-1234-5678'; owner.notes='픽업 전에 문자 부탁';
      localStorage.setItem(key,JSON.stringify(wrapper)); return visit;
    }''')
    page.reload(wait_until='networkidle')
    page.locator(f'[data-date="{visit["date"]}"]').click()
    panel = page.locator('.calendar-day-panel')
    card = panel.locator('.grooming-visit').filter(has=page.get_by_role('button', name='구름이 (체험) 예약 상세 보기', exact=True))
    expect(card).to_contain_text('비숑 프리제')
    expect(card).to_contain_text(visit['guardianName'])
    expect(card.locator('.visit-attention')).to_be_visible()
    card.locator('.visit-open').click()
    expect(page.get_by_role('link', name='010-1234-5678', exact=True)).to_be_visible()
    expect(page.locator('.detail-care-section')).to_contain_text('픽업 전에 문자 부탁')
    expect(page.locator('.detail-care-section')).to_contain_text('발을 만질 때')
    note = page.get_by_label('미용 메모', exact=True)
    note.fill('드라이 온도 낮게, 다음 방문 때 피부 확인')
    page.get_by_role('button', name='메모 저장', exact=True).click()
    expect(page.get_by_role('button', name='메모 저장', exact=True)).to_be_disabled()
    page.screenshot(path='/tmp/visit-context-and-notes.png', animations='disabled')
    page.locator('.modal-close').click()
    card.get_by_role('button', name='미용 완료', exact=True).click()
    checkout = page.locator('.checkout-sheet')
    expect(page.get_by_role('heading', name='미용 마무리', exact=True)).to_be_visible()
    expect(checkout.locator('input[type=date]')).to_have_count(0)
    expect(checkout.get_by_role('button', name='카드', exact=True)).to_have_attribute('aria-pressed', 'true')
    expect(checkout.locator('.checkout-contact')).to_contain_text('010-1234-5678')
    expect(page.get_by_label('미용 메모', exact=True)).to_have_value('드라이 온도 낮게, 다음 방문 때 피부 확인')
    page.screenshot(path='/tmp/checkout-desktop.png', animations='disabled')
    checkout.get_by_role('button', name='요금 수정', exact=True).click()
    page.get_by_label('기본 미용 요금 (원)', exact=True).fill(str(visit['basePrice'] + 5000))
    checkout.get_by_role('button', name='추가요금', exact=True).click()
    page.get_by_label('추가요금 사유', exact=True).last.fill('엉킴 정리')
    page.get_by_label('금액 (원)', exact=True).last.fill('5000')
    total = visit['price'] + 10000
    checkout.get_by_role('button', name='계좌이체', exact=True).click()
    checkout.get_by_role('button', name='변경', exact=True).click()
    picker = page.get_by_role('group', name='실제 결제일', exact=True)
    expect(picker).to_be_visible()
    expect(checkout.locator('input[type=date]')).to_have_count(0)
    expect(picker.get_by_role('button', name='결제일 다음 달', exact=True)).to_be_disabled()
    selected_date = picker.locator('[aria-pressed=true]')
    selected_date.focus()
    selected_date.press('ArrowLeft')
    chosen = picker.locator('button[data-picker-date]:focus')
    paid_date = chosen.get_attribute('data-picker-date')
    assert paid_date < visit['date']
    page.screenshot(path='/tmp/checkout-inline-calendar.png', animations='disabled')
    chosen.press('Enter')
    expect(picker).not_to_be_visible()
    expect(checkout.get_by_role('button', name='변경', exact=True)).to_be_focused()
    checkout.get_by_role('button', name='변경', exact=True).click()
    picker.locator('[aria-pressed=true]').focus()
    picker.locator('[aria-pressed=true]').press('Escape')
    expect(picker).not_to_be_visible()
    expect(checkout).to_be_visible()
    page.get_by_label('미용 메모', exact=True).fill('픽업 안내 완료, 다음 방문 피부 확인')
    page.evaluate('''()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='mongle-demo-v1')throw new DOMException('test quota','QuotaExceededError');return window.originalSetItem.call(this,k,v);};}''')
    checkout.get_by_role('button', name=f'{total:,}원 기록', exact=True).click()
    expect(checkout.locator('.form-error')).to_be_visible()
    expect(page.get_by_label('미용 메모', exact=True)).to_have_value('픽업 안내 완료, 다음 방문 피부 확인')
    unchanged = page.evaluate('(id)=>JSON.parse(localStorage.getItem("mongle-demo-v1")).data.appointments.find(a=>a.id===id)', visit['id'])
    assert unchanged['paymentStatus'] == 'unpaid' and unchanged['price'] == visit['price']
    page.evaluate('()=>{Storage.prototype.setItem=window.originalSetItem;}')
    checkout.get_by_role('button', name=f'{total:,}원 기록', exact=True).click()
    expect(checkout).not_to_be_visible()
    expect(card).to_contain_text(f'{total:,}원')
    card.locator('.visit-open').click()
    note = page.get_by_label('미용 메모', exact=True)
    note.fill('결제 후에도 미용 메모 보완')
    page.get_by_role('button', name='메모 저장', exact=True).click()
    expect(page.get_by_role('button', name='메모 저장', exact=True)).to_be_disabled()
    page.reload(wait_until='networkidle')
    paid = page.evaluate('(id)=>JSON.parse(localStorage.getItem("mongle-demo-v1")).data.appointments.find(a=>a.id===id)', visit['id'])
    assert paid['price'] == total and paid['paymentStatus'] == 'paid' and paid['paymentMethod'] == 'transfer'
    assert paid['paidDate'] == paid_date and paid['notes'] == '결제 후에도 미용 메모 보완'
    page.set_viewport_size({'width': 390, 'height': 667})
    page.locator(f'[data-date="{visit["date"]}"]').click()
    expect(page.locator('.mobile-day-panel')).to_be_visible()
    expect(page.locator('.calendar-workspace')).to_have_attribute('data-agenda-open', 'true')
    page.locator('.mobile-day-panel').get_by_role('button', name='미용 완료', exact=True).first.click()
    expect(checkout).to_be_visible()
    expect(checkout.locator('input[type=date]')).to_have_count(0)
    assert checkout.locator('.modal').evaluate('el=>el.scrollWidth<=el.clientWidth')
    expect(checkout.locator('.modal-footer button')).to_be_visible()
    note_box = checkout.get_by_label('미용 메모', exact=True).bounding_box()
    footer = checkout.locator('.modal-footer').bounding_box()
    assert note_box['y'] + note_box['height'] <= footer['y'] + 1, (note_box, footer)
    page.screenshot(path='/tmp/checkout-mobile.png', animations='disabled')
    checkout.get_by_role('button', name='변경', exact=True).click()
    page.set_viewport_size({'width': 320, 'height': 667})
    assert picker.evaluate('el=>el.scrollWidth<=el.clientWidth')
    assert checkout.locator('.modal').evaluate('el=>el.scrollWidth<=el.clientWidth')
    assert not errors, errors
    print('PASS guardian/pet context, persistent notes after payment, final charges + payment atomicity, storage failure draft preservation, and compact mobile checkout')
    browser.close()
server.shutdown()
