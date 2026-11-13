import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pencil,
  Plus,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_CATEGORY_EMOJIS,
  EXPENSE_CATEGORIES,
  INCOME_SOURCES,
  type BalanceScope,
  type ExpenseCategory,
  type ExpenseEntry,
  type ExpenseReportPeriod,
  type IncomeEntry,
} from '../types';
import {
  addDays,
  addMonths,
  calculateExpenseStreak,
  formatCurrency,
  formatDisplayDate,
  getWeekDays,
  parseDateStr,
  toDateStr,
} from '../lib/dateUtils';
import {
  createExpense,
  createIncome,
  deleteExpense,
  deleteIncome,
  updateCategoryEmojis,
  updateCurrency,
  updateExpense,
  updateIncome,
} from '../lib/firestoreService';

interface ExpensesViewProps {
  uid: string;
  expenses: ExpenseEntry[];
  incomes: IncomeEntry[];
  categoryEmojis: Record<ExpenseCategory, string>;
  currency: string;
}

const CURRENCY_OPTIONS = ['$', '€', '£', '¥', '₩', '฿', '₹', '₫', '₱', '៛'];

export function ExpensesView({
  uid,
  expenses,
  incomes,
  categoryEmojis,
  currency,
}: ExpensesViewProps) {
  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [balanceScope, setBalanceScope] = useState<BalanceScope>('month');
  const [activityFilter, setActivityFilter] = useState<'day' | 'all'>('day');

  // Add / Edit Expense form state (modal + inline quick input)
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(
    null
  );
  const [selectedCategory, setSelectedCategory] =
    useState<ExpenseCategory>('Food');
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [expenseDateInput, setExpenseDateInput] = useState(todayStr);
  const [submitting, setSubmitting] = useState(false);

  // Inline quick-add bar state
  const [quickCategory, setQuickCategory] = useState<ExpenseCategory>('Food');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  // Feedback state
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add / Edit Income form state
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [incomeSource, setIncomeSource] = useState('Salary');
  const [incomeAmountInput, setIncomeAmountInput] = useState('');
  const [incomeNoteInput, setIncomeNoteInput] = useState('');
  const [incomeDateInput, setIncomeDateInput] = useState(todayStr);
  const [incomeSubmitting, setIncomeSubmitting] = useState(false);

  // Emoji & Currency customizer state
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<ExpenseCategory>('Food');
  const [customEmojiInput, setCustomEmojiInput] = useState('');

  // Report modal/view state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeriod, setReportPeriod] =
    useState<ExpenseReportPeriod>('weekly');
  const [reportAnchorDate, setReportAnchorDate] = useState<string>(todayStr);

  const streak = useMemo(
    () => calculateExpenseStreak(expenses, todayStr),
    [expenses, todayStr]
  );

  // Expenses & Incomes for selected date
  const dayExpenses = useMemo(
    () => expenses.filter((e) => e.date === selectedDate),
    [expenses, selectedDate]
  );
  const dayIncomes = useMemo(
    () => incomes.filter((i) => i.date === selectedDate),
    [incomes, selectedDate]
  );

  const dayExpenseTotal = useMemo(
    () => dayExpenses.reduce((sum, e) => sum + e.amount, 0),
    [dayExpenses]
  );
  const dayIncomeTotal = useMemo(
    () => dayIncomes.reduce((sum, i) => sum + i.amount, 0),
    [dayIncomes]
  );

  // Income vs Total Expense & Money Left summary (Month / All Time / Selected Day)
  const balanceSummary = useMemo(() => {
    const monthPrefix = selectedDate.slice(0, 7);
    let scopedIncome = 0;
    let scopedExpense = 0;

    if (balanceScope === 'month') {
      scopedIncome = incomes
        .filter((i) => i.date.startsWith(monthPrefix))
        .reduce((s, i) => s + i.amount, 0);
      scopedExpense = expenses
        .filter((e) => e.date.startsWith(monthPrefix))
        .reduce((s, e) => s + e.amount, 0);
    } else if (balanceScope === 'all') {
      scopedIncome = incomes.reduce((s, i) => s + i.amount, 0);
      scopedExpense = expenses.reduce((s, e) => s + e.amount, 0);
    } else {
      scopedIncome = dayIncomeTotal;
      scopedExpense = dayExpenseTotal;
    }

    const moneyLeft = scopedIncome - scopedExpense;
    const scopeLabel =
      balanceScope === 'month'
        ? parseDateStr(selectedDate).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
        : balanceScope === 'all'
        ? 'All recorded time'
        : selectedDate === todayStr
        ? 'Today'
        : formatDisplayDate(selectedDate);

    return {
      income: scopedIncome,
      expense: scopedExpense,
      moneyLeft,
      scopeLabel,
    };
  }, [
    balanceScope,
    incomes,
    expenses,
    selectedDate,
    todayStr,
    dayIncomeTotal,
    dayExpenseTotal,
  ]);

  // Totals grouped by day (sorted descending)
  const dailyTotals = useMemo(() => {
    const map = new Map<
      string,
      { date: string; expense: number; income: number; count: number }
    >();
    for (const exp of expenses) {
      const prev = map.get(exp.date) || {
        date: exp.date,
        expense: 0,
        income: 0,
        count: 0,
      };
      prev.expense += exp.amount;
      prev.count += 1;
      map.set(exp.date, prev);
    }
    for (const inc of incomes) {
      const prev = map.get(inc.date) || {
        date: inc.date,
        expense: 0,
        income: 0,
        count: 0,
      };
      prev.income += inc.amount;
      prev.count += 1;
      map.set(inc.date, prev);
    }
    return Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [expenses, incomes]);

  // Quick category totals for selected date
  const dayCategoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const exp of dayExpenses) {
      map[exp.category] = (map[exp.category] || 0) + exp.amount;
    }
    return map;
  }, [dayExpenses]);

  const showStatus = (msg: string) => {
    setErrorMessage(null);
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const openQuickAdd = (category: ExpenseCategory) => {
    setEditingExpense(null);
    setSelectedCategory(category);
    setQuickCategory(category);
    setAmountInput('');
    setNoteInput('');
    setExpenseDateInput(selectedDate);
    setErrorMessage(null);
    setAddSheetOpen(true);
  };

  const openEditExpense = (expense: ExpenseEntry) => {
    setEditingExpense(expense);
    setSelectedCategory(expense.category);
    setAmountInput(String(expense.amount));
    setNoteInput(expense.note);
    setExpenseDateInput(expense.date);
    setErrorMessage(null);
    setAddSheetOpen(true);
  };

  const openIncomeSheet = () => {
    setEditingIncome(null);
    setIncomeSource('Salary');
    setIncomeAmountInput('');
    setIncomeNoteInput('');
    setIncomeDateInput(selectedDate);
    setErrorMessage(null);
    setIncomeSheetOpen(true);
  };

  const openEditIncome = (income: IncomeEntry) => {
    setEditingIncome(income);
    setIncomeSource(income.source);
    setIncomeAmountInput(String(income.amount));
    setIncomeNoteInput(income.note);
    setIncomeDateInput(income.date);
    setErrorMessage(null);
    setIncomeSheetOpen(true);
  };

  const handleInlineQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(quickAmount);
    if (!Number.isFinite(numeric) || numeric <= 0 || quickSubmitting) return;
    setQuickSubmitting(true);
    setErrorMessage(null);
    try {
      await createExpense(uid, {
        category: quickCategory,
        amount: numeric,
        note: quickNote,
        date: selectedDate,
      });
      setQuickAmount('');
      setQuickNote('');
      showStatus(`Saved ${quickCategory} · ${formatCurrency(numeric, currency)}`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to save expense.'
      );
    } finally {
      setQuickSubmitting(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(amountInput);
    if (!Number.isFinite(numeric) || numeric <= 0 || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingExpense) {
        await updateExpense(uid, editingExpense.id, {
          category: selectedCategory,
          amount: numeric,
          note: noteInput,
          date: expenseDateInput,
        });
        showStatus(
          `Updated ${selectedCategory} · ${formatCurrency(numeric, currency)}`
        );
      } else {
        await createExpense(uid, {
          category: selectedCategory,
          amount: numeric,
          note: noteInput,
          date: expenseDateInput,
        });
        showStatus(
          `Saved ${selectedCategory} · ${formatCurrency(numeric, currency)}`
        );
      }
      setSelectedDate(expenseDateInput);
      setAddSheetOpen(false);
      setEditingExpense(null);
      setAmountInput('');
      setNoteInput('');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to save expense.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(incomeAmountInput);
    if (!Number.isFinite(numeric) || numeric <= 0 || incomeSubmitting) return;
    setIncomeSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingIncome) {
        await updateIncome(uid, editingIncome.id, {
          source: incomeSource,
          amount: numeric,
          note: incomeNoteInput,
          date: incomeDateInput,
        });
        showStatus(
          `Updated ${incomeSource} · +${formatCurrency(numeric, currency)}`
        );
      } else {
        await createIncome(uid, {
          source: incomeSource,
          amount: numeric,
          note: incomeNoteInput,
          date: incomeDateInput,
        });
        showStatus(
          `Saved ${incomeSource} · +${formatCurrency(numeric, currency)}`
        );
      }
      setSelectedDate(incomeDateInput);
      setIncomeSheetOpen(false);
      setEditingIncome(null);
      setIncomeAmountInput('');
      setIncomeNoteInput('');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to save income.'
      );
    } finally {
      setIncomeSubmitting(false);
    }
  };

  const handleDeleteExpenseEntry = async (exp: ExpenseEntry) => {
    setErrorMessage(null);
    try {
      await deleteExpense(uid, exp.id);
      if (editingExpense?.id === exp.id) {
        setAddSheetOpen(false);
        setEditingExpense(null);
      }
      showStatus(`Deleted ${exp.category} expense`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to delete expense.'
      );
    }
  };

  const handleDeleteIncomeEntry = async (inc: IncomeEntry) => {
    setErrorMessage(null);
    try {
      await deleteIncome(uid, inc.id);
      if (editingIncome?.id === inc.id) {
        setIncomeSheetOpen(false);
        setEditingIncome(null);
      }
      showStatus(`Deleted ${inc.source} income`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to delete income.'
      );
    }
  };

  const handleSelectEmoji = async (cat: ExpenseCategory, emoji: string) => {
    const trimmed = emoji.trim();
    if (!trimmed) return;
    const nextMap = {
      ...DEFAULT_CATEGORY_EMOJIS,
      ...categoryEmojis,
      [cat]: trimmed.slice(0, 8),
    };
    await updateCategoryEmojis(uid, nextMap);
    setCustomEmojiInput('');
  };

  // ---------------- REPORT CALCULATIONS ----------------
  const reportData = useMemo(() => {
    const anchor = parseDateStr(reportAnchorDate);
    let filteredExpenses: ExpenseEntry[] = [];
    let filteredIncomes: IncomeEntry[] = [];
    let bars: { label: string; total: number; isCurrent?: boolean }[] = [];
    let title = '';

    if (reportPeriod === 'weekly') {
      const weekDates = getWeekDays(reportAnchorDate);
      const start = weekDates[0];
      const end = weekDates[6];
      filteredExpenses = expenses.filter((e) => e.date >= start && e.date <= end);
      filteredIncomes = incomes.filter((i) => i.date >= start && i.date <= end);
      bars = weekDates.map((dStr) => {
        const dt = parseDateStr(dStr);
        const total = filteredExpenses
          .filter((e) => e.date === dStr)
          .reduce((s, e) => s + e.amount, 0);
        return {
          label: dt.toLocaleDateString('en-US', { weekday: 'short' }),
          total,
          isCurrent: dStr === todayStr,
        };
      });
      title = `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
    } else if (reportPeriod === 'monthly') {
      const year = anchor.getFullYear();
      const month = anchor.getMonth();
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      filteredExpenses = expenses.filter((e) => e.date.startsWith(prefix));
      filteredIncomes = incomes.filter((i) => i.date.startsWith(prefix));

      const buckets = [
        { label: '1–7', min: 1, max: 7 },
        { label: '8–14', min: 8, max: 14 },
        { label: '15–21', min: 15, max: 21 },
        { label: '22–28', min: 22, max: 28 },
        ...(daysInMonth > 28
          ? [{ label: `29–${daysInMonth}`, min: 29, max: daysInMonth }]
          : []),
      ];
      bars = buckets.map((b) => {
        const total = filteredExpenses
          .filter((e) => {
            const d = Number(e.date.slice(8, 10));
            return d >= b.min && d <= b.max;
          })
          .reduce((s, e) => s + e.amount, 0);
        return { label: b.label, total };
      });
      title = anchor.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    } else {
      const year = anchor.getFullYear();
      const prefix = `${year}-`;
      filteredExpenses = expenses.filter((e) => e.date.startsWith(prefix));
      filteredIncomes = incomes.filter((i) => i.date.startsWith(prefix));
      const monthLabels = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      bars = monthLabels.map((lbl, idx) => {
        const mPrefix = `${year}-${String(idx + 1).padStart(2, '0')}`;
        const total = filteredExpenses
          .filter((e) => e.date.startsWith(mPrefix))
          .reduce((s, e) => s + e.amount, 0);
        return {
          label: lbl,
          total,
          isCurrent:
            year === new Date().getFullYear() && idx === new Date().getMonth(),
        };
      });
      title = `${year} Annual Summary`;
    }

    const totalExpense = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const totalIncome = filteredIncomes.reduce((s, i) => s + i.amount, 0);
    const moneyLeft = totalIncome - totalExpense;
    const maxBar = Math.max(1, ...bars.map((b) => b.total));

    const categoryBreakdown = EXPENSE_CATEGORIES.map((cat) => {
      const sum = filteredExpenses
        .filter((e) => e.category === cat.name)
        .reduce((s, e) => s + e.amount, 0);
      return {
        category: cat.name,
        emoji: categoryEmojis[cat.name] || cat.defaultEmoji,
        accent: cat.accent,
        total: sum,
        percent: totalExpense > 0 ? Math.round((sum / totalExpense) * 100) : 0,
      };
    })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const activeDaysCount = new Set(filteredExpenses.map((e) => e.date)).size;
    const avgPerActiveDay =
      activeDaysCount > 0 ? totalExpense / activeDaysCount : 0;

    return {
      title,
      totalIncome,
      totalExpense,
      moneyLeft,
      entryCount: filteredExpenses.length,
      avgPerActiveDay,
      bars,
      maxBar,
      categoryBreakdown,
    };
  }, [expenses, incomes, reportPeriod, reportAnchorDate, todayStr, categoryEmojis]);

  const shiftReportPeriod = (dir: -1 | 1) => {
    if (reportPeriod === 'weekly') {
      setReportAnchorDate((d) => addDays(d, dir * 7));
    } else if (reportPeriod === 'monthly') {
      setReportAnchorDate((d) => addMonths(d, dir));
    } else {
      setReportAnchorDate((d) => addMonths(d, dir * 12));
    }
  };

  return (
    <div className="space-y-5">
      {/* TOP STREAK & CONSISTENCY BANNER */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          {/* Streak Display */}
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 ${
                streak.currentStreak > 0
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono-num text-2xl sm:text-3xl font-bold text-slate-900">
                  {streak.currentStreak}
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  Day{streak.currentStreak === 1 ? '' : 's'} Streak
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {streak.loggedToday
                  ? 'Logged today — consistency kept!'
                  : 'Record one expense today to grow your streak.'}{' '}
                <span aria-hidden="true">·</span> Best:{' '}
                <span className="font-mono-num font-medium text-slate-700">
                  {streak.longestStreak}d
                </span>
              </p>
            </div>
          </div>

          {/* 7-Day Consistency Strip + Report Button */}
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-4">
            <div
              className="flex items-center gap-1.5"
              aria-label="Last 7 days consistency"
            >
              {streak.last7Days.map((d) => (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(d.dateStr)}
                  title={formatDisplayDate(d.dateStr)}
                  className={`w-8 h-10 rounded-xl flex flex-col items-center justify-center text-[11px] font-semibold transition-colors cursor-pointer ${
                    d.hasEntry
                      ? 'bg-emerald-600 text-white'
                      : d.isToday
                      ? 'bg-blue-50 text-blue-700 border border-blue-300'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <span>{d.label}</span>
                  <span className="text-[9px] leading-none mt-0.5">
                    {d.hasEntry ? '✓' : '·'}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setReportAnchorDate(selectedDate);
                setReportOpen(true);
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
              <span>View Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* INCOME · TOTAL EXPENSE · MONEY LEFT BALANCE BAR */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">
              Income &amp; Remaining Balance
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {balanceSummary.scopeLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'month', label: 'Month' },
                  { id: 'all', label: 'All Time' },
                  { id: 'day', label: 'Day' },
                ] as { id: BalanceScope; label: string }[]
              ).map((opt) => {
                const active = balanceScope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBalanceScope(opt.id)}
                    className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={openIncomeSheet}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Income</span>
            </button>
          </div>
        </div>

        {/* 3-Column Comparison: Income | Total Expense | Money Left */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 border border-slate-200/80 rounded-2xl bg-slate-50/50">
          <div className="p-4 flex items-center justify-between sm:block">
            <span className="text-xs font-medium text-slate-500 block">
              Total Income
            </span>
            <span className="font-mono-num text-xl sm:text-2xl font-bold text-emerald-700 sm:mt-1 block">
              +{formatCurrency(balanceSummary.income, currency)}
            </span>
          </div>

          <div className="p-4 flex items-center justify-between sm:block">
            <span className="text-xs font-medium text-slate-500 block">
              Total Expense
            </span>
            <span className="font-mono-num text-xl sm:text-2xl font-bold text-slate-900 sm:mt-1 block">
              {formatCurrency(balanceSummary.expense, currency)}
            </span>
          </div>

          <div className="p-4 flex items-center justify-between sm:block">
            <span className="text-xs font-medium text-slate-500 block">
              {balanceSummary.moneyLeft >= 0 ? 'Money Left' : 'Over Income'}
            </span>
            <span
              className={`font-mono-num text-xl sm:text-2xl font-bold sm:mt-1 block ${
                balanceSummary.moneyLeft >= 0
                  ? 'text-blue-700'
                  : 'text-rose-700'
              }`}
            >
              {balanceSummary.moneyLeft < 0 ? '-' : ''}
              {formatCurrency(Math.abs(balanceSummary.moneyLeft), currency)}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN DESKTOP / STACKED MOBILE WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: DATE SELECTOR + 10 CATEGORIES QUICK RECORD */}
        <div className="lg:col-span-7 space-y-5">
          {/* Date Selector & Selected Day Total */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                aria-label="Previous day"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) =>
                    e.target.value && setSelectedDate(e.target.value)
                  }
                  aria-label="Select expense date"
                  className="text-sm font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                />
                <p className="text-xs text-slate-500">
                  {selectedDate === todayStr
                    ? 'Today'
                    : formatDisplayDate(selectedDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                aria-label="Next day"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="min-h-[36px] px-3 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>

            <div className="text-right">
              <span className="block text-xs text-slate-500">Day Expense</span>
              <span className="font-mono-num text-2xl font-bold text-slate-900">
                {formatCurrency(dayExpenseTotal, currency)}
              </span>
            </div>
          </div>

          {/* 10 Categories Grid + Inline Quick Input */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-900 text-base">
                  Record Expense
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter an amount below or tap a category for{' '}
                  {selectedDate === todayStr
                    ? 'today'
                    : formatDisplayDate(selectedDate)}
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCategory('Food');
                  setEmojiSheetOpen(true);
                }}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Smile className="w-4 h-4" />
                <span>Customize Emojis</span>
              </button>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800"
              >
                {statusMessage}
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 break-words"
              >
                {errorMessage}
              </div>
            )}

            {/* Inline Quick Expense Input */}
            <form
              onSubmit={handleInlineQuickExpense}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80"
            >
              <select
                value={quickCategory}
                onChange={(e) =>
                  setQuickCategory(e.target.value as ExpenseCategory)
                }
                aria-label="Expense category"
                className="sm:col-span-4 min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {categoryEmojis[c.name] || c.defaultEmoji} {c.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100000000"
                inputMode="decimal"
                required
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                placeholder={`Amount (${currency})`}
                aria-label="Expense amount"
                className="sm:col-span-3 min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white font-mono-num text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <input
                type="text"
                maxLength={200}
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Expense note"
                className="sm:col-span-3 min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <button
                type="submit"
                disabled={
                  quickSubmitting || !quickAmount || Number(quickAmount) <= 0
                }
                className="sm:col-span-2 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                {quickSubmitting ? 'Saving...' : 'Save'}
              </button>
            </form>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {EXPENSE_CATEGORIES.map((cat) => {
                const emoji = categoryEmojis[cat.name] || cat.defaultEmoji;
                const spentToday = dayCategoryTotals[cat.name] || 0;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => openQuickAdd(cat.name)}
                    className="min-h-[88px] p-3 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-blue-500 hover:shadow-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                  >
                    <span
                      className="text-2xl leading-none"
                      role="img"
                      aria-label={cat.name}
                    >
                      {emoji}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 mt-1 truncate max-w-full">
                      {cat.name}
                    </span>
                    <span className="font-mono-num text-[11px] text-slate-500">
                      {spentToday > 0
                        ? formatCurrency(spentToday, currency)
                        : '+ Add'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: SELECTED DAY ENTRIES (EXPENSES + INCOME) & DAILY TOTALS */}
        <div className="lg:col-span-5 space-y-5">
          {/* Selected Day / All Entries */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  {activityFilter === 'all'
                    ? 'All Expenses & Income'
                    : selectedDate === todayStr
                    ? "Today's Activity"
                    : `Activity · ${formatDisplayDate(selectedDate)}`}
                </h3>
                <p className="text-xs text-slate-500">
                  {activityFilter === 'all'
                    ? `${expenses.length} expense${
                        expenses.length === 1 ? '' : 's'
                      } · ${incomes.length} income${
                        incomes.length === 1 ? '' : 's'
                      }`
                    : `${dayExpenses.length} expense${
                        dayExpenses.length === 1 ? '' : 's'
                      }${
                        dayIncomes.length > 0
                          ? ` · ${dayIncomes.length} income${
                              dayIncomes.length === 1 ? '' : 's'
                            }`
                          : ''
                      }`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 p-1 bg-slate-100 rounded-xl mr-1">
                  <button
                    type="button"
                    onClick={() => setActivityFilter('day')}
                    className={`min-h-[32px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activityFilter === 'day'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('all')}
                    className={`min-h-[32px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activityFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All
                  </button>
                </div>
                <button
                  type="button"
                  onClick={openIncomeSheet}
                  className="min-h-[44px] px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Income</span>
                </button>
                <button
                  type="button"
                  onClick={() => openQuickAdd('Food')}
                  className="min-h-[44px] px-3 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Expense</span>
                </button>
              </div>
            </div>

            {(() => {
              const visibleIncomes =
                activityFilter === 'all' ? incomes : dayIncomes;
              const visibleExpenses =
                activityFilter === 'all' ? expenses : dayExpenses;

              if (visibleExpenses.length === 0 && visibleIncomes.length === 0) {
                return (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">
                      {activityFilter === 'all'
                        ? 'No expenses or income recorded yet.'
                        : 'No expenses or income recorded on this day.'}
                    </p>
                  </div>
                );
              }

              return (
                <div
                  className={`divide-y divide-slate-100 ${
                    activityFilter === 'all' ? 'max-h-[420px] overflow-y-auto pr-0.5' : ''
                  }`}
                >
                  {visibleIncomes.map((inc) => {
                    const sourceMeta = INCOME_SOURCES.find(
                      (s) => s.label === inc.source
                    );
                    return (
                      <div
                        key={inc.id}
                        className="py-3 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg shrink-0">
                            {sourceMeta ? (
                              sourceMeta.emoji
                            ) : (
                              <ArrowDownLeft className="w-4 h-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {inc.source}{' '}
                              <span className="text-xs font-normal text-emerald-700">
                                · Income
                              </span>
                            </p>
                            {(inc.note || activityFilter === 'all') && (
                              <p className="text-xs text-slate-500 truncate">
                                {activityFilter === 'all'
                                  ? inc.date === todayStr
                                    ? 'Today'
                                    : formatDisplayDate(inc.date)
                                  : ''}
                                {activityFilter === 'all' && inc.note ? ' · ' : ''}
                                {inc.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono-num text-sm font-semibold text-emerald-700 mr-1">
                            +{formatCurrency(inc.amount, currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditIncome(inc)}
                            aria-label={`Edit ${inc.source} income`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteIncomeEntry(inc)}
                            aria-label={`Delete ${inc.source} income`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {visibleExpenses.map((exp) => {
                    const emoji =
                      categoryEmojis[exp.category] ||
                      DEFAULT_CATEGORY_EMOJIS[exp.category];
                    return (
                      <div
                        key={exp.id}
                        className="py-3 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                            {emoji}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {exp.category}
                            </p>
                            {(exp.note || activityFilter === 'all') && (
                              <p className="text-xs text-slate-500 truncate">
                                {activityFilter === 'all'
                                  ? exp.date === todayStr
                                    ? 'Today'
                                    : formatDisplayDate(exp.date)
                                  : ''}
                                {activityFilter === 'all' && exp.note ? ' · ' : ''}
                                {exp.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono-num text-sm font-semibold text-slate-900 mr-1">
                            -{formatCurrency(exp.amount, currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditExpense(exp)}
                            aria-label={`Edit ${exp.category} expense`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteExpenseEntry(exp)}
                            aria-label={`Delete ${exp.category} expense`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {activityFilter === 'day' &&
              (dayExpenses.length > 0 || dayIncomes.length > 0) && (
                <div className="pt-3 border-t border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Day Expense Total</span>
                    <span className="font-mono-num font-semibold text-slate-900">
                      {formatCurrency(dayExpenseTotal, currency)}
                    </span>
                  </div>
                  {dayIncomeTotal > 0 && (
                    <div className="flex items-center justify-between text-xs text-emerald-700">
                      <span>Day Income Total</span>
                      <span className="font-mono-num font-semibold">
                        +{formatCurrency(dayIncomeTotal, currency)}
                      </span>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Daily Totals History */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">
                Total Amount by Day
              </h3>
              <span className="text-xs text-slate-500">
                {dailyTotals.length} day{dailyTotals.length === 1 ? '' : 's'}
              </span>
            </div>

            {dailyTotals.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Daily totals will appear here once you log your first entry.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {dailyTotals.map((row) => {
                  const active = row.date === selectedDate;
                  return (
                    <button
                      key={row.date}
                      type="button"
                      onClick={() => {
                        setSelectedDate(row.date);
                        setActivityFilter('day');
                      }}
                      className={`w-full min-h-[44px] py-2.5 px-2 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer ${
                        active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <span className="text-sm font-medium text-slate-900">
                          {row.date === todayStr
                            ? 'Today'
                            : formatDisplayDate(row.date)}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          · {row.count} item{row.count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="text-right font-mono-num text-sm">
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(row.expense, currency)}
                        </span>
                        {row.income > 0 && (
                          <span className="block text-[11px] font-medium text-emerald-700">
                            +{formatCurrency(row.income, currency)} in
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD / EDIT EXPENSE MODAL / BOTTOM SHEET */}
      {addSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-expense-title"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden" />

            <form onSubmit={handleSaveExpense} className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">
                    {categoryEmojis[selectedCategory] ||
                      DEFAULT_CATEGORY_EMOJIS[selectedCategory]}
                  </span>
                  <div>
                    <h2
                      id="add-expense-title"
                      className="font-display text-lg font-semibold text-slate-900"
                    >
                      {editingExpense
                        ? `Edit ${selectedCategory}`
                        : `Add ${selectedCategory}`}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {expenseDateInput === todayStr
                        ? 'Current day'
                        : formatDisplayDate(expenseDateInput)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddSheetOpen(false);
                    setEditingExpense(null);
                  }}
                  aria-label="Close"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {EXPENSE_CATEGORIES.map((c) => {
                    const active = selectedCategory === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedCategory(c.name)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="block text-base leading-none">
                          {categoryEmojis[c.name] || c.defaultEmoji}
                        </span>
                        <span className="block text-[10px] font-medium mt-1 truncate">
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100000000"
                    required
                    autoFocus
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[52px] px-4 py-2 rounded-xl border border-slate-300 font-mono-num text-2xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDateInput}
                    onChange={(e) => setExpenseDateInput(e.target.value)}
                    className="w-full min-h-[52px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="e.g., Lunch with team, Bus fare"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 break-words"
                >
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center gap-3">
                {editingExpense && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteExpenseEntry(editingExpense)}
                    disabled={submitting}
                    className="min-h-[48px] px-4 py-3 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting || !amountInput || Number(amountInput) <= 0}
                  className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : editingExpense
                    ? 'Update Expense'
                    : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT INCOME MODAL / BOTTOM SHEET */}
      {incomeSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-income-title"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden" />

            <form onSubmit={handleSaveIncome} className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    id="add-income-title"
                    className="font-display text-lg font-semibold text-slate-900"
                  >
                    {editingIncome ? 'Edit Income' : 'Add Income'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Track earnings to see how much money you have left.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIncomeSheetOpen(false);
                    setEditingIncome(null);
                  }}
                  aria-label="Close"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Source
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {INCOME_SOURCES.map((src) => {
                    const active = incomeSource === src.label;
                    return (
                      <button
                        key={src.label}
                        type="button"
                        onClick={() => setIncomeSource(src.label)}
                        className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          active
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{src.emoji}</span>
                        <span>{src.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100000000"
                    required
                    autoFocus
                    inputMode="decimal"
                    value={incomeAmountInput}
                    onChange={(e) => setIncomeAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono-num text-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={incomeDateInput}
                    onChange={(e) => setIncomeDateInput(e.target.value)}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={incomeNoteInput}
                  onChange={(e) => setIncomeNoteInput(e.target.value)}
                  placeholder="e.g., November paycheck, Side project"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 break-words"
                >
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center gap-3">
                {editingIncome && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteIncomeEntry(editingIncome)}
                    disabled={incomeSubmitting}
                    className="min-h-[48px] px-4 py-3 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={
                    incomeSubmitting ||
                    !incomeAmountInput ||
                    Number(incomeAmountInput) <= 0
                  }
                  className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {incomeSubmitting
                    ? 'Saving...'
                    : editingIncome
                    ? 'Update Income'
                    : 'Save Income'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMIZE CATEGORY EMOJIS & CURRENCY SHEET */}
      {emojiSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emoji-customizer-title"
        >
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden" />
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    id="emoji-customizer-title"
                    className="font-display text-xl font-semibold text-slate-900"
                  >
                    Category Emojis &amp; Currency
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pick a category and choose your preferred emoji.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmojiSheetOpen(false)}
                  aria-label="Close"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {EXPENSE_CATEGORIES.map((c) => {
                  const active = editingCategory === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setEditingCategory(c.name)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-xl block">
                        {categoryEmojis[c.name] || c.defaultEmoji}
                      </span>
                      <span className="text-[11px] font-semibold mt-1 block truncate">
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Choose emoji for {editingCategory}
                  </span>
                  <span className="text-xl">
                    {categoryEmojis[editingCategory] ||
                      DEFAULT_CATEGORY_EMOJIS[editingCategory]}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    EXPENSE_CATEGORIES.find((c) => c.name === editingCategory)
                      ?.suggestions || []
                  ).map((em) => {
                    const isSelected =
                      (categoryEmojis[editingCategory] ||
                        DEFAULT_CATEGORY_EMOJIS[editingCategory]) === em;
                    return (
                      <button
                        key={em}
                        type="button"
                        onClick={() => handleSelectEmoji(editingCategory, em)}
                        className={`min-h-[44px] min-w-[44px] text-xl rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-slate-900 bg-white shadow-sm scale-105'
                            : 'border-slate-200 bg-white/70 hover:bg-white'
                        }`}
                      >
                        {em}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    maxLength={8}
                    value={customEmojiInput}
                    onChange={(e) => setCustomEmojiInput(e.target.value)}
                    placeholder="Or type any emoji..."
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectEmoji(editingCategory, customEmojiInput)
                    }
                    disabled={!customEmojiInput.trim()}
                    className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700">
                  Currency Symbol
                </span>
                <div className="flex flex-wrap gap-2">
                  {CURRENCY_OPTIONS.map((sym) => {
                    const active = currency === sym;
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => updateCurrency(uid, sym)}
                        className={`min-h-[44px] min-w-[44px] px-3 rounded-xl border font-mono-num text-sm font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEEKLY / MONTHLY / YEARLY REPORT SHEET */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-report-title"
        >
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden" />

            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="expense-report-title"
                    className="font-display text-xl font-semibold text-slate-900"
                  >
                    Expense &amp; Income Report
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {reportData.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  aria-label="Close report"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  {(['weekly', 'monthly', 'yearly'] as ExpenseReportPeriod[]).map(
                    (p) => {
                      const active = reportPeriod === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setReportPeriod(p)}
                          className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => shiftReportPeriod(-1)}
                    aria-label="Previous period"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportAnchorDate(todayStr)}
                    className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Current
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftReportPeriod(1)}
                    aria-label="Next period"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* KPI Totals: Income, Expense, Money Left, Active Day Avg */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                  <span className="text-xs text-slate-500 block">
                    Income
                  </span>
                  <span className="font-mono-num text-base sm:text-lg font-bold text-emerald-700 mt-1 block">
                    +{formatCurrency(reportData.totalIncome, currency)}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                  <span className="text-xs text-slate-500 block">
                    Total Expense
                  </span>
                  <span className="font-mono-num text-base sm:text-lg font-bold text-slate-900 mt-1 block">
                    {formatCurrency(reportData.totalExpense, currency)}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                  <span className="text-xs text-slate-500 block">
                    {reportData.moneyLeft >= 0 ? 'Money Left' : 'Over Income'}
                  </span>
                  <span
                    className={`font-mono-num text-base sm:text-lg font-bold mt-1 block ${
                      reportData.moneyLeft >= 0
                        ? 'text-blue-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {reportData.moneyLeft < 0 ? '-' : ''}
                    {formatCurrency(Math.abs(reportData.moneyLeft), currency)}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                  <span className="text-xs text-slate-500 block">
                    Active Day Avg
                  </span>
                  <span className="font-mono-num text-base sm:text-lg font-bold text-slate-900 mt-1 block">
                    {formatCurrency(reportData.avgPerActiveDay, currency)}
                  </span>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-semibold text-slate-700 block">
                  Expense Breakdown
                </span>
                <div className="h-44 flex items-end gap-1.5 sm:gap-2.5 pt-4">
                  {reportData.bars.map((bar) => {
                    const heightPct = Math.max(
                      bar.total > 0 ? 6 : 2,
                      Math.round((bar.total / reportData.maxBar) * 100)
                    );
                    return (
                      <div
                        key={bar.label}
                        className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 min-w-0"
                        title={`${bar.label}: ${formatCurrency(
                          bar.total,
                          currency
                        )}`}
                      >
                        <span className="font-mono-num text-[10px] text-slate-500 truncate max-w-full">
                          {bar.total > 0
                            ? formatCurrency(bar.total, currency)
                            : ''}
                        </span>
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className={`w-full rounded-t-lg transition-all ${
                              bar.total === 0
                                ? 'bg-slate-100'
                                : bar.isCurrent
                                ? 'bg-blue-600'
                                : 'bg-slate-800'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-600 truncate max-w-full">
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-700">
                  By Category
                </h3>
                {reportData.categoryBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    No expenses recorded during this period.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {reportData.categoryBreakdown.map((item) => (
                      <div key={item.category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium text-slate-800">
                            <span>{item.emoji}</span>
                            <span>{item.category}</span>
                          </span>
                          <span className="font-mono-num text-slate-900 font-semibold">
                            {formatCurrency(item.total, currency)}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              ({item.percent}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${item.percent}%`,
                              backgroundColor: item.accent,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
