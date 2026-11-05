import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { api } from './types';
import type { ShopNotice } from './types';
import './notebook.css';

export function ShopNoticeBoard() {
  const [notices, setNotices] = useState<ShopNotice[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setError('');
    api<{notices?: ShopNotice[]}>('/public/catalog').then(data => { if (active) setNotices(data.notices ?? []); }).catch(() => { if (active) setError('공지사항을 불러오지 못했어요.'); });
    return () => { active = false; };
  }, [retry]);
  return <section className="notebook-notices" aria-label="매장 공지사항">
    <h2><Megaphone size={18} />매장 공지사항</h2>
    {error ? <p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>다시 확인</button></p> : notices === null ? <p role="status">공지사항을 확인하고 있어요…</p> : notices.length ? notices.map(notice => <details key={notice.id}><summary>{notice.title}</summary><p>{notice.body}</p></details>) : <p>새로운 공지사항이 없어요.</p>}
  </section>;
}

