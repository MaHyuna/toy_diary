"""Real HTTP sessions and role boundaries (build production first, never demo).

Run: npm run build && python tests/browser_auth.py
An isolated production build can be passed with --static-dir /tmp/auth-dist.
"""
import argparse
import json
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread

from playwright.sync_api import expect, sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.app import Store, make_handler, today


def start_server(store, static, password, clock):
    handler = make_handler(store, static, owner_password=password, secure_cookies=False,
                           session_seconds=3600, auth_clock=lambda: clock[0])
    handler.log_message = lambda *args: None
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, f'http://127.0.0.1:{server.server_port}/'


parser = argparse.ArgumentParser()
parser.add_argument('--static-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'dist')
args = parser.parse_args()
assert (args.static_dir / 'index.html').is_file(), 'Build the production frontend first.'

with TemporaryDirectory(prefix='mongle-auth-browser-') as folder, sync_playwright() as playwright:
    store = Store(Path(folder) / 'auth.sqlite')
    guardian = store.create_customer({'name': '권한 테스트 보호자', 'phone': '010-9999-8888', 'notes': 'PRIVATE_CUSTOMER_NOTE'})
    pet = store.create_pet({'customerId': guardian['id'], 'name': '권한 테스트 두부', 'breed': '말티즈', 'weight': 3.2})
    visit = store.create_appointment({'dogName': pet['name'], 'guardianName': guardian['name'], 'phone': guardian['phone'],
        'petId': pet['id'], 'breed': pet['breed'], 'weight': pet['weight'], 'date': today(), 'time': '09:00',
        'duration': 60, 'service': '전체 미용', 'basePrice': 65000, 'notes': 'PRIVATE_VISIT_NOTE'})
    store.save_care(visit['id'], {'beforeNotes': '눈 주변과 발끝 상태 확인', 'afterNotes': '미용 완료',
        'groomerOpinion': '쉬는 시간을 나눠 진행했어요.', 'homeCare': '젖은 발을 잘 말려 주세요.', 'photos': []})
    report = store.publish_care(visit['id'], {})
    password = 'browser-test-owner-password'
    clock = [100.0]
    server, thread, base = start_server(store, args.static_dir, password, clock)
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    try:
        owner = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = owner.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + 'owner/', wait_until='networkidle')
        expect(page.get_by_role('heading', name='사장님 로그인', exact=True)).to_be_visible()
        expect(page.locator('.month-cells')).to_have_count(0)
        assert owner.request.get(base + 'api/state').status == 401
        page.get_by_label('사장님 비밀번호', exact=True).fill('wrong-password')
        page.get_by_role('button', name='로그인', exact=True).click()
        expect(page.locator('.owner-auth-error')).to_contain_text('비밀번호')
        expect(page.locator('.month-cells')).to_have_count(0)
        page.get_by_label('사장님 비밀번호', exact=True).fill(password)
        page.get_by_role('button', name='로그인', exact=True).click()
        expect(page.locator('.month-cells')).to_be_visible()
        cookie = next(cookie for cookie in owner.cookies() if cookie['name'] == 'mongle_owner_session')
        assert cookie['httpOnly'] and cookie['sameSite'] == 'Strict'
        assert 'mongle_owner_session' not in page.evaluate('document.cookie')
        assert not page.evaluate('(password)=>Object.values(localStorage).some(value=>value.includes(password))', password)
        assert owner.request.get(base + 'api/state').status == 200

        # A customer grant can read only published reports; it cannot become an owner session.
        customer = browser.new_context(viewport={'width': 390, 'height': 844})
        customer_page = customer.new_page()
        token = report['shareToken']
        response = customer.request.get(base + f'api/public/care/{token}')
        assert response.status == 200
        assert 'PRIVATE_' not in json.dumps(response.json())
        assert customer.request.get(base + f'api/state?token={token}').status == 401
        assert customer.request.get(base + 'api/customers', headers={'Authorization': f'Bearer {token}'}).status == 401
        assert customer.request.patch(base + f'api/appointments/{visit["id"]}', data={'notes': 'CUSTOMER_MUST_NOT_WRITE'}).status == 401
        assert store.state(today()[:7])['appointments'][0]['notes'] == 'PRIVATE_VISIT_NOTE'
        customer_page.goto(base + f'customer/care/?token={token}', wait_until='networkidle')
        expect(customer_page.locator('.care-site')).to_be_visible()
        expect(customer_page.locator('.sidebar,.mobile-navigation,.owner-auth-panel')).to_have_count(0)
        assert 'PRIVATE_' not in customer_page.locator('body').inner_text()
        assert guardian['phone'] not in customer_page.locator('body').inner_text()

        # A real server 401 locks the UI but keeps the in-progress form mounted.
        page.locator(f'[data-date="{visit["date"]}"]').click()
        panel = page.locator('.calendar-day-panel')
        panel.get_by_role('button', name=f'{pet["name"]} 예약·요금 수정', exact=True).click()
        expect(page.get_by_role('heading', name='예약 수정', exact=True)).to_be_visible()
        notes = page.get_by_label('미용 메모', exact=True)
        draft = '재로그인 후에도 남아 있어야 하는 미용 메모'
        notes.fill(draft)
        clock[0] += 3601
        page.get_by_role('button', name='변경 사항 저장', exact=True).click()
        overlay = page.locator('.owner-auth-overlay')
        expect(overlay).to_be_visible()
        expect(page.locator('.owner-session-private')).to_have_attribute('aria-hidden', 'true')
        assert page.locator('.owner-session-private').evaluate('element=>element.inert')
        expect(page.locator('.owner-session-private').get_by_label('미용 메모', exact=True)).to_have_value(draft)
        assert owner.request.get(base + 'api/state').status == 401
        overlay.get_by_label('사장님 비밀번호', exact=True).fill(password)
        overlay.get_by_role('button', name='로그인', exact=True).click()
        expect(overlay).not_to_be_visible()
        expect(notes).to_be_visible()
        expect(notes).to_have_value(draft)
        page.get_by_role('button', name='변경 사항 저장', exact=True).click()
        expect(page.get_by_role('heading', name='예약 수정', exact=True)).not_to_be_visible()
        assert store.state(today()[:7])['appointments'][0]['notes'] == draft
        latest_cookie = next(cookie for cookie in owner.cookies() if cookie['name'] == 'mongle_owner_session')['value']
        page.get_by_role('button', name='사장님 로그아웃', exact=True).click()
        expect(page.locator('.owner-auth-panel')).to_be_visible()
        expect(page.locator('.owner-session-private')).to_have_count(0)
        expect(page.locator('.month-cells')).to_have_count(0)
        assert owner.request.get(base + 'api/state').status == 401
        assert owner.request.get(base + 'api/state', headers={'Cookie': f'mongle_owner_session={latest_cookie}'}).status == 401
        page.goto(base + 'customer/booking/', wait_until='networkidle')
        expect(page.locator('.public-site')).to_be_visible()
        page.go_back(wait_until='networkidle')
        expect(page.locator('.owner-auth-panel')).to_be_visible()
        expect(page.locator('.month-cells')).to_have_count(0)
        assert customer.request.get(base + f'api/public/care/{token}').status == 200
        page.screenshot(path='/tmp/owner-auth-logged-out.png', animations='disabled')
        assert not errors, errors
        print('PASS real owner sessions, HttpOnly cookie, anonymous/customer API denial, scoped public care, expired-session draft preservation, logout/replay/back-navigation protection')
        customer.close()
        owner.close()
    finally:
        browser.close()
        server.shutdown()
        server.server_close()
        thread.join()
