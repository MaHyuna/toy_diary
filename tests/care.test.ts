import assert from 'node:assert/strict';
import test from 'node:test';
import { careReportFile, careReportHtml } from '../src/care.ts';
import type { PublicCareReport } from '../src/types.ts';

const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
const report: PublicCareReport = {
  id: 'visit-public', petId: 'pet-public', dogName: '테스트 두부', breed: '말티즈', weight: 3.2,
  date: '2026-11-05', service: '전체 미용', beforeNotes: '발가락 사이의 털 확인', afterNotes: '발끝과 얼굴 정리',
  groomerOpinion: '드라이할 때 쉬는 시간을 가졌어요.', homeCare: '산책 후 발을 잘 말려 주세요.\n빗질은 천천히 해 주세요.',
  nextVisitDate: '2026-12-10', publishedAt: '2026-11-05T09:00:00Z',
  photos: [{ id: 'before', src: jpeg, caption: '미용 전 상태', stage: 'before' }, { id: 'after', src: jpeg, caption: '미용 후 모습', stage: 'after' }],
};

test('portable care report includes explicit public care content and embedded photos', () => {
  const html = careReportHtml(report);
  for (const text of [report.dogName, report.beforeNotes, report.afterNotes, report.groomerOpinion, report.homeCare, report.nextVisitDate]) assert.ok(html.includes(text));
  assert.equal((html.match(/<img\b/g) ?? []).length, 2);
  assert.equal((html.match(/src="data:image\/jpeg;base64,/g) ?? []).length, 2);
  assert.match(html, /권장일은 예약 확정일이 아니에요/);
  assert.match(html, /white-space:pre-wrap/);
});

test('customer export never serializes internal appointment or guardian fields', () => {
  const enriched = { ...report, price: 'PRIVATE_PRICE_937127', phone: 'PRIVATE_PHONE_01099998888',
    guardianName: 'PRIVATE_GUARDIAN', notes: 'PRIVATE_INTERNAL_NOTE', allergies: 'PRIVATE_MASTER_RECORD',
    shareToken: 'PRIVATE_BEARER_TOKEN', unpublishedDraft: 'PRIVATE_DRAFT' };
  const html = careReportHtml(enriched);
  assert.ok(!html.includes('PRIVATE_'));
  assert.ok(!html.includes(report.id));
  assert.ok(!html.includes(report.petId!));
});

test('all report text and captions are escaped instead of becoming executable markup', () => {
  const attack = `</title><script>window.attack=1</script><img src=x onerror="alert('x')">&`;
  const hostile = { ...report, dogName: attack, breed: attack, service: attack, date: attack,
    beforeNotes: attack, afterNotes: attack, groomerOpinion: attack, homeCare: attack, nextVisitDate: attack,
    photos: [{ ...report.photos[0], caption: attack }] };
  const html = careReportHtml(hostile);
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&quot;'));
  assert.ok(html.includes('&#39;'));
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /img-src data:/);
  assert.match(html, /form-action 'none'/);
});

test('portable report rejects remote, SVG, and attribute-injection image sources', () => {
  const html = careReportHtml({ ...report, photos: [report.photos[0],
    { id: 'remote', src: 'https://invalid.test/private.jpg', caption: 'remote', stage: 'after' },
    { id: 'svg', src: 'data:image/svg+xml;base64,PHN2Zz4=', caption: 'svg', stage: 'after' },
    { id: 'attribute', src: `${jpeg}" onerror="alert(1)`, caption: 'attribute', stage: 'after' },
  ] });
  assert.equal((html.match(/<img\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /invalid\.test|image\/svg|onerror=/);
  assert.doesNotMatch(html, /<script\b|<iframe\b|<form\b/i);
});

test('customer download is a self-contained HTML file with a safe readable filename', async () => {
  const file = careReportFile({ ...report, dogName: '../테스트:"두부"\u0000' });
  assert.ok(file.name.endsWith('-2026-11-05-케어기록.html'));
  assert.doesNotMatch(file.name, /[\\/:*?"<>|\u0000-\u001f]/);
  assert.equal(file.type, 'text/html;charset=utf-8');
  assert.ok((await file.text()).includes(report.homeCare));
});
