import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { BookOpen, CalendarDays, LogOut, Wallet } from 'lucide-react';
import { auth } from './lib/firebase';
import {
  ensureUserProfile,
  subscribeBooks,
  subscribeEvents,
  subscribeExpenses,
  subscribeIncomes,
  subscribeUserProfile,
} from './lib/firestoreService';
import {
  DEFAULT_CATEGORY_EMOJIS,
  type AppTab,
  type CalendarEvent,
  type DiaryBook,
  type ExpenseCategory,
  type ExpenseEntry,
  type IncomeEntry,
} from './types';
import { AuthGate } from './components/AuthGate';
import { CalendarView } from './components/CalendarView';
import { ExpensesView } from './components/ExpensesView';
import { DiaryView } from './components/DiaryView';
import { ErrorBoundary } from './components/ErrorBoundary';

function FolioDayApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('calendar');

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [books, setBooks] = useState<DiaryBook[]>([]);
  const [categoryEmojis, setCategoryEmojis] = useState<
    Record<ExpenseCategory, string>
  >({ ...DEFAULT_CATEGORY_EMOJIS });
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setExpenses([]);
      setIncomes([]);
      setBooks([]);
      return;
    }

    let cancelled = false;
    void ensureUserProfile({
      uid: user.uid,
      displayName: user.displayName || 'Planner User',
      email: user.email || '',
      emailVerified: user.emailVerified,
      photoURL: user.photoURL || '',
      providerId: user.providerData[0]?.providerId || 'google.com',
    }).then((profile) => {
      if (cancelled) return;
      setCategoryEmojis(profile.categoryEmojis);
      setCurrency(profile.currency || '$');
    });

    const unsubProfile = subscribeUserProfile(user.uid, (profile) => {
      setCategoryEmojis(profile.categoryEmojis);
      setCurrency(profile.currency || '$');
    });
    const unsubEvents = subscribeEvents(user.uid, setEvents);
    const unsubExpenses = subscribeExpenses(user.uid, setExpenses);
    const unsubIncomes = subscribeIncomes(user.uid, setIncomes);
    const unsubBooks = subscribeBooks(user.uid, setBooks);

    return () => {
      cancelled = true;
      unsubProfile();
      unsubEvents();
      unsubExpenses();
      unsubIncomes();
      unsubBooks();
    };
  }, [user]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="font-display text-2xl font-semibold text-slate-900 block">
            FolioDay
          </span>
          <span className="text-xs text-slate-500 block">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const navItems: { id: AppTab; label: string; icon: typeof CalendarDays }[] = [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'diary', label: 'Diary', icon: BookOpen },
  ];

  const handleSignOut = () => {
    void signOut(auth);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col md:flex-row">
      {/* DESKTOP SIDEBAR RAIL */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-white border-r border-slate-200/80 sticky top-0 h-screen p-5 justify-between">
        <div className="space-y-8">
          <div className="px-2">
            <span className="font-display text-2xl font-semibold tracking-tight text-slate-900 whitespace-nowrap">
              FolioDay
            </span>
          </div>

          <nav aria-label="Primary navigation" className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="px-2 flex items-center gap-2.5">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User avatar'}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user.displayName || 'Planner Account'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE COMPACT TOP BAR (48px) */}
      <header className="md:hidden sticky top-0 z-30 h-12 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 flex items-center justify-between">
        <span className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          FolioDay
        </span>

        <span className="text-xs font-semibold text-slate-500 capitalize">
          {activeTab}
        </span>

        <div className="flex items-center gap-1.5">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User avatar'}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover border border-slate-200"
            />
          )}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 min-w-0 px-3.5 py-4 pb-20 md:p-7 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'calendar' && (
            <CalendarView uid={user.uid} events={events} />
          )}
          {activeTab === 'expenses' && (
            <ExpensesView
              uid={user.uid}
              expenses={expenses}
              incomes={incomes}
              categoryEmojis={categoryEmojis}
              currency={currency}
            />
          )}
          {activeTab === 'diary' && <DiaryView uid={user.uid} books={books} />}
        </div>
      </main>

      {/* MOBILE FIXED BOTTOM THUMB NAVIGATION (56px) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200/90 grid grid-cols-3 items-center"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.25]' : ''}`} />
              <span className="text-[11px] font-semibold tracking-tight leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FolioDayApp />
    </ErrorBoundary>
  );
}
