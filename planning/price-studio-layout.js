import {columnsFor} from './price-studio-model.js?v=decor-27';
// Fixed widths reserve a basis; flexible siblings receive the remaining space.
const baseMetrics=p=>{const d=p.design,full=900-2*(d.pageMargin??48),gap=d.columnGap??24,padding=Math.max(d.sectionPadding??24,d.flowers?(d.markerSize||18)+6:0);return {full,gap,padding,min:padding*2+116};};
const sectionMap=p=>new Map(p.sections.map(s=>[s.id,s]));
const visible=(node,sections)=>node.sectionId?!!sections.get(node.sectionId)?.visible:node.children.some(child=>visible(child,sections));
function minimumWidth(p,node,sections=sectionMap(p)){
 const base=baseMetrics(p);if(node.sectionId){const s=sections.get(node.sectionId);return s?.kind==='matrix'?Math.max(base.min,base.padding*2+112+columnsFor(p,s).length*24):base.min;}
 return Math.max(base.min,...node.children.filter(child=>visible(child,sections)).map(child=>minimumWidth(p,child,sections)));
}
export function structureRowStacks(p,children,width){const {gap}=baseMetrics(p);return children.length>1&&width-gap*(children.length-1)<children.reduce((sum,child)=>sum+minimumWidth(p,child),0);}
export function structureRowWidths(p,children,width){
 const {gap}=baseMetrics(p),available=Math.max(1,width-gap*(children.length-1)),sections=sectionMap(p),rawMins=children.map(child=>minimumWidth(p,child,sections)),minSum=rawMins.reduce((a,b)=>a+b,0),mins=rawMins.map(value=>value*Math.min(1,available/minSum));
 const bases=children.map(child=>child.sectionId?sections.get(child.sectionId)?.layoutWidth:undefined),free=bases.filter(value=>value===undefined).length,fixed=bases.reduce((sum,value)=>sum+(value||0),0);
 let widths;if(!free&&fixed>0)widths=bases.map((value,i)=>Math.max(mins[i],available*value/fixed));else widths=bases.map((value,i)=>Math.max(mins[i],value??(available-fixed)/Math.max(1,free)));
 const sum=widths.reduce((a,b)=>a+b,0);
 if(sum>available){const room=widths.reduce((total,value,i)=>total+Math.max(0,value-mins[i]),0);widths=widths.map((value,i)=>Math.max(mins[i],value-(sum-available)*Math.max(0,value-mins[i])/(room||1)));}
 else if(sum<available){const flexible=free?bases.map(value=>value===undefined):bases.map(()=>true),count=flexible.filter(Boolean).length;widths=widths.map((value,i)=>value+(flexible[i]?(available-sum)/count:0));}
 // Correct floating point residue so every row ends at the same right edge.
 if(widths.length)widths[widths.length-1]+=available-widths.reduce((a,b)=>a+b,0);return widths;
}
function structureGeometry(p){
 const sections=sectionMap(p),widths=new Map(),pairs=new Map(),containers=new Map();
 function visit(node,width){
  if(node.sectionId){if(sections.get(node.sectionId)?.visible)widths.set(node.sectionId,width);return;}
  const children=node.children.filter(child=>visible(child,sections));if(!children.length)return;
  const row=node.direction==='row'&&!structureRowStacks(p,children,width);
  if(!row){children.forEach(child=>visit(child,width));return;}
  const sizes=structureRowWidths(p,children,width);children.forEach((child,i)=>visit(child,sizes[i]));
  if(children.length===2&&children.every(child=>child.sectionId))for(const child of children){pairs.set(child.sectionId,children.map(c=>sections.get(c.sectionId)));containers.set(child.sectionId,width);}
 }
 if(p.structure)visit(p.structure,baseMetrics(p).full);return {widths,pairs,containers};
}
export function rowMetrics(p,id){const base=baseMetrics(p),geometry=p.structure&&id?structureGeometry(p):null,pair=geometry?.pairs.get(id),full=geometry?.containers.get(id)??base.full,available=full-base.gap;let min=base.min,max=available-base.min;
 if(pair){const index=pair[0].id===id?0:1;min=minimumWidth(p,{sectionId:id});max=available-minimumWidth(p,{sectionId:pair[1-index].id});}
 return {...base,full,available,min,max};}

export function pairedSections(p,id){
 if(p.structure)return structureGeometry(p).pairs.get(id)||null;
 const shown=p.sections.filter(s=>s.visible);for(let i=0;i<shown.length-1;i++){const a=shown[i],b=shown[i+1];if(a.span==='half'&&b.span==='half'&&a.kind!=='matrix'&&b.kind!=='matrix'){if(a.id===id||b.id===id)return [a,b];i++;}}return null;
}
export function rowWidths(p,left,right){
 if(p.structure){const geometry=structureGeometry(p),pair=geometry.pairs.get(left.id);if(pair&&pair[0].id===left.id&&pair[1].id===right.id)return [geometry.widths.get(left.id),geometry.widths.get(right.id)];}
 return structureRowWidths(p,[{sectionId:left.id},{sectionId:right.id}],baseMetrics(p).full);
}
export function sectionWidth(p,s){
 const m=baseMetrics(p);if(p.structure)return structureGeometry(p).widths.get(s.id)??m.full;
 const pair=pairedSections(p,s.id);if(pair)return rowWidths(p,...pair)[pair[0].id===s.id?0:1];return s.span==='half'&&s.kind!=='matrix'?Math.max(m.min,Math.min(m.full,s.layoutWidth??(m.full-m.gap)/2)):m.full;
}
export function setSectionWidth(p,id,width){
 const s=p.sections.find(section=>section.id===id),pair=pairedSections(p,id);if(!s||!Number.isFinite(width))return;
 if(p.structure&&!pair)return;
 if(!p.structure&&(s.kind==='matrix'||s.span!=='half'))return;
 const m=rowMetrics(p,id);s.layoutWidth=Math.max(m.min,Math.min(pair?m.max:m.full,width));if(pair)delete pair.find(item=>item.id!==id).layoutWidth;
}
