import {pairedSections} from './price-studio-layout.js?v=decor-23';
export function canMoveTextBelow(project,element){const b=element?.binding,s=project.sections.find(s=>s.id===b?.sectionId);return !!(b?.type==='section'&&['note','content'].includes(b.key)&&s&&s.kind!=='text'&&s[b.key]?.trim());}
// Split a text block into an independent full-width section after its current row.
export function moveTextBelow(project,element,id=crypto.randomUUID()){
 if(!canMoveTextBelow(project,element))return null;
 if(project.sections.length>=24)throw new Error('섹션은 최대 24개까지 만들 수 있어요.');
 const b=element.binding,source=project.sections.find(s=>s.id===b.sectionId),pair=pairedSections(project,source.id),after=pair?.at(-1)||source;
 const next={id,kind:'text',title:(source.title+' 안내').slice(0,100),breeds:'',note:'',content:source[b.key],span:'full',visible:true,hideHeading:true,style:{body:source.style?.[b.key==='note'?'note':'body']||project.design.colors[b.key==='note'?'note':'body']}};
 const newId='sec:'+id+':content',oldStyle=project.canvas?.styles?.[element.id]||{},size=oldStyle.fontSize||(b.key==='note'?project.design.bodySize-1:project.design.bodySize);
 project.canvas??={styles:{},transforms:{}};project.canvas.styles??={};project.canvas.transforms??={};
 const style={...oldStyle,fontSize:size};delete style.width;
 if(style.lineHeight===undefined)style.lineHeight=Math.min(3,Math.max(1,(b.key==='note'?project.design.bodySize+5:project.design.bodySize+7)/size));
 project.canvas.styles[newId]=style;delete project.canvas.styles[element.id];delete project.canvas.transforms[element.id];
 source[b.key]='';project.sections.splice(project.sections.indexOf(after)+1,0,next);
 if(project.design.format==='fit')project.design.format='portrait';
 return newId;
}
