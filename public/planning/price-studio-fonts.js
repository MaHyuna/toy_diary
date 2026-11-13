// Bundled Korean fonts share the same files in the canvas and outlined exports.
export const FONT_FAMILIES={StudioSans:'고딕 · 나눔고딕',Jua:'둥근 글꼴 · 주아',StudioSerif:'명조 · 나눔명조',StudioHand:'손글씨 · 나눔손글씨 펜'};
export const FONT_FILES={Jua:'Jua-Regular.woff',regular:'NanumGothic-Regular.ttf',bold:'NanumGothic-Bold.ttf',StudioSerif:'NanumMyeongjo-Regular.woff',StudioSerifBold:'NanumMyeongjo-Bold.woff',StudioHand:'NanumPenScript-Regular.woff'};
let ready;
export function installFontOptions(){
 const select=document.getElementById('canvas-font-family');
 if(select){const value=select.value;for(const [family,label] of Object.entries(FONT_FAMILIES)){let option=[...select.options].find(option=>option.value===family);if(!option){option=new Option(label,family);select.add(option);}option.textContent=label;}if(FONT_FAMILIES[value])select.value=value;}
 if(!ready)ready=Promise.all([['StudioSerif','NanumMyeongjo-Regular.woff','400'],['StudioSerif','NanumMyeongjo-Bold.woff','600 900'],['StudioHand','NanumPenScript-Regular.woff','400']].map(async([family,name,weight])=>{const face=new FontFace(family,`url("${new URL('../fonts/'+name,import.meta.url).href}")`,{weight,display:'swap'});document.fonts.add(face);await face.load();return face;})).catch(error=>{ready=null;throw error;});
 return ready;
}
