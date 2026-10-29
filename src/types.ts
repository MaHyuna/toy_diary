import { isDemo } from './runtime';

export type PaymentMethod = 'card' | 'cash' | 'transfer';
export type Appointment = {
  id: string;
  dogName: string;
  guardianName: string;
  phone: string;
  breed: string;
  weight: number | null;
  service: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  basePrice: number;
  breedSurcharge: number;
  weightSurcharge: number;
  extraCharges: { label: string; amount: number }[];
  staffId: string;
  customerId: string | null;
  petId: string | null;
  shampooUsage: ShampooUsage[];
  shampooSurcharge: number;
  shampooCost: number;
  notes: string;
  source: string;
  externalId: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod: PaymentMethod | null;
  paidDate: string | null;
  createdAt: string;
};
export type Pricing = { services: { id: string; name: string; basePrice: number; duration: number }[]; breedRules: { id: string; breed: string; amount: number }[]; weightRules: { id: string; minWeight: number; maxWeight: number; amount: number }[] };
export type Customer = { id: string; name: string; phone: string; notes: string; createdAt: string };
export type PetPhoto = { id: string; src: string; caption: string; date: string };
export type Pet = { photos?: PetPhoto[]; id: string; customerId: string; name: string; breed: string; weight: number | null; birthDate: string; sex: 'unknown' | 'male' | 'female'; neutered: boolean | null; allergies: string; healthNotes: string; behaviorNotes: string; preferredStyle: string; visitIntervalWeeks: number | null; createdAt: string };
export type Shampoo = { id: string; name: string; purchasePrice: number; volumeMl: number; dilutionWaterRatio: number; notes: string; archived: boolean; createdAt: string };
export type ShampooUsage = { shampooId: string; name: string; usedMl: number; purchasePrice: number; volumeMl: number; cost: number; customerCharge: number };
export type Expense = { id: string; date: string; category: string; amount: number; memo: string; createdAt: string };
export type State = { appointments: Appointment[]; expenses: Expense[]; pricing: Pricing; customers: Customer[]; pets: Pet[]; shampoos: Shampoo[]; summary: { revenue: number; totalExpenses: number; profit: number; unpaidAmount: number; paidCount: number; shampooCost: number } };
export const money = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const paymentLabels: Record<PaymentMethod, string> = { card: '카드', cash: '현금', transfer: '계좌이체' };
export const services = [{ name: '전체 미용', price: 65000, duration: 120 }, { name: '목욕 · 위생 미용', price: 35000, duration: 60 }, { name: '부분 미용', price: 25000, duration: 40 }, { name: '스포팅', price: 80000, duration: 150 }];
export const categories = ['샴푸 구매', '미용 용품', '소모품', '임대료', '공과금', '식비', '광고비', '기타'];

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (isDemo) {
    const { demoRequest } = await import('./demo/api');
    return demoRequest<T>(path, method, body);
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error('연결이 잠시 끊겼어요. 연결 상태를 확인하고 다시 시도해 주세요.');
  }
  const data = await response.json().catch(() => { throw new Error('기록 공간에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'); });
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했어요. 다시 시도해 주세요.');
  return data;
}
