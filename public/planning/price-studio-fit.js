import {sectionWidth as getSectionWidth,setSectionWidth,pairedSections,rowMetrics} from './price-studio-layout.js?v=decor-26';
import {layoutText} from './price-studio-text.js?v=decor-26';
// Grow the frame/section, never alter either cell's typography to force a fit.
export function fitItemWidth(project,element,ctx){
 const section=project.sections.find(s=>s.id===element.binding.sectionId),item=section?.items?.[element.binding.index];
 if(!item)return {fits:false,expanded:false};
 const d=project.design,id=element.id,valueId=id.replace(/:label$/,':value');
 project.canvas??={transforms:{},styles:{}};project.canvas.styles??={};
 const styles=project.canvas.styles,ls=styles[id]||{},vs=styles[valueId]||{};
 const measure=(value,style,size,bold)=>{const l=layoutText(ctx,value,100000,`${bold?'600':'400'} ${size}px StudioSans`,size+5,style);ctx.font=l.font;ctx.letterSpacing=l.spacing+'px';return Math.max(...String(value).split('\n').map(line=>ctx.measureText(line).width))+2*l.padding+4;};
 const labelWidth=Math.max(40,Math.ceil(measure(item.label,ls,d.bodySize,false))),valueWidth=Math.max(64,Math.ceil(measure(item.value||'—',vs,d.priceSize,true)));
 const {padding}=rowMetrics(project),gap=12;let sectionWidth=getSectionWidth(project,section);
 const required=labelWidth+valueWidth+gap+2*padding,oldWidth=sectionWidth;
 if(required>sectionWidth&&(section.span==='half'||pairedSections(project,section.id))){setSectionWidth(project,section.id,required);sectionWidth=getSectionWidth(project,section);}
 const expanded=sectionWidth>oldWidth,paired=!!pairedSections(project,section.id);
 const available=sectionWidth-2*padding,width=Math.max(40,Math.min(labelWidth,available-gap-Math.min(valueWidth,available-gap-40)));
 styles[id]={...ls,width};
 // A content edit must not trigger an implicit whole-sheet font reduction.
 if(d.format==='fit')d.format='portrait';
 return {expanded,paired,fits:labelWidth+valueWidth+gap<=available&&!item.label.includes('\n')&&!item.value.includes('\n')};
}
