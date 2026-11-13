import {renderPoster} from './price-studio-render.js?v=weight-font-29';
import {OutlineCanvas,outlineFonts,loadScript} from './price-studio-svg.js?v=weight-font-29';
export const PAPERS={A0:[841,1189],A1:[594,841],A2:[420,594],A3:[297,420],A4:[210,297],A5:[148,210],A6:[105,148],B4:[250,353],B5:[176,250],Letter:[215.9,279.4]};
export const PRINT_DEFAULTS={paper:'A4',width:210,height:297,orientation:'portrait',layout:'sheet',format:'pdf',dpi:300,bleed:0,cropMarks:false};
export function validatePrint(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('인쇄 설정을 확인해 주세요.');
 const p={...PRINT_DEFAULTS,...value};
 if(![...Object.keys(PAPERS),'custom'].includes(p.paper)||!['portrait','landscape'].includes(p.orientation)||!['sheet','natural'].includes(p.layout)||!['pdf','svg','png','jpg'].includes(p.format)||![72,150,300,600].includes(p.dpi)||![0,3,5].includes(p.bleed)||typeof p.cropMarks!=='boolean')throw Error('인쇄 설정을 확인해 주세요.');
 for(const key of ['width','height'])if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<40||p[key]>2000)throw Error('용지 크기는 40~2000mm로 입력해 주세요.');
 return Object.fromEntries(Object.keys(PRINT_DEFAULTS).map(k=>[k,p[k]]));
}
export function printGeometry(project,logo,settings){
 const s=validatePrint(settings);let [width,height]=PAPERS[s.paper]||[s.width,s.height];
 if(s.orientation==='landscape')[width,height]=[height,width];
 const scratch=document.createElement('canvas');
 if(s.layout==='natural'){
  const natural=renderPoster(scratch,project,logo,{measureOnly:true});height=width*Math.max(900,natural.requiredHeight)/900;
 }
 const logicalHeight=Math.round(900*height/width),options={fixedHeight:logicalHeight,fitToPage:s.layout==='sheet'};
 const margin=s.bleed+(s.cropMarks?5:0),outerWidth=width+margin*2,outerHeight=height+margin*2;
 return {settings:s,width,height,margin,outerWidth,outerHeight,logicalHeight,options,pixelWidth:Math.round(outerWidth/25.4*s.dpi),pixelHeight:Math.round(outerHeight/25.4*s.dpi)};
}
export function printPreview(canvas,project,logo,settings){const geometry=printGeometry(project,logo,settings);const result=renderPoster(canvas,project,logo,geometry.options);return {...geometry,result};}
export async function outlinedSVG(project,logo,settings){
 const g=printGeometry(project,logo,settings),fonts=await outlineFonts(),canvas=new OutlineCanvas(fonts);
 const result=renderPoster(canvas,project,logo,g.options);if(result.error)throw Error(result.error);
 const {width,height,margin,outerWidth,outerHeight}=g,s=g.settings;
 let marks='';
 if(s.cropMarks){
  const offset=s.bleed+1,length=3;
  for(const x of [margin,margin+width])for(const y of [margin,margin+height]){
   const dx=x===margin?-1:1,dy=y===margin?-1:1;
   marks+=`M${x+dx*offset} ${y}h${dx*length}M${x} ${y+dy*offset}v${dy*length}`;
  }
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outerWidth}mm" height="${outerHeight}mm" viewBox="0 0 ${outerWidth} ${outerHeight}"><title>요금표 · 글자 윤곽선</title><rect width="${outerWidth}" height="${outerHeight}" fill="#ffffff"/><rect x="${margin-s.bleed}" y="${margin-s.bleed}" width="${width+s.bleed*2}" height="${height+s.bleed*2}" fill="${project.design.colors.background}"/><g id="artwork" transform="translate(${margin} ${margin}) scale(${width/900} ${height/g.logicalHeight})">${canvas.markup}</g>${marks?`<path id="crop-marks" d="${marks}" fill="none" stroke="#000000" stroke-width="0.15"/>`:''}</svg>`;
 return {svg,geometry:g};
}
// Embed print density rather than leaving the browser's default 96dpi metadata.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export async function withDensity(blob,dpi,type){
 const bytes=new Uint8Array(await blob.arrayBuffer());
 if(type==='png'){
  const chunk=new Uint8Array(21),view=new DataView(chunk.buffer);view.setUint32(0,9);chunk.set([112,72,89,115],4);const ppm=Math.round(dpi/0.0254);view.setUint32(8,ppm);view.setUint32(12,ppm);chunk[16]=1;view.setUint32(17,crc32(chunk.subarray(4,17)));
  const parts=[bytes.subarray(0,33),chunk];let offset=33;while(offset<bytes.length){const length=new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0)+12;const isDensity=String.fromCharCode(...bytes.subarray(offset+4,offset+8))==='pHYs';if(!isDensity)parts.push(bytes.subarray(offset,offset+length));offset+=length;}return new Blob(parts,{type:'image/png'});
 }
 // Canvas JPEGs include JFIF; add one if an encoder omits it.
 let found=false;for(let i=2;i<bytes.length-16&&bytes[i]===0xff;){const marker=bytes[i+1];if(marker===0xda||marker===0xd9)break;const length=(bytes[i+2]<<8)|bytes[i+3];if(marker===0xe0&&String.fromCharCode(...bytes.subarray(i+4,i+9))==='JFIF\0'){bytes[i+11]=1;bytes[i+12]=dpi>>8;bytes[i+13]=dpi&255;bytes[i+14]=dpi>>8;bytes[i+15]=dpi&255;found=true;break;}i+=length+2;}
 if(found)return new Blob([bytes],{type:'image/jpeg'});
 const jfif=new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,dpi>>8,dpi&255,dpi>>8,dpi&255,0,0]);return new Blob([bytes.subarray(0,2),jfif,bytes.subarray(2)],{type:'image/jpeg'});
}
export async function exportPrint(project,logo,settings){
 const geometry=printGeometry(project,logo,settings),s=geometry.settings;
 if(['png','jpg'].includes(s.format)&&(geometry.pixelWidth*geometry.pixelHeight>32000000||Math.max(geometry.pixelWidth,geometry.pixelHeight)>16000))throw Error('이 크기의 이미지는 메모리가 많이 필요해요. 해상도를 낮추거나 크기 제한이 없는 PDF·SVG로 저장해 주세요.');
 const {svg}=await outlinedSVG(project,logo,s);
 if(s.format==='svg')return {blob:new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),geometry};
 if(s.format==='pdf'){
  await loadScript('jspdf.umd.min.js');await loadScript('svg2pdf.umd.min.js');
  const pdf=new window.jspdf.jsPDF({orientation:geometry.outerWidth>geometry.outerHeight?'landscape':'portrait',unit:'mm',format:[geometry.outerWidth,geometry.outerHeight],compress:true,precision:5,putOnlyUsedFonts:true});
  pdf.setProperties({title:'Price list',creator:'Price Studio'});
  const element=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
  await pdf.svg(element,{x:0,y:0,width:geometry.outerWidth,height:geometry.outerHeight});
  const context=pdf.internal.getCurrentPageInfo().pageContext,pt=72/25.4;
  context.trimBox={bottomLeftX:geometry.margin*pt,bottomLeftY:geometry.margin*pt,topRightX:(geometry.margin+geometry.width)*pt,topRightY:(geometry.margin+geometry.height)*pt};
  context.bleedBox={bottomLeftX:(geometry.margin-s.bleed)*pt,bottomLeftY:(geometry.margin-s.bleed)*pt,topRightX:(geometry.margin+geometry.width+s.bleed)*pt,topRightY:(geometry.margin+geometry.height+s.bleed)*pt};
  return {blob:pdf.output('blob'),geometry};
 }
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),canvas=document.createElement('canvas');
 try{
  const image=new Image();image.src=url;await image.decode();canvas.width=geometry.pixelWidth;canvas.height=geometry.pixelHeight;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,s.format==='png'?'image/png':'image/jpeg',.98));if(!blob)throw Error('이미지를 만들 메모리가 부족해요. 해상도를 낮춰 주세요.');
  return {blob:await withDensity(blob,s.dpi,s.format),geometry};
 }finally{URL.revokeObjectURL(url);canvas.width=canvas.height=1;}
}
