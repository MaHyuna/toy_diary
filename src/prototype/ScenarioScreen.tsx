import { Checkbox, TextArea, TextField } from '@react-spectrum/s2';
import type { Screen } from './flows';
export function ScenarioScreen({screen,draft,onChange}:{screen:Screen;draft:Record<string,string>;onChange:(key:string,value:string)=>void}){
 const ui=screen.ui!;
 const dateKey=screen.id==='booking-reselect'?'변경 날짜':'예약 날짜';
 const selected=(draft.services??'목욕,위생미용').split(',').filter(Boolean);
 const cost=selected.reduce((n,s)=>n+({목욕:35000,위생미용:10000,스파:15000}[s]??0),0);
 const duration=selected.reduce((n,s)=>n+({목욕:60,위생미용:20,스파:20}[s]??0),0);
 return <div className="scenario-screen">
  <span className="scenario-design">확장 설계 · 실제 서비스 구현 전</span>
  {ui.status&&<div className="proto-summary"><strong>{ui.status}</strong><span>예약 상태와 결제 상태를 따로 관리합니다.</span></div>}
  {ui.calendar&&<><div className="scenario-calendar-title">2026년 11월 · 가능한 날짜 선택</div><div className="scenario-calendar">{['일','월','화','수','목','금','토'].map(d=><small key={d}>{d}</small>)}{Array.from({length:30},(_,i)=><button key={i} type="button" aria-label={`11월 ${i+1}일 선택`} aria-pressed={Number((draft[dateKey]??'2026-11-12').slice(-2))===i+1} onClick={()=>onChange(dateKey,`2026-11-${String(i+1).padStart(2,'0')}`)}>{i+1}</button>)}</div></>}
  {ui.fields?.map(field=>{const value=draft[field.label]??field.value??'';return field.type==='textarea'?<TextArea key={field.label} label={field.label} value={value} onChange={v=>onChange(field.label,v)} isRequired={field.required} validationBehavior="aria"/>:<TextField key={field.label} label={field.label} type={field.type??'text'} value={value} onChange={v=>onChange(field.label,v)} isRequired={field.required} validationBehavior="aria"/>;})}
  {ui.services&&<><h3>예약 항목 · 여러 개 선택 가능</h3>{[['목욕','35,000원 · 60분'],['위생미용','10,000원 · 20분'],['스파','15,000원 · 20분']].map(([name,description])=><Checkbox key={name} isSelected={selected.includes(name)} onChange={checked=>onChange('services',(checked?[...selected,name]:selected.filter(v=>v!==name)).join(','))}>{name} · {description}</Checkbox>)}<div className="proto-summary"><strong>예상 {cost.toLocaleString()}원 · {duration}분</strong><span>매장 설정에 따라 조합 가능 여부와 총 시간을 확인합니다.</span></div></>}
  {ui.requests&&<><Checkbox isSelected={draft.requestEnabled==='yes'} onChange={v=>onChange('requestEnabled',v?'yes':'no')}>요청사항이 있어요</Checkbox>{draft.requestEnabled==='yes'&&<TextArea label="예약 요청사항" value={draft.request??''} onChange={v=>onChange('request',v)}/>}</>}
  {ui.rows&&<table className="scenario-table"><thead><tr>{(ui.columns??['항목','내용']).map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{ui.rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{screen.id==='owner-review'&&r[0]==='예약 항목'&&j===1?selected.join(' + '):screen.id==='owner-review'&&r[0]==='요청 일정'&&j===1?`${draft['변경 날짜']??draft['예약 날짜']??'2026-11-12'} ${draft['변경 시간']??draft['예약 시간']??'10:00'}`:v}</td>)}</tr>)}</tbody></table>}
  {['booking-review','owner-review','booking-confirmed','booking-repending'].includes(screen.id)&&<div className="proto-summary"><strong>몽이 · {selected.join(' + ')||'항목 미선택'}</strong><span>{draft['변경 날짜']??draft['예약 날짜']??'2026-11-12'} {draft['변경 시간']??draft['예약 시간']??'10:00'} · {duration}분</span><span>예상 {cost.toLocaleString()}원 · 예약금 10,000원(예시) · 잔액 {Math.max(0,cost-10000).toLocaleString()}원</span>{draft.requestEnabled==='yes'&&draft.request&&<span>요청: {draft.request}</span>}</div>}
  {ui.message&&<div className="proto-callout"><p>{ui.message}</p></div>}
  <p>{screen.purpose}</p>
 </div>;
}
