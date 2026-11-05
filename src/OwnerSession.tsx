import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { ArrowRight, LoaderCircle, LockKeyhole, PawPrint, RotateCw } from 'lucide-react';
import { isDemo } from './runtime';
import './auth.css';

const DEMO_SESSION = 'mongle-demo-owner-session';
const PENDING_LOGOUT = 'mongle-owner-logout-pending';
type Session = { authenticated: boolean; role: 'owner' | null; configured: boolean };
type Status = 'checking' | 'authenticated' | 'anonymous' | 'expired' | 'unconfigured' | 'error';
const remember = (key: string, value?: string) => {
  try { if (value === undefined) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* Navigation remains usable if storage is unavailable. */ }
};
const recalled = (key: string) => { try { return sessionStorage.getItem(key); } catch { return null; } };

async function sessionRequest(path: string, body?: { password: string } | Record<string, never>, signal?: AbortSignal): Promise<Session> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new Error('연결을 확인한 뒤 다시 시도해 주세요.');
  }
  const data = await response.json().catch(() => { throw new Error('로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.'); });
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : '로그인하지 못했어요. 다시 시도해 주세요.');
  if (typeof data?.authenticated !== 'boolean' || typeof data?.configured !== 'boolean' || !['owner', null].includes(data.role)) throw new Error('로그인 상태를 확인하지 못했어요.');
  return { authenticated: data.authenticated && data.role === 'owner', role: data.role, configured: data.configured };
}

