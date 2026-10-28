import type { Appointment, Customer, Pet, Shampoo, ShampooUsage, State } from '../types.ts';

export type DemoData = Omit<State, 'summary'>;
export const DEMO_SEED_REVISION = 2;

/** Fictional, independent sample records. This module never reads stored data. */
export function createDemoData(referenceDate: string): DemoData {
  const reference = new Date(`${referenceDate}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate) || Number.isNaN(reference.getTime()) || reference.toISOString().slice(0, 10) !== referenceDate) {
    throw new Error('체험 기준 날짜는 올바른 YYYY-MM-DD 형식이어야 해요.');
  }
  const createdAt = `${referenceDate}T08:00:00+09:00`;
  const identifier = (group: number, number: number) => `${group.toString(16).padStart(2, '0')}${number.toString(16).padStart(30, '0')}`;
  const previousDate = `${referenceDate.slice(0, 7)}-${String(Math.max(1, Number(referenceDate.slice(8)) - 7)).padStart(2, '0')}`;
  const tomorrow = new Date(reference.getTime() + 86_400_000).toISOString().slice(0, 10);
  const birthYear = Math.max(1, Number(referenceDate.slice(0, 4)) - 3).toString().padStart(4, '0');

  const customers: Customer[] = [
    { id: identifier(1, 1), name: '체험 보호자 김몽글', phone: '', notes: '가상의 체험 고객이에요. 몽이와 콩이를 함께 맡기는 예시입니다.', createdAt },
    { id: identifier(1, 2), name: '체험 보호자 이다정', phone: '', notes: '가상의 체험 고객이에요. 미용 전 스타일을 상담하는 예시입니다.', createdAt },
    { id: identifier(1, 3), name: '체험 보호자 박포근', phone: '', notes: '가상의 체험 고객이에요. 실제 보호자 정보가 아닙니다.', createdAt },
  ];

  const pets: Pet[] = [
    { id: identifier(2, 1), customerId: customers[0].id, name: '몽이 (체험)', breed: '비숑 프리제', weight: 6.2, birthDate: `${birthYear}-01-01`, sex: 'male', neutered: true, allergies: '체험 예시: 향이 강한 샴푸 사용 전 보호자에게 확인', healthNotes: '체험 예시: 발바닥 피부가 예민해요.', behaviorNotes: '', preferredStyle: '체험 예시: 동그란 얼굴, 귀는 짧게', visitIntervalWeeks: 6, createdAt },
    { id: identifier(2, 2), customerId: customers[0].id, name: '콩이 (체험)', breed: '말티즈', weight: 3.2, birthDate: '', sex: 'female', neutered: true, allergies: '', healthNotes: '', behaviorNotes: '체험 예시: 드라이 소리에 놀랄 수 있어요.', preferredStyle: '체험 예시: 몸은 짧고 얼굴은 자연스럽게', visitIntervalWeeks: 4, createdAt },
    { id: identifier(2, 3), customerId: customers[1].id, name: '구름이 (체험)', breed: '비숑 프리제', weight: 4.1, birthDate: '', sex: 'female', neutered: null, allergies: '', healthNotes: '', behaviorNotes: '체험 예시: 발을 만질 때 예민하고 입질이 있어요.', preferredStyle: '체험 예시: 얼굴은 둥글게, 다리는 풍성하게', visitIntervalWeeks: 6, createdAt },
    { id: identifier(2, 4), customerId: customers[2].id, name: '보리 (체험)', breed: '푸들', weight: 7.4, birthDate: `${birthYear}-01-01`, sex: 'male', neutered: false, allergies: '', healthNotes: '체험 예시: 뒷다리를 무리하게 들지 않아요.', behaviorNotes: '', preferredStyle: '체험 예시: 눈 주변과 발끝을 깔끔하게', visitIntervalWeeks: 5, createdAt },
  ];

  const guardianNames = ['최하늘', '정초록', '한봄날', '윤햇살', '송다온', '임소담', '강도담', '조여울', '오나래', '서온유', '신가람', '권보송', '문노을', '안새봄', '배이든', '백해솔', '홍누리', '유라온', '남아람', '장별빛', '노푸름'];
  guardianNames.forEach((name, index) => customers.push({
    id: identifier(1, 100 + index), name: `체험 보호자 ${name}`, phone: '',
    notes: `가상의 체험 고객이에요. ${index % 3 === 0 ? '방문 전 원하는 스타일을 함께 확인하는 예시입니다.' : index % 3 === 1 ? '목욕과 전체 미용을 번갈아 예약하는 예시입니다.' : '마무리 후 픽업 시간을 확인하는 예시입니다.'}`, createdAt,
  }));
  const petProfiles: [string, string, number][] = [
    ['두부', '말티즈', 3.1], ['밤비', '푸들', 4.8], ['코코', '포메라니안', 3.6], ['솜이', '비숑 프리제', 5.3],
    ['호두', '시츄', 6.3], ['루루', '요크셔테리어', 2.8], ['초코', '푸들', 4.2], ['모찌', '말티푸', 4.5],
    ['설이', '스피츠', 7.2], ['탄이', '슈나우저', 8.1], ['별이', '말티즈', 3.7], ['라떼', '믹스견', 5.6],
    ['쿠키', '포메라니안', 4.1], ['복실이', '비숑 프리제', 6.7], ['토리', '푸들', 5.2], ['해피', '시츄', 5.8],
    ['체리', '말티푸', 3.9], ['뭉치', '비숑 프리제', 7.1], ['나나', '요크셔테리어', 2.5], ['보송이', '말티즈', 3.3],
    ['땅콩', '푸들', 4.6], ['오레오', '믹스견', 6.8], ['만두', '포메라니안', 4.3], ['감자', '말티푸', 5.1],
  ];
  petProfiles.forEach(([name, breed, weight], index) => pets.push({
    id: identifier(2, 100 + index), customerId: customers[3 + index % guardianNames.length].id,
    name: `${name} (체험)`, breed, weight, birthDate: `${birthYear}-${String(index % 12 + 1).padStart(2, '0')}-15`,
    sex: index % 2 === 0 ? 'female' : 'male', neutered: index % 4 === 0 ? null : true,
    allergies: index % 7 === 0 ? '체험 예시: 제품 변경 전 보호자에게 확인해 주세요.' : '',
    healthNotes: index % 6 === 0 ? '체험 예시: 오래 서 있으면 힘들어해요. 방문 전 상태를 확인해요.' : '',
    behaviorNotes: index % 5 === 0 ? '체험 예시: 발을 만질 때 예민해요. 작업 중 쉬는 시간이 필요해요.' : '',
    preferredStyle: ['체험 예시: 얼굴은 둥글게, 몸은 짧게', '체험 예시: 귀와 꼬리는 자연스럽게', '체험 예시: 발끝과 눈 주변을 깔끔하게'][index % 3],
    visitIntervalWeeks: 4 + index % 3, createdAt,
  }));

  const shampoos: Shampoo[] = [
    { id: identifier(3, 1), name: '체험용 저자극 샴푸', purchasePrice: 30000, volumeMl: 1000, dilutionWaterRatio: 0, notes: '가상의 샴푸 예시입니다. 희석 정보는 미등록이며 실제 제품 라벨을 확인해야 해요.', archived: false, createdAt },
    { id: identifier(3, 2), name: '체험용 볼륨 샴푸', purchasePrice: 30000, volumeMl: 1000, dilutionWaterRatio: 0, notes: '가상의 샴푸 예시입니다. 10ml 원액 사용 시 원가 300원으로 계산해요.', archived: false, createdAt },
    { id: identifier(3, 100), name: '체험용 데일리 샴푸', purchasePrice: 90000, volumeMl: 4000, dilutionWaterRatio: 0, notes: '가격과 용량은 체험용 가상 값입니다. 실제 사용법은 제품 라벨을 확인하세요.', archived: false, createdAt },
    { id: identifier(3, 101), name: '체험용 보습 샴푸', purchasePrice: 28000, volumeMl: 500, dilutionWaterRatio: 0, notes: '가상의 제품입니다. 추가요금과 원가를 구분하는 체험에 사용해요.', archived: false, createdAt },
  ];

  const pricing: DemoData['pricing'] = {
    services: [
      { id: identifier(6, 1), name: '전체 미용', basePrice: 65000, duration: 120 },
      { id: identifier(6, 2), name: '목욕 · 위생 미용', basePrice: 35000, duration: 60 },
      { id: identifier(6, 3), name: '부분 미용', basePrice: 25000, duration: 40 },
      { id: identifier(6, 4), name: '스포팅', basePrice: 80000, duration: 150 },
    ],
    breedRules: [{ id: identifier(7, 1), breed: '비숑 프리제', amount: 10000 }],
    weightRules: [{ id: identifier(8, 1), minWeight: 5, maxWeight: 10, amount: 5000 }],
  };

  function useShampoo(shampoo: Shampoo, usedMl: number, customerCharge: number): ShampooUsage {
    return { shampooId: shampoo.id, name: shampoo.name, usedMl, purchasePrice: shampoo.purchasePrice, volumeMl: shampoo.volumeMl, cost: Math.round(shampoo.purchasePrice * usedMl / shampoo.volumeMl), customerCharge };
  }

  function reservation(number: number, pet: Pet, date: string, time: string, serviceName: string, duration: number, options: { paid?: boolean; paidDate?: string; paymentMethod?: 'card' | 'cash' | 'transfer'; extraCharges?: Appointment['extraCharges']; shampooUsage?: ShampooUsage[]; notes?: string } = {}): Appointment {
    const customer = customers.find((item) => item.id === pet.customerId)!;
    const service = pricing.services.find((item) => item.name === serviceName)!;
    const breedSurcharge = pricing.breedRules.find((rule) => rule.breed === pet.breed)?.amount ?? 0;
    const weightSurcharge = pet.weight === null ? 0 : pricing.weightRules.find((rule) => pet.weight! >= rule.minWeight && pet.weight! < rule.maxWeight)?.amount ?? 0;
    const extraCharges = options.extraCharges ?? [];
    const shampooUsage = options.shampooUsage ?? [];
    const shampooSurcharge = shampooUsage.reduce((sum, item) => sum + item.customerCharge, 0);
    return {
      id: identifier(4, number), dogName: pet.name, guardianName: customer.name, phone: customer.phone, breed: pet.breed, weight: pet.weight,
      service: service.name, date, time, duration, basePrice: service.basePrice, breedSurcharge, weightSurcharge, extraCharges,
      price: service.basePrice + breedSurcharge + weightSurcharge + extraCharges.reduce((sum, item) => sum + item.amount, 0) + shampooSurcharge,
      staffId: 'owner', customerId: customer.id, petId: pet.id, shampooUsage, shampooSurcharge,
      shampooCost: shampooUsage.reduce((sum, item) => sum + item.cost, 0),
      notes: options.notes ?? '가상의 예약입니다. 실제 고객의 예약이나 결제 내역이 아니에요.',
      source: 'manual', externalId: null, status: options.paid ? 'completed' : 'scheduled',
      paymentStatus: options.paid ? 'paid' : 'unpaid', paymentMethod: options.paid ? options.paymentMethod ?? 'card' : null,
      paidDate: options.paid ? options.paidDate ?? date : null, createdAt: `${date < referenceDate ? date : referenceDate}T08:00:00+09:00`,
    };
  }

  const appointments: Appointment[] = [
    reservation(1, pets[0], referenceDate, '09:00', '전체 미용', 90, { paid: true, paymentMethod: 'card', extraCharges: [{ label: '심한 엉킴 (체험 예시)', amount: 5000 }], shampooUsage: [useShampoo(shampoos[0], 10, 5000)], notes: '체험 예시: 엉킨 부위 정리 후 저자극 샴푸 사용. 카드 정산을 완료한 예약이에요.' }),
    reservation(2, pets[1], referenceDate, '11:00', '목욕 · 위생 미용', 60, { shampooUsage: [useShampoo(shampoos[0], 10, 0)] }),
    reservation(3, pets[2], referenceDate, '14:00', '전체 미용', 90, { extraCharges: [{ label: '입질 대응 (체험 예시)', amount: 10000 }], shampooUsage: [useShampoo(shampoos[1], 10, 5000)], notes: '체험 예시: 발 미용 시 휴식이 필요해요. 추가 요금 사유를 보호자와 확인한 상황입니다.' }),
    reservation(4, pets[3], referenceDate, '16:00', '부분 미용', 60),
    reservation(5, pets[0], previousDate, '07:00', '목욕 · 위생 미용', 60, { paid: true, paymentMethod: 'cash', shampooUsage: [useShampoo(shampoos[0], 10, 5000)], notes: '체험 예시: 이전 방문 기록이에요. 정산 금액과 샴푸 사용 원가를 구분해서 확인할 수 있어요.' }),
    reservation(6, pets[1], tomorrow, '11:00', '전체 미용', 90, { notes: '체험 예시: 다음 방문 예약입니다. 아직 정산되지 않아 실제 매출에는 포함되지 않아요.' }),
  ];

  // Fill the previous/current month and the first week of next month. Mondays
  // are quiet days, and future visits never become settled income in advance.
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1, 12));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 7, 12));
  let serial = 100;
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86_400_000) {
    const current = new Date(cursor), date = current.toISOString().slice(0, 10);
    if (current.getUTCDay() === 1 || date === referenceDate) continue;
    const dayNumber = current.getUTCDate(), count = 2 + dayNumber % 3;
    for (let slot = 0; slot < count; slot++) {
      const number = serial++, pet = pets[4 + (number - 100) % petProfiles.length];
      const service = pricing.services[(number + slot) % pricing.services.length];
      const time = ['09:00', '11:30', '14:00', '16:30'][slot];
      const nextDate = new Date(cursor + 86_400_000).toISOString().slice(0, 10);
      const paidDate = dayNumber >= 28 && slot === 0 ? nextDate : date;
      const paid = date < referenceDate && paidDate <= referenceDate && !(dayNumber % 13 === 0 && slot === count - 1);
      const item = reservation(number, pet, date, time, service.name, service.duration, {
        paid, paidDate, paymentMethod: (['card', 'cash', 'transfer'] as const)[number % 3],
        shampooUsage: service.name === '부분 미용' ? [] : [useShampoo(shampoos[2 + number % 2], 8 + number % 8, number % 5 === 0 ? 5000 : 0)],
        extraCharges: number % 7 === 0 ? [{ label: '엉킴 정리 (체험 예시)', amount: 10000 }] : number % 11 === 0 ? [{ label: '입질 대응 (체험 예시)', amount: 5000 }] : [],
        notes: paid ? '체험 예시: 이전 방문과 결제 내역입니다. 다음 상담에 스타일 기록을 참고해요.' : '체험 예시: 미정산 예약이에요. 결제를 기록하면 실제 받은 날짜의 수입에 반영돼요.',
      });
      if (dayNumber % 17 === 0 && slot === count - 1) {
        item.status = 'cancelled'; item.paymentStatus = 'unpaid'; item.paidDate = null; item.paymentMethod = null;
        item.notes = '체험 예시: 보호자 요청으로 취소한 예약입니다. 예약 건수와 수입에서 제외돼요.';
      }
      if (!appointments.some(existing => overlaps(existing, item))) appointments.push(item);
    }
  }

  const expenses: DemoData['expenses'] = [
    { id: identifier(5, 1), date: previousDate, category: '샴푸 구매', amount: 30000, memo: '체험 예시: 저자극 샴푸 1L 구입. 사용 원가와 별도로 기록한 실제 지출 예시예요.', createdAt },
    { id: identifier(5, 2), date: referenceDate, category: '소모품', amount: 12000, memo: '체험 예시: 위생 장갑과 일회용 타월 구입', createdAt },
  ];
  const expenseSchedule: [number, string, number, string][] = [
    [1, '임대료', 550000, '매장 월 임대료'], [3, '샴푸 구매', 90000, '데일리 샴푸 4L 구매'],
    [5, '소모품', 18000, '배변 패드와 위생 장갑'], [8, '미용 용품', 45000, '클리퍼 날 관리와 교체'],
    [10, '공과금', 87000, '매장 전기요금'], [12, '광고비', 30000, '동네 소식지 광고'],
    [15, '소모품', 24000, '일회용 타월과 리본'], [18, '샴푸 구매', 28000, '보습 샴푸 500mL 구매'],
    [21, '공과금', 33000, '매장 통신요금'], [24, '미용 용품', 19000, '브러시와 빗 교체'],
    [27, '기타', 22000, '세탁 비용'], [28, '소모품', 15000, '청소 용품 구매'],
  ];
  for (let monthOffset = -1; monthOffset <= 0; monthOffset++) {
    const month = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + monthOffset, 1, 12)).toISOString().slice(0, 7);
    expenseSchedule.forEach(([number, category, amount, memo], index) => {
      const date = `${month}-${String(number).padStart(2, '0')}`;
      if (date <= referenceDate) expenses.push({ id: identifier(5, 100 + (monthOffset + 1) * 100 + index), date, category, amount, memo: `체험 예시: ${memo}`, createdAt: `${date}T08:00:00+09:00` });
    });
  }

  return {
    appointments, customers, pets, shampoos, pricing, expenses,
  };
}

function overlaps(left: Appointment, right: Appointment): boolean {
  if (left.status === 'cancelled' || right.status === 'cancelled' || left.date !== right.date || left.staffId !== right.staffId) return false;
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return minutes(left.time) < minutes(right.time) + right.duration && minutes(right.time) < minutes(left.time) + left.duration;
}

/** One-time additive upgrade: preserve edited/deleted original samples and user records. */
export function addExpandedDemoData(existing: DemoData, referenceDate: string): DemoData {
  const data = structuredClone(existing), samples = createDemoData(referenceDate);
  for (const key of ['customers', 'pets', 'shampoos', 'expenses', 'appointments'] as const) {
    const ids = new Set(data[key].map(row => row.id));
    for (const row of samples[key]) {
      if (parseInt(row.id.slice(2), 16) < 100 || ids.has(row.id)) continue;
      if (key === 'appointments' && data.appointments.some(current => overlaps(current, row as Appointment))) continue;
      (data[key] as { id: string }[]).push(row);
    }
  }
  return data;
}
