import type { Appointment, Expense } from './types.ts';

export type CalendarDay = {
  date: string;
  appointments: Appointment[];
  payments: Appointment[];
  expenses: Expense[];
  income: number;
  spending: number;
  bookingAmount: number;
  completedCount: number;
  completedAmount: number;
};

export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function monthDays(month: string, appointments: Appointment[], expenses: Expense[]): CalendarDay[] {
  const [year, number] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, index): CalendarDay => ({
    date: `${month}-${String(index + 1).padStart(2, '0')}`,
    appointments: [], payments: [], expenses: [], income: 0, spending: 0,
    bookingAmount: 0, completedCount: 0, completedAmount: 0,
  }));
  const byDate = new Map(days.map(day => [day.date, day]));
  for (const appointment of appointments) {
    if (appointment.status === 'cancelled') continue;
    const visitDay = byDate.get(appointment.date);
    if (visitDay) {
      visitDay.appointments.push(appointment);
      visitDay.bookingAmount += appointment.price;
      if (appointment.status === 'completed') {
        visitDay.completedCount += 1;
        visitDay.completedAmount += appointment.price;
      }
    }
    const paymentDay = appointment.paidDate ? byDate.get(appointment.paidDate) : undefined;
    if (appointment.paymentStatus === 'paid' && paymentDay) {
      paymentDay.payments.push(appointment);
      paymentDay.income += appointment.price;
    }
  }
  for (const expense of expenses) {
    const day = byDate.get(expense.date);
    if (day) {
      day.expenses.push(expense);
      day.spending += expense.amount;
    }
  }
  for (const day of days) day.appointments.sort((a, b) => a.time.localeCompare(b.time));
  return days;
}
