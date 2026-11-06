import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, Cell, Column, Content, Dialog, DialogContainer, Heading, Row, TableBody, TableHeader, TableView, TextField } from '@react-spectrum/s2';
import { flows } from './flows';
import type { Flow } from './flows';
const labels:Record<string,string>={signup:'가입·계정',pets:'반려동물 관리',booking:'예약 신청','customer-history':'예약·미용수첩','owner-setup':'매장 운영 설정','owner-requests':'신청 검토','owner-crm':'고객 관리','owner-finance':'정산·장부','owner-safety':'권한·백업','owner-day':'방문·미용 진행',channels:'예약 채널 연동',supplies:'샴푸·원가',visit:'미용 기록·결제',pricing:'요금표·이력',customer:'고객 홈',notice:'공지 관리'};
export function FlowSelector({current,onSelect}:{current:Flow;onSelect:(flow:Flow)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[role,setRole]=useState<'전체'|'고객'|'사장님'>(current.role);
 const visible=flows.filter(f=>(role==='전체'||f.role===role)&&`${labels[f.id]} ${f.name} ${f.summary}`.includes(query.trim()));
 function show(){setQuery('');setRole(current.role);setOpen(true);}
 return <div className="flow-selector">
  <span className="flow-selector-caption">시나리오 · {flows.length}개 흐름 / {flows.reduce((n,f)=>n+f.steps.length,0)}개 화면</span>
  <div><Button variant="secondary" aria-haspopup="dialog" onPress={show}>흐름 선택 · {current.role} / {labels[current.id]} ▾</Button></div>
  <DialogContainer onDismiss={()=>setOpen(false)}>{open&&<Dialog size="M" isDismissible><Heading slot="title">시나리오 선택</Heading><Content><div className="flow-selector-dialog" data-scenario-selector>
   <TextField autoFocus label="시나리오 검색" placeholder="예약, 환불, 회원가입…" value={query} onChange={setQuery} UNSAFE_style={{width:'100%'}}/>
   <div className="flow-selector-filters" role="group" aria-label="사용자 구분">{(['전체','고객','사장님'] as const).map(r=><Button key={r} size="S" variant={role===r?'accent':'secondary'} aria-pressed={role===r} onPress={()=>setRole(r)}>{r}</Button>)}<span>{visible.length}개 흐름</span></div>
   {visible.length?<div className="flow-selector-results" style={{'--flow-list-height':`${Math.min(340,44+visible.length*80)}px`} as CSSProperties}><TableView aria-label="시나리오 검색 결과" density="spacious" overflowMode="wrap" onAction={key=>{const f=flows.find(v=>v.id===key);if(f){onSelect(f);setOpen(false);}}} UNSAFE_style={{width:'100%',height:'100%'}}><TableHeader><Column isRowHeader>시나리오</Column></TableHeader><TableBody>{visible.map(f=><Row key={f.id} id={f.id} textValue={labels[f.id]}><Cell><div className="flow-selector-option"><div><strong>{labels[f.id]}</strong><small>{f.id===current.id?'현재 · ':''}{f.role} · {f.steps.length}개 화면</small></div><span>{f.summary}</span></div></Cell></Row>)}</TableBody></TableView></div>:<p className="flow-selector-empty" role="status">일치하는 시나리오가 없습니다. 검색어나 사용자 구분을 바꿔주세요.</p>}
   <div className="flow-selector-footer"><span>항목을 선택하면 해당 흐름으로 이동합니다.</span><Button variant="secondary" onPress={()=>setOpen(false)}>닫기</Button></div>
  </div></Content></Dialog>}</DialogContainer>
 </div>;
}
