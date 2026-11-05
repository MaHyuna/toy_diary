"""Desktop month/day workspace and mobile month-to-inline-agenda workflow."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(
    ('127.0.0.1', 0),
    partial(Handler, directory=str(Path(__file__).resolve().parents[1] / 'demo-dist')),
)
threading.Thread(target=server.serve_forever, daemon=True).start()


def assert_previews_fit(page):
    issues = page.locator('.month-day').evaluate_all(r'''cells => cells.flatMap(cell => {
      const box=cell.getBoundingClientRect(), events=[...cell.querySelectorAll('.calendar-cell-event')];
      const count=Number(cell.querySelector('.month-booking-count')?.textContent.replace(/\D/g,'')||0);
      const more=Number(cell.querySelector('.calendar-cell-more')?.textContent.replace(/\D/g,'')||0);
      const badges=events.flatMap(event=>[...event.querySelectorAll('.calendar-cell-more')].filter(more=>{const e=event.getBoundingClientRect(),b=more.getBoundingClientRect();return b.top<e.top-1||b.bottom>e.bottom+1||b.right>e.right+1;}).map(()=>cell.dataset.date+' remaining-count badge clipped'));
      return [...badges,...events.filter(event=>{
        const b=event.getBoundingClientRect();
        return b.top<box.top||b.bottom>box.bottom+1||b.right>box.right+1;
      }).map(()=>cell.dataset.date+' clipped'),
      ...(events.length&&events.length+more!==count?[cell.dataset.date+' incorrect remaining count']:[])];
    })''')
    assert not issues, issues


def assert_no_page_scroll(page):
    dimensions = page.evaluate('''() => ({
      width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
      height:innerHeight, scrollHeight:document.documentElement.scrollHeight,
      scrollY:window.scrollY,
    })''')
    assert dimensions['scrollWidth'] <= dimensions['width'], dimensions
    assert dimensions['scrollHeight'] <= dimensions['height'] + 1, dimensions
    assert dimensions['scrollY'] == 0, dimensions


def assert_caption_clears_add(page):
    floating = page.get_by_role('button', name='예약 등록', exact=True).bounding_box()
    for caption in page.locator('.grooming-calendar-caption > span:visible').all():
        box = caption.bounding_box()
        assert (box['x'] + box['width'] <= floating['x'] + 1
                or box['y'] + box['height'] <= floating['y'] + 1
                or box['y'] >= floating['y'] + floating['height'] - 1), (box, floating)


def assert_agenda_space(page):
    panel = page.locator('.calendar-day-panel').bounding_box()
    header = page.locator('.calendar-day-panel-header').bounding_box()
    body = page.locator('.calendar-day-panel-body').bounding_box()
    assert header['height'] <= 80, (panel, header)
    assert body['height'] >= panel['height'] * .8, (panel, body)


def assert_inline_agenda(page, selected):
    expect(page.locator('.calendar-workspace')).to_have_attribute('data-agenda-open', 'true')
    expect(page.locator('.mobile-day-panel')).to_be_visible()
    expect(page.locator(f'.month-day[data-date="{selected}"]')).to_have_attribute('aria-pressed', 'true')
    # Leading/trailing blanks still belong to the selected seven-day row.
    expect(page.locator('.month-cells > .month-day:visible, .month-cells > .month-blank:visible')).to_have_count(7)
    expect(page.locator('.grooming-day-sheet, .modal')).to_have_count(0)
    assert_no_page_scroll(page)


def expand_month(page, selected):
    page.get_by_role('button', name='월간 펼치기', exact=True).click()
    expect(page.locator('.calendar-workspace')).to_have_attribute('data-agenda-open', 'false')
    expect(page.locator('.mobile-day-panel')).to_have_count(0)
    expect(page.locator(f'.month-day[data-date="{selected}"]')).to_be_focused()
    expect(page.locator('.month-day:visible')).to_have_count(page.locator('.month-day').count())
    assert_no_page_scroll(page)


def assert_visit_layout(panel):
    # Pet/guardian context must retain usable line width, and card actions must
    # never overlap its detail hit area when older styles share these classes.
    issues = panel.locator('.grooming-visit').evaluate_all('''cards => cards.flatMap(card => {
      const open=card.querySelector('.visit-open').getBoundingClientRect();
      const info=card.querySelector('.visit-open-info').getBoundingClientRect();
      const price=card.querySelector('.visit-open-price').getBoundingClientRect();
      const action=card.querySelector('.visit-card-actions').getBoundingClientRect();
      return [...(info.width<100?['pet context too narrow: '+info.width]:[]),
        ...(price.bottom>open.bottom+1?['amount extends outside detail button']:[]),
        ...(action.top<open.bottom-1?['card actions overlap detail button']:[])];
    })''')
    assert not issues, issues


def assert_final_visit_clears_add(page, panel, add, require_scroll=False):
    body = panel.locator('.calendar-day-panel-body')
    body.evaluate('el => el.scrollTop = el.scrollHeight')
    final = body.locator('.grooming-visit').last.bounding_box()
    floating = add.bounding_box()
    assert final['y'] + final['height'] <= floating['y'] - 6, (final, floating)
    if require_scroll:
        assert body.evaluate('el => el.scrollTop > 0'), 'Booking list must scroll inside its panel'


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    context.add_init_script("sessionStorage.setItem('mongle-demo-owner-session','active')")
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'http://127.0.0.1:{server.server_address[1]}/?screen=owner', wait_until='networkidle')
    panel = page.locator('.calendar-day-panel')
    expect(panel).to_be_visible()
    expect(page.locator('.calendar-cell-event').first).to_be_visible()
    month, agenda = page.locator('.month-calendar').bounding_box(), panel.bounding_box()
    assert month['x'] + month['width'] <= agenda['x'] + 1
    assert month['width'] > 600 and agenda['width'] >= 290
    assert_agenda_space(page)

    first = page.locator('.month-day').filter(has=page.locator('.calendar-cell-event')).first
    first.click()
    selected = first.get_attribute('data-date')
    expect(first).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('.grooming-day-sheet')).to_have_count(0)
    expect(panel.locator('.visit-open').first).to_be_visible()
    # The complete card opens detail, including its amount, and returns to this day.
    panel.locator('.visit-open-price b').first.click()
    expect(page.locator('.detail-summary')).to_be_visible()
    page.locator('.modal-close').click()
    expect(panel).to_be_visible()
    expect(page.locator(f'.month-day[data-date="{selected}"]')).to_have_attribute('aria-pressed', 'true')

    # Arrow keys select dates; Enter transfers focus to the inline agenda heading.
    current = page.locator(f'.month-day[data-date="{selected}"]')
    current.focus()
    current.press('ArrowRight')
    new = page.locator('.month-day[aria-pressed="true"]')
    assert new.get_attribute('data-date') != selected
    expect(new).to_be_focused()
    new.press('Enter')
    expect(panel.locator('h2')).to_be_focused()
    chosen = page.locator('.month-day[aria-pressed="true"]').get_attribute('data-date')
    panel.get_by_role('button', name='예약 추가', exact=True).click()
    expect(page.get_by_role('heading', name='새 예약', exact=True)).to_be_visible()
    expect(page.get_by_label('예약 날짜', exact=False)).to_have_value(chosen)
    page.locator('.modal-close').click()
    first.click()
    assert_previews_fit(page)
    page.screenshot(path='/tmp/owner-after-desktop.png', animations='disabled')

    # Cross-month movement also restores focus after loading the other month.
    last = page.locator('.month-day').last
    last_date = last.get_attribute('data-date')
    last.focus()
    last.press('ArrowRight')
    expect(page.locator('.month-day[aria-pressed="true"]')).to_be_focused()
    assert page.locator('.month-day[aria-pressed="true"]').get_attribute('data-date')[:7] != last_date[:7]
    page.locator('.month-day[aria-pressed="true"]').press('ArrowLeft')
    expect(page.locator(f'.month-day[data-date="{last_date}"]')).to_be_focused()
    first.click()
    page.set_viewport_size({'width': 1920, 'height': 1080})
    page.wait_for_timeout(200)
    assert_previews_fit(page)
    assert_no_page_scroll(page)
    page.screenshot(path='/tmp/owner-after-wide.png', animations='disabled')
    for width, height in [(1100, 800), (1366, 768), (1366, 900), (1440, 800)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(200)
        expect(panel).to_be_visible()
        assert_agenda_space(page)
        assert_previews_fit(page)
        assert_no_page_scroll(page)
        assert_final_visit_clears_add(page, panel, panel.get_by_role('button', name='예약 추가', exact=True))
        if (width, height) == (1366, 900):
            page.screenshot(path='/tmp/owner-after-1366x900.png', animations='disabled')

    # Each narrow viewport starts with the whole month, then compacts to one week
    # above the day list. The document itself never becomes the scroll container.
    for width, height in [(320, 667), (360, 740), (390, 844), (768, 900)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.reload(wait_until='networkidle')
        expect(page.locator('.calendar-workspace')).to_have_attribute('data-agenda-open', 'false')
        expect(page.locator('.mobile-day-panel')).to_have_count(0)
        expect(page.locator('.month-day:visible')).to_have_count(page.locator('.month-day').count())
        expect(page.locator('.calendar-cell-event')).to_have_count(0)
        assert_no_page_scroll(page)
        assert_caption_clears_add(page)
        page.screenshot(path=f'/tmp/owner-after-month-{width}x{height}.png', animations='disabled')
        today = page.locator('.month-day.is-current')
        selected = today.get_attribute('data-date')
        today.click()
        assert_inline_agenda(page, selected)
        mobile_panel = page.locator('.mobile-day-panel')
        expect(mobile_panel.locator('.grooming-visit')).to_have_count(4)
        assert_visit_layout(mobile_panel)
        mobile_panel.locator('.visit-open-price b').first.click()
        expect(page.locator('.detail-summary')).to_be_visible()
        page.locator('.modal-close').click()
        assert_inline_agenda(page, selected)
        mobile_panel.locator('.visit-open time').first.click()
        expect(page.locator('.detail-summary')).to_be_visible()
        page.locator('.modal-close').click()
        assert_inline_agenda(page, selected)
        assert_final_visit_clears_add(page, mobile_panel, page.get_by_role('button', name='예약 등록', exact=True), require_scroll=True)
        page.screenshot(path=f'/tmp/owner-after-agenda-{width}x{height}.png', animations='disabled')
        expand_month(page, selected)

    # Saving an edited appointment preserves both the selected day and inline list.
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('.month-day.is-current').click()
    selected = page.locator('.month-day.is-current').get_attribute('data-date')
    edit_button = page.locator('.mobile-day-panel').get_by_role('button', name='예약·요금 수정', exact=False).first
    edit_button.click()
    form = page.locator('.appointment-form')
    name = form.get_by_label('반려견 이름', exact=False).input_value()
    original_price = form.get_by_label('예상 총금액 (원)', exact=True).input_value()
    form.get_by_label('미용 메모', exact=True).fill('인라인 일정 수정 저장 확인')
    form.get_by_role('button', name='변경 사항 저장', exact=True).click()
    expect(form).to_have_count(0)
    assert_inline_agenda(page, selected)
    expect(page.locator('.mobile-day-panel .grooming-visits')).to_contain_text('인라인 일정 수정 저장 확인')
    saved = page.evaluate('(name) => JSON.parse(localStorage.getItem("mongle-demo-v1")).data.appointments.find(a=>a.dogName===name && a.notes==="인라인 일정 수정 저장 확인")', name)
    assert saved['date'] == selected and saved['price'] == int(original_price), saved

    # The global + uses the selected date; successful creation stays on that list.
    expand_month(page, selected)
    empty_day = page.locator('.month-day').filter(has_not=page.locator('.month-day-bookings')).first
    empty_date = empty_day.get_attribute('data-date')
    empty_day.click()
    page.get_by_role('button', name='예약 등록', exact=True).click()
    expect(form.get_by_label('예약 날짜', exact=False)).to_have_value(empty_date)
    form.get_by_label('반려견 이름', exact=False).fill('인라인 등록 확인')
    form.get_by_label('보호자 이름', exact=False).fill('테스트 보호자')
    form.get_by_label('예약 시간', exact=False).fill('10:00')
    form.get_by_role('button', name='예약 등록', exact=True).click()
    expect(form).to_have_count(0)
    assert_inline_agenda(page, empty_date)
    expect(page.locator('.mobile-day-panel .visit-open')).to_contain_text('인라인 등록 확인')
    expect(page.locator(f'.month-day[data-date="{empty_date}"] .month-booking-count')).to_have_text('1건')

    # A six-row month must still fit, and expanding retains the selected date focus.
    for width, height in [(320, 667), (360, 740), (390, 667), (768, 900)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.locator('#month').fill('2026-08')
        if page.locator('.calendar-workspace').get_attribute('data-agenda-open') == 'true':
            expand_month(page, page.locator('.month-day[aria-pressed="true"]').get_attribute('data-date'))
        assert_caption_clears_add(page)
        expect(page.locator('.month-cells')).to_have_attribute('data-weeks', '6')
        expect(page.locator('.month-cells > .month-day:visible, .month-cells > .month-blank:visible')).to_have_count(42)
        assert_no_page_scroll(page)
        final_date = page.locator('.month-day[data-date="2026-08-31"]')
        final_box, nav = final_date.bounding_box(), page.locator('.mobile-navigation').bounding_box()
        available_bottom = nav['y'] if nav else height
        assert final_box['y'] + final_box['height'] <= available_bottom + 1, (final_box, nav)
        final_date.click()
        assert_inline_agenda(page, '2026-08-31')
        expand_month(page, '2026-08-31')
        if (width, height) == (390, 667):
            page.screenshot(path='/tmp/owner-after-mobile.png', animations='disabled')

    page.emulate_media(reduced_motion='reduce')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    expect(panel).to_be_visible()
    # A populated six-week month adapts previews to short desktop cells.
    page.evaluate('''() => {
      const k='mongle-demo-v1', w=JSON.parse(localStorage.getItem(k)), date=w.data.appointments[0].date;
      w.data.appointments=w.data.appointments.filter(a=>a.date===date).map(a=>({...a,date:'2026-08-15',paidDate:a.paidDate?'2026-08-15':null}));
      localStorage.setItem(k,JSON.stringify(w));
    }''')
    page.reload(wait_until='networkidle')
    page.locator('#month').fill('2026-08')
    expect(page.locator('[data-date="2026-08-15"] .month-booking-count')).to_be_visible()
    for width, height in [(1440, 1000), (1440, 800), (1100, 800)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(200)
        assert_previews_fit(page)
        assert_no_page_scroll(page)

    # Payments arriving on a different day remain visible even without appointments.
    payment = page.evaluate('''() => {
      const k='mongle-demo-v1',w=JSON.parse(localStorage.getItem(k)),v=w.data.appointments[0],month=v.date.slice(0,7),target=month+'-02';
      w.data.appointments=w.data.appointments.filter(a=>a.date!==target&&a.paidDate!==target&&a.id!==v.id);
      w.data.appointments.push({...v,date:month+'-01',paidDate:target,paymentStatus:'paid',status:'completed',paymentMethod:'card'});
      localStorage.setItem(k,JSON.stringify(w));return {date:target,price:v.price};
    }''')
    payment_date = payment['date']
    page.reload(wait_until='networkidle')
    page.locator('#month').fill(payment_date[:7])
    page.locator(f'.month-day[data-date="{payment_date}"]').click()
    expect(panel.locator('.visit-open')).to_have_count(0)
    expect(panel.locator('.day-payment-row')).to_have_count(1)
    expect(panel.locator('.day-payment-row')).to_contain_text(f"{payment['price']:,}원")
    expect(panel.locator('.calendar-no-visits')).to_contain_text('이날 방문 예약은 없어요')
    assert not errors, errors
    print('PASS desktop previews/keyboard/inline day panel; 320/360/390/768 full month → selected week + inline agenda; detail return, selected-date creation/edit save, list scroll/FAB clearance, six-week no-scroll and payment-only dates')
    browser.close()
server.shutdown()
