import type { DemoData } from './seed.ts';
import type { PriceMenu } from '../price-menu.ts';
import { sameMenu } from '../price-menu.ts';
export const currentMenu=(d:DemoData)=>d.priceMenu??d.pricePoster?.menu??null;
export const version=(d:DemoData)=>d.priceHistory?.at(-1)?.version??0;
export function record(d:DemoData,menu:PriceMenu,kind:'baseline'|'save'|'restore',note='',restoredFrom:number|null=null){
 (d.priceHistory??=[]).push({version:version(d)+1,savedAt:new Date().toISOString(),kind,note,restoredFrom,menu:structuredClone(menu)});
}
export function baseline(d:DemoData){const menu=currentMenu(d);if(menu&&!sameMenu(d.priceHistory?.at(-1)?.menu,menu))record(d,menu,'baseline','이력 도입 시 기존 저장본 보존 · 최초 작성일은 알 수 없습니다.');}
export function checkVersion(d:DemoData,input:Record<string,unknown>){if(!Number.isInteger(input.expectedVersion)||Number(input.expectedVersion)<0)throw Error('수정 기준 버전을 확인해 주세요.');if(input.expectedVersion!==version(d))throw Error('다른 화면에서 요금표가 변경되었습니다. 입력 내용은 유지됩니다. 최신 목록을 다시 불러온 뒤 수정해 주세요.');}
export function note(input:Record<string,unknown>){const v=input.note??'';if(typeof v!=='string'||v.length>500)throw Error('변경 사유는 500자 이내로 입력해 주세요.');return v.trim();}
