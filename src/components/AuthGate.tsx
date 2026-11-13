import { signInWithPopup } from 'firebase/auth';
import { CalendarDays, Wallet, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';

export function AuthGate() {
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      let msg =
        err instanceof Error ? err.message : 'Unable to sign in right now.';
      if (code === 'auth/unauthorized-domain') {
        msg = `This domain (${window.location.hostname}) is not authorized in Firebase Authentication yet. Add it under Firebase Console → Authentication → Settings → Authorized domains.`;
      } else if (code === 'auth/popup-blocked') {
        msg = 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
      }
      setErrorMsg(msg);
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col justify-between p-6 md:p-12">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <span className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          FolioDay
        </span>
        <span className="text-xs text-slate-500">Personal Daily Companion</span>
      </header>

      <main className="max-w-5xl w-full mx-auto my-auto py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-6">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 text-balance leading-[1.12]">
            Plan your days, track your spending, and keep your stories.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            One calm workspace designed for daily focus. Check off calendar
            tasks, maintain your expense logging streak, and write in custom
            auto-saving diary books.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="min-h-[48px] w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              <span>{signingIn ? 'Signing in...' : 'Continue with Google'}</span>
            </button>
            {errorMsg && (
              <p className="mt-3 text-sm text-rose-600" role="alert">
                {errorMsg}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 grid grid-cols-1 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-base">
                To-Do Calendar
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Switch between Monthly, Weekly, and Daily views. Color-code
                events and strike them off as you finish.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-base">
                Daily Expenses &amp; Streaks
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Log spending across 10 customizable emoji categories, track your
                daily streak, and review Weekly, Monthly, and Yearly reports.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-base">
                Auto-Saving Diary Books
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Create notebooks with custom covers, see note counts at a
                glance, and write freely with instant auto-save.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-xs text-slate-500">
        Your calendar, expenses, and diary entries sync privately to your
        account.
      </footer>
    </div>
  );
}
