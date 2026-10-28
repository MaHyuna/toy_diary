import type { Appointment, Customer, Pet, Shampoo, ShampooUsage, State } from '../types.ts';

export type DemoData = Omit<State, 'summary'>;

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

  const shampoos: Shampoo[] = [
    { id: identifier(3, 1), name: '체험용 저자극 샴푸', purchasePrice: 30000, volumeMl: 1000, dilutionWaterRatio: 0, notes: '가상의 샴푸 예시입니다. 희석 정보는 미등록이며 실제 제품 라벨을 확인해야 해요.', archived: false, createdAt },
    { id: identifier(3, 2), name: '체험용 볼륨 샴푸', purchasePrice: 30000, volumeMl: 1000, dilutionWaterRatio: 0, notes: '가상의 샴푸 예시입니다. 10ml 원액 사용 시 원가 300원으로 계산해요.', archived: false, createdAt },
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

  function reservation(number: number, pet: Pet, date: string, time: string, serviceName: string, duration: number, options: { paid?: boolean; paymentMethod?: 'card' | 'cash'; extraCharges?: Appointment['extraCharges']; shampooUsage?: ShampooUsage[]; notes?: string } = {}): Appointment {
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
      paidDate: options.paid ? date : null, createdAt,
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

  return {
    appointments, customers, pets, shampoos, pricing,
    expenses: [
      { id: identifier(5, 1), date: previousDate, category: '샴푸 구매', amount: 30000, memo: '체험 예시: 저자극 샴푸 1L 구입. 사용 원가와 별도로 기록한 실제 지출 예시예요.', createdAt },
      { id: identifier(5, 2), date: referenceDate, category: '소모품', amount: 12000, memo: '체험 예시: 위생 장갑과 일회용 타월 구입', createdAt },
    ],
  };
}
