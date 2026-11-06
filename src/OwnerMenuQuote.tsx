import { useEffect,useState } from 'react';
import { Button, Picker, PickerItem, Text } from '@react-spectrum/s2';
import { SpectrumSurface } from './ui/SpectrumSurface';
import { api,money } from './types';
import { matchesWeight } from './menu-booking';
import type { BookingCatalog,MenuOffer } from './menu-booking';
export function OwnerMenuQuote({weight,disabled,onApply}:{weight:number;disabled:boolean;onApply:(o:MenuOffer)=>void}){
 const [catalog,setCatalog]=useState<BookingCatalog|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;api<{booking:BookingCatalog}>('/public/catalog').then(r=>{if(active)setCatalog(r.booking);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const offers=catalog?.offers.filter(o=>matchesWeight(o,weight))??[];
 async function apply(){setBusy(true);setError('');try{const current=(await api<{booking:BookingCatalog}>('/public/catalog')).booking;setCatalog(current);if(current.revision!==catalog?.revision){setSelected('');throw Error('요금표가 바뀌었어요. 최신 금액을 다시 선택해 주세요.');}const offer=current.offers.find(o=>o.id===selected&&matchesWeight(o,weight));if(offer)onApply(offer);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <SpectrumSurface><section className="mongle-workflow-stack" aria-label="게시 요금표에서 불러오기"><Text>게시 요금표에서 불러오기 · 기존 기록은 적용을 눌러야 변경됩니다.</Text><Picker label="아이 몸무게에 맞는 요금" selectedKey={offers.some(o=>o.id===selected)?selected:null} onSelectionChange={k=>setSelected(String(k))} isDisabled={disabled||busy||!offers.length}>{offers.map(o=><PickerItem key={o.id} id={o.id}>{o.name} · {money(o.price)}원 · {o.duration}분</PickerItem>)}</Picker><div><Button variant="secondary" isDisabled={disabled||busy||!offers.some(o=>o.id===selected)} isPending={busy} onPress={apply}>선택 요금 적용</Button></div>{!offers.length&&<Text>몸무게를 입력하고 요금 관리에서 예약 항목을 연결해 주세요. 상담 금액은 아래에서 직접 입력할 수 있어요.</Text>}{error&&<p role="alert">{error}</p>}</section></SpectrumSurface>;
}
