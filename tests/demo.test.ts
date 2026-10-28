import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoApi } from '../src/demo/api.ts';
import { createDemoData, DEMO_SEED_REVISION } from '../src/demo/seed.ts';
import type { Appointment, Customer, Pet, Pricing, Shampoo, State } from '../src/types.ts';

const KEY = 'mongle-demo-v1';
const TODAY = '2030-01-20';

class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.values.set(key, value);
  }
}

function setup(storage = new MemoryStorage()) {
  return { storage, api: createDemoApi(storage, { today: () => TODAY }) };
}

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    dogName: '테스트 두부', guardianName: '테스트 보호자', phone: '010-0000-0000',
    breed: '말티즈', weight: 4.2, service: '전체 미용', date: '2031-01-15',
    time: '10:00', duration: 120, basePrice: 65000, notes: '테스트 예약',
    ...overrides,
  };
}

function shampooData(overrides: Record<string, unknown> = {}) {
  return {
    name: '테스트 저자극 샴푸', purchasePrice: 10000, volumeMl: 100,
    dilutionWaterRatio: 10, notes: '', archived: false, ...overrides,
  };
}

function petData(customerId: string, overrides: Record<string, unknown> = {}) {
  return {
    customerId, name: '테스트 두부', breed: '말티즈', weight: 4.2,
    birthDate: '2021-03-15', sex: 'male', neutered: true,
    allergies: '향료 알레르기', healthNotes: '슬개골 주의', behaviorNotes: '입질 주의',
    preferredStyle: '얼굴 둥글게', visitIntervalWeeks: 6, ...overrides,
  };
}

test('demo data stays inside its storage and persists across adapter recreation', async () => {
  const first = setup();
  const independent = setup();
  const before = await first.api.request<State>('/state?month=2030-01');
  assert.ok(before.appointments.length > 0, 'the initial demo must contain synthetic appointments');
  const added = await first.api.request<Customer>('/customers', 'POST', { name: '새 데모 고객', phone: '010-9999-9999', notes: '' });
  const restarted = setup(first.storage);
  const restored = await restarted.api.request<State>('/state?month=2030-01');
  assert.equal(restored.customers.length, before.customers.length + 1);
  assert.ok(restored.customers.some((customer) => customer.id === added.id));
  const separate = await independent.api.request<State>('/state?month=2030-01');
  assert.ok(!separate.customers.some((customer) => customer.id === added.id));
  const stored = JSON.parse(first.storage.getItem(KEY)!);
  assert.equal(stored.version, 1);
  assert.ok(stored.data);
});

test('same customer details are distinct records and linked pet details survive edits', async () => {
  const { api } = setup();
  const details = { name: '동명이인', phone: '010-1234-5678', notes: '' };
  const first = await api.request<Customer>('/customers', 'POST', details);
  const second = await api.request<Customer>('/customers', 'POST', details);
  assert.notEqual(first.id, second.id);
  const pet = await api.request<Pet>('/pets', 'POST', petData(first.id));
  const changed = await api.request<Pet>(`/pets/${pet.id}`, 'PATCH', { behaviorNotes: '드라이어 소리에 민감' });
  assert.equal(changed.customerId, first.id);
  assert.equal(changed.allergies, '향료 알레르기');
  assert.equal(changed.behaviorNotes, '드라이어 소리에 민감');
  const appointment = await api.request<Appointment>('/appointments', 'POST', reservation({ petId: pet.id }));
  assert.equal(appointment.customerId, first.id);
  await assert.rejects(api.request('/appointments', 'POST', reservation({ time: '14:00', petId: pet.id, customerId: second.id })));
  await api.request(`/customers/${first.id}`, 'PATCH', { name: '보호자 새 이름' });
  await api.request(`/pets/${pet.id}`, 'PATCH', { name: '반려견 새 이름' });
  const persisted = (await api.request<State>('/state')).appointments.find((item) => item.id === appointment.id)!;
  assert.equal(persisted.guardianName, appointment.guardianName);
  assert.equal(persisted.dogName, appointment.dogName);
});

