import botanicalCover from './assets/images/diary_cover_botanical_1794542375496.jpg';
import coastalCover from './assets/images/diary_cover_coastal_1794542375798.jpg';
import sandstoneCover from './assets/images/diary_cover_sandstone_1794542376962.jpg';
import nocturneCover from './assets/images/diary_cover_nocturne_1794542377522.jpg';

export type AppTab = 'calendar' | 'expenses' | 'diary';

export type CalendarViewMode = 'monthly' | 'weekly' | 'daily';

export type EventColor =
  | 'cobalt'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'teal'
  | 'slate'
  | 'orange';

export interface CalendarEvent {
  id: string;
  ownerId: string;
  title: string;
  notes: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM or ''
  color: EventColor;
  completed: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ExpenseCategory =
  | 'Food'
  | 'Transportation'
  | 'Health'
  | 'Entertainment'
  | 'Shopping'
  | 'Hangout'
  | 'Family'
  | 'Saving'
  | 'Business'
  | 'Need';

export interface ExpenseEntry {
  id: string;
  ownerId: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IncomeEntry {
  id: string;
  ownerId: string;
  source: string;
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type BalanceScope = 'month' | 'all' | 'day';

export const INCOME_SOURCES: { label: string; emoji: string }[] = [
  { label: 'Salary', emoji: '💵' },
  { label: 'Freelance', emoji: '💻' },
  { label: 'Business', emoji: '📈' },
  { label: 'Bonus', emoji: '🎁' },
  { label: 'Allowance', emoji: '🪙' },
  { label: 'Other', emoji: '✨' },
];

export type ExpenseReportPeriod = 'weekly' | 'monthly' | 'yearly';

export interface DiaryBook {
  id: string;
  ownerId: string;
  name: string;
  coverType: 'preset' | 'color' | 'custom';
  coverValue: string;
  noteCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DiaryNote {
  id: string;
  ownerId: string;
  bookId: string;
  title: string;
  content: string;
  entryDate: string; // YYYY-MM-DD
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  ownerId: string;
  displayName: string;
  photoURL: string;
  currency: string;
  categoryEmojis: Record<ExpenseCategory, string>;
  lastLoginAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateAccount {
  ownerId: string;
  email: string;
  emailVerified: boolean;
  providerId: string;
  lastLoginAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const EVENT_COLORS: Record<
  EventColor,
  {
    label: string;
    swatch: string;
    bg: string;
    border: string;
    text: string;
    dot: string;
  }
> = {
  cobalt: {
    label: 'Cobalt Blue',
    swatch: '#2563EB',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    dot: 'bg-blue-600',
  },
  emerald: {
    label: 'Emerald',
    swatch: '#059669',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    dot: 'bg-emerald-600',
  },
  amber: {
    label: 'Amber Gold',
    swatch: '#D97706',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    dot: 'bg-amber-600',
  },
  rose: {
    label: 'Rose',
    swatch: '#E11D48',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-900',
    dot: 'bg-rose-600',
  },
  violet: {
    label: 'Violet',
    swatch: '#7C3AED',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-900',
    dot: 'bg-violet-600',
  },
  teal: {
    label: 'Teal',
    swatch: '#0D9488',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-900',
    dot: 'bg-teal-600',
  },
  orange: {
    label: 'Tangerine',
    swatch: '#EA580C',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-900',
    dot: 'bg-orange-600',
  },
  slate: {
    label: 'Slate Ink',
    swatch: '#334155',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    text: 'text-slate-900',
    dot: 'bg-slate-700',
  },
};

export const EXPENSE_CATEGORIES: {
  name: ExpenseCategory;
  defaultEmoji: string;
  suggestions: string[];
  accent: string;
}[] = [
  { name: 'Food', defaultEmoji: '🍜', suggestions: ['🍜', '🍽️', '🥗', '🍔', '🍕', '🥐', '🍱', '☕'], accent: '#EA580C' },
  { name: 'Transportation', defaultEmoji: '🚌', suggestions: ['🚌', '🚗', '🚕', '🚇', '🚲', '⛽', '✈️', '🛵'], accent: '#2563EB' },
  { name: 'Health', defaultEmoji: '🩺', suggestions: ['🩺', '💊', '🧘', '🏥', '🦷', '🏃', '🧴', '❤️'], accent: '#059669' },
  { name: 'Entertainment', defaultEmoji: '🎬', suggestions: ['🎬', '🎮', '🎵', '🎟️', '📚', '🎨', '📺', '🎳'], accent: '#7C3AED' },
  { name: 'Shopping', defaultEmoji: '🛍️', suggestions: ['🛍️', '👕', '👟', '📦', '🎁', '💄', '⌚', '🛒'], accent: '#DB2777' },
  { name: 'Hangout', defaultEmoji: '☕', suggestions: ['☕', '🍻', '🧋', '🎉', '🎤', '🍰', '🥂', '🎲'], accent: '#D97706' },
  { name: 'Family', defaultEmoji: '🏡', suggestions: ['🏡', '👨‍👩‍👧', '👶', '🐾', '💐', '🎂', '🧸', '🫶'], accent: '#0D9488' },
  { name: 'Saving', defaultEmoji: '🏦', suggestions: ['🏦', '💰', '📈', '🪙', '💎', '🧾', '🔐', '🌱'], accent: '#15803D' },
  { name: 'Business', defaultEmoji: '💼', suggestions: ['💼', '💻', '📊', '🗂️', '✈️', '📱', '🖋️', '🏢'], accent: '#334155' },
  { name: 'Need', defaultEmoji: '🧾', suggestions: ['🧾', '🛒', '💡', '💧', '🏠', '🧻', '🔧', '🧺'], accent: '#475569' },
];

export const DEFAULT_CATEGORY_EMOJIS: Record<ExpenseCategory, string> = EXPENSE_CATEGORIES.reduce(
  (acc, item) => {
    acc[item.name] = item.defaultEmoji;
    return acc;
  },
  {} as Record<ExpenseCategory, string>
);

export const DIARY_COVER_PRESETS: {
  id: string;
  label: string;
  src: string;
  legacySrc: string;
  fallbackGradient: string;
}[] = [
  {
    id: 'botanical',
    label: 'Botanical Linen',
    src: botanicalCover,
    legacySrc: '/src/assets/images/diary_cover_botanical_1794542375496.jpg',
    fallbackGradient: 'from-stone-200 via-stone-100 to-emerald-100',
  },
  {
    id: 'coastal',
    label: 'Coastal Brush',
    src: coastalCover,
    legacySrc: '/src/assets/images/diary_cover_coastal_1794542375798.jpg',
    fallbackGradient: 'from-sky-100 via-blue-200 to-teal-100',
  },
  {
    id: 'sandstone',
    label: 'Sandstone Arches',
    src: sandstoneCover,
    legacySrc: '/src/assets/images/diary_cover_sandstone_1794542376962.jpg',
    fallbackGradient: 'from-amber-100 via-orange-200 to-stone-300',
  },
  {
    id: 'nocturne',
    label: 'Indigo Nocturne',
    src: nocturneCover,
    legacySrc: '/src/assets/images/diary_cover_nocturne_1794542377522.jpg',
    fallbackGradient: 'from-slate-900 via-indigo-950 to-slate-800',
  },
];

export const DIARY_CLOTH_COLORS: {
  id: string;
  label: string;
  bg: string;
  text: string;
  spine: string;
}[] = [
  { id: '#1E293B', label: 'Charcoal Buckram', bg: '#1E293B', text: '#F8FAFC', spine: '#0F172A' },
  { id: '#1E3A8A', label: 'Cobalt Cloth', bg: '#1E3A8A', text: '#EFF6FF', spine: '#172554' },
  { id: '#065F46', label: 'Forest Linen', bg: '#065F46', text: '#ECFDF5', spine: '#064E3B' },
  { id: '#9A3412', label: 'Terracotta Clay', bg: '#9A3412', text: '#FFF7ED', spine: '#7C2D12' },
  { id: '#581C87', label: 'Plum Velvet', bg: '#581C87', text: '#FAF5FF', spine: '#3B0764' },
  { id: '#78350F', label: 'Ochre Canvas', bg: '#78350F', text: '#FFFBEB', spine: '#451A03' },
];
