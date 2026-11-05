import { api } from './types';
import { isDemo } from './runtime';
import { validatePriceMenu } from './price-menu';
import type { PriceMenu } from './price-menu';
export async function loadPriceMenu():Promise<PriceMenu|null>{
 const saved=await api<PriceMenu|null>('/public/price-menu');if(saved)return validatePriceMenu(saved);
 if(!isDemo)return null;
 const response=await fetch('images/demo-price-menu.json');if(!response.ok)throw Error('요금표를 불러오지 못했어요.');
 return validatePriceMenu(await response.json());
}
