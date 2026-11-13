import {FONT_FILES} from './price-studio-fonts.js?v=decor-25';
// Record the same drawing operations as the preview, with text converted to paths.
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const number=n=>Number(n.toFixed(5));
let fontsPromise;
const scripts=new Map();
export function loadScript(name){
 if(!scripts.has(name))scripts.set(name,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/'+name,import.meta.url);script.onload=resolve;script.onerror=()=>{scripts.delete(name);script.remove();reject(Error('출력 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 저장해 주세요.'));};document.head.append(script);}));
 return scripts.get(name);
}
export function outlineFonts(){
 if(!fontsPromise)fontsPromise=(async()=>{
  await loadScript('opentype.min.js');
  const entries=await Promise.all(Object.entries(FONT_FILES).map(async([key,name])=>{
   const response=await fetch(new URL('../fonts/'+name,import.meta.url));if(!response.ok)throw Error('인쇄 글꼴을 읽지 못했어요. 다시 시도해 주세요.');return [key,window.opentype.parse(await response.arrayBuffer())];
  }));return Object.fromEntries(entries);
 })().catch(e=>{fontsPromise=null;throw e;});
 return fontsPromise;
}
const properties=['fillStyle','strokeStyle','lineWidth','font','textAlign','letterSpacing','elementId'];
export class OutlineCanvas {
 constructor(fonts){this.width=1800;this.height=2546;this.context=new SVGContext(fonts);}
 getContext(){return this.context;}
 get markup(){return this.context.nodes.join('');}
}
class SVGContext {
 constructor(fonts){this.fonts=fonts;this.measure=document.createElement('canvas').getContext('2d');this.measure.canvas.lang='ko';this.nodes=[];this.stack=[];this.matrix=new DOMMatrix();this.fillStyle='#000000';this.strokeStyle='#000000';this.lineWidth=1;this.font='14px StudioSans';this.textAlign='left';this.letterSpacing='0px';this.dash=[];this.path='';this.elementId='paper';}
 save(){this.stack.push({matrix:DOMMatrix.fromMatrix(this.matrix),dash:[...this.dash],...Object.fromEntries(properties.map(k=>[k,this[k]]))});}
 restore(){const state=this.stack.pop();if(state)Object.assign(this,state);}
 setTransform(a,b,c,d,e,f){this.matrix=new DOMMatrix([a/2,b/2,c/2,d/2,e/2,f/2]);}
 translate(x,y){this.matrix.translateSelf(x,y);}
 scale(x,y=x){this.matrix.scaleSelf(x,y);}
 rotate(r){this.matrix.rotateSelf(r*180/Math.PI);}
 setLineDash(value){this.dash=[...value];}
 measureText(text){const ctx=this.measure;ctx.font=this.font;ctx.fontKerning='none';ctx.letterSpacing=this.letterSpacing;return ctx.measureText(text);}
 emit(tag,attrs,extraMatrix){const m=extraMatrix?this.matrix.multiply(extraMatrix):this.matrix;const transform=`matrix(${[m.a,m.b,m.c,m.d,m.e,m.f].map(number).join(' ')})`;this.nodes.push(`<${tag} data-element="${escape(this.elementId)}" transform="${transform}" ${attrs}/>`);}
 fillRect(x,y,width,height){this.emit('rect',`x="${x}" y="${y}" width="${width}" height="${height}" fill="${escape(this.fillStyle)}"`);}
 strokeRect(x,y,width,height){this.emit('rect',`x="${x}" y="${y}" width="${width}" height="${height}" ${this.strokeAttributes()}`);}
 strokeAttributes(){return `fill="none" stroke="${escape(this.strokeStyle)}" stroke-width="${this.lineWidth}"${this.dash.length?` stroke-dasharray="${this.dash.join(' ')}"`:''}`;}
 beginPath(){this.path='';}
 moveTo(x,y){this.path+=`M${number(x)} ${number(y)}`;}
 lineTo(x,y){this.path+=`L${number(x)} ${number(y)}`;}
 quadraticCurveTo(x,y,x2,y2){this.path+=`Q${[x,y,x2,y2].map(number).join(' ')}`;}
 bezierCurveTo(...values){this.path+='C'+values.map(number).join(' ');}
 closePath(){this.path+='Z';}
 ellipse(x,y,rx,ry,rotation,start,end,anticlockwise=false){
  let sweep=end-start;if(Math.abs(sweep)>=Math.PI*2)sweep=(anticlockwise?-1:1)*Math.PI*2;else if(anticlockwise&&sweep>0)sweep-=Math.PI*2;else if(!anticlockwise&&sweep<0)sweep+=Math.PI*2;
  const count=Math.max(1,Math.ceil(Math.abs(sweep)/(Math.PI/2))),step=sweep/count;
  const point=t=>[x+rx*Math.cos(t)*Math.cos(rotation)-ry*Math.sin(t)*Math.sin(rotation),y+rx*Math.cos(t)*Math.sin(rotation)+ry*Math.sin(t)*Math.cos(rotation)];
  const tangent=t=>[-rx*Math.sin(t)*Math.cos(rotation)-ry*Math.cos(t)*Math.sin(rotation),-rx*Math.sin(t)*Math.sin(rotation)+ry*Math.cos(t)*Math.cos(rotation)];
  const first=point(start);if(this.path)this.lineTo(...first);else this.moveTo(...first);
  for(let i=0;i<count;i++){const a=start+step*i,b=a+step,k=4/3*Math.tan(step/4),pa=point(a),pb=point(b),ta=tangent(a),tb=tangent(b);this.bezierCurveTo(pa[0]+k*ta[0],pa[1]+k*ta[1],pb[0]-k*tb[0],pb[1]-k*tb[1],...pb);}
 }
 arc(x,y,r,start,end,ccw){this.ellipse(x,y,r,r,0,start,end,ccw);}
 fill(){this.emit('path',`d="${this.path}" fill="${escape(this.fillStyle)}"`);}
 stroke(){this.emit('path',`d="${this.path}" ${this.strokeAttributes()}`);}
 drawImage(image,x,y,width,height){this.emit('image',`x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" href="${escape(image.src)}"`);}
 fillText(value,x,y,maxWidth=Infinity){
  const text=String(value).normalize('NFC'),size=Number(this.font.match(/([\d.]+)px/)?.[1])||14;
  const bold=/^(?:italic )?(600|700|800|900) /.test(this.font),family=this.font.includes('StudioSerif')?'StudioSerif':this.font.includes('StudioHand')?'StudioHand':this.font.includes('Jua')?'Jua':'StudioSans',font=family==='StudioSans'?(bold?this.fonts.bold:this.fonts.regular):family==='StudioSerif'&&bold?this.fonts.StudioSerifBold:this.fonts[family];
  const width=this.measureText(text).width,scale=Math.min(1,maxWidth/(width||1));
  const start=x-(this.textAlign==='center'?width*scale/2:this.textAlign==='right'?width*scale:0);
  let prefix='',path='';
  for(const ch of text){
   const glyph=font.charToGlyph(ch);if(glyph.index===0&&!/\s/.test(ch))throw Error(`“${ch}” 문자는 인쇄 글꼴에 없어요. 다른 문자로 바꿔 주세요.`);
   // Browser advances include tracking. This keeps wrapping and outlines identical.
   const advance=this.measureText(prefix).width;path+=glyph.getPath(advance,0,size).toPathData(3);prefix+=ch;
  }
  const matrix=new DOMMatrix().translate(start,y).scale(scale,1);if(this.font.includes('italic'))matrix.skewXSelf(-12);
  this.emit('path',`d="${path}" fill="${escape(this.fillStyle)}"${bold&&['Jua','StudioHand'].includes(family)?` stroke="${escape(this.fillStyle)}" stroke-width="${size*.025}" paint-order="stroke"`:''}`,matrix);
 }
}
