import {SHAPES,drawShape} from './price-studio-shapes.js?v=decor-21';
export const BORDERS={none:'없음',line:'직선',double:'이중선',rounded:'라운드',scallop:'물결',dashed:'점선',dotted:'도트'};
export const CORNERS={none:'없음',angle:'ㄱ자 선',round:'둥근 선',doubleAngle:'이중 ㄱ자',step:'계단 선',arc:'원호',flourish:'장식 곡선',...SHAPES};
export const CORNER_POSITIONS={tl:'왼쪽 위',tr:'오른쪽 위',br:'오른쪽 아래',bl:'왼쪽 아래'};
// Old backups used center coordinates. Preserve those until a new anchor is chosen.
export function cornerSettings(d,key){
 const detail=d.cornerDetails?.[key]||{},edge=Math.min((d.pageMargin??48)/2,d.borderInset+8);
 const anchor=detail.anchor||d.cornerAnchor||([detail.x,detail.y,d.cornerX,d.cornerY].some(v=>v!==undefined)?'legacy':'border');
 return {shape:d.corners?(d.cornerShape||'leaf'):'none',size:d.cornerSize??14,x:d.cornerX??(anchor==='legacy'?edge:0),y:d.cornerY??(anchor==='legacy'?edge:0),rotation:d.cornerRotation??0,fill:d.cornerFill||'solid',stroke:d.cornerStroke??1.5,color:d.cornerColor||d.colors.decoration,...detail,anchor};
}
function roundedFrame(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.stroke();}
export function drawBorder(ctx,d,W,H){
 const i=d.borderInset;if(d.border==='none')return;ctx.save();ctx.strokeStyle=d.borderColor||d.colors.line;ctx.lineWidth=d.borderWidth;
 const pattern=d.borderPattern||(d.border==='dashed'?'dashed':d.border==='dotted'?'dotted':'solid');ctx.setLineDash(pattern==='dashed'?[8,5]:pattern==='dotted'?[2,4]:[]);
 if(d.border==='scallop'){ctx.beginPath();ctx.moveTo(i,i);for(let x=i;x<W-i;x+=22)ctx.quadraticCurveTo(Math.min(x+11,W-i),i+6,Math.min(x+22,W-i),i);for(let y=i;y<H-i;y+=22)ctx.quadraticCurveTo(W-i-6,Math.min(y+11,H-i),W-i,Math.min(y+22,H-i));for(let x=W-i;x>i;x-=22)ctx.quadraticCurveTo(Math.max(x-11,i),H-i-6,Math.max(x-22,i),H-i);for(let y=H-i;y>i;y-=22)ctx.quadraticCurveTo(i+6,Math.max(y-11,i),i,Math.max(y-22,i));ctx.closePath();ctx.stroke();}
 else{const r=d.borderRadius??(d.border==='rounded'?24:0);roundedFrame(ctx,i,i,W-i*2,H-i*2,r);if(d.border==='double'){ctx.lineWidth=d.borderWidth*.6;roundedFrame(ctx,i+7,i+7,W-i*2-14,H-i*2-14,Math.max(0,r-7));}}
 ctx.restore();
}
export function drawCorner(ctx,settings,x,y,angle,background){
 const s=settings;if(s.shape==='none')return;ctx.save();ctx.translate(x,y);ctx.rotate((angle+s.rotation)*Math.PI/180);ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.stroke;
 if(Object.hasOwn(SHAPES,s.shape))drawShape(ctx,s.shape,0,0,s.size,s.color,background,s.fill,s.stroke);
 else{const h=s.size/2;ctx.beginPath();
  if(s.shape==='angle'){ctx.moveTo(-h,h);ctx.lineTo(-h,-h);ctx.lineTo(h,-h);}
  if(s.shape==='round'){ctx.moveTo(-h,h);ctx.lineTo(-h,0);ctx.quadraticCurveTo(-h,-h,0,-h);ctx.lineTo(h,-h);}
  if(s.shape==='doubleAngle'){for(const off of [0,s.size*.22]){ctx.moveTo(-h+off,h);ctx.lineTo(-h+off,-h+off);ctx.lineTo(h,-h+off);}}
  if(s.shape==='step'){ctx.moveTo(-h,h);ctx.lineTo(-h,0);ctx.lineTo(0,0);ctx.lineTo(0,-h);ctx.lineTo(h,-h);}
  if(s.shape==='arc'){ctx.moveTo(-h,h);ctx.quadraticCurveTo(-h,-h,h,-h);}
  if(s.shape==='flourish'){ctx.moveTo(-h,h);ctx.bezierCurveTo(h,h,-h,-h,h,-h);ctx.moveTo(-h,0);ctx.quadraticCurveTo(h*.4,h*.4,0,-h);}
  ctx.stroke();
 }ctx.restore();
}
export function cornerGeometry(d,W,H){return Object.entries(CORNER_POSITIONS).map(([key,label],i)=>{
 const settings=cornerSettings(d,key),r=settings.size*.55*(Math.abs(Math.cos(settings.rotation*Math.PI/180))+Math.abs(Math.sin(settings.rotation*Math.PI/180)))+settings.stroke/2;
 const base=settings.anchor==='border'?d.borderInset:0,offset=settings.anchor==='legacy'?0:base+r;
 const dx=settings.x+offset,dy=settings.y+offset,x=Math.min(W-r,Math.max(r,key==='tr'||key==='br'?W-dx:dx)),y=Math.min(H-r,Math.max(r,key==='br'||key==='bl'?H-dy:dy));
 return {key,label,settings,x,y,r,angle:i*90};
});}
// Separate interaction targets never participate in content layout or exports.
export function decorationTargets(d,W,H){
 const i=d.borderInset,targets=[];
 if(d.border!=='none')for(const [key,x,y,width,height] of [['top',i,i,W-2*i,0],['right',W-i,i,0,H-2*i],['bottom',i,H-i,W-2*i,0],['left',i,i,0,H-2*i]])targets.push({id:'border:'+key,target:'border',label:'테두리 설정 열기',x,y,width,height});
 if(d.corners)for(const c of cornerGeometry(d,W,H))if(c.settings.shape!=='none')targets.push({id:'corner:'+c.key,target:c.key,label:c.label+' 모서리 설정 열기',x:c.x-c.r,y:c.y-c.r,width:c.r*2,height:c.r*2});
 return targets;
}
export function borderIcon(key){const dash=key==='dashed'?'stroke-dasharray="8 4"':key==='dotted'?'stroke-dasharray="2 4"':'';return `<svg viewBox="0 0 80 52" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" ${dash}>${key==='none'?'<path d="M25 40 55 12"/>':key==='scallop'?'<path d="M8 8Q16 15 24 8T40 8T56 8T72 8L72 44Q64 37 56 44T40 44T24 44T8 44Z"/>':`<rect x="8" y="8" width="64" height="36" rx="${key==='rounded'?12:0}"/>${key==='double'?'<rect x="13" y="13" width="54" height="26"/>':''}`}</g></svg>`;}
export function cornerIcon(key){const paths={none:'M20 40 60 12',angle:'M20 42V12H60',round:'M20 42V28Q20 12 36 12H60',doubleAngle:'M18 42V10H60M27 42V19H60',step:'M20 42V27H40V12H60',arc:'M20 42Q20 12 60 12',flourish:'M20 42C60 42 20 12 60 12M20 27Q48 35 40 12'};if(paths[key])return `<svg viewBox="0 0 80 52" aria-hidden="true"><path d="${paths[key]}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;return `<span class="shape-symbol" aria-hidden="true">${{flower:'✿',paw:'🐾',heart:'♡',star:'☆',sparkle:'✧',diamond:'◇',circle:'○',leaf:'❧'}[key]}</span>`;}
