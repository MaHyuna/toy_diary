/** Run with node --experimental-strip-types scripts/generate_scenario_spec.mjs. */
import {readFileSync,writeFileSync} from 'node:fs';
import {flows} from '../src/prototype/flows.ts';
import {screenSpec} from '../src/prototype/screen-spec.ts';
const prefix=readFileSync(new URL('../docs/production-plan/SERVICE_SCENARIOS.md',import.meta.url),'utf8').split('## 고객 시나리오')[0].split('\n색상:')[0]+'\n\n';
let md=prefix+'색상: 초록=고객 행동, 파랑=사장님 업무, 보라=시스템 처리·상태. 주황=확인·판단, 빨강=실패·예외.\n\n';
for(const role of ['고객','사장님']){
 md+=`## ${role} 시나리오\n\n`;
 for(const flow of flows.filter(f=>f.role===role)){
  md+=`### ${flow.name}\n\n${flow.summary}\n\n`;
  for(const screen of flow.steps){const spec=screenSpec(flow,screen);
   md+=`#### ${screen.name}\n\n담당: ${spec.role} / 유형: ${screen.kind} / ${screen.future?'확장 설계':'기존 구현 기반'}\n\n`;
   const blocks=[['목적',[screen.purpose]],['진입 경로',spec.incoming.length?spec.incoming:['시나리오 시작']],['표시·입력 항목',[...spec.inputs,...spec.display]],['처리·검증 규칙',spec.checks],['동작 → 다음 화면·상태',screen.actions.map(a=>{const target=flow.steps.find(s=>s.id===a.to);return `${a.label} → ${target.name}${target.ui?.status?' · '+target.ui.status:''}`;})]];
   for(const [label,values] of blocks)md+=`**${label}**\n\n${values.map(v=>'- '+v).join('\n')}\n\n`;
  }
 }
}
for(const path of ['../docs/production-plan/SERVICE_SCENARIOS.md','../public/prototype/scenarios.md'])writeFileSync(new URL(path,import.meta.url),md);
console.log(`Generated ${flows.reduce((n,f)=>n+f.steps.length,0)} screen specifications`);