/** Server sessions authorize production APIs; the Pages mode is only an explicit sample-data preview. */
export function OwnerSession({ children, customerUrl = './?screen=booking' }: { children: ReactNode; customerUrl?: string }) {
  const initialDemo = isDemo && recalled(DEMO_SESSION) === 'active';
  const [status, setStatus] = useState<Status>(initialDemo ? 'authenticated' : isDemo ? 'anonymous' : 'checking');
  const [opened, setOpened] = useState(initialDemo);
  const [configured, setConfigured] = useState(isDemo);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingLogout, setPendingLogout] = useState(!isDemo && recalled(PENDING_LOGOUT) === 'pending');
  const [retry, setRetry] = useState(0);
  const operation = useRef(false);
  const generation = useRef(0);
  const openedRef = useRef(opened);
  const authenticatedRef = useRef(status === 'authenticated');
  const restoreFocus = useRef<HTMLElement | null>(null);
  const privateView = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const authenticated = status === 'authenticated';
  const reauth = opened && !authenticated;
  openedRef.current = opened;
  authenticatedRef.current = authenticated;

  const applySession = useCallback((session: Session) => {
    setConfigured(session.configured);
    if (session.authenticated && session.configured) {
      setOpened(true); setStatus('authenticated');
    } else setStatus(!session.configured ? 'unconfigured' : openedRef.current ? 'expired' : 'anonymous');
  }, []);

  useEffect(() => {
    if (isDemo) return;
    const controller = new AbortController();
    const sequence = ++generation.current;
    const logoutFirst = recalled(PENDING_LOGOUT) === 'pending';
    setStatus('checking'); setError('');
    void sessionRequest(logoutFirst ? 'logout' : 'session', logoutFirst ? {} : undefined, controller.signal).then(session => {
      if (sequence !== generation.current) return;
      if (logoutFirst) { remember(PENDING_LOGOUT); setPendingLogout(false); }
      applySession(session);
    }).catch(cause => {
      if (controller.signal.aborted || sequence !== generation.current) return;
      setStatus('error'); setError(cause instanceof Error ? cause.message : '로그인 상태를 확인하지 못했어요.');
    });
    return () => controller.abort();
  }, [applySession, retry]);

  const logout = useCallback(async () => {
    if (operation.current) return;
    operation.current = true;
    ++generation.current;
    restoreFocus.current = null;
    setPassword(''); setError(''); setOpened(false); setStatus('anonymous');
    remember(DEMO_SESSION);
    if (isDemo) { operation.current = false; return; }
    remember(PENDING_LOGOUT, 'pending'); setPendingLogout(true); setBusy(true);
    try {
      const session = await sessionRequest('logout', {});
      remember(PENDING_LOGOUT); setPendingLogout(false);
      applySession({ ...session, authenticated: false, role: null });
    } catch (cause) {
      setError(cause instanceof Error ? `${cause.message} 로그아웃을 완료하지 못했어요.` : '로그아웃을 완료하지 못했어요. 다시 시도해 주세요.');
      setStatus('error');
    } finally { operation.current = false; setBusy(false); }
  }, [applySession]);

  useEffect(() => {
    const expired = () => {
      if (!authenticatedRef.current) return;
      ++generation.current;
      restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPassword(''); setError(''); setStatus('expired');
      if (isDemo) remember(DEMO_SESSION);
    };
    const requestedLogout = () => { void logout(); };
    const recheck = () => {
      if (isDemo || document.visibilityState !== 'visible' || !authenticatedRef.current || operation.current) return;
      const sequence = generation.current;
      void sessionRequest('session').then(session => {
        if (sequence !== generation.current || !authenticatedRef.current) return;
        if (!session.authenticated) expired();
        setConfigured(session.configured);
      }).catch(() => { /* A failed read cannot extend or grant a server session. API calls still enforce authorization. */ });
    };
    window.addEventListener('owner-session-expired', expired);
    window.addEventListener('owner-logout', requestedLogout);
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('owner-session-expired', expired);
      window.removeEventListener('owner-logout', requestedLogout);
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [logout]);

  useEffect(() => {
    const conceal = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && privateView.current?.contains(active)) restoreFocus.current = active;
      // Hide before the browser stores a history snapshot, rather than waiting for React after restoration.
      privateView.current?.setAttribute('data-suspended', 'true');
    };
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (isDemo) {
        if (recalled(DEMO_SESSION) === 'active') {
          privateView.current?.removeAttribute('data-suspended');
          setOpened(true); setStatus('authenticated');
        } else {
          setPassword(''); setOpened(false); setStatus('anonymous');
        }
        return;
      }
      // The initial-check effect also honors a failed logout marker before checking a session.
      setStatus('checking'); setPassword(''); setError('');
      setRetry(value => value + 1);
    };
    window.addEventListener('pagehide', conceal);
    window.addEventListener('pageshow', restore);
    return () => { window.removeEventListener('pagehide', conceal); window.removeEventListener('pageshow', restore); };
  }, []);

  useEffect(() => {
    if (authenticated) {
      privateView.current?.removeAttribute('data-suspended');
      const previous = restoreFocus.current;
      if (previous?.isConnected) requestAnimationFrame(() => previous.focus({ preventScroll: true }));
      restoreFocus.current = null;
      return;
    }
    if (status === 'checking') return;
    // Re-authentication takes focus without summoning a mobile keyboard over the form.
    if (window.matchMedia('(max-width: 760px)').matches || isDemo || !configured) panel.current?.focus({ preventScroll: true });
    else passwordInput.current?.focus({ preventScroll: true });
  }, [authenticated, configured, status]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (operation.current || pendingLogout) return;
    operation.current = true; setBusy(true); setError('');
    const sequence = ++generation.current;
    const restored = openedRef.current;
    try {
      if (isDemo) { remember(DEMO_SESSION, 'active'); setOpened(true); setStatus('authenticated'); }
      else {
        const session = await sessionRequest('login', { password });
        if (sequence !== generation.current) return;
        if (!session.authenticated || !session.configured) throw new Error('사장님 계정으로 로그인하지 못했어요.');
        applySession(session);
      }
      setPassword('');
      if (restored) window.dispatchEvent(new Event('owner-session-restored'));
    } catch (cause) {
      if (sequence === generation.current) setError(cause instanceof Error ? cause.message : '로그인하지 못했어요.');
    } finally { operation.current = false; setBusy(false); }
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!reauth) return;
    // An expired session cannot be dismissed into a still-mounted private form.
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
    if (event.key !== 'Tab') return;
    const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled]), a[href]') ?? []).filter(element => element.getClientRects().length);
    if (!elements.length) { event.preventDefault(); panel.current?.focus(); return; }
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }

  const title = isDemo ? '사장님 화면 체험' : status === 'unconfigured' ? '사장님 로그인 설정이 필요해요' : reauth ? '다시 로그인해 주세요' : '사장님 로그인';
  return <>
    {opened && <div ref={privateView} className="owner-session-private" inert={!authenticated} aria-hidden={!authenticated}>{children}</div>}
    {!authenticated && <div className={`owner-auth-shell${reauth ? ' owner-auth-overlay' : ''}`}>
      <div ref={panel} className="owner-auth-panel" role={reauth ? 'dialog' : undefined} aria-modal={reauth || undefined} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} tabIndex={-1} onKeyDown={trapFocus}>
        <div className="owner-auth-brand"><span><PawPrint size={24} /></span><strong>몽글</strong></div>
        <span className="owner-auth-eyebrow"><LockKeyhole size={14} />사장님 전용</span>
        <h1 id={`${id}-title`}>{title}</h1>
        <p id={`${id}-description`}>{isDemo ? '예시 데이터로 예약과 고객 관리 기능을 살펴보세요.' : reauth ? '작성 중인 내용은 그대로 보관하고 있어요.' : status === 'unconfigured' ? '매장 운영자가 로그인 설정을 완료하면 사용할 수 있어요.' : '예약·정산·고객 기록을 관리하는 화면입니다.'}</p>
        {status === 'checking' ? <p className="owner-auth-loading" role="status"><LoaderCircle size={19} className="spin" />로그인 상태를 확인하고 있어요…</p> : <>
          {error && <p className="owner-auth-error" role="alert">{error}</p>}
          {pendingLogout ? <button type="button" className="owner-auth-primary" disabled={busy} onClick={() => void logout()}>{busy ? '로그아웃 중…' : '로그아웃 다시 시도'}</button>
            : status === 'error' && !configured && !isDemo ? <button type="button" className="owner-auth-primary" onClick={() => setRetry(value => value + 1)}><RotateCw size={17} />다시 확인</button>
              : (isDemo || configured) && <form onSubmit={signIn}>
                {!isDemo && <label className="owner-auth-field" htmlFor={`${id}-password`}>사장님 비밀번호<input ref={passwordInput} id={`${id}-password`} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={256} required disabled={busy} /></label>}
                <button type="submit" className="owner-auth-primary" disabled={busy}>{busy && <LoaderCircle size={18} className="spin" />}{isDemo ? '예시 데이터로 사장님 체험' : busy ? '로그인 중…' : '로그인'}{!busy && <ArrowRight size={17} />}</button>
              </form>}
          {status === 'unconfigured' && <button type="button" className="owner-auth-retry" onClick={() => setRetry(value => value + 1)}><RotateCw size={15} />설정 상태 다시 확인</button>}
        </>}
        <a className="owner-auth-customer-link" href={customerUrl}>예약·케어 확인은 고객 화면으로<ArrowRight size={15} /></a>
        {isDemo && <p className="owner-auth-demo-note">공유 체험에는 실제 로그인이나 접근 보호가 적용되지 않아요. 실제 고객 정보는 입력하지 마세요.</p>}
      </div>
    </div>}
  </>;
}
