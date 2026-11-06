import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, DatePicker, Divider, Heading, LinkButton, NumberField, Picker, PickerItem, Text, TextArea, TextField } from '@react-spectrum/s2';
import { parseDate } from '@internationalized/date';
import { SpectrumSurface } from './ui/SpectrumSurface';
import { matchesWeight } from './menu-booking';
import type { BookingCatalog } from './menu-booking';
import { api, money, today } from './types';
import { appUrl } from './routes';
import { isDemo } from './runtime';

type Catalog={name:string;hours:string;booking:BookingCatalog};
type Receipt={id:string;date:string;time:string;price:number};
const stages=['미용 선택','날짜·시간','아이 정보','신청 확인'];
export function PublicBooking(){
 const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState(''),[step,setStep]=useState(0);
 const [group,setGroup]=useState(''),[weight,setWeight]=useState<number>(NaN),[serviceId,setServiceId]=useState('');
 const [date,setDate]=useState(parseDate(today()).add({days:1})),[time,setTime]=useState(''),[slots,setSlots]=useState<string[]>([]),[loading,setLoading]=useState(false);
 const [form,setForm]=useState({dogName:'',guardianName:'',phone:'',breed:'',notes:''});
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState<Receipt|null>(null),[editing,setEditing]=useState(false);
 const [reload,setReload]=useState(0),[retry,setRetry]=useState(0);
 const submitting=useRef(false),heading=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;api<Catalog>('/public/catalog').then(c=>{if(active){setCatalog(c);setGroup(g=>c.booking.offers.some(o=>o.group===g)?g:c.booking.offers[0]?.group??'');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[reload]);
 const offers=catalog?.booking.offers.filter(o=>o.group===group&&matchesWeight(o,weight))??[],service=offers.find(o=>o.id===serviceId);
 useEffect(()=>{let active=true;setTime('');setSlots([]);if(!service){setLoading(false);return;}setLoading(true);api<{slots:string[]}>(`/public/availability?date=${date}&serviceId=${encodeURIComponent(service.id)}`).then(r=>{if(active)setSlots(r.slots);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[service?.id,service?.duration,date,catalog?.booking.revision,retry]);
 useEffect(()=>{heading.current?.focus();},[step,receipt]);
 const validInfo=!!form.dogName.trim()&&!!form.guardianName.trim()&&/^\d{10,11}$/.test(form.phone.replace(/\D/g,''));
 function next(){setError('');if(step===0&&!service){setError('몸무게에 맞는 미용 서비스를 선택해 주세요.');return;}if(step===1&&!time){setError('방문 시간을 선택해 주세요.');return;}if(step===2&&!validInfo){setError('아이 이름, 보호자 이름과 연락처를 확인해 주세요.');return;}if(editing&&step>0){setEditing(false);setStep(3);}else setStep(step+1);window.scrollTo({top:0,behavior:'instant'});}
 function edit(n:number){setConsent(false);setError('');setEditing(true);setStep(n);}
 async function submit(){if(submitting.current||!service||!catalog||!consent)return;submitting.current=true;setBusy(true);setError('');try{setReceipt(await api<Receipt>('/public/requests','POST',{...form,weight,serviceId:service.id,revision:catalog.booking.revision,date:String(date),time,consent}));}catch(e){setError((e as Error).message);setConsent(false);setServiceId('');setStep(0);setEditing(false);setReload(v=>v+1);}finally{submitting.current=false;setBusy(false);}}
 const groups=[...new Set(catalog?.booking.offers.map(o=>o.group)??[])];
 return <SpectrumSurface><main className="mongle-workflow">
 <header className="mongle-workflow-header"><Heading level={1}>{catalog?.name??'몽글 미용실'}</Heading><LinkButton href={appUrl('prices')} variant="secondary">요금표 보기</LinkButton></header>
 {isDemo&&<Text>공유 체험 · 실제 개인정보를 입력하지 마세요. 신청은 이 브라우저에만 저장됩니다.</Text>}
 {error&&<p role="alert">{error}</p>}
 {!catalog?<><p role="status">매장 정보를 확인하고 있어요.</p>{error&&<Button onPress={()=>setReload(v=>v+1)}>다시 불러오기</Button>}</>:receipt?<section className="mongle-workflow-stack"><div ref={heading} tabIndex={-1}><Heading level={2}>방문 신청을 보냈어요</Heading></div><Text>아직 확정 전입니다. 매장의 확인 후 예약이 확정됩니다.</Text><dl className="mongle-workflow-summary"><div><dt>아이 · 미용</dt><dd>{form.dogName} · {service?.name}</dd></div><div><dt>방문</dt><dd>{receipt.date} {receipt.time}</dd></div><div><dt>예상 금액</dt><dd>{money(receipt.price)}원</dd></div><div><dt>요청사항</dt><dd>{form.notes||'없음'}</dd></div><div><dt>접수번호</dt><dd>{receipt.id.slice(0,8)}</dd></div></dl><LinkButton href={appUrl('home')}>미용수첩으로</LinkButton></section>:!catalog.booking.offers.length?<section className="mongle-workflow-stack"><Heading level={2}>온라인 예약을 준비하고 있어요</Heading><Text>매장에서 요금과 소요 시간을 확인한 후 예약을 열 예정이에요. 지금은 요금표를 확인해 주세요.</Text></section>:<>
 <Text>{step+1} / 4 · {stages[step]}</Text><div ref={heading} tabIndex={-1}><Heading level={2}>{['어떤 미용이 필요하세요?','언제 방문할까요?','아이를 소개해 주세요','신청 내용을 확인해 주세요'][step]}</Heading></div>
 {step===0&&<div className="mongle-workflow-stack"><div className="mongle-workflow-fields"><Picker label="요금 분류" selectedKey={group} onSelectionChange={k=>{setGroup(String(k));setServiceId('');setConsent(false);}}>{groups.map(g=><PickerItem key={g} id={g}>{g}</PickerItem>)}</Picker><NumberField label="몸무게 (kg)" value={weight} onChange={w=>{setWeight(w);setServiceId('');setConsent(false);}} minValue={0.1} maxValue={150} step={0.1} isRequired/></div><Text>요금표에서 아이에게 맞는 분류를 확인해 주세요. 견종과 털 상태에 따른 최종 금액은 방문 상담 후 안내합니다.</Text>{offers.length?<Picker label="미용 서비스" selectedKey={serviceId||null} onSelectionChange={k=>{setServiceId(String(k));setConsent(false);}}>{offers.map(o=><PickerItem key={o.id} id={o.id}>{o.service} · {money(o.price)}원 · {o.duration}분</PickerItem>)}</Picker>:<Text>{Number.isFinite(weight)?'이 체중에 연결된 온라인 예약 요금이 없어요. 매장 상담이 필요합니다.':'몸무게를 입력하면 해당 요금이 표시됩니다.'}</Text>}{service&&<Text>요금표 기준 {service.band||`${service.minWeight}–${service.maxWeight}kg`} · 예상 {money(service.price)}원</Text>}</div>}
 {step===1&&<div className="mongle-workflow-stack"><Text>{service?.name} · 약 {service?.duration}분 · 예약 가능 시간 {catalog.hours}</Text><DatePicker label="방문 날짜" value={date} onChange={d=>{if(d)setDate(d);}} minValue={parseDate(today())} maxValue={parseDate(today()).add({days:90})} isRequired/>{loading?<p role="status">가능한 시간을 확인하고 있어요.</p>:slots.length?<Picker label="방문 시간" selectedKey={time||null} onSelectionChange={k=>setTime(String(k))}>{slots.map(t=><PickerItem key={t} id={t}>{t}</PickerItem>)}</Picker>:<><Text>선택 가능한 시간이 없습니다. 다른 날짜를 선택해 주세요.</Text><Button variant="secondary" onPress={()=>setRetry(v=>v+1)}>시간 다시 확인</Button></>}</div>}
 {step===2&&<div className="mongle-workflow-fields">{([['dogName','아이 이름'],['breed','견종'],['guardianName','보호자 이름'],['phone','연락받을 전화번호']] as const).map(([key,label])=><TextField key={key} label={label} value={form[key]} onChange={v=>setForm({...form,[key]:v})} isRequired={key!=='breed'} maxLength={80} type={key==='phone'?'tel':'text'}/>)}<div className="mongle-workflow-wide"><TextArea label="원하는 스타일 · 미리 전할 말 (선택)" value={form.notes} onChange={v=>setForm({...form,notes:v})} maxLength={1000}/></div></div>}
 {step===3&&<div className="mongle-workflow-stack"><section className="mongle-workflow-stack" aria-label="미용 선택 확인"><div className="mongle-workflow-header"><Heading level={3}>미용 서비스</Heading><Button variant="secondary" onPress={()=>edit(0)}>서비스 변경</Button></div><Text>{service?.name} · {weight}kg · 약 {service?.duration}분</Text></section><Divider/>
 <section className="mongle-workflow-stack" aria-label="방문 일정 확인"><div className="mongle-workflow-header"><Heading level={3}>방문 일정</Heading><Button variant="secondary" onPress={()=>edit(1)}>일정 변경</Button></div><Text>{String(date)} {time} · 매장 확인 후 확정</Text></section><Divider/>
 <section className="mongle-workflow-stack" aria-label="아이와 보호자 정보 확인"><div className="mongle-workflow-header"><Heading level={3}>아이 · 보호자</Heading><Button variant="secondary" onPress={()=>edit(2)}>정보 수정</Button></div><Text>{form.dogName} · {form.breed||'견종 미입력'} · {weight}kg</Text><Text>{form.guardianName} · {form.phone}</Text><dl className="mongle-workflow-summary"><div><dt>미리 전할 말</dt><dd>{form.notes||'등록한 요청사항이 없어요.'}</dd></div></dl></section><Divider/>
 <Heading level={3}>예상 합계 {money(service?.price??0)}원</Heading><Text>게시된 요금표 기준입니다. 추가 작업은 상담 후 안내하며 지금 결제되지 않습니다.</Text><Checkbox isSelected={consent} onChange={setConsent}>예약 상담·연락을 위한 이름, 전화번호, 반려견 정보 수집에 동의합니다.</Checkbox></div>}
 <footer className="mongle-workflow-actions">{step>0&&<Button variant="secondary" isDisabled={busy} onPress={()=>setStep(step-1)}>이전</Button>}<Button variant="accent" isDisabled={busy||!service||step===1&&(loading||!time)||step===3&&!consent} isPending={busy} onPress={step===3?submit:next}>{step===3?'예약 신청 보내기':editing&&step>0?'수정 내용 확인':'다음'}</Button></footer>
 </>}
 </main></SpectrumSurface>;
}
