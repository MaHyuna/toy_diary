import {DEFAULT_LOGO} from './price-studio-logo.js?v=decor-22';
import {createDefaultProject} from './price-studio-defaults.js?v=decor-22';
// Transcribed from the owner's 1000025787.png, supplied 2026-11-12.
export function createLatestProject(){
 const p=createDefaultProject();
 p.brand={name:'',title:'',logo:DEFAULT_LOGO,footer:'',contact:'예쁜 미용보다 안전하고 스트레스 없는 미용을 추구합니다!'};
 p.design={...p.design,border:'double',corners:true,logoSize:300,colors:{background:'#fffaf0',heading:'#3b342c',category:'#3b342c',body:'#3b342c',price:'#3b342c',note:'#a07a4d',line:'#3b342c',decoration:'#a07a4d',tableHeader:'#3b342c'}};
 p.columns[1].name='위생미용';p.columns[2].name='위생+목욕';
 const weights=['3kg 미만','3~5kg 미만','5~7kg 미만','7~9kg 미만'];
 const prices=[
  [[15000,15000,25000,35000,70000,80000],[20000,15000,30000,40000,80000,90000],[25000,20000,35000,45000,90000,100000]],
  [[20000,20000,35000,45000,80000,90000],[25000,20000,40000,50000,90000,100000],[30000,25000,45000,55000,100000,110000],[35000,25000,50000,60000,110000,120000]],
  [[30000,20000,40000,55000,95000,105000],[35000,20000,50000,65000,105000,115000],[40000,25000,60000,75000,115000,125000],[45000,25000,70000,85000,125000,135000]]
 ];
 for(let i=0;i<3;i++){
  const s=p.sections[i];s.rows=prices[i].map((row,j)=>({id:`row-${i}-${j}`,weight:weights[j],prices:row.map(String)}));
  s.note=i===0?'7kg 이상부터 중형견 요금 적용':'9kg 이상부터 1kg당 10,000원 추가';
 }
 p.sections[0].breeds='말티즈, 요크셔 테리어, 치와와, 포메라니안, 시츄, 토이푸들 등';
 p.sections[1].breeds='닥스훈트, 슈나우저, 미니어처푸들, 코카 스파니엘, 스피츠, 프렌치 불독, 믹스견 등';
 p.sections[3].items=[
  ['크라운 / 무스타슈 / 크라운 / 가면','5,000'],['곰돌이 / 테디','10,000'],['귀툭튀 / 하이바 / 베이비컷 / 디자인컷','15,000'],['발바닥 / 닭발','5,000 / 5,000'],['양말 / 장화 / 엉뽕','10,000'],['스파 / 머드팩','10,000 / 20,000'],['노령견 (10살 이상)','10,000'],['털길이(6mm / 1cm / 2cm)','5,000 / 10,000 / 20,000']
 ].map(([label,value])=>({label,value}));
 p.sections[3].note='이중모, 엉킴, 기장, 입질, 미용매너 등 추가비용이 발생 할 수 있습니다.\n15kg이상은 대형견 요금으로 측정됩니다.\n작업 비용은 보호자와 상담 후 안내합니다.';
 p.sections[4].note='털엉킴 등 추가작업은 별도 안내합니다.';
 return p;
}
