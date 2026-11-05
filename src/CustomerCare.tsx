import { appUrl } from './routes';
import { ShopNoticeBoard } from './ShopNotices';
import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Camera, ChevronRight, Download, Heart, LoaderCircle, PawPrint, RotateCw, Scissors, X } from 'lucide-react';
import { api } from './types';
import type { PublicCareHistoryItem, PublicCareReport } from './types';
import { isDemo } from './runtime';
import { downloadCareReport } from './care';

type CarePhoto = PublicCareReport['photos'][number];
type CareResponse = { report: PublicCareReport; history: PublicCareHistoryItem[] };
const dayLabel = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
}).format(new Date(`${value}T12:00:00Z`));
const photoLabel = (photo: CarePhoto) => `${photo.stage === 'before' ? '미용 전' : '미용 후'}${photo.caption ? ` · ${photo.caption}` : ' 사진'}`;

function WeightHistory({report, visits}: {report: PublicCareReport; visits: PublicCareHistoryItem[]}) {
  const older = visits.find(visit => visit.date < report.date && typeof visit.weight === 'number');
  const difference = report.weight !== null && older && typeof older.weight === 'number'
    ? Math.round((report.weight - older.weight) * 100) / 100 : null;
  return <section className="care-report-section notebook-weight" aria-label="방문별 몸무게 기록">
    <div className="notebook-weight-heading"><div><h2>몸무게 기록</h2><p>선택한 방문 당시의 몸무게</p></div><strong>{report.weight === null ? '미기록' : <>{report.weight}<small> kg</small></>}</strong></div>
    {difference !== null && <p className="notebook-weight-difference">{older!.date} 기록 대비 {difference > 0 ? '+' : ''}{difference}kg</p>}
    <p className="notebook-weight-caption">공개된 방문 기록을 기준으로 표시해요. 기록이 없는 날은 비워 둡니다.</p>
    {visits.length > 1 && <details><summary>지난 몸무게 함께 보기</summary><table><thead><tr><th scope="col">방문일</th><th scope="col">몸무게</th></tr></thead><tbody>{visits.map(visit=><tr key={visit.id}><td><time dateTime={visit.date}>{visit.date}</time></td><td>{typeof visit.weight === 'number' ? `${visit.weight}kg` : '미기록'}</td></tr>)}</tbody></table></details>}
  </section>;
}

function CareHistory({ visits, selectedId, onSelect }: { visits: PublicCareHistoryItem[]; selectedId: string; onSelect: (visit: PublicCareHistoryItem) => void }) {
  const id = useId();
  if (visits.length < 2) return null;
  return <section className="care-report-section care-report-history" aria-labelledby={id}>
    <h2 id={id}>지난 관리 기록 <small>{visits.length}회</small></h2>
    <div>{visits.map(visit => <button type="button" key={visit.id} aria-pressed={visit.id === selectedId} aria-label={`${dayLabel(visit.date)} ${visit.service} 관리 기록 보기`} onClick={() => onSelect(visit)}>
      <span><time dateTime={visit.date}>{dayLabel(visit.date)}</time><span>{visit.service}{typeof visit.weight === 'number' ? ` · ${visit.weight}kg` : ''}</span></span><ChevronRight size={18} aria-hidden="true" />
    </button>)}</div>
  </section>;
}

