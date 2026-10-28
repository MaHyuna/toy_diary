import assert from 'node:assert/strict';
import test from 'node:test';
import { monthDays, shiftMonth } from '../src/calendar.ts';
import { createDemoData } from '../src/demo/seed.ts';

test('calendar counts visits on booking dates and income only on actual payment dates', () => {
  const fixture = createDemoData('2030-02-20');
  const visit = fixture.appointments[0];
  const appointments = [
    { ...visit, id: 'late-payment', date: '2030-01-31', time: '10:00', paidDate: '2030-02-02', price: 65000, paymentStatus: 'paid' as const },
    { ...visit, id: 'unpaid', date: '2030-02-02', time: '14:00', paidDate: null, price: 80000, paymentStatus: 'unpaid' as const },
    { ...visit, id: 'paid-visit', date: '2030-02-02', time: '09:00', paidDate: '2030-02-03', price: 35000, paymentStatus: 'paid' as const },
    { ...visit, id: 'cancelled', date: '2030-02-02', time: '12:00', status: 'cancelled' as const, paidDate: null, paymentStatus: 'unpaid' as const },
  ];
  const originalOrder = appointments.map(appointment => appointment.id);
  const days = monthDays('2030-02', appointments, [
    { ...fixture.expenses[0], id: 'expense-a', date: '2030-02-02', amount: 12000 },
    { ...fixture.expenses[0], id: 'expense-b', date: '2030-02-02', amount: 3000 },
    { ...fixture.expenses[0], id: 'outside', date: '2030-01-31', amount: 99999 },
  ]);
  assert.deepEqual(days[1].appointments.map(appointment => appointment.id), ['paid-visit', 'unpaid']);
  assert.equal(days[1].income, 65000);
  assert.equal(days[1].spending, 15000);
  assert.equal(days[2].income, 35000);
  assert.equal(days.reduce((total, day) => total + day.income, 0), 100000);
  assert.equal(days.reduce((total, day) => total + day.spending, 0), 15000);
  assert.equal(days[0].appointments.length, 0);
  assert.deepEqual(appointments.map(appointment => appointment.id), originalOrder);
});

test('month grids include leap days, full months and empty days without timezone drift', () => {
  assert.equal(monthDays('2028-02', [], []).at(-1)?.date, '2028-02-29');
  assert.equal(monthDays('2029-02', [], []).length, 28);
  assert.equal(monthDays('2030-04', [], []).length, 30);
  const december = monthDays('2030-12', [], []);
  assert.equal(december.length, 31);
  assert.equal(december[0].date, '2030-12-01');
  assert.equal(december.at(-1)?.date, '2030-12-31');
  assert.ok(december.every(day => day.income === 0 && day.spending === 0));
});

test('calendar month navigation crosses years and leap years', () => {
  assert.equal(shiftMonth('2030-12', 1), '2031-01');
  assert.equal(shiftMonth('2030-01', -1), '2029-12');
  assert.equal(shiftMonth('2028-03', -1), '2028-02');
});
