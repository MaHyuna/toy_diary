import {columnsFor} from './price-studio-model.js?v=decor-26';
import {deriveStructure,flattenStructure,placeSection,placeGroup,syncStructure} from './price-studio-structure.js?v=decor-26';
const clone=value=>structuredClone(value),uid=()=>crypto.randomUUID();
const editable=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]');
function nodeById(node,id){if(node?.id===id)return node;for(const child of node?.children||[]){const found=nodeById(child,id);if(found)return found;}return null;}
function elementRef(p,e){const b=e?.binding,s=p.sections.find(v=>v.id===b?.sectionId);if(!b)return null;if(b.type==='brand')return {object:p.brand,key:b.key};if(!s)return null;if(b.type==='section')return {object:s,key:b.key};if(b.type==='item')return {object:s.items?.[b.index],key:b.key};if(b.type==='weight')return {object:s.rows?.find(r=>r.id===b.rowId),key:'weight'};const columns=columnsFor(p,s),j=columns.findIndex(c=>c.id===b.columnId);if(b.type==='column')return {object:columns[j],key:b.key};if(b.type==='price')return {object:s.rows?.find(r=>r.id===b.rowId)?.prices,key:j};return null;}
function capture(p,e,cut=false){
 if(!e)return null;const b=e.binding||{},section=p.sections.find(s=>s.id===b.sectionId),groupId=b.groupId||(['group','layoutGroup','container'].includes(b.type)?e.id?.replace(/^group:/,''):null);
 const styles=clone(p.canvas?.styles||{}),transforms=clone(p.canvas?.transforms||{});
 if(groupId){const tree=deriveStructure(p),node=nodeById(tree,groupId);if(!node||!node.children||node===tree)return null;const ids=flattenStructure(node);return {kind:'group',node:clone(node),sections:p.sections.filter(s=>ids.includes(s.id)).map(s=>({...clone(s),...(s.kind==='matrix'?{columns:clone(columnsFor(p,s))}:{})})),styles,transforms,cut,sourceId:groupId};}
 if(section&&['sectionGroup','table'].includes(b.type))return {kind:'section',sections:[{...clone(section),...(section.kind==='matrix'?{columns:clone(columnsFor(p,section))}:{})}],styles,transforms,cut,sourceId:section.id};
 const ref=elementRef(p,e);if(!ref?.object||typeof ref.object[ref.key]!=='string')return null;
 const note=b.type==='section'&&b.key==='note';return {kind:'text',text:ref.object[ref.key],style:{fontFamily:((b.type==='section'&&b.key==='title'||b.type==='brand'&&b.key==='name')&&p.design.font==='Jua'?'Jua':'StudioSans'),bold:b.type==='price'||b.type==='item'&&b.key==='value',...clone(styles[e.id]||{}),fontSize:styles[e.id]?.fontSize||e.textStyle?.fontSize||p.design.bodySize,color:styles[e.id]?.color||e.textStyle?.color||section?.style?.[note?'note':'body']||p.design.colors[note?'note':'body']},label:e.label,cut,sourceId:e.id,binding:clone(b)};
}
function copyBags(p,clip,map){p.canvas??={styles:{},transforms:{}};for(const bag of ['styles','transforms']){p.canvas[bag]??={};for(const [oldId,newId] of map){const prefix='sec:'+oldId;for(const [id,value] of Object.entries(clip[bag]||{}))if(id===prefix||id.startsWith(prefix+':'))p.canvas[bag]['sec:'+newId+id.slice(prefix.length)]=clone(value);}}}
export function installShortcuts({getProject,getSelected,undo,redo,changed,select,notice}){
 let clipboard=null;
 function targetId(p){const selected=getSelected();return p.sections.some(s=>s.id===selected?.binding?.sectionId)?selected.binding.sectionId:p.sections.at(-1)?.id;}
 function paste(clip){const p=getProject(),backup=clone(p),target=targetId(p);try{
  let selectedId;
  if(clip.kind==='text'){
   if(p.sections.length>=24)throw Error('섹션은 최대 24개까지 만들 수 있어요.');
   const origin=clip.cut?elementRef(p,{id:clip.sourceId,binding:clip.binding}):null;if(clip.cut&&(!origin?.object||origin.object[origin.key]!==clip.text))throw Error('잘라낸 원문이 변경됐어요. 다시 복사해 주세요.');
   const section={id:uid(),kind:'text',title:'붙여넣은 텍스트',breeds:'',note:'',content:clip.text,span:'full',visible:true,hideHeading:true,style:{}};p.sections.push(section);p.canvas??={styles:{},transforms:{}};p.canvas.styles??={};const style={...clip.style};delete style.width;p.canvas.styles['sec:'+section.id+':content']=style;syncStructure(p);if(target)placeSection(p,section.id,target,'after');if(origin)origin.object[origin.key]='';selectedId='sec:'+section.id+':content';
  }else if(clip.cut){
   if(clip.kind==='group'){placeGroup(p,clip.sourceId,target,'after');selectedId='sec:'+flattenStructure(clip.node)[0];}
   else{placeSection(p,clip.sourceId,target,'after');selectedId='sec:'+clip.sourceId;}
  }else{
   if(p.sections.length+clip.sections.length>24)throw Error('섹션은 최대 24개까지 만들 수 있어요.');
   const ids=new Map(clip.sections.map(s=>[s.id,uid()]));const copies=clip.sections.map(s=>({...clone(s),id:ids.get(s.id)}));for(const s of copies)if(s.flowSource&&ids.has(s.flowSource.sectionId))s.flowSource.sectionId=ids.get(s.flowSource.sectionId);
   p.sections.push(...copies);copyBags(p,clip,ids);syncStructure(p);
   if(clip.kind==='group'){
    const copiedLeaves=new Set(ids.values());function prune(node){node.children=node.children.filter(c=>!c.sectionId||!copiedLeaves.has(c.sectionId));for(const c of node.children)if(c.children)prune(c);}prune(p.structure);
    const mapNode=node=>node.sectionId?{sectionId:ids.get(node.sectionId)}:{id:uid(),direction:node.direction,children:node.children.map(mapNode)};const group=mapNode(clip.node);p.structure.children.push(group);if(target)placeGroup(p,group.id,target,'after');selectedId='sec:'+copies[0].id;
   }else{if(target)placeSection(p,copies[0].id,target,'after');selectedId='sec:'+copies[0].id;}
  }
  if(p.design.format==='fit')p.design.format='portrait';changed();select(selectedId);if(clip.cut)clipboard=null;notice(clip.cut?'선택한 내용을 옮겼어요.':'선택한 내용을 붙여넣었어요.');
 }catch(error){for(const key of Object.keys(p))delete p[key];Object.assign(p,backup);notice(error.message);}}
 function keydown(e){if(e.defaultPrevented||e.isComposing||editable(e.target)||!(e.ctrlKey||e.metaKey)||e.altKey)return;const key=e.key.toLowerCase();
  if(key==='z'||key==='y'){e.preventDefault();if(key==='y'||e.shiftKey)redo();else undo();return;}
  if(!['c','x','v','d'].includes(key)||document.querySelector('dialog[open]'))return;
  if(key==='v'){if(clipboard){e.preventDefault();paste(clipboard);}return;}
  const selection=getSelected();if(key==='x'&&(['weight','column'].includes(selection?.binding?.type)||selection?.binding?.type==='section'&&selection.binding.key==='title')){e.preventDefault();notice('표 제목·열 이름·몸무게는 내용 편집창에서 잘라내거나, 해당 행·열을 드래그해 이동해 주세요.');return;}
  const clip=capture(getProject(),selection,key==='x');if(!clip)return;e.preventDefault();
  if(key==='d'){paste(clip);return;}
  clipboard=clip;if(clip.kind==='text')navigator.clipboard?.writeText(clip.text).catch(()=>{});notice(key==='x'?'잘라낼 내용을 선택했어요. 붙여넣으면 원래 위치에서 이동합니다.':'선택한 내용을 복사했어요.');
 }
 function externalPaste(e){if(e.defaultPrevented||editable(e.target)||document.querySelector('dialog[open]'))return;const value=e.clipboardData?.getData('text/plain');if(!value)return;e.preventDefault();paste({kind:'text',text:value.slice(0,5000),style:{},cut:false});}
 document.addEventListener('keydown',keydown);document.addEventListener('paste',externalPaste);
 return {dispose(){document.removeEventListener('keydown',keydown);document.removeEventListener('paste',externalPaste);}};
}
