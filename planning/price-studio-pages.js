import {renderPoster} from './price-studio-render.js?v=spacing-15';
export const A4_HEIGHT=1273;
// Keep every section and row on one A4 sheet without changing saved typography or data.
export function renderSheetPoster(canvas,project,logo){
 if(project.design.format!=='portrait')return renderPoster(canvas,project,logo);
 // Keep user spacing intact; fit the entire layout proportionally.
 return renderPoster(canvas,project,logo,{fixedHeight:A4_HEIGHT,fitToPage:true});
}
