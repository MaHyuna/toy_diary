import { sameMenu } from './price-menu';
import { loadPriceMenu } from './shared-price-menu';
import { useEffect, useRef, useState } from 'react';
import { api } from './types';
import { appUrl } from './routes';
import { Modal } from './Forms';
import './price-poster.css';
export function PricePosterEditor({onClose}:{onClose:()=>void}) {
 const frame=useRef<HTMLIFrameElement>(null), pending=useRef(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function syncMenu(){const menu=await loadPriceMenu();if(menu)frame.current?.contentWindow?.postMessage({type:'mongle-price-source',menu},location.origin);}
 useEffect(()=>{async function receive(e:MessageEvent){if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;if(e.data?.type==='mongle-price-ready'){try{await syncMenu();}catch(e){setError((e as Error).message);}return;}if(e.data?.type!=='mongle-price-poster'||pending.current)return;pending.current=true;setBusy(true);setError('');setMessage('');try{const menu=await loadPriceMenu();if(menu&&!sameMenu(e.data.poster?.menu,menu))throw Error('요금 설정과 일치하지 않습니다. 서비스·견종·몸무게 금액은 요금 관리에서 저장한 뒤 다시 열어 주세요.');await api('/price-poster','PUT',e.data.poster);setMessage('저장된 요금과 일치하는 안내 이미지를 게시했어요.');}catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}}window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
 return <Modal title="고객 요금표 디자인" description="고객과 사장님이 함께 사용하는 견종·몸무게별 표입니다. 금액은 요금 관리에서 수정하고 여기서는 안내 이미지를 꾸미세요." onClose={onClose} busy={busy} className="price-poster-editor"><iframe ref={frame} src="planning/pricelist.html?embedded=1" title="요금표 캔버스 편집기"/>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<footer className="modal-footer"><a href={appUrl('prices')} target="_blank" rel="noopener">고객 화면 보기</a><button className="btn btn-secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api('/price-poster','DELETE');setMessage('게시를 내렸어요.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>게시 내리기</button><button className="btn btn-primary" disabled={busy} onClick={()=>frame.current?.contentWindow?.postMessage({type:'mongle-export-price-poster'},location.origin)}>{busy?'게시 중…':'현재 요금표 게시'}</button></footer></Modal>;
}