test('overlapping appointments are rejected while adjacent and cancelled slots are reusable', async () => {
  const { api } = setup();
  const first = await api.request<Appointment>('/appointments', 'POST', reservation());
  await assert.rejects(api.request('/appointments', 'POST', reservation({ time: '11:00' })));
  const adjacent = await api.request<Appointment>('/appointments', 'POST', reservation({ time: '12:00' }));
  await assert.rejects(api.request(`/appointments/${adjacent.id}`, 'PATCH', { time: '10:30' }));
  await api.request(`/appointments/${first.id}`, 'PATCH', { status: 'cancelled' });
  await api.request('/appointments', 'POST', reservation());
  await assert.rejects(api.request(`/appointments/${first.id}/settle`, 'POST', { paymentMethod: 'card', paidDate: TODAY }));
  await assert.rejects(api.request(`/appointments/${first.id}`, 'PATCH', { status: 'scheduled' }));
});

test('settlement records money once and locks paid appointment edits', async () => {
  const { api, storage } = setup();
  const appointment = await api.request<Appointment>('/appointments', 'POST', reservation());
  const paid = await api.request<Appointment>(`/appointments/${appointment.id}/settle`, 'POST', { paymentMethod: 'card', paidDate: TODAY });
  assert.equal(paid.paymentStatus, 'paid');
  assert.equal(paid.status, 'completed');
  const saved = storage.getItem(KEY);
  await assert.rejects(api.request(`/appointments/${appointment.id}/settle`, 'POST', { paymentMethod: 'card', paidDate: TODAY }));
  await assert.rejects(api.request(`/appointments/${appointment.id}`, 'PATCH', { price: 1 }));
  await assert.rejects(api.request(`/appointments/${appointment.id}`, 'PATCH', { status: 'cancelled' }));
  assert.equal(storage.getItem(KEY), saved);
});

test('monthly cash totals use payment dates and avoid deducting shampoo cost twice', async () => {
  const { api } = setup();
  const before = (await api.request<State>('/state?month=2029-12')).summary;
  const januaryBefore = (await api.request<State>('/state?month=2030-01')).summary;
  const shampoo = await api.request<Shampoo>('/shampoos', 'POST', shampooData());
  const usage = [{ shampooId: shampoo.id, usedMl: 10, customerCharge: 5000 }];
  const appointment = await api.request<Appointment>('/appointments', 'POST', reservation({ shampooUsage: usage }));
  await api.request('/appointments', 'POST', reservation({ time: '14:00', shampooUsage: usage }));
  await api.request(`/appointments/${appointment.id}/settle`, 'POST', { paymentMethod: 'transfer', paidDate: '2029-12-31' });
  const expense = await api.request<{ id: string }>('/expenses', 'POST', { date: '2029-12-31', category: '샴푸 구매', amount: 10000, memo: '샴푸 구입' });
  const after = (await api.request<State>('/state?month=2029-12')).summary;
  assert.equal(after.revenue - before.revenue, 70000);
  assert.equal(after.totalExpenses - before.totalExpenses, 10000);
  assert.equal(after.profit - before.profit, 60000);
  assert.equal(after.shampooCost - before.shampooCost, 1000);
  assert.equal(after.paidCount - before.paidCount, 1);
  const januaryAfter = (await api.request<State>('/state?month=2030-01')).summary;
  assert.equal(januaryAfter.revenue, januaryBefore.revenue);
  assert.equal(januaryAfter.shampooCost, januaryBefore.shampooCost);
  await api.request(`/expenses/${expense.id}`, 'DELETE');
  assert.equal((await api.request<State>('/state?month=2029-12')).summary.totalExpenses, before.totalExpenses);
});