/** Public presentation consumes the published snapshot, never the owner's live records. */
export function CareReportView({ report, history = [], onSelect }: {
  report: PublicCareReport;
  history?: PublicCareHistoryItem[];
  onSelect?: (report: PublicCareHistoryItem) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const photoTrigger = useRef<HTMLButtonElement | null>(null);
  const dialogTitle = useId();
  const [viewing, setViewing] = useState<CarePhoto | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const before = report.photos.filter(photo => photo.stage === 'before');
  const after = report.photos.filter(photo => photo.stage === 'after');
  const avatar = after[0] ?? before[0];
  // The server authorizes this collection. This extra filter also keeps previews scoped to one pet.
  const visits = [...new Map(history
    .filter(item => item.id === report.id || !!report.petId && item.petId === report.petId)
    .map(item => [item.id, item])).values()].sort((a, b) => b.date.localeCompare(a.date));

  useEffect(() => {
    setDownloadError('');
    setViewing(null);
  }, [report.id]);
  useEffect(() => {
    const element = dialog.current;
    if (!viewing || !element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      photoTrigger.current?.focus({ preventScroll: true });
    };
  }, [viewing]);

  function selectVisit(visit: PublicCareHistoryItem) {
    if (!onSelect || visit.id === report.id) return;
    onSelect(visit);
  }
  async function saveReport() {
    if (downloading) return;
    setDownloading(true); setDownloadError('');
    try { await downloadCareReport(report); }
    catch { setDownloadError('기록 파일을 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setDownloading(false); }
  }
  function photoStage(stage: 'before' | 'after', photos: CarePhoto[], notes: string) {
    const label = stage === 'before' ? '미용 전' : '미용 후';
    return <section className={`care-report-photo-stage care-report-photo-stage-${stage}`} aria-label={label}>
      <h3>{label}</h3>
      {photos.length ? <div className="care-photo-grid">{photos.map(photo => <figure key={photo.id}>
        <button type="button" className="care-photo-button" aria-label={`${photoLabel(photo)} 크게 보기`} onClick={event => { photoTrigger.current = event.currentTarget; setViewing(photo); }}>
          <img src={photo.src} alt={photoLabel(photo)} loading="lazy" decoding="async" />
        </button>
        {photo.caption && <figcaption>{photo.caption}</figcaption>}
      </figure>)}</div> : <div className="care-photo-empty"><Camera size={23} aria-hidden="true" /><span>등록된 사진이 없어요</span></div>}
      {notes.trim() && <p className="care-report-stage-note">{notes}</p>}
    </section>;
  }

  return <article className="care-report">
    <header className="care-report-hero">
      <div className="care-report-avatar">{avatar
        ? <img src={avatar.src} alt={`${report.dogName} 미용 사진`} decoding="async" />
        : <PawPrint size={34} aria-hidden="true" />}</div>
      <div><p className="care-report-eyebrow">우리 아이 미용관리 수첩</p><h1 tabIndex={-1}>{report.dogName}</h1><p className="care-report-pet-meta">{report.breed || '견종 미등록'}{report.weight !== null ? ` · ${report.weight}kg` : ''}</p></div>
    </header>
    <div className="care-report-meta"><time dateTime={report.date}><CalendarDays size={16} aria-hidden="true" />{dayLabel(report.date)}</time><span><Scissors size={16} aria-hidden="true" />{report.service}</span></div>

    <WeightHistory report={report} visits={visits.length ? visits : [{...report, shareToken: ''}]} />

    <section className="care-report-section care-report-photos" aria-labelledby={`${dialogTitle}-photos`}>
      <div className="care-report-section-heading"><h2 id={`${dialogTitle}-photos`}>미용 전·후 기록</h2><span>사진을 누르면 크게 볼 수 있어요</span></div>
      <div className="care-report-photo-comparison">
        {photoStage('before', before, report.beforeNotes)}
        {photoStage('after', after, report.afterNotes)}
      </div>
    </section>

    <section className="care-report-section care-report-opinion" aria-labelledby={`${dialogTitle}-opinion`}>
      <h2 id={`${dialogTitle}-opinion`}>미용사의 소견</h2>
      <p className={`care-report-copy${report.groomerOpinion.trim() ? '' : ' is-empty'}`}>{report.groomerOpinion || '등록된 소견이 없어요.'}</p>
    </section>
    <section className="care-report-section care-report-homecare" aria-labelledby={`${dialogTitle}-homecare`}>
      <h2 id={`${dialogTitle}-homecare`}><Heart size={18} aria-hidden="true" />집에서 이렇게 관리해 주세요</h2>
      <p className={`care-report-copy${report.homeCare.trim() ? '' : ' is-empty'}`}>{report.homeCare || '별도로 등록된 관리 안내가 없어요.'}</p>
    </section>
    {report.nextVisitDate && <section className="care-report-nextvisit" aria-label="다음 권장 방문일">
      <CalendarDays size={22} aria-hidden="true" /><div><span>다음 권장 방문일</span><time dateTime={report.nextVisitDate}>{dayLabel(report.nextVisitDate)}</time><p>예약 일정은 매장과 확인해 주세요.</p></div>
    </section>}

    {onSelect && <CareHistory visits={visits} selectedId={report.id} onSelect={selectVisit} />}
    <div className="care-report-actions"><button type="button" disabled={downloading} onClick={() => void saveReport()}>{downloading ? <LoaderCircle size={18} className="spin" /> : <Download size={18} />}기록 파일 저장</button>{downloadError && <p className="care-error" role="alert">{downloadError}</p>}</div>
    <p className="care-report-published">매장에서 공개한 미용·관리 안내입니다.</p>

    {viewing && <dialog className="care-photo-lightbox" ref={dialog} aria-labelledby={dialogTitle} onCancel={event => { event.preventDefault(); setViewing(null); }} onClose={() => setViewing(null)} onClick={event => { if (event.target === event.currentTarget) setViewing(null); }}>
      <div className="care-photo-lightbox-heading"><h2 id={dialogTitle}>{photoLabel(viewing)}</h2><button type="button" aria-label="사진 닫기" onClick={() => setViewing(null)}><X size={22} /></button></div>
      <img className="care-photo-full" src={viewing.src} alt={photoLabel(viewing)} />
      <a className="care-photo-download" href={viewing.src} download={`${report.dogName}-${report.date}-${viewing.stage}.jpg`}><Download size={17} />사진 저장</a>
    </dialog>}
  </article>;
}

export function CustomerCare() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const validToken = /^[A-Za-z0-9_-]{32,128}$/.test(token);
  const main = useRef<HTMLElement>(null);
  const moveToReport = useRef(false);
  const [report, setReport] = useState<PublicCareReport | null>(null);
  const [history, setHistory] = useState<PublicCareHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(validToken);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setReport(null); setFailed(false);
    if (!validToken) { setHistory([]); setLoading(false); return () => { active = false; }; }
    setLoading(true);
    api<CareResponse>(`/public/care/${encodeURIComponent(token)}`).then(result => {
      if (active) {
        setReport(result.report); setSelectedId(result.report.id);
        setHistory(result.history.filter(item => item.id === result.report.id || !!result.report.petId && item.petId === result.report.petId).sort((a, b) => b.date.localeCompare(a.date)));
      }
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, validToken, retry]);
  useEffect(() => {
    if (loading || !report || !moveToReport.current) return;
    moveToReport.current = false;
    requestAnimationFrame(() => {
      main.current?.querySelector<HTMLHeadingElement>('.care-report-hero h1')?.focus({ preventScroll: true });
      main.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }, [loading, report]);
  function selectVisit(visit: PublicCareHistoryItem) {
    if (visit.id === selectedId && report) return;
    moveToReport.current = true;
    setReport(null); setLoading(true); setFailed(false); setSelectedId(visit.id);
    if (visit.shareToken === token) setRetry(value => value + 1);
    else setToken(visit.shareToken);
    const location = new URL(window.location.href);
    location.searchParams.set('token', visit.shareToken);
    window.history.replaceState(null, '', location);
  }
  return <div className="care-site">
    <header className="care-site-header"><a href={appUrl('home', token ? {token} : {})}><PawPrint size={23} aria-hidden="true" /><strong>몽글 · 미용수첩</strong></a><a href={appUrl('booking')}>다음 미용 예약</a></header>
    {isDemo && <p className="care-demo-notice">공유 체험 · 이 링크는 현재 브라우저에 저장된 공개 기록을 보여줘요. 다른 기기로 전달하려면 기록 파일을 저장해 주세요.</p>}
    <main ref={main}>
      <ShopNoticeBoard />
      {!token && <section className="care-empty care-status"><PawPrint size={40} aria-hidden="true" /><h1>우리 아이의 케어 노트</h1><p>매장에서 전달받은 기록 링크를 열면<br />미용 전후 사진과 관리 안내를 확인할 수 있어요.</p></section>}
      {loading && <section className="care-loading care-status" role="status"><LoaderCircle size={26} className="spin" aria-hidden="true" /><p>케어 기록을 불러오고 있어요…</p></section>}
      {!!token && (!validToken || failed) && <section className="care-error-state care-status" role="alert"><PawPrint size={36} aria-hidden="true" /><h1>기록을 확인할 수 없어요</h1><p>매장에서 받은 링크를 확인해 주세요.<br />공개가 중단된 기록은 열리지 않아요.</p>{validToken && <button type="button" onClick={() => setRetry(value => value + 1)}><RotateCw size={17} />다시 확인</button>}</section>}
      {!loading && !failed && report && <CareReportView report={report} history={history} onSelect={selectVisit} />}
      {(loading || failed) && history.length > 1 && <div className="care-report care-status-history"><CareHistory visits={history} selectedId={selectedId} onSelect={selectVisit} /></div>}
    </main>
    <nav className="notebook-care-nav" aria-label="수첩 메뉴"><a href={appUrl('home')}>다른 수첩 열기</a><a href={appUrl('booking')}>미용 예약</a><a href={appUrl('prices')}>요금표</a></nav>
  </div>;
}
