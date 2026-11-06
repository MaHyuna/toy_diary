import { useEffect, useState } from 'react';
import { ActionButton, Button, ButtonGroup, Content, Dialog, DialogContainer, Heading, Picker, PickerItem, Text, TextArea, TextField } from '@react-spectrum/s2';
import { MobilePriceMenu } from './MobilePriceMenu';
import type { PriceCellAddress } from './MobilePriceMenu';
import type { PriceMenu } from './price-menu';
import './price-poster.css';
import './ui/price-menu-layout.css';
type Section=PriceMenu['sections'][number];
type Edit={type:'section';index:number;draft:Section;kind:'table'|'list'}|{type:'cell';address:PriceCellAddress;label:string;value:string}|{type:'columns';draft:PriceMenu};
type Props={menu:PriceMenu;onChange:(m:PriceMenu)=>void;disabled:boolean};
const blank=(kind:'table'|'list',columns:string[]):Section=>({title:'',breeds:'',note:'',content:'',rows:kind==='table'?[{weight:'체중 기준',prices:columns.map(()=>'상담')}]:[],items:kind==='list'?[{label:'서비스',value:'상담'}]:[]});
export function SpectrumPriceEditor({menu,onChange,disabled}:Props){
 const [edit,setEdit]=useState<Edit|null>(null),[error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 const [wide,setWide]=useState(()=>matchMedia('(min-width:900px)').matches);
 useEffect(()=>{const q=matchMedia('(min-width:900px)'),change=()=>setWide(q.matches);q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
 function open(value:Edit){setError('');setConfirmDelete(false);setEdit(value);}
 function cell(address:PriceCellAddress,value:string){onChange({...menu,sections:menu.sections.map((s,si)=>si!==address.section?s:'item'in address?{...s,items:s.items.map((item,i)=>i===address.item?{...item,value}:item)}:{...s,rows:s.rows.map((r,ri)=>ri!==address.row?r:{...r,prices:r.prices.map((p,ci)=>ci===address.column?value:p)})})});}
 function sectionPatch(patch:Partial<Section>){if(edit?.type==='section')setEdit({...edit,draft:{...edit.draft,...patch}});}
 function apply(){
  if(!edit)return;
  if(edit.type==='cell')cell(edit.address,edit.value);
  else if(edit.type==='columns'){
   if(edit.draft.columns.some(c=>!c.trim())){setError('서비스 이름을 입력해 주세요.');return;}
   onChange(edit.draft);
  }else{
   if(!edit.draft.title.trim()||edit.draft.rows.some(r=>!r.weight.trim())||edit.draft.items.some(i=>!i.label.trim())){setError('섹션 제목과 체중·항목 이름을 입력해 주세요.');return;}
   onChange({...menu,sections:edit.index<0?[...menu.sections,edit.draft]:menu.sections.map((s,i)=>i===edit.index?edit.draft:s)});
  }
  setEdit(null);
 }
 const draft=edit?.type==='section'?edit.draft:null;
 return <>
 <div className="price-edit-toolbar"><Text>원본과 같은 배열입니다. 금액을 수정하고, 섹션 편집에서 제목·행·항목을 관리하세요.</Text><div className="price-section-actions"><Button isDisabled={disabled||menu.sections.length>=24} onPress={()=>open({type:'section',index:-1,kind:'table',draft:blank('table',menu.columns)})}>+ 섹션 추가</Button><Button variant="secondary" isDisabled={disabled} onPress={()=>open({type:'columns',draft:structuredClone(menu)})}>서비스 열 편집</Button></div></div>
 <div className="price-sheet-editor"><MobilePriceMenu menu={menu} sectionActions={index=><ActionButton isQuiet isDisabled={disabled} aria-label={`${menu.sections[index].title} 섹션 편집`} onPress={()=>open({type:'section',index,draft:structuredClone(menu.sections[index]),kind:menu.sections[index].rows.length?'table':'list'})}>섹션 편집</ActionButton>} renderPrice={(value,label,address)=>wide?<TextField aria-label={label} value={value} maxLength={80} onChange={v=>cell(address,v)} isDisabled={disabled} UNSAFE_style={{width:'100%',minWidth:0}}/>:<ActionButton isQuiet size="S" aria-label={`${label} 수정`} isDisabled={disabled} UNSAFE_style={{width:'100%',minWidth:0,paddingInline:0,fontSize:'inherit',fontWeight:'inherit'}} onPress={()=>open({type:'cell',address,label,value})}>{/^\d+$/.test(value)?Number(value).toLocaleString('ko-KR'):value||'입력'}</ActionButton>}/></div>
 <Button variant="secondary" isDisabled={disabled||menu.sections.length>=24} onPress={()=>open({type:'section',index:-1,kind:'table',draft:blank('table',menu.columns)})}>+ 섹션 추가</Button>
 <DialogContainer onDismiss={()=>setEdit(null)}>{edit&&<Dialog size={edit.type==='cell'?'S':'L'}><Heading slot="title">{edit.type==='cell'?'금액 수정':edit.type==='columns'?'서비스 열 편집':edit.index<0?'섹션 추가':'섹션 편집'}</Heading><Content><div className="mongle-workflow-stack">
 {edit.type==='cell'&&<TextField autoFocus label={edit.label} value={edit.value} maxLength={80} onChange={value=>setEdit({...edit,value})} description="숫자 외에 상담, 복수 금액도 그대로 입력할 수 있어요."/>}
 {edit.type==='section'&&draft&&<>
 <TextField autoFocus label="섹션 제목" value={draft.title} onChange={title=>sectionPatch({title})} maxLength={120} isRequired/>
 {edit.index<0&&<Picker label="섹션 형식" selectedKey={edit.kind} onSelectionChange={key=>{const kind=key as 'table'|'list';setEdit({...edit,kind,draft:{...blank(kind,menu.columns),title:draft.title,breeds:draft.breeds,note:draft.note,content:draft.content}});}}><PickerItem id="table">체중별 요금표</PickerItem><PickerItem id="list">항목·금액 목록 (고양이·추가 요금 등)</PickerItem></Picker>}
 <TextField label="견종 안내" value={draft.breeds} onChange={breeds=>sectionPatch({breeds})} maxLength={2000}/><TextField label="추가 요금·주의 안내" value={draft.note} onChange={note=>sectionPatch({note})} maxLength={2000}/><TextArea label="기타 설명" value={draft.content} onChange={content=>sectionPatch({content})} maxLength={2000}/>
 <Heading level={3}>체중 행</Heading><div className="price-section-draft-rows">{draft.rows.map((row,ri)=><div className="price-section-draft-row" key={ri}><div><TextField label={`${ri+1}번째 체중 기준`} value={row.weight} onChange={weight=>sectionPatch({rows:draft.rows.map((r,i)=>i===ri?{...r,weight}:r)})} maxLength={120}/></div><Button variant="secondary" aria-label={`${ri+1}번째 체중 행 삭제`} onPress={()=>sectionPatch({rows:draft.rows.filter((_,i)=>i!==ri)})}>삭제</Button></div>)}</div><div><Button isDisabled={!menu.columns.length||draft.rows.length>=30} variant="secondary" onPress={()=>sectionPatch({rows:[...draft.rows,{weight:'체중 기준',prices:menu.columns.map(()=>'상담')}]})}>+ 체중 행 추가</Button></div>
 <Heading level={3}>추가 항목</Heading>{draft.items.map((item,ii)=><div className="mongle-workflow-stack" key={ii}><TextField label={`${ii+1}번째 항목 이름`} value={item.label} onChange={label=>sectionPatch({items:draft.items.map((v,i)=>i===ii?{...v,label}:v)})} maxLength={120}/><TextField label={`${ii+1}번째 항목 금액`} value={item.value} onChange={value=>sectionPatch({items:draft.items.map((v,i)=>i===ii?{...v,value}:v)})} maxLength={80}/><div><Button variant="secondary" aria-label={`${ii+1}번째 추가 항목 삭제`} onPress={()=>sectionPatch({items:draft.items.filter((_,i)=>i!==ii)})}>항목 삭제</Button></div></div>)}<div><Button variant="secondary" isDisabled={draft.items.length>=40} onPress={()=>sectionPatch({items:[...draft.items,{label:'서비스',value:'상담'}]})}>+ 항목 추가</Button></div>
 {edit.index>=0&&<div>{confirmDelete?<><p>이 섹션의 표와 항목을 삭제할까요? 요금표 저장 전까지는 게시 내용이 바뀌지 않습니다.</p><Button variant="negative" onPress={()=>{onChange({...menu,sections:menu.sections.filter((_,i)=>i!==edit.index)});setEdit(null);}}>섹션 삭제 확인</Button></>:<Button variant="negative" fillStyle="outline" onPress={()=>setConfirmDelete(true)}>섹션 삭제</Button>}</div>}
 </>}
 {edit.type==='columns'&&<><Text>모든 체중별 표에 공통 적용됩니다. 열을 삭제하면 해당 열의 금액도 제거됩니다.</Text>{edit.draft.columns.map((c,ci)=><div className="price-section-draft-row" key={ci}><div><TextField label={`${ci+1}번째 서비스 이름`} value={c} maxLength={120} onChange={value=>setEdit({...edit,draft:{...edit.draft,columns:edit.draft.columns.map((x,i)=>i===ci?value:x)}})}/></div><Button variant="secondary" aria-label={`${ci+1}번째 서비스 열 삭제`} isDisabled={edit.draft.columns.length<=1} onPress={()=>setEdit({...edit,draft:{...edit.draft,columns:edit.draft.columns.filter((_,i)=>i!==ci),sections:edit.draft.sections.map(s=>({...s,rows:s.rows.map(r=>({...r,prices:r.prices.filter((_,i)=>i!==ci)}))}))}})}>삭제</Button></div>)}<div><Button variant="secondary" isDisabled={edit.draft.columns.length>=8} onPress={()=>setEdit({...edit,draft:{...edit.draft,columns:[...edit.draft.columns,'새 서비스'],sections:edit.draft.sections.map(s=>({...s,rows:s.rows.map(r=>({...r,prices:[...r.prices,'상담']}))}))}})}>+ 서비스 열 추가</Button></div></>}
 {error&&<p role="alert">{error}</p>}
 </div></Content><ButtonGroup><Button variant="secondary" onPress={()=>setEdit(null)}>취소</Button><Button variant="accent" onPress={apply}>적용</Button></ButtonGroup></Dialog>}</DialogContainer>
 </>;
}
