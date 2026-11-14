import {renderPoster} from './price-studio-render.js?v=layout-fix-34';
export const A4_HEIGHT=1273;
export function renderSheetPoster(canvas,project,logo){
 // Shrinking is an explicit export choice, never the default editing behavior.
 if(project.design.format==='fit'){const d=project.design,margin=d.borderInset+(d.fitPadding??12),fitted={...project,design:{...d,pageMargin:margin,headerTop:margin}};return renderPoster(canvas,fitted,logo,{fixedHeight:A4_HEIGHT,fitToPage:true});}
 if(project.design.format==='portrait'){
  const natural=renderPoster(canvas,project,logo,{measureOnly:true});
  return renderPoster(canvas,project,logo,{fixedHeight:Math.max(A4_HEIGHT,natural.requiredHeight)});
 }
 return renderPoster(canvas,project,logo);
}
