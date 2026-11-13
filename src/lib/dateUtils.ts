import type { ExpenseEntry } from '../types';

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(dateStr: string, delta: number): string {
  const dt = parseDateStr(dateStr);
  dt.setDate(dt.getDate() + delta);
  return toDateStr(dt);
}

export function addMonths(dateStr: string, delta: number): string {
  const dt = parseDateStr(dateStr);
  const targetDay = dt.getDate();
  dt.setDate(1);
  dt.setMonth(dt.getMonth() + delta);
  const maxDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(targetDay, maxDay));
  return toDateStr(dt);
}

export function getMonthGridDays(year: number, monthIndex: number): {
  dateStr: string;
  day: number;
  inCurrentMonth: boolean;
}[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startDayOfWeek = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: { dateStr: string; day: number; inCurrentMonth: boolean }[] = [];

  // Leading days from previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dt = new Date(year, monthIndex, -i);
    cells.push({
      dateStr: toDateStr(dt),
      day: dt.getDate(),
      inCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex, d);
    cells.push({
      dateStr: toDateStr(dt),
      day: d,
      inCurrentMonth: true,
    });
  }

  // Trailing days to complete 35 or 42 cells
  const totalCells = cells.length <= 35 ? 35 : 42;
  let nextDay = 1;
  while (cells.length < totalCells) {
    const dt = new Date(year, monthIndex + 1, nextDay++);
    cells.push({
      dateStr: toDateStr(dt),
      day: dt.getDate(),
      inCurrentMonth: false,
    });
  }

  return cells;
}

export function getWeekDays(anchorDateStr: string): string[] {
  const dt = parseDateStr(anchorDateStr);
  const dayOfWeek = dt.getDay(); // 0=Sun
  const start = new Date(dt);
  start.setDate(dt.getDate() - dayOfWeek);
  const week: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    week.push(toDateStr(d));
  }
  return week;
}

export function formatDisplayDate(dateStr: string): string {
  const dt = parseDateStr(dateStr);
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatLongDate(dateStr: string): string {
  const dt = parseDateStr(dateStr);
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number, currency = '$'): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${formatted}`;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  loggedToday: boolean;
  last7Days: { dateStr: string; label: string; hasEntry: boolean; isToday: boolean }[];
}

export function calculateExpenseStreak(expenses: ExpenseEntry[], todayStr: string): StreakStats {
  const dateSet = new Set(expenses.map((e) => e.date));
  const loggedToday = dateSet.has(todayStr);

  // Current streak: count backwards from today if loggedToday, else from yesterday
  let currentStreak = 0;
  let cursor = loggedToday ? todayStr : addDays(todayStr, -1);
  while (dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest streak across all sorted dates
  const sortedDates = Array.from(dateSet).sort();
  let longestStreak = 0;
  let run = 0;
  let prevDate = '';
  for (const d of sortedDates) {
    if (prevDate && addDays(prevDate, 1) === d) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevDate = d;
  }

  const last7Days: StreakStats['last7Days'] = [];
  for (let i = 6; i >= 0; i--) {
    const dStr = addDays(todayStr, -i);
    const dt = parseDateStr(dStr);
    last7Days.push({
      dateStr: dStr,
      label: dt.toLocaleDateString('en-US', { weekday: 'narrow' }),
      hasEntry: dateSet.has(dStr),
      isToday: dStr === todayStr,
    });
  }

  return {
    currentStreak,
    longestStreak,
    loggedToday,
    last7Days,
  };
}
