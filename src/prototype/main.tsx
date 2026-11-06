import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, ButtonGroup, Cell, Checkbox, Column, Content, Dialog, DialogContainer, Heading, LinkButton, Picker, PickerItem, Row, TableBody, TableHeader, TableView, TextArea, TextField } from '@react-spectrum/s2';
import { SpectrumSurface } from '../ui/SpectrumSurface';
import { ScenarioScreen } from './ScenarioScreen';
import { FlowBoard } from './FlowBoard';
import { flows } from './flows';
import type { Screen } from './flows';
import '../ui/prototype.css';
const initial=()=>{const p=new URLSearchParams(location.hash.slice(1));const flow=flows.find(f=>f.id===p.get('flow'))??flows.find(f=>f.id==='booking')!;return {flow:flow.id,screen:flow.steps.find(s=>s.id===p.get('screen'))?.id??flow.steps[0].id,mode:p.get('mode')==='modal'?'modal':p.get('mode')==='play'?'play':'map'};};
function Prototype(){
 const [trail,setTrail]=useState<{flow:string;screen:string;mode:string}[]>([]);
 const [cancelReturn,setCancelReturn]=useState('booking-pending');
 const [scenarioDraft,setScenarioDraft]=useState<Record<string,string>>({});
 const [position,setPosition]=useState(initial),[device,setDevice]=useState<'phone'|'desktop'>('phone'),[notice,setNotice]=useState('');
 const [price,setPrice]=useState('18000'),[savedPrice,setSavedPrice]=useState('18000'),[revision,setRevision]=useState(2),[title,setTitle]=useState('11월 휴무 안내'),[memo,setMemo]=useState('11월 16일은 매장 정기 휴무입니다.'),[published,setPublished]=useState(true);
 const [savedNotice,setSavedNotice]=useState({title:'11월 휴무 안내',memo:'11월 16일은 매장 정기 휴무입니다.',published:true});
 const flow=flows.find(f=>f.id===position.flow)!,screen=flow.steps.find(s=>s.id===position.screen)??flow.steps[0];
 useEffect(()=>{const update=()=>setPosition(initial());window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
 function move(screenId:string,mode=position.mode,flowId=flow.id){
  if(position.mode==='modal'&&mode==='play')mode='modal';
  if(flowId!==position.flow||mode==='map'||position.mode==='map')setTrail([]);
  else if(screenId!==position.screen)setTrail(t=>[...t,position]);
  const next={flow:flowId,screen:screenId,mode};setPosition(next);location.hash=new URLSearchParams(next).toString();setNotice('');
 }
 function previous(){const last=trail.at(-1);if(!last)return;setTrail(t=>t.slice(0,-1));setPosition(last);history.replaceState(history.state,'','#'+new URLSearchParams(last));setNotice('');}
 function closePreview(){move(screen.id,'map');}

 function perform(label:string,to:string){
  if(to==='booking-cancel')setCancelReturn(screen.id);
  if(screen.id==='booking-cancel'&&label==='예약 유지'){move(cancelReturn,'play');return;}
  if(label==='제안 일정으로 신청')setScenarioDraft(d=>({...d,'변경 날짜':'2026-11-13','변경 시간':'11:00'}));
  if(screen.ui?.services&&label==='예상 요금·정책 확인'&&scenarioDraft.services===''){setNotice('예약 항목을 하나 이상 선택해 주세요.');return;}
  if(label===screen.actions[0]?.label&&screen.ui?.fields?.some(f=>f.required&&!(scenarioDraft[f.label]??f.value??'').trim())){setNotice('필수 사유를 입력해 주세요.');return;}
  if(label==='요금표 저장'){setSavedPrice(price);setRevision(n=>n+1);}
  if(label==='복원 확정'){setPrice('15000');setSavedPrice('15000');setRevision(n=>n+1);}
  if(flow.id==='notice'&&['공지 저장','수정 저장'].includes(label))setSavedNotice({title,memo,published});
  if(flow.id==='notice'&&label==='작성 취소'){setTitle(savedNotice.title);setMemo(savedNotice.memo);setPublished(savedNotice.published);}
  if(label==='변경 버리고 목록으로')setPrice(savedPrice);
  move(to,'play');
  if(/저장|등록|접수|확정|공개|기록$/.test(label))setNotice('프로토타입에서만 처리했습니다. 실제 데이터는 바뀌지 않습니다.');
 }
 function reset(){setScenarioDraft({});setPrice('18000');setSavedPrice('18000');setRevision(2);setTitle('11월 휴무 안내');setMemo('11월 16일은 매장 정기 휴무입니다.');setPublished(true);setSavedNotice({title:'11월 휴무 안내',memo:'11월 16일은 매장 정기 휴무입니다.',published:true});move(flow.steps[0].id);}
 useEffect(()=>{
  if(position.mode==='map')return;
  const keydown=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
   const target=event.target as HTMLElement|null;
   if(event.key==='Escape'){event.preventDefault();closePreview();return;}
   if(target?.closest('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="spinbutton"],[role="grid"],[role="listbox"],[role="menu"],[role="slider"],[aria-haspopup]'))return;
   if(document.querySelector('[role="listbox"],[role="menu"]'))return;
   if(event.key==='ArrowLeft'){event.preventDefault();previous();}
   if(event.key==='ArrowRight'){event.preventDefault();const next=screen.actions[0];if(next)perform(next.label,next.to);}
  };
  window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
 });
 const extras={price,savedPrice,revision,title,memo,published,savedNotice,setPrice,setTitle,setMemo,setPublished};
 const workbench=(<main className={`proto-workbench ${position.mode==='modal'?'is-modal':''}`} aria-label="클릭형 화면 프로토타입">
   <aside className="proto-steps"><h3>화면 목록 <span>{flow.steps.length}</span></h3><nav aria-label="흐름 안의 화면">{flow.steps.map((s,i)=><a key={s.id} href={`#flow=${flow.id}&screen=${s.id}&mode=play`} aria-current={screen.id===s.id?'step':undefined} onClick={e=>{e.preventDefault();move(s.id,'play');}}><span>{String(i+1).padStart(2,'0')}</span>{s.name}{s.future&&<small>제안</small>}</a>)}</nav></aside>
   <section className="proto-stage"><div className="proto-stage-toolbar"><span>{screen.future?'검토 제안':'현재 구현 기반 · 단순화'}</span><ButtonGroup><Button size="S" variant={device==='phone'?'accent':'secondary'} onPress={()=>setDevice('phone')}>모바일</Button><Button size="S" variant={device==='desktop'?'accent':'secondary'} onPress={()=>setDevice('desktop')}>PC</Button></ButtonGroup></div><div className={`proto-device ${device}`}><header className="proto-app-header"><strong>✿ 몽글</strong><span>{(screen.actor??flow.role)==='고객'?'고객 · 미용수첩':'사장님 · 매장 관리'}</span></header><div className="proto-screen" key={screen.id}><div className="proto-screen-title"><span>{screen.kind}</span><h2>{screen.name}</h2></div>{screen.ui?<ScenarioScreen screen={screen} draft={scenarioDraft} onChange={(key,value)=>setScenarioDraft(d=>({...d,[key]:value}))}/>:<ScreenContents screen={screen} values={extras} go={to=>move(to,'play')}/>}<div className="proto-screen-actions">{screen.actions.map(a=><Button key={a.label} variant={a.primary?'accent':'secondary'} onPress={()=>perform(a.label,a.to)}>{a.label}</Button>)}</div></div><footer className="proto-app-footer">{(screen.actor??flow.role)==='고객'?'미용수첩 · 예약 · 요금표':'예약 · 고객 · 장부 · 매장관리'}</footer></div></section>
   <aside className="proto-inspector"><p className="proto-eyebrow">이 화면의 역할</p><h3>{screen.name}</h3><p>{screen.purpose}</p><hr/><h4>동작과 데이터 규칙</h4><p>{screen.rule}</p><h4>다음 화면</h4><ul>{screen.actions.map(a=><li key={a.label}>{a.label}<span>→ {flow.steps.find(s=>s.id===a.to)?.name}</span></li>)}</ul><div className="proto-inspector-status">{screen.future?'후속 설계 · 실제 기능 미구현':'구현된 동작을 검토용으로 재현'}<small>{screen.future?'확장 설계 화면입니다. 실제 결제·인증·알림·백업 처리는 연결하지 않았습니다.':'실제 서비스의 전체 필드·권한 검사는 서비스에서 확인합니다.'}</small></div></aside>
  </main>);
 return <SpectrumSurface><div className="proto-shell">
  <header className="proto-mast"><div className="proto-wordmark"><span aria-hidden="true">✿</span><div><strong>몽글</strong><small>SCREEN FLOW / 2026.11.06</small></div></div><div className="proto-head-actions"><span className="proto-version">검토용 프로토타입</span><Button variant="secondary" onPress={async()=>{try{await navigator.clipboard.writeText(location.href);setNotice('현재 화면 링크를 복사했어요.');}catch{setNotice('주소창의 링크를 복사해 공유할 수 있어요.');}}}>화면 링크 복사</Button></div></header>
  <div className="proto-intro"><div><p className="proto-eyebrow">화면을 따라가며, 흐름을 확인하세요.</p><h1>몽글 · 서비스 화면 흐름도</h1><p>예약부터 미용수첩까지. 각 화면에서 무엇을 보고, 어떤 행동으로 다음 화면에 가는지 검토하는 공간입니다.</p></div><div className="proto-boundary"><strong>서비스와 분리된 예시입니다.</strong><p>입력·저장·결제는 시뮬레이션이며 실제 전송하지 않습니다. 기존 구현과 확장 설계를 함께 담았습니다. 확장 화면은 실제 서비스 구현 전인 것으로 표시합니다.</p></div></div>
  <div className="proto-controls"><details className="scenario-catalog"><summary><span>시나리오 선택 · {flows.length}개 흐름 / {flows.reduce((n,f)=>n+f.steps.length,0)}개 화면</span><strong>{flow.role} · {flow.name}</strong></summary><nav aria-label="사용자 흐름 선택">{(['고객','사장님'] as const).map(role=><section key={role}><h3>{role} 시나리오</h3><div className="proto-flow-options">{flows.filter(f=>f.role===role).map(f=><Button key={f.id} variant={flow.id===f.id?'accent':'secondary'} aria-pressed={flow.id===f.id} onPress={()=>{move(f.steps[0].id,position.mode,f.id);document.querySelector('.scenario-catalog')?.removeAttribute('open');}}>{({visit:'예약·미용',pricing:'요금표·이력',customer:'고객 수첩',notice:'공지 관리'} as Record<string,string>)[f.id]??f.name}</Button>)}</div></section>)}</nav></details><div className="proto-control-buttons"><ButtonGroup><Button variant={position.mode==='map'?'accent':'secondary'} onPress={()=>move(screen.id,'map')}>전체 흐름보드</Button><Button variant={position.mode==='play'?'accent':'secondary'} onPress={()=>move(screen.id,'play')}>눌러보는 화면</Button></ButtonGroup><Button variant="secondary" onPress={reset}>처음부터</Button></div></div>
  <div className="proto-flow-heading"><div><span className="proto-role">{flow.role} 영역</span><h2>{flow.name}</h2><p>{flow.summary}</p></div><LinkButton href={`..${flow.path}`} target="_blank" variant="secondary">실제 서비스 열기 ↗</LinkButton></div>
  {notice&&position.mode!=='modal'&&<p className="proto-notice" role="status">{notice}</p>}
  {position.mode!=='play'&&<FlowBoard flow={flow} onOpen={id=>move(id,'modal')}/>}
  {position.mode==='play'&&<><div className="proto-preview-navigation"><Button variant="secondary" isDisabled={!trail.length} onPress={previous}>← 이전 화면</Button><Button variant="secondary" onPress={closePreview}>흐름도로 돌아가기</Button><span>← 이전 · → 기본 경로 · Esc 닫기</span></div>{workbench}</>}
  <DialogContainer onDismiss={closePreview}>{position.mode==='modal'&&<Dialog size="XL"><Heading slot="title">화면 미리보기 · {screen.name}</Heading><Content><div className="proto-preview-navigation"><Button variant="secondary" isDisabled={!trail.length} onPress={previous}>← 이전 화면</Button><Button variant="secondary" onPress={()=>perform(screen.actions[0].label,screen.actions[0].to)}>다음 화면 →</Button><Button variant="secondary" onPress={closePreview}>닫기 · 흐름도로</Button><span>← 이전 · → {screen.actions[0].label} · Esc 닫기</span></div>{notice&&<p className="proto-notice" role="status">{notice}</p>}{workbench}</Content></Dialog>}</DialogContainer>
  <footer className="proto-footer"><p><strong>공통 원칙</strong> 목록 → 상세 → 명시적인 등록·수정 → 확인 → 결과. 고객용 조회 화면에는 내부 관리 기능을 노출하지 않습니다.</p><p>공유 링크는 현재 흐름과 화면 위치를 포함합니다. 예시 입력값은 새로고침하면 초기화됩니다. <a href="scenarios.md" download="몽글-서비스-시나리오.md">전체 시나리오 명세 다운로드</a> ·  <a href="../images/pets/credits.html" target="_blank" rel="noreferrer">예시 사진 출처</a></p></footer>
 </div></SpectrumSurface>;
}
type Values={price:string;savedPrice:string;revision:number;title:string;memo:string;published:boolean;savedNotice:{title:string;memo:string;published:boolean};setPrice:(v:string)=>void;setTitle:(v:string)=>void;setMemo:(v:string)=>void;setPublished:(v:boolean)=>void};
function DataTable({label,columns,rows,onRow}:{label:string;columns:string[];rows:string[][];onRow?:(index:number)=>void}){return <div className="proto-table" style={{height:Math.min(340,48+rows.length*64)}}><TableView aria-label={label} density="spacious" overflowMode="wrap" onAction={onRow?key=>onRow(Number(key)):undefined} UNSAFE_style={{width:'100%',height:'100%'}}><TableHeader>{columns.map((c,i)=><Column key={c} isRowHeader={i===0}>{c}</Column>)}</TableHeader><TableBody>{rows.map((r,i)=><Row key={i} id={i} textValue={r[0]}>{r.map((v,j)=><Cell key={j}>{v}</Cell>)}</Row>)}</TableBody></TableView></div>;}
function Pet(){return <div className="proto-pet"><img src="../images/pets/bichon.jpg" alt="예시 반려견 몽이"/><div><strong>몽이</strong><p>비숑 프리제 · 4.2kg</p><small>김몽글 보호자 · 1234</small></div></div>;}
function PriceTable({price='18000'}:{price?:string}){return <div className="proto-price-sheet"><h3>✿ 소형견 미용</h3><p>말티즈 · 푸들 · 포메라니안</p><table><caption>체중별 서비스 요금 · 원</caption><thead><tr><th>몸무게</th><th>목욕</th><th>부분미용</th><th>가위컷</th></tr></thead><tbody>{['4kg 미만','4~6kg 미만','6~8kg 미만'].map((w,i)=><tr key={w}><th>{w}</th><td>{Number(price)+i*5000}</td><td>{15000+i*5000}</td><td>{80000+i*10000}</td></tr>)}</tbody></table><p>입질·엉킴 등 추가 작업은 상담 후 안내합니다.</p></div>;}
function ScreenContents({screen:s,values:v,go}:{screen:Screen;values:Values;go:(id:string)=>void}){
 switch(s.id){
 case 'calendar':return <><div className="proto-month"><strong>2026. 11.</strong><span>받은 금액 · 665,000원</span></div><div className="proto-calendar">{['일','월','화','수','목','금','토'].map(w=><span key={w} className="proto-weekday">{w}</span>)}{Array.from({length:35},(_,i)=><div key={i} className={i===5?'is-today':''}>{i<30?<><span>{i+1}</span>{[0,3,5,9,12,18,23,27].includes(i)&&<><small>{i===5?'4':'2'}건</small><b>{i===5?'245,000':'90,000'}</b></>}</>:null}</div>)}</div><p className="proto-help">11월 6일을 선택하는 흐름을 눌러보세요.</p></>;
 case 'day':return <><div className="proto-summary"><strong>11월 6일 금요일</strong><span>4건 · 예상 245,000원</span></div><DataTable label="당일 예약" columns={['시간 · 아이','서비스 · 금액']} rows={[["09:00 몽이","전체 미용 · 90,000"],["11:00 콩이","목욕 · 35,000"],["14:00 구름이","전체 미용 · 90,000"],["16:00 보리","부분 미용 · 30,000"]]} onRow={()=>go('visit-detail')}/></>;
 case 'new-visit':return <><TextField label="고객·반려견 검색" defaultValue="몽이"/><DataTable label="고객 검색 결과" columns={['보호자 | 반려동물','뒤 4자리']} rows={[["김몽글 | 몽이","1234"]]}/><TextField label="방문 일시" defaultValue="2026-11-06 09:00"/><TextField label="서비스" defaultValue="전체 미용"/><TextField label="예약 금액" defaultValue="90000"/></>;
 case 'visit-detail':return <><Pet/><div className="proto-summary"><strong>09:00 · 전체 미용</strong><span>90분 · 90,000원</span></div><div className="proto-callout"><strong>미용 시 주의</strong><p>드라이 소리에 예민해요. 앞발을 만질 때 천천히 접근해 주세요.</p></div><p>보호자 요청: 얼굴은 둥글게, 몸은 짧게 정리해 주세요.</p></>;
 case 'care-edit':return <><Pet/><div className="proto-photo-pair"><figure><img src="../images/pets/bichon.jpg" alt="미용 전 기록 예시"/><figcaption>미용 전 · 예시 사진</figcaption></figure><figure><div>＋</div><figcaption>미용 후 · 사진 자리</figcaption></figure></div><TextArea label="미용 소견" defaultValue="발바닥 주변 피부가 약간 붉어 자극을 줄여 미용했어요."/><TextArea label="보호자가 챙길 관리" defaultValue="발을 씻긴 뒤 발가락 사이까지 충분히 말려주세요."/></>;
 case 'care-publish':case 'notebook':return <><Pet/><div className="proto-summary"><strong>11월 6일 · 전체 미용</strong><span>체중 4.2kg · 지난 방문 4.1kg</span></div><img className="proto-record-photo" src="../images/pets/bichon.jpg" alt="미용 기록용 예시 사진"/><h3>오늘의 미용 소견</h3><p>발바닥 주변 피부가 약간 붉어 자극을 줄여 미용했어요.</p><h3>집에서 챙겨주세요</h3><p>발을 씻긴 뒤 발가락 사이까지 충분히 말려주세요.</p></>;
 case 'checkout':return <><Pet/><TextField label="최종 미용 금액 (원)" defaultValue="90000"/><Picker label="결제 수단" defaultSelectedKey="card"><PickerItem id="card">카드</PickerItem><PickerItem id="cash">현금</PickerItem><PickerItem id="transfer">계좌이체</PickerItem></Picker><TextField label="실제 결제일" defaultValue="2026-11-06"/><p className="proto-help">실제 카드 결제가 아닌, 받은 금액의 기록입니다.</p></>;
 case 'paid':return <><div className="proto-success">✓</div><Heading level={3}>미용과 결제 기록을 마쳤어요</Heading><Pet/><DataTable label="결제 결과" columns={['항목','내용']} rows={[["기록 금액","90,000원"],["결제 수단","카드"],["결제일","2026-11-06"]]}/></>;
 case 'cancel-visit':return <><Pet/><div className="proto-callout"><strong>11월 6일 09:00 예약을 취소할까요?</strong><p>예약 취소는 창 닫기와 다른 작업입니다. 대상을 확인해 주세요.</p></div></>;
 case 'price-list':return <><TextField label="요금 분류 검색" placeholder="분류명·견종"/><span className="proto-chip">현재 적용 v{v.revision}</span><DataTable label="요금 분류" columns={['분류','구성']} rows={[["소형견 미용","체중 3행"],["중형견 미용","체중 4행"],["특수견 미용","체중 4행"],["기타 추가금액","항목 4개"],["고양이 미용","항목 2개"]]} onRow={()=>go('price-detail')}/></>;
 case 'price-detail':return <PriceTable price={v.savedPrice}/>;
 case 'public-prices':return <><PriceTable price={v.savedPrice}/><div className="proto-price-sheet"><h3>✿ 고양이 미용</h3><p>목욕 <strong>50,000원</strong></p><p>기본 미용 <strong>80,000원</strong></p></div></>;
 case 'price-create':return <><TextField label="섹션 제목" defaultValue="고양이 케어"/><Picker label="섹션 형식" defaultSelectedKey="items"><PickerItem id="items">항목·금액 목록</PickerItem><PickerItem id="table">체중별 요금표</PickerItem></Picker><TextField label="항목 이름" defaultValue="목욕"/><TextField label="금액" defaultValue="50000"/><p className="proto-help">구조 등록 동선을 보여주는 예시입니다.</p></>;
 case 'price-edit':return <><PriceTable price={v.price}/><TextField label="소형견 · 4kg 미만 · 목욕 (원)" value={v.price} onChange={v.setPrice}/><TextArea label="변경 사유 (선택)" defaultValue="목욕 요금 조정"/><p className="proto-help">여기서 바꾼 예시 금액은 저장 후 이 프로토타입 안에서만 표시됩니다.</p></>;
 case 'discard':return <div className="proto-callout"><h3>변경사항을 버릴까요?</h3><p>저장하지 않은 입력이 있습니다. 계속 수정하거나 변경을 버리고 목록으로 돌아갈 수 있어요.</p></div>;
 case 'conflict':return <div className="proto-callout"><h3>다른 화면에서 먼저 수정했어요</h3><p>입력한 {v.price}원은 유지하고 있습니다. 최신 요금표를 확인한 뒤 다시 수정해 주세요.</p></div>;
 case 'history':return <DataTable label="요금표 버전 목록" columns={['버전 · 변경 내용','기록 시각']} rows={[...(v.revision>2?[[`v${v.revision} · 현재 적용`,"11.06 11:05"]]:[]),[v.revision===2?'v2 · 현재 적용':'v2 · 목욕 요금 조정',"11.06 10:30"],["v1 · 기존 저장본 보존","11.05 14:00"]]} onRow={()=>go('version')}/>;
 case 'version':return <><span className="proto-chip">v1 · 읽기 전용</span><p>이력 시작 시 보존한 저장본입니다. 최초 작성일은 알 수 없습니다.</p><PriceTable price="15000"/></>;
 case 'restore':return <><div className="proto-callout"><strong>v1 내용으로 복원할까요?</strong><p>새 버전이 추가됩니다. 기존 예약과 결제 금액은 바뀌지 않습니다.</p></div><DataTable label="복원 전후" columns={['항목','현재 → 복원']} rows={[["목욕 · 4kg 미만",`${v.savedPrice} → 15000`]]}/><TextField label="복원 사유 (선택)" defaultValue="요금 조정 철회"/></>;
 case 'restored':return <><div className="proto-success">✓</div><h3>v{v.revision}로 복원 내용을 저장했어요</h3><p>현재 목욕 금액은 {v.savedPrice}원입니다. 이전 버전은 이력에 남아 있습니다.</p></>;
 case 'price-delete':return <div className="proto-callout"><h3>소형견 미용 분류를 삭제할까요?</h3><p>고객 요금표에서 사라지고 연결된 새 예약 견적을 사용할 수 없게 됩니다. 기존 예약·결제 기록은 유지됩니다.</p></div>;
 case 'home':return <><p className="proto-chip">김몽글 보호자 · 계정 연결됨</p><Pet/><div className="proto-summary"><strong>몽이의 최근 미용</strong><span>11월 6일 · 전체 미용</span></div><h3>매장 공지</h3><p>11월 정기 휴무 안내</p></>;
 case 'request':return <><Pet/><Picker label="미용 서비스" defaultSelectedKey="bath"><PickerItem id="bath">목욕 · 18,000원</PickerItem><PickerItem id="full">전체 미용 · 65,000원</PickerItem></Picker><TextField label="방문 일시" defaultValue="2026-11-12 10:00"/><TextField label="연락처" defaultValue="010-0000-1234"/><TextArea label="요청사항" defaultValue="드라이 소리에 예민해요."/></>;
 case 'request-review':return <><Pet/><DataTable label="예약 신청 확인" columns={['항목','신청 내용']} rows={[["서비스","목욕"],["방문 시간","11월 12일 10:00"],["예상 금액","18,000원"]]}/><p>예상 금액이며 실제 상태와 추가 작업에 따라 상담 후 달라질 수 있어요.</p></>;
 case 'requested':return <><div className="proto-success">✓</div><h3>예약 신청을 접수했어요</h3><p>매장에서 확인 후 확정합니다. 아직 결제되거나 예약이 확정된 상태는 아니에요.</p></>;
 case 'notification':return <div className="proto-callout"><span className="proto-proposed">미구현 · 검토 제안</span><h3>몽이의 예약이 확정되었어요</h3><p>11월 12일 오전 10시<br/>메시지 채널과 발송 정책은 추후 결정합니다.</p></div>;
 case 'notice-list':return <><TextField label="공지 검색" placeholder="제목·내용 검색"/><DataTable label="공지 목록" columns={['제목','상태']} rows={[[v.savedNotice.title,v.savedNotice.published?'공개':'비공개'],['겨울철 발바닥 관리','비공개']]} onRow={()=>go('notice-detail')}/></>;
 case 'notice-detail':return <><span className="proto-chip">{v.savedNotice.published?'고객에게 공개':'비공개'}</span><h3>{v.savedNotice.title}</h3><p>{v.savedNotice.memo}</p></>;
 case 'notice-new':case 'notice-edit':return <><TextField label="공지 제목" value={v.title} onChange={v.setTitle}/><TextArea label="공지 내용" value={v.memo} onChange={v.setMemo}/><Checkbox isSelected={v.published} onChange={v.setPublished}>고객에게 공개</Checkbox></>;
 case 'notice-delete':return <div className="proto-callout"><h3>‘{v.title}’ 공지를 삭제할까요?</h3><p>고객 홈에서도 이 공지가 사라집니다.</p></div>;
 default:return <p>{s.purpose}</p>;
 }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Prototype/></React.StrictMode>);
