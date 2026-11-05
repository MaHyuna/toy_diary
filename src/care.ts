import type { PublicCareReport } from './types';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const textSection = (title: string, value: string) => value.trim() ? `<section><h2>${title}</h2><p>${escapeHtml(value)}</p></section>` : '';

/** A portable, script-free copy of the explicit public snapshot, never owner state. */
export function careReportHtml(report: PublicCareReport) {
  const photos = (stage: 'before' | 'after') => report.photos.filter(photo => photo.stage === stage && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo.src)).map(photo =>
    `<figure><img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption || (stage === 'before' ? '미용 전' : '미용 후'))}"><figcaption>${escapeHtml(photo.caption)}</figcaption></figure>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(report.dogName)}의 미용 케어 기록</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f8f6f5;color:#352b32;font:15px/1.75 system-ui,sans-serif}main{max-width:800px;margin:auto;padding:32px 20px 48px}header{padding:12px 0 24px;border-bottom:1px solid #e7dfe3}header small{color:#70445c}h1{font-size:28px;line-height:1.4;margin:8px 0}h2{font-size:17px;margin:0 0 12px}p{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}section{padding:24px 0;border-bottom:1px solid #e7dfe3}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:8px 0}img{display:block;width:100%;max-height:420px;object-fit:contain;background:#f1ebee;border-radius:10px}figcaption{font-size:12px;color:#766570;overflow-wrap:anywhere}.home{border-left:3px solid #865b72;padding-left:16px}footer{font-size:12px;color:#766570;margin-top:24px}@media(max-width:440px){main{padding:20px 16px}h1{font-size:24px}.comparison{gap:10px}}@media print{body{background:#fff}section,figure{break-inside:avoid}}
  </style></head><body><main><header><small>미용 케어 기록</small><h1>${escapeHtml(report.dogName)}</h1><p>${escapeHtml(report.date)} · ${escapeHtml(report.service)}</p><p>${escapeHtml(report.breed)}${report.weight === null ? '' : ` · ${escapeHtml(String(report.weight))}kg`}</p></header>
  <section><div class="comparison"><div><h2>미용 전</h2>${photos('before')}<p>${escapeHtml(report.beforeNotes || '등록한 상태 설명이 없어요.')}</p></div><div><h2>미용 후</h2>${photos('after')}<p>${escapeHtml(report.afterNotes || '등록한 작업 결과가 없어요.')}</p></div></div></section>
  ${textSection('미용사의 소견', report.groomerOpinion)}${report.homeCare.trim() ? `<div class="home">${textSection('집에서 관리해 주세요', report.homeCare)}</div>` : ''}
  ${report.nextVisitDate ? textSection('다음 방문 권장일', `${report.nextVisitDate}\n권장일은 예약 확정일이 아니에요.`) : ''}
  <footer>매장에서 보호자에게 공개한 기록의 사본입니다. 작성 이후 내용이 바뀌어도 이 파일은 자동으로 갱신되지 않습니다.</footer></main></body></html>`;
}

export function careReportFile(report: PublicCareReport) {
  const fileName = `${report.dogName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 60)}-${report.date}-케어기록.html`;
  return new File([careReportHtml(report)], fileName, { type: 'text/html;charset=utf-8' });
}

export function downloadCareReport(report: PublicCareReport) {
  const file = careReportFile(report);
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