test('shampoo costs round half up and survive catalog changes when only customer fees change', async () => {
  const { api } = setup();
  const shampoo = await api.request<Shampoo>('/shampoos', 'POST', shampooData({ purchasePrice: 5, volumeMl: 2 }));
  const appointment = await api.request<Appointment>('/appointments', 'POST', reservation({
    shampooUsage: [{ shampooId: shampoo.id, usedMl: 1, customerCharge: 2000 }],
  }));
  assert.equal(appointment.shampooCost, 3);
  assert.equal(appointment.price, 67000);
  await api.request(`/shampoos/${shampoo.id}`, 'PATCH', { name: '새 샴푸 이름', purchasePrice: 100, archived: true });
  const changed = await api.request<Appointment>(`/appointments/${appointment.id}`, 'PATCH', {
    shampooUsage: [{ shampooId: shampoo.id, usedMl: 1, customerCharge: 3000 }],
  });
  assert.equal(changed.shampooCost, 3);
  assert.equal(changed.price, 68000);
  for (const key of ['name', 'purchasePrice', 'volumeMl', 'usedMl', 'cost'] as const) {
    assert.equal(changed.shampooUsage[0][key], appointment.shampooUsage[0][key]);
  }
  await assert.rejects(api.request(`/appointments/${appointment.id}`, 'PATCH', {
    shampooUsage: [{ shampooId: shampoo.id, usedMl: 2, customerCharge: 3000 }],
  }));
});

test('pricing changes leave existing quotes intact and invalid rules never persist', async () => {
  const { api, storage } = setup();
  const appointment = await api.request<Appointment>('/appointments', 'POST', reservation({
    basePrice: 65000, breedSurcharge: 5000, weightSurcharge: 3000,
    extraCharges: [{ label: '엉킴', amount: 7000 }],
  }));
  assert.equal(appointment.price, 80000);
  const pricing: Pricing = {
    services: [{ id: 'new-full', name: '새 요금 전체 미용', basePrice: 95000, duration: 120 }],
    breedRules: [{ id: 'maltese', breed: '말티즈', amount: 10000 }],
    weightRules: [{ id: 'small', minWeight: 0, maxWeight: 5, amount: 1000 }],
  };
  await api.request('/pricing', 'PUT', pricing);
  const state = await api.request<State>('/state');
  assert.deepEqual(state.pricing, pricing);
  assert.equal(state.appointments.find((item) => item.id === appointment.id)!.price, 80000);
  const saved = storage.getItem(KEY);
  await assert.rejects(api.request('/pricing', 'PUT', {
    ...pricing, weightRules: [...pricing.weightRules, { id: 'overlap', minWeight: 4, maxWeight: 10, amount: 2000 }],
  }));
  assert.equal(storage.getItem(KEY), saved);
  await assert.rejects(api.request(`/appointments/${appointment.id}`, 'PATCH', { basePrice: 60000, price: 1 }));
  assert.equal(storage.getItem(KEY), saved);
});

test('paid history can be linked to a pet without changing money or original names', async () => {
  const { api } = setup();
  const appointment = await api.request<Appointment>('/appointments', 'POST', reservation());
  const paid = await api.request<Appointment>(`/appointments/${appointment.id}/settle`, 'POST', { paymentMethod: 'cash', paidDate: TODAY });
  const customer = await api.request<Customer>('/customers', 'POST', { name: '등록 고객', phone: '', notes: '' });
  const pet = await api.request<Pet>('/pets', 'POST', petData(customer.id));
  const linked = await api.request<Appointment>(`/appointments/${appointment.id}/link-pet`, 'POST', { petId: pet.id });
  assert.equal(linked.petId, pet.id);
  assert.equal(linked.customerId, customer.id);
  for (const [key, value] of Object.entries(paid)) {
    if (key !== 'petId' && key !== 'customerId') assert.deepEqual((linked as unknown as Record<string, unknown>)[key], value, key);
  }
  const otherPet = await api.request<Pet>('/pets', 'POST', petData(customer.id, { name: '다른 반려견' }));
  await assert.rejects(api.request(`/appointments/${appointment.id}/link-pet`, 'POST', { petId: otherPet.id }));
});

