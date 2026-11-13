export const SHAPES={flower:'꽃',paw:'발바닥',heart:'하트',star:'별',sparkle:'반짝임',diamond:'마름모',circle:'원',leaf:'잎사귀'};
export function drawShape(ctx,shape,x,y,size,color,background){
 ctx.save();ctx.translate(x,y);ctx.scale(size/20,size/20);ctx.fillStyle=color;
 const oval=(x,y,rx,ry,angle=0)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);ctx.fill();};
 if(shape==='flower'){
  for(let a=0;a<5;a++){const angle=a*Math.PI*2/5;oval(6*Math.cos(angle),6*Math.sin(angle),4,5,angle);}ctx.fillStyle=background;oval(0,0,2.5,2.5);
 }else if(shape==='paw'){
  oval(0,4,6,5);for(const [x,y,r] of [[-7,-2,-.4],[-3,-7,-.15],[3,-7,.15],[7,-2,.4]])oval(x,y,2.5,3.3,r);
 }else if(shape==='heart'){
  ctx.beginPath();ctx.moveTo(0,9);ctx.bezierCurveTo(-18,-2,-7,-15,0,-6);ctx.bezierCurveTo(7,-15,18,-2,0,9);ctx.closePath();ctx.fill();
 }else if(shape==='circle')oval(0,0,8,8);
 else if(shape==='leaf'){
  ctx.beginPath();ctx.moveTo(-9,8);ctx.quadraticCurveTo(-13,-10,10,-9);ctx.quadraticCurveTo(13,9,-9,8);ctx.closePath();ctx.fill();ctx.strokeStyle=background;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-6,5);ctx.lineTo(6,-5);ctx.stroke();
 }else{
  const points=shape==='star'?10:shape==='sparkle'?8:4;
  ctx.beginPath();for(let i=0;i<points;i++){const a=-Math.PI/2+i*Math.PI*2/points,r=shape==='diamond'?9:i%2?(shape==='star'?4:2.5):10;const p=[r*Math.cos(a),r*Math.sin(a)];if(i)ctx.lineTo(...p);else ctx.moveTo(...p);}ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
