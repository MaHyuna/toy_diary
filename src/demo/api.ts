import type { Appointment, Customer, Expense, PaymentMethod, Pet, Pricing, Shampoo, ShampooUsage, State } from '../types.ts';
import { addExpandedDemoData, createDemoData, DEMO_SEED_REVISION } from './seed.ts';
import type { DemoData } from './seed.ts';

export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type Input = Record<string, unknown>;
const KEY = 'mongle-demo-v1';
const MAX_MONEY = 100_000_000;
const customerFields = ['name', 'phone', 'notes'];
const petFields = ['photos', 'customerId', 'name', 'breed', 'weight', 'birthDate', 'sex', 'neutered', 'allergies', 'healthNotes', 'behaviorNotes', 'preferredStyle', 'visitIntervalWeeks'];
const shampooFields = ['name', 'purchasePrice', 'volumeMl', 'dilutionWaterRatio', 'notes', 'archived'];
const breakdownFields = ['basePrice', 'breedSurcharge', 'weightSurcharge', 'extraCharges', 'shampooUsage'];
const appointmentFields = ['dogName', 'guardianName', 'phone', 'breed', 'weight', 'service', 'date', 'time', 'duration', 'price', 'notes', 'status', 'staffId', 'customerId', 'petId', 'shampooUsage', 'shampooSurcharge', 'shampooCost', 'basePrice', 'breedSurcharge', 'weightSurcharge', 'extraCharges'];
const fail = (message: string): never => { throw new Error(message); };
const clone = <T>(value: T): T => structuredClone(value);
const uid = () => crypto.randomUUID().replaceAll('-', '');
const stamp = () => new Date().toISOString();
const koreaToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function object(value: unknown): Input {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('입력 항목을 확인해 주세요.');
  return value as Input;
}
function only(input: Input, fields: string[]) {
  if (Object.keys(input).some(key => !fields.includes(key))) fail('지원하지 않는 입력 항목이 있습니다.');
}
function text(input: Input, key: string, label: string, max = 2000, required = false): string {
  const value = input[key] === undefined ? '' : input[key];
  if (typeof value !== 'string') return fail(`${label}를 올바르게 입력해 주세요.`);
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.length > max) fail(`${label}를 ${max}자 이내로 입력해 주세요.`);
  return trimmed;
}
function amount(value: unknown, label = '금액', min = 0, max = MAX_MONEY): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return fail(`${label}는 ${min.toLocaleString()}~${max.toLocaleString()} 사이의 정수로 입력해 주세요.`);
  return value;
}
function measure(value: unknown, label: string, max = 1_000_000, inclusiveZero = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value > max || (inclusiveZero ? value < 0 : value <= 0)) return fail(`${label}의 범위를 확인해 주세요.`);
  return value;
}
function list(value: unknown, max: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail(`${label}는 최대 ${max}개까지 입력해 주세요.`);
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) return fail(`${label}를 확인해 주세요.`);
  return value as T;
}
function day(value: unknown, label = '날짜'): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return fail(`${label}를 올바르게 입력해 주세요.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail(`${label}를 올바르게 입력해 주세요.`);
  return value;
}
function month(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) fail('조회할 월을 YYYY-MM 형식으로 입력해 주세요.');
  day(`${value}-01`);
  return value;
}
function clock(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return fail('예약 시간을 HH:MM 형식으로 입력해 주세요.');
  return value;
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
function existing<T extends { id: string }>(rows: T[], id: unknown, label: string): T {
  if (typeof id !== 'string' || !id) return fail(`${label}를 선택해 주세요.`);
  return rows.find(row => row.id === id) ?? fail(`${label}를 찾을 수 없습니다.`);
}

function customer(input: Input): Omit<Customer, 'id' | 'createdAt'> {
  return { name: text(input, 'name', '보호자 이름', 80, true), phone: text(input, 'phone', '연락처', 40), notes: text(input, 'notes', '보호자 메모') };
}
function pet(input: Input, today: string): Omit<Pet, 'id' | 'createdAt'> {
  const birthDate = input.birthDate === undefined || input.birthDate === '' ? '' : day(input.birthDate, '생일');
  if (birthDate > today) fail('생일은 오늘 이후로 지정할 수 없습니다.');
  if (input.neutered !== undefined && input.neutered !== null && typeof input.neutered !== 'boolean') fail('중성화 여부를 확인해 주세요.');
  return {
    photos: list(input.photos ?? [], 6, '사진').map(value => { const photo = object(value); only(photo, ['id', 'src', 'caption', 'date']); const src = text(photo, 'src', '사진', 350000, true); if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(src)) fail('JPEG 사진을 선택해 주세요.'); let decoded = ''; try { decoded = atob(src.split(',')[1]); } catch { fail('사진 데이터를 읽을 수 없습니다.'); } if (!decoded.startsWith('\xff\xd8') || !decoded.endsWith('\xff\xd9')) fail('JPEG 사진을 선택해 주세요.'); return { id: text(photo, 'id', '사진 ID', 80, true), src, caption: text(photo, 'caption', '사진 설명', 120), date: day(photo.date, '촬영일') }; }),
    customerId: text(input, 'customerId', '보호자', 80, true), name: text(input, 'name', '반려견 이름', 80, true), breed: text(input, 'breed', '견종', 80),
    weight: input.weight === undefined || input.weight === null ? null : measure(input.weight, '몸무게', 150), birthDate,
    sex: choice(input.sex ?? 'unknown', ['unknown', 'male', 'female'] as const, '성별'), neutered: (input.neutered ?? null) as boolean | null,
    allergies: text(input, 'allergies', '알레르기'), healthNotes: text(input, 'healthNotes', '건강 정보'), behaviorNotes: text(input, 'behaviorNotes', '성향 정보'), preferredStyle: text(input, 'preferredStyle', '선호 스타일'),
    visitIntervalWeeks: input.visitIntervalWeeks === undefined || input.visitIntervalWeeks === null ? null : amount(input.visitIntervalWeeks, '방문 주기', 1, 104),
  };
}
function shampoo(input: Input): Omit<Shampoo, 'id' | 'createdAt'> {
  if (input.archived !== undefined && typeof input.archived !== 'boolean') fail('샴푸 사용 중지 여부를 확인해 주세요.');
  return {
    name: text(input, 'name', '샴푸 이름', 100, true), purchasePrice: amount(input.purchasePrice, '구매 금액'), volumeMl: measure(input.volumeMl, '제품 용량'),
    dilutionWaterRatio: measure(input.dilutionWaterRatio ?? 0, '물 희석비', 1000, true), notes: text(input, 'notes', '샴푸 메모'), archived: input.archived === true,
  };
}
function pricing(input: Input): Pricing {
  only(input, ['services', 'breedRules', 'weightRules']);
  const services = list(input.services, 30, '서비스').map(value => {
    const row = object(value); only(row, ['id', 'name', 'basePrice', 'duration']);
    return { id: text(row, 'id', '항목 ID', 80, true), name: text(row, 'name', '서비스 이름', 100, true), basePrice: amount(row.basePrice), duration: amount(row.duration, '소요 시간', 1, 480) };
  });
  if (!services.length) fail('서비스를 한 개 이상 등록해 주세요.');
  const breedRules = list(input.breedRules, 100, '견종 규칙').map(value => {
    const row = object(value); only(row, ['id', 'breed', 'amount']);
    return { id: text(row, 'id', '항목 ID', 80, true), breed: text(row, 'breed', '견종', 80, true), amount: amount(row.amount) };
  });
  const weightRules = list(input.weightRules, 100, '몸무게 규칙').map(value => {
    const row = object(value); only(row, ['id', 'minWeight', 'maxWeight', 'amount']);
    const minWeight = measure(row.minWeight, '최소 몸무게', 150, true), maxWeight = measure(row.maxWeight, '최대 몸무게', 150);
    if (minWeight >= maxWeight) fail('최대 몸무게는 최소보다 커야 합니다.');
    return { id: text(row, 'id', '항목 ID', 80, true), minWeight, maxWeight, amount: amount(row.amount) };
  });
  for (const values of [services.map(row => row.id), services.map(row => row.name.toLocaleLowerCase()), breedRules.map(row => row.id), breedRules.map(row => row.breed.toLocaleLowerCase()), weightRules.map(row => row.id)]) {
    if (new Set(values).size !== values.length) fail('요금 항목 ID, 서비스 이름 또는 견종이 중복되었습니다.');
  }
  const ordered = [...weightRules].sort((a, b) => a.minWeight - b.minWeight);
  if (ordered.some((row, index) => index > 0 && ordered[index - 1].maxWeight > row.minWeight)) fail('몸무게 요금 구간이 겹칩니다.');
  return { services, breedRules, weightRules };
}

// Convert decimal strings (including exponent notation) to exact fractions.
function fraction(value: number): [bigint, bigint] {
  const [mantissa, power = '0'] = String(value).toLowerCase().split('e');
  const [whole, decimal = ''] = mantissa.split('.');
  const scale = decimal.length - Number(power);
  const digits = BigInt(whole + decimal);
  return scale >= 0 ? [digits, 10n ** BigInt(scale)] : [digits * 10n ** BigInt(-scale), 1n];
}
function usageCost(price: number, usedMl: number, volumeMl: number): number {
  const [usedN, usedD] = fraction(usedMl), [volumeN, volumeD] = fraction(volumeMl);
  const numerator = BigInt(price) * usedN * volumeD, denominator = usedD * volumeN;
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  if (rounded > BigInt(MAX_MONEY)) fail('샴푸 사용원가가 허용 범위를 넘었습니다.');
  return Number(rounded);
}
function usage(data: DemoData, supplied: unknown, previous: ShampooUsage[] = []): ShampooUsage[] {
  const seen = new Set<string>();
  return list(supplied ?? [], 20, '샴푸 사용 내역').map(value => {
    const row = object(value); only(row, ['shampooId', 'usedMl', 'customerCharge', 'name', 'purchasePrice', 'volumeMl', 'cost']);
    const shampooId = text(row, 'shampooId', '샴푸', 80, true);
    if (seen.has(shampooId)) fail('동일 샴푸는 한 번만 입력해 주세요.');
    seen.add(shampooId);
    const usedMl = measure(row.usedMl, '샴푸 원액 사용량'), customerCharge = amount(row.customerCharge ?? 0, '샴푸 고객 추가 요금');
    const old = previous.find(item => item.shampooId === shampooId && item.usedMl === usedMl);
    if (old) return { ...old, customerCharge };
    const product = existing(data.shampoos, shampooId, '샴푸');
    if (product.archived) fail('사용 중지한 샴푸는 새 사용 내역에 추가할 수 없습니다.');
    return { shampooId, usedMl, customerCharge, name: product.name, purchasePrice: product.purchasePrice, volumeMl: product.volumeMl, cost: usageCost(product.purchasePrice, usedMl, product.volumeMl) };
  });
}
function appointment(data: DemoData, supplied: Input, current?: Appointment): Appointment {
  only(supplied, current ? appointmentFields : [...appointmentFields, 'source', 'externalId']);
  if (current?.paymentStatus === 'paid') fail('정산 완료된 예약은 수정하거나 취소할 수 없습니다.');
  if (!current && ((supplied.source ?? 'manual') !== 'manual' || (supplied.externalId ?? null) !== null)) fail('외부 예약 연동은 아직 지원하지 않습니다.');
  const values: Input = { ...current, ...supplied };
  if ((values.staffId ?? 'owner') !== 'owner') fail('현재는 원장님 한 명의 예약만 관리할 수 있습니다.');
  const petId = values.petId ?? null;
  let customerId = values.customerId ?? null;
  if ('petId' in supplied && petId === null && !('customerId' in supplied)) customerId = null;
  if (petId !== null) {
    const selected = existing(data.pets, petId, '반려견');
    if (supplied.customerId !== undefined && supplied.customerId !== null && supplied.customerId !== selected.customerId) fail('선택한 반려견과 보호자가 일치하지 않습니다.');
    customerId = selected.customerId;
  }
  if (customerId !== null) existing(data.customers, customerId, '보호자');
  const shampooUsage = usage(data, values.shampooUsage, current?.shampooUsage);
  const shampooCost = amount(shampooUsage.reduce((sum, item) => sum + item.cost, 0), '샴푸 사용원가 합계');
  const shampooSurcharge = amount(shampooUsage.reduce((sum, item) => sum + item.customerCharge, 0), '샴푸 고객 추가 요금 합계');
  if (('shampooCost' in supplied && amount(supplied.shampooCost) !== shampooCost) || ('shampooSurcharge' in supplied && amount(supplied.shampooSurcharge) !== shampooSurcharge)) fail('샴푸 상세 내역과 합계가 일치하지 않습니다.');
  const extraCharges = list(values.extraCharges ?? [], 20, '추가 요금').map(value => {
    const row = object(value); only(row, ['label', 'amount']);
    return { label: text(row, 'label', '추가 요금 항목', 100, true), amount: amount(row.amount, '추가 요금') };
  });
  const breedSurcharge = amount(values.breedSurcharge ?? 0, '견종 추가 요금'), weightSurcharge = amount(values.weightSurcharge ?? 0, '몸무게 추가 요금');
  const surcharges = breedSurcharge + weightSurcharge + extraCharges.reduce((sum, item) => sum + item.amount, 0) + shampooSurcharge;
  let basePrice = values.basePrice ?? values.price;
  if (current && 'price' in supplied && !breakdownFields.some(key => key in supplied)) basePrice = amount(supplied.price) - surcharges;
  const normalizedBase = amount(basePrice, '기본 요금'), price = amount(normalizedBase + surcharges, '예약 총액');
  if ('price' in supplied && amount(supplied.price) !== price) fail('예약 총액과 요금 상세 합계가 일치하지 않습니다.');
  const time = clock(values.time), duration = amount(values.duration, '소요 시간', 1, 480);
  if (minutes(time) + duration > 1440) fail('예약은 같은 날짜 안에 끝나도록 입력해 주세요.');
  const result: Appointment = {
    id: current?.id ?? uid(), createdAt: current?.createdAt ?? stamp(), staffId: 'owner', customerId: customerId as string | null, petId: petId as string | null,
    dogName: text(values, 'dogName', '반려견 이름', 80, true), guardianName: text(values, 'guardianName', '보호자 이름', 80, true), phone: text(values, 'phone', '연락처', 40), breed: text(values, 'breed', '견종', 80),
    weight: values.weight === undefined || values.weight === null ? null : measure(values.weight, '몸무게', 150), service: text(values, 'service', '서비스', 100, true), date: day(values.date, '예약 날짜'), time, duration,
    price, basePrice: normalizedBase, breedSurcharge, weightSurcharge, extraCharges, shampooUsage, shampooCost, shampooSurcharge, notes: text(values, 'notes', '메모'),
    source: 'manual', externalId: null, status: choice(values.status ?? 'scheduled', ['scheduled', 'completed', 'cancelled'] as const, '예약 상태'), paymentStatus: 'unpaid', paymentMethod: null, paidDate: null,
  };
  if (result.status !== 'cancelled' && data.appointments.some(other => other.id !== result.id && other.status !== 'cancelled' && other.staffId === result.staffId && other.date === result.date && minutes(result.time) < minutes(other.time) + other.duration && minutes(result.time) + result.duration > minutes(other.time))) fail('같은 시간에 다른 예약이 있습니다. 예약 시간을 확인해 주세요.');
  return result;
}

function summary(data: DemoData, selected: string): State {
  month(selected);
  const appointments = [...data.appointments].sort((a, b) => `${a.date}${a.time}${a.createdAt}`.localeCompare(`${b.date}${b.time}${b.createdAt}`));
  const expenses = [...data.expenses].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  const paid = appointments.filter(row => row.paymentStatus === 'paid' && row.paidDate?.startsWith(selected));
  const revenue = paid.reduce((sum, row) => sum + row.price, 0), totalExpenses = expenses.filter(row => row.date.startsWith(selected)).reduce((sum, row) => sum + row.amount, 0);
  return { ...data, appointments, expenses, summary: { revenue, totalExpenses, profit: revenue - totalExpenses, paidCount: paid.length, unpaidAmount: appointments.filter(row => row.date.startsWith(selected) && row.status !== 'cancelled' && row.paymentStatus === 'unpaid').reduce((sum, row) => sum + row.price, 0), shampooCost: paid.reduce((sum, row) => sum + row.shampooCost, 0) } };
}

function validateStored(value: unknown, today: string): DemoData {
  const wrapper = object(value);
  if (wrapper.version !== 1) fail('기록 버전이 다릅니다.');
  const data = object(wrapper.data);
  for (const key of ['appointments', 'expenses', 'customers', 'pets', 'shampoos']) {
    if (!Array.isArray(data[key])) fail('기록 형식이 다릅니다.');
    const ids = new Set<string>();
    for (const value of data[key] as unknown[]) {
      const row = object(value), id = text(row, 'id', 'ID', 80, true);
      if (ids.has(id) || typeof row.createdAt !== 'string') fail('기록 형식이 다릅니다.');
      ids.add(id);
    }
  }
  const records = data as unknown as DemoData;
  pricing(object(records.pricing));
  for (const row of records.customers) customer(object(row));
  for (const row of records.pets) { pet(object(row), today); existing(records.customers, row.customerId, '보호자'); }
  for (const row of records.shampoos) shampoo(object(row));
  for (const row of records.expenses) { day(row.date); amount(row.amount, '지출 금액', 1); text(object(row), 'category', '지출 분류', 80, true); text(object(row), 'memo', '지출 메모'); }
  for (const row of records.appointments) {
    choice(row.paymentStatus, ['paid', 'unpaid'] as const, '정산 상태');
    if (row.paymentStatus === 'paid') { day(row.paidDate); choice(row.paymentMethod, ['card', 'cash', 'transfer'] as const, '결제 수단'); }
    for (const value of list(row.shampooUsage, 20, '샴푸 사용 내역')) {
      const item = object(value); amount(item.cost); amount(item.purchasePrice); measure(item.volumeMl, '제품 용량'); text(item, 'name', '샴푸 이름', 100, true);
    }
    const editable: Input = {};
    for (const field of appointmentFields) editable[field] = object(row)[field];
    const normalized = appointment({ ...records, appointments: [] }, editable, { ...row, paymentStatus: 'unpaid' });
    if (normalized.price !== row.price || normalized.shampooCost !== row.shampooCost || normalized.shampooSurcharge !== row.shampooSurcharge) fail('요금 기록을 확인할 수 없습니다.');
  }
  return records;
}

export function createDemoApi(storage: StorageLike, options: { today?: () => string } = {}) {
  const getToday = options.today ?? koreaToday;
  function persist(data: DemoData) {
    try { storage.setItem(KEY, JSON.stringify({ version: 1, seedRevision: DEMO_SEED_REVISION, data })); }
    catch { fail('체험 기록을 저장하지 못했어요. 브라우저 저장 공간과 설정을 확인해 주세요.'); }
  }
  function read(): DemoData {
    let raw: string | null;
    try { raw = storage.getItem(KEY); }
    catch { return fail('브라우저 체험 기록에 접근하지 못했어요. 저장 공간 사용을 허용해 주세요.'); }
    if (raw === null) { const initial = createDemoData(day(getToday())); persist(initial); return clone(initial); }
    let data: DemoData, seedRevision: number;
    try {
      const wrapper = object(JSON.parse(raw));
      data = validateStored(wrapper, getToday());
      seedRevision = wrapper.seedRevision === undefined ? 1 : amount(wrapper.seedRevision, '예시 데이터 버전', 1, DEMO_SEED_REVISION);
    }
    catch { return fail('저장된 체험 기록을 읽을 수 없어요. 체험 데이터 초기화로 다시 시작해 주세요.'); }
    if (seedRevision < DEMO_SEED_REVISION) {
      data = addExpandedDemoData(data, day(getToday()));
      validateStored({ version: 1, data }, getToday());
      persist(data);
    }
    return data;
  }
  function locked<T>(operation: () => T): Promise<T> {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(KEY, operation);
    return Promise.resolve().then(operation);
  }
  return {
    request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
      return locked(() => {
        const url = new URL(path, 'https://demo.invalid');
        const route = url.pathname.replace(/^\/api(?=\/)/, '');
        if (method === 'GET' && route === '/health') return { status: 'ok', mode: 'demo' } as T;
        const data = clone(read()), today = day(getToday());
        if (method === 'GET' && route === '/state') return clone(summary(data, url.searchParams.get('month') ?? today.slice(0, 7))) as T;
        const input = method === 'DELETE' ? {} : object(body);
        let result: unknown;
        const parts = route.split('/').filter(Boolean), [resource, id, action] = parts;
        if (method === 'PUT' && route === '/pricing') { data.pricing = pricing(input); result = data.pricing; }
        else if (method === 'POST' && route === '/appointments') { result = appointment(data, input); data.appointments.push(result as Appointment); }
        else if (resource === 'appointments' && id && parts.length <= 3) {
          const current = existing(data.appointments, id, '예약');
          if (method === 'PATCH' && !action) {
            if (!Object.keys(input).length) fail('수정할 항목을 입력해 주세요.');
            const saved = appointment(data, input, current); data.appointments[data.appointments.indexOf(current)] = saved; result = saved;
          } else if (method === 'POST' && action === 'settle') {
            only(input, ['paymentMethod', 'paidDate']);
            if (current.paymentStatus === 'paid') fail('이미 정산 완료된 예약입니다.');
            if (current.status === 'cancelled') fail('취소된 예약은 정산할 수 없습니다.');
            const paidDate = day(input.paidDate, '결제 날짜'); if (paidDate > today) fail('결제 날짜는 오늘 이후로 지정할 수 없습니다.');
            current.paymentMethod = choice<PaymentMethod>(input.paymentMethod, ['card', 'cash', 'transfer'], '결제 수단');
            current.paidDate = paidDate; current.paymentStatus = 'paid'; current.status = 'completed'; result = current;
          } else if (method === 'POST' && action === 'link-pet') {
            only(input, ['petId']); const selected = existing(data.pets, input.petId, '반려견');
            if (current.petId !== null && current.petId !== selected.id) fail('이미 다른 반려견과 연결된 예약입니다.');
            current.petId = selected.id; current.customerId = selected.customerId; result = current;
          } else fail('요청한 경로를 찾을 수 없습니다.');
        } else if (['customers', 'pets', 'shampoos'].includes(resource) && parts.length <= 2 && ((method === 'POST' && !id) || (method === 'PATCH' && !!id))) {
          if (!Object.keys(input).length) fail('입력 항목을 확인해 주세요.');
          if (resource === 'customers') {
            only(input, customerFields); const current = id ? existing(data.customers, id, '보호자') : undefined;
            const saved: Customer = { id: current?.id ?? uid(), createdAt: current?.createdAt ?? stamp(), ...customer({ ...current, ...input }) };
            if (current) data.customers[data.customers.indexOf(current)] = saved; else data.customers.push(saved); result = saved;
          } else if (resource === 'pets') {
            only(input, petFields); const current = id ? existing(data.pets, id, '반려견') : undefined;
            const saved: Pet = { id: current?.id ?? uid(), createdAt: current?.createdAt ?? stamp(), ...pet({ ...current, ...input }, today) };
            existing(data.customers, saved.customerId, '보호자');
            if (current && current.customerId !== saved.customerId && data.appointments.some(row => row.petId === current.id)) fail('예약 내역이 있는 반려견의 보호자는 변경할 수 없습니다.');
            if (current) data.pets[data.pets.indexOf(current)] = saved; else data.pets.push(saved); result = saved;
          } else {
            only(input, shampooFields); const current = id ? existing(data.shampoos, id, '샴푸') : undefined;
            const saved: Shampoo = { id: current?.id ?? uid(), createdAt: current?.createdAt ?? stamp(), ...shampoo({ ...current, ...input }) };
            if (current) data.shampoos[data.shampoos.indexOf(current)] = saved; else data.shampoos.push(saved); result = saved;
          }
        } else if (method === 'POST' && route === '/expenses') {
          only(input, ['date', 'category', 'amount', 'memo']);
          const date = day(input.date, '지출 날짜'); if (date > today) fail('실제 지출 날짜는 오늘 이후로 지정할 수 없습니다.');
          const saved: Expense = { id: uid(), createdAt: stamp(), date, category: text(input, 'category', '지출 분류', 80, true), amount: amount(input.amount, '지출 금액', 1), memo: text(input, 'memo', '지출 메모') };
          data.expenses.push(saved); result = saved;
        } else if (method === 'DELETE' && resource === 'expenses' && id && parts.length === 2) {
          existing(data.expenses, id, '지출 내역'); data.expenses = data.expenses.filter(row => row.id !== id); result = { deleted: true };
        } else fail('요청한 경로를 찾을 수 없습니다.');
        persist(data);
        return clone(result) as T;
      });
    },
    reset(): Promise<void> { return locked(() => { persist(createDemoData(day(getToday()))); }); },
  };
}

let browserApi: ReturnType<typeof createDemoApi> | undefined;
function browser() {
  if (!browserApi) {
    let storage: Storage;
    try { storage = window.localStorage; }
    catch { return fail('브라우저 저장 공간을 사용할 수 없어요. 설정을 확인해 주세요.'); }
    browserApi = createDemoApi(storage);
  }
  return browserApi;
}
export async function demoRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> { return browser().request<T>(path, method, body); }
export async function resetDemoData(): Promise<void> { return browser().reset(); }