test('failed storage writes leave both persisted and live state unchanged', async () => {
  const { api, storage } = setup();
  const before = await api.request<State>('/state');
  const saved = storage.getItem(KEY);
  storage.failWrites = true;
  await assert.rejects(api.request('/customers', 'POST', { name: '저장되면 안 되는 고객', phone: '', notes: '' }));
  assert.equal(storage.getItem(KEY), saved);
  storage.failWrites = false;
  assert.deepEqual(await api.request<State>('/state'), before);
  assert.deepEqual(await setup(storage).api.request<State>('/state'), before);
});

test('corrupt or incompatible storage reports errors without silently resetting records', async () => {
  for (const raw of ['{broken json', JSON.stringify({ version: 99, data: {} }), JSON.stringify({ version: 1, data: {} }), '[]']) {
    const storage = new MemoryStorage();
    storage.setItem(KEY, raw);
    storage.setItem('unrelated-app', 'preserve me');
    await assert.rejects(async () => {
      const { api } = setup(storage);
      await api.request('/state');
    });
    assert.equal(storage.getItem(KEY), raw);
    assert.equal(storage.getItem('unrelated-app'), 'preserve me');
  }
});

test('intentional reset restores synthetic data and leaves other storage keys alone', async () => {
  const { api, storage } = setup();
  storage.setItem('production-preferences', 'keep this');
  const initial = await api.request<State>('/state');
  const customer = await api.request<Customer>('/customers', 'POST', { name: '초기화할 고객', phone: '', notes: '' });
  await api.reset();
  const reset = await api.request<State>('/state');
  assert.equal(reset.customers.length, initial.customers.length);
  assert.ok(!reset.customers.some((item) => item.id === customer.id));
  assert.equal(storage.getItem('production-preferences'), 'keep this');
  assert.equal(JSON.parse(storage.getItem(KEY)!).version, 1);
});

test('invalid dates, amounts, associations and unknown staff never mutate demo records', async () => {
  const { api, storage } = setup();
  await api.request('/state');
  const saved = storage.getItem(KEY);
  for (const invalid of [
    { date: '2031-02-30' }, { time: '24:00' }, { basePrice: -1 },
    { basePrice: true }, { duration: 0 }, { weight: 1e308 },
    { staffId: 'unregistered-staff' }, { petId: 'missing-pet' },
  ]) {
    await assert.rejects(api.request('/appointments', 'POST', reservation(invalid)));
    assert.equal(storage.getItem(KEY), saved);
  }
  await assert.rejects(api.request('/expenses', 'POST', { date: '2031-01-01', category: '소모품', amount: 1000, memo: '' }));
  await assert.rejects(api.request('/state?month=2030-99'));
  assert.equal(storage.getItem(KEY), saved);
});

