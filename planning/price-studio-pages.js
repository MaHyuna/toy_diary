import {renderPoster} from './price-studio-render.js?v=print-17';
export const A4_HEIGHT=1273;
export function renderSheetPoster(canvas,project,logo){
 // Shrinking is an explicit export choice, never the default editing behavior.
 if(project.design.format==='fit')return renderPoster(canvas,project,logo,{fixedHeight:A4_HEIGHT,fitToPage:true});
 if(project.design.format==='portrait'){
  const natural=renderPoster(canvas,project,logo,{measureOnly:true});
  return renderPoster(canvas,project,logo,{fixedHeight:Math.max(A4_HEIGHT,natural.requiredHeight)});
 }
 return renderPoster(canvas,project,logo);
}
