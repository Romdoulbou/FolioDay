import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_CATEGORY_EMOJIS,
  type CalendarEvent,
  type DiaryBook,
  type DiaryNote,
  type EventColor,
  type ExpenseCategory,
  type ExpenseEntry,
  type IncomeEntry,
  type UserProfile,
} from '../types';

export interface GoogleSignInUserInfo {
  uid: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  photoURL: string;
  providerId: string;
}

export async function ensureUserProfile(
  userInfo: GoogleSignInUserInfo
): Promise<UserProfile> {
  const { uid } = userInfo;
  const profilePath = `users/${uid}`;
  const privatePath = `users/${uid}/private/account`;
  const profileRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'account');
  const safeDisplayName = (userInfo.displayName || 'Planner User').slice(0, 100);
  const safePhotoURL = (userInfo.photoURL || '').slice(0, 500);
  const safeEmail = (userInfo.email || '').slice(0, 254);
  const safeProviderId = (userInfo.providerId || 'google.com').slice(0, 40);

  let resolvedProfile: UserProfile;

  try {
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      await updateDoc(profileRef, {
        displayName: safeDisplayName,
        photoURL: safePhotoURL,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      resolvedProfile = {
        ...data,
        displayName: safeDisplayName,
        photoURL: safePhotoURL,
        categoryEmojis: {
          ...DEFAULT_CATEGORY_EMOJIS,
          ...(data.categoryEmojis || {}),
        },
      };
    } else {
      const initial: UserProfile = {
        ownerId: uid,
        displayName: safeDisplayName,
        photoURL: safePhotoURL,
        currency: '$',
        categoryEmojis: { ...DEFAULT_CATEGORY_EMOJIS },
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(profileRef, initial);
      resolvedProfile = {
        ...initial,
        categoryEmojis: { ...DEFAULT_CATEGORY_EMOJIS },
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  try {
    const privateSnap = await getDoc(privateRef);
    if (privateSnap.exists()) {
      await updateDoc(privateRef, {
        email: safeEmail,
        emailVerified: Boolean(userInfo.emailVerified),
        providerId: safeProviderId,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(privateRef, {
        ownerId: uid,
        email: safeEmail,
        emailVerified: Boolean(userInfo.emailVerified),
        providerId: safeProviderId,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  return resolvedProfile;
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        onData({
          ...data,
          categoryEmojis: { ...DEFAULT_CATEGORY_EMOJIS, ...(data.categoryEmojis || {}) },
        });
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function updateCategoryEmojis(
  uid: string,
  categoryEmojis: Record<ExpenseCategory, string>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      categoryEmojis,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCurrency(uid: string, currency: string): Promise<void> {
  const path = `users/${uid}`;
  const safeCurrency = (currency.trim() || '$').slice(0, 8);
  try {
    await updateDoc(doc(db, 'users', uid), {
      currency: safeCurrency,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------- CALENDAR EVENTS ----------------

function getTimestampMillis(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export function subscribeEvents(
  uid: string,
  onData: (events: CalendarEvent[]) => void
): Unsubscribe {
  const path = `users/${uid}/events`;
  const q = query(
    collection(db, 'users', uid, 'events'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: CalendarEvent[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CalendarEvent, 'id'>),
        }))
        .sort((a, b) => {
          const dateCmp = a.date.localeCompare(b.date);
          if (dateCmp !== 0) return dateCmp;
          if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
          if (a.startTime) return -1;
          if (b.startTime) return 1;
          return a.title.localeCompare(b.title);
        });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createEvent(
  uid: string,
  payload: {
    title: string;
    notes: string;
    date: string;
    startTime: string;
    color: EventColor;
  }
): Promise<void> {
  const colRef = collection(db, 'users', uid, 'events');
  const newRef = doc(colRef);
  const path = `users/${uid}/events/${newRef.id}`;
  try {
    await setDoc(newRef, {
      ownerId: uid,
      title: payload.title.trim().slice(0, 140),
      notes: payload.notes.trim().slice(0, 500),
      date: payload.date,
      startTime: payload.startTime || '',
      color: payload.color,
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleEventCompleted(
  uid: string,
  eventId: string,
  completed: boolean
): Promise<void> {
  const path = `users/${uid}/events/${eventId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'events', eventId), {
      completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateEventColor(
  uid: string,
  eventId: string,
  color: EventColor
): Promise<void> {
  const path = `users/${uid}/events/${eventId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'events', eventId), {
      color,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateEventDetails(
  uid: string,
  eventId: string,
  payload: {
    title: string;
    notes: string;
    date: string;
    startTime: string;
    color: EventColor;
    completed: boolean;
  }
): Promise<void> {
  const path = `users/${uid}/events/${eventId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'events', eventId), {
      title: payload.title.trim().slice(0, 140),
      notes: payload.notes.trim().slice(0, 500),
      date: payload.date,
      startTime: payload.startTime || '',
      color: payload.color,
      completed: payload.completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEvent(uid: string, eventId: string): Promise<void> {
  const path = `users/${uid}/events/${eventId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'events', eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------- EXPENSES ----------------

export function subscribeExpenses(
  uid: string,
  onData: (expenses: ExpenseEntry[]) => void
): Unsubscribe {
  const path = `users/${uid}/expenses`;
  const q = query(
    collection(db, 'users', uid, 'expenses'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ExpenseEntry[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ExpenseEntry, 'id'>),
        }))
        .sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
          return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
        });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createExpense(
  uid: string,
  payload: {
    category: ExpenseCategory;
    amount: number;
    note: string;
    date: string;
  }
): Promise<void> {
  const colRef = collection(db, 'users', uid, 'expenses');
  const newRef = doc(colRef);
  const path = `users/${uid}/expenses/${newRef.id}`;
  const safeAmount = Math.min(100000000, Math.max(0.01, Math.round(payload.amount * 100) / 100));
  try {
    await setDoc(newRef, {
      ownerId: uid,
      category: payload.category,
      amount: safeAmount,
      note: payload.note.trim().slice(0, 200),
      date: payload.date,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateExpense(
  uid: string,
  expenseId: string,
  payload: {
    category: ExpenseCategory;
    amount: number;
    note: string;
    date: string;
  }
): Promise<void> {
  const path = `users/${uid}/expenses/${expenseId}`;
  const safeAmount = Math.min(100000000, Math.max(0.01, Math.round(payload.amount * 100) / 100));
  try {
    await updateDoc(doc(db, 'users', uid, 'expenses', expenseId), {
      category: payload.category,
      amount: safeAmount,
      note: payload.note.trim().slice(0, 200),
      date: payload.date,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExpense(uid: string, expenseId: string): Promise<void> {
  const path = `users/${uid}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'expenses', expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------- INCOMES ----------------

export function subscribeIncomes(
  uid: string,
  onData: (incomes: IncomeEntry[]) => void
): Unsubscribe {
  const path = `users/${uid}/incomes`;
  const q = query(
    collection(db, 'users', uid, 'incomes'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: IncomeEntry[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<IncomeEntry, 'id'>),
        }))
        .sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
          return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
        });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createIncome(
  uid: string,
  payload: {
    source: string;
    amount: number;
    note: string;
    date: string;
  }
): Promise<void> {
  const colRef = collection(db, 'users', uid, 'incomes');
  const newRef = doc(colRef);
  const path = `users/${uid}/incomes/${newRef.id}`;
  const safeAmount = Math.min(100000000, Math.max(0.01, Math.round(payload.amount * 100) / 100));
  try {
    await setDoc(newRef, {
      ownerId: uid,
      source: (payload.source.trim() || 'Other').slice(0, 60),
      amount: safeAmount,
      note: payload.note.trim().slice(0, 200),
      date: payload.date,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateIncome(
  uid: string,
  incomeId: string,
  payload: {
    source: string;
    amount: number;
    note: string;
    date: string;
  }
): Promise<void> {
  const path = `users/${uid}/incomes/${incomeId}`;
  const safeAmount = Math.min(100000000, Math.max(0.01, Math.round(payload.amount * 100) / 100));
  try {
    await updateDoc(doc(db, 'users', uid, 'incomes', incomeId), {
      source: (payload.source.trim() || 'Other').slice(0, 60),
      amount: safeAmount,
      note: payload.note.trim().slice(0, 200),
      date: payload.date,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteIncome(uid: string, incomeId: string): Promise<void> {
  const path = `users/${uid}/incomes/${incomeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'incomes', incomeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------- DIARY BOOKS & NOTES ----------------

export function subscribeBooks(
  uid: string,
  onData: (books: DiaryBook[]) => void
): Unsubscribe {
  const path = `users/${uid}/books`;
  const q = query(
    collection(db, 'users', uid, 'books'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: DiaryBook[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DiaryBook, 'id'>),
        }))
        .sort(
          (a, b) =>
            getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt)
        );
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createBook(
  uid: string,
  payload: {
    name: string;
    coverType: 'preset' | 'color' | 'custom';
    coverValue: string;
  }
): Promise<string> {
  const colRef = collection(db, 'users', uid, 'books');
  const newRef = doc(colRef);
  const path = `users/${uid}/books/${newRef.id}`;
  try {
    await setDoc(newRef, {
      ownerId: uid,
      name: payload.name.trim().slice(0, 80),
      coverType: payload.coverType,
      coverValue: payload.coverValue.slice(0, 260000),
      noteCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBook(
  uid: string,
  bookId: string,
  payload: {
    name: string;
    coverType: 'preset' | 'color' | 'custom';
    coverValue: string;
  }
): Promise<void> {
  const path = `users/${uid}/books/${bookId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'books', bookId), {
      name: payload.name.trim().slice(0, 80),
      coverType: payload.coverType,
      coverValue: payload.coverValue.slice(0, 260000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBook(uid: string, bookId: string): Promise<void> {
  const path = `users/${uid}/books/${bookId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'books', bookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeNotes(
  uid: string,
  bookId: string,
  onData: (notes: DiaryNote[]) => void
): Unsubscribe {
  const path = `users/${uid}/books/${bookId}/notes`;
  const q = query(
    collection(db, 'users', uid, 'books', bookId, 'notes'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: DiaryNote[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DiaryNote, 'id'>),
        }))
        .sort(
          (a, b) =>
            getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt)
        );
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createNote(
  uid: string,
  bookId: string,
  payload: {
    title: string;
    content: string;
    entryDate: string;
  }
): Promise<string> {
  const noteCol = collection(db, 'users', uid, 'books', bookId, 'notes');
  const noteRef = doc(noteCol);
  const bookRef = doc(db, 'users', uid, 'books', bookId);
  const path = `users/${uid}/books/${bookId}/notes/${noteRef.id}`;
  try {
    const batch = writeBatch(db);
    batch.set(noteRef, {
      ownerId: uid,
      bookId,
      title: payload.title.slice(0, 140),
      content: payload.content.slice(0, 50000),
      entryDate: payload.entryDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(bookRef, {
      noteCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return noteRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveNoteContent(
  uid: string,
  bookId: string,
  noteId: string,
  payload: {
    title: string;
    content: string;
    entryDate: string;
  }
): Promise<void> {
  const path = `users/${uid}/books/${bookId}/notes/${noteId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'books', bookId, 'notes', noteId), {
      title: payload.title.slice(0, 140),
      content: payload.content.slice(0, 50000),
      entryDate: payload.entryDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNote(
  uid: string,
  bookId: string,
  noteId: string
): Promise<void> {
  const noteRef = doc(db, 'users', uid, 'books', bookId, 'notes', noteId);
  const bookRef = doc(db, 'users', uid, 'books', bookId);
  const path = `users/${uid}/books/${bookId}/notes/${noteId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(noteRef);
    batch.update(bookRef, {
      noteCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
