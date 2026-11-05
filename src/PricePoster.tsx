import { useEffect, useRef, useState } from 'react';
import { api } from './types';
import { appUrl } from './routes';
import { Modal } from './Forms';
import './price-poster.css';
export function PricePosterEditor({onClose}:{onClose:()=>void}) {
 const frame=useRef<HTMLIFrameElement>(null), pending=useRef(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{function receive(e:MessageEvent){if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||e.data?.type!=='mongle-price-poster'||pending.current)return;pending.current=true;setBusy(true);setError('');setMessage('');api('/price-poster','PUT',e.data.poster).then(()=>setMessage('고객 요금안내에 게시했어요. 이후 편집은 다시 게시할 때 반영됩니다.')).catch(e=>setError(e.message)).finally(()=>{pending.current=false;setBusy(false);});}window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
 return <Modal title="고객 요금표 디자인" description="작성한 표를 그대로 게시합니다. 예약 자동 견적의 요금 설정은 별도입니다." onClose={onClose} busy={busy} className="price-poster-editor"><iframe ref={frame} src="planning/pricelist.html?embedded=1" title="요금표 캔버스 편집기"/>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<footer className="modal-footer"><a href={appUrl('prices')} target="_blank" rel="noopener">고객 화면 보기</a><button className="btn btn-secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api('/price-poster','DELETE');setMessage('게시를 내렸어요.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>게시 내리기</button><button className="btn btn-primary" disabled={busy} onClick={()=>frame.current?.contentWindow?.postMessage({type:'mongle-export-price-poster'},location.origin)}>{busy?'게시 중…':'현재 요금표 게시'}</button></footer></Modal>;
}
