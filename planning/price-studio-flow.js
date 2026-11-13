import {pairedSections} from './price-studio-layout.js?v=decor-26';
export function canMoveTextBelow(project,element){const b=element?.binding,s=project.sections.find(s=>s.id===b?.sectionId);return !!(b?.type==='section'&&['note','content'].includes(b.key)&&s&&s.kind!=='text'&&s[b.key]?.trim());}
// Split a text block into an independent full-width section after its current row.
export function moveTextBelow(project,element,id=crypto.randomUUID()){
 if(!canMoveTextBelow(project,element))return null;
 if(project.sections.length>=24)throw new Error('섹션은 최대 24개까지 만들 수 있어요.');
 const b=element.binding,source=project.sections.find(s=>s.id===b.sectionId),pair=pairedSections(project,source.id),after=pair?.at(-1)||source;
 const next={id,kind:'text',title:(source.title+' 안내').slice(0,100),breeds:'',note:'',content:source[b.key],span:'full',visible:true,hideHeading:true,flowSource:{sectionId:source.id,key:b.key},style:{body:source.style?.[b.key==='note'?'note':'body']||project.design.colors[b.key==='note'?'note':'body']}};
 const newId='sec:'+id+':content',oldStyle=project.canvas?.styles?.[element.id]||{},size=oldStyle.fontSize||(b.key==='note'?project.design.bodySize-1:project.design.bodySize);
 project.canvas??={styles:{},transforms:{}};project.canvas.styles??={};project.canvas.transforms??={};
 const style={...oldStyle,fontSize:size};delete style.width;
 if(style.lineHeight===undefined)style.lineHeight=Math.min(3,Math.max(1,(b.key==='note'?project.design.bodySize+5:project.design.bodySize+7)/size));
 project.canvas.styles[newId]=style;delete project.canvas.styles[element.id];delete project.canvas.transforms[element.id];
 source[b.key]='';project.sections.splice(project.sections.indexOf(after)+1,0,next);
 if(project.design.format==='fit')project.design.format='portrait';
 return newId;
}
export function returnDestination(p,e){
 const s=p.sections.find(s=>s.id===e?.binding?.sectionId);if(s?.kind!=='text'||!s.hideHeading||e.binding.key!=='content')return null;
 const ref=s.flowSource;
 const source=ref?p.sections.find(v=>v.id===ref.sectionId):p.sections.slice(0,p.sections.indexOf(s)).reverse().find(v=>v.kind!=='text'&&(v.title+' 안내').slice(0,100)===s.title);
 if(!source||!source.visible)return null;
 const key=ref?.key||(!source.note?'note':!source.content?'content':null);return key?{source,key,section:s}:null;
}
export function returnTextToColumn(p,e){
 const target=returnDestination(p,e);if(!target)return null;const {source,key,section}=target;
 if(source[key]?.trim())throw new Error('원래 위치에 새 내용이 있어요. 내용을 비운 뒤 다시 옮겨 주세요.');
 if(section.note?.trim()||section.breeds?.trim())throw new Error('새 섹션에 추가한 안내 내용이 있어요. 따로 옮긴 뒤 다시 시도해 주세요.');
 const id='sec:'+source.id+':'+key;p.canvas??={styles:{},transforms:{}};p.canvas.styles??={};
 const style={...p.canvas.styles[e.id]};delete style.width;style.color??=section.style?.body||p.design.colors.body;
 p.canvas.styles[id]=style;delete p.canvas.styles[e.id];if(p.canvas.transforms)delete p.canvas.transforms[e.id];
 source[key]=section.content;p.sections.splice(p.sections.indexOf(section),1);return id;
}
