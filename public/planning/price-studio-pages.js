import {renderPoster} from './price-studio-render.js?v=list-width-14';
export const A4_HEIGHT=1273;
// Keep every section and row on one A4 sheet without changing saved typography or data.
export function renderSheetPoster(canvas,project,logo){
 if(project.design.format!=='portrait')return renderPoster(canvas,project,logo);
 const original=renderPoster(canvas,project,logo,{measureOnly:true});
 let layout=project;
 if(original.requiredHeight>A4_HEIGHT){
  // Reduce surplus spacing first, then scale the complete composition proportionally.
  layout={...project,design:{...project.design,gap:Math.min(project.design.gap,10),rowHeight:Math.min(project.design.rowHeight,24)}};
 }
 return renderPoster(canvas,layout,logo,{fixedHeight:A4_HEIGHT,fitToPage:true});
}