test('expanded examples cover multiple months with linked customers, valid totals and no booking conflicts', async () => {
  for (const today of ['2030-01-20', '2030-01-01', '2028-02-29', '2030-12-31']) {
    const storage = new MemoryStorage();
    const api = createDemoApi(storage, { today: () => today });
    const initial = await api.request<State>('/state');
    const restored = await api.request<State>('/state');
    assert.deepEqual(restored, initial, 'all expanded samples must survive validation on reload');
    assert.equal(initial.customers.length, 24);
    assert.equal(initial.pets.length, 28);
    assert.equal(initial.shampoos.length, 4);
    assert.ok(initial.appointments.length > 140);
    assert.ok(initial.expenses.length >= 15);
    assert.ok(new Set(initial.appointments.map(item => item.date)).size > 50);
    assert.ok(initial.customers.every(customer => !customer.phone));
    assert.ok(initial.expenses.every(expense => expense.date <= today));
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    for (const appointment of initial.appointments) {
      assert.equal(appointment.price, appointment.basePrice + appointment.breedSurcharge + appointment.weightSurcharge + appointment.extraCharges.reduce((sum, item) => sum + item.amount, 0) + appointment.shampooSurcharge);
      assert.ok(initial.pets.some(pet => pet.id === appointment.petId && pet.customerId === appointment.customerId));
      if (appointment.paymentStatus === 'paid') assert.ok(appointment.paidDate! <= today);
      if (appointment.date > today) assert.equal(appointment.paymentStatus, 'unpaid');
    }
    const active = initial.appointments.filter(item => item.status !== 'cancelled');
    for (let index = 0; index < active.length; index++) {
      for (const other of active.slice(index + 1)) {
        const current = active[index];
        if (current.date === other.date) assert.ok(minutes(current.time) + current.duration <= minutes(other.time) || minutes(other.time) + other.duration <= minutes(current.time), `overlap on ${current.date}`);
      }
    }
  }
});

function legacyStorage() {
  const data = createDemoData(TODAY);
  for (const key of ['customers', 'pets', 'shampoos', 'appointments', 'expenses'] as const) {
    (data[key] as { id: string }[]) = data[key].filter(row => parseInt(row.id.slice(2), 16) < 100);
  }
  // A user-modified booking occupies the first sample slot. One original
  // expense was deleted, and custom pricing must remain as entered.
  data.appointments[1] = { ...data.appointments[1], date: '2029-12-02', time: '09:00', duration: 120, notes: '사용자가 입력한 예약 메모' };
  data.customers[0].notes = '사용자가 입력한 고객 메모';
  data.pricing.services[0].basePrice = 99000;
  data.expenses = data.expenses.slice(1);
  const storage = new MemoryStorage();
  storage.setItem(KEY, JSON.stringify({ version: 1, data }));
  return { storage, data };
}

test('existing browsers receive samples once while retaining edits, deletions and occupied slots', async () => {
  const { storage, data: old } = legacyStorage();
  const { api } = setup(storage);
  const expanded = await api.request<State>('/state');
  assert.ok(expanded.appointments.length > old.appointments.length);
  for (const key of ['appointments', 'customers', 'pets', 'shampoos', 'expenses'] as const) {
    for (const row of old[key]) assert.deepEqual(expanded[key].find(item => item.id === row.id), row);
  }
  assert.deepEqual(expanded.pricing, old.pricing);
  assert.ok(!expanded.expenses.some(expense => parseInt(expense.id.slice(2), 16) === 1));
  assert.equal(expanded.appointments.filter(item => item.date === '2029-12-02' && item.time === '09:00').length, 1);
  assert.equal(JSON.parse(storage.getItem(KEY)!).seedRevision, DEMO_SEED_REVISION);
  const addedExpense = expanded.expenses.find(expense => !old.expenses.some(previous => previous.id === expense.id))!;
  await api.request(`/expenses/${addedExpense.id}`, 'DELETE');
  const after = await api.request<State>('/state');
  assert.ok(!after.expenses.some(expense => expense.id === addedExpense.id));
  const later = createDemoApi(storage, { today: () => '2030-01-21' });
  const reopened = await later.request<State>('/state');
  assert.deepEqual(reopened, after, 'reload or date change must not re-add or duplicate samples');
});

test('a failed sample upgrade never replaces the existing stored records', async () => {
  const { storage } = legacyStorage();
  const before = storage.getItem(KEY);
  storage.failWrites = true;
  await assert.rejects(setup(storage).api.request('/state'), /저장하지 못했어요/);
  assert.equal(storage.getItem(KEY), before);
  storage.failWrites = false;
  assert.ok((await setup(storage).api.request<State>('/state')).appointments.length > 140);
});
