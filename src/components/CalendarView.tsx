import { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Palette,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  EVENT_COLORS,
  type CalendarEvent,
  type CalendarViewMode,
  type EventColor,
} from '../types';
import {
  addDays,
  addMonths,
  formatDisplayDate,
  formatLongDate,
  getMonthGridDays,
  getWeekDays,
  parseDateStr,
  toDateStr,
} from '../lib/dateUtils';
import {
  createEvent,
  deleteEvent,
  toggleEventCompleted,
  updateEventColor,
  updateEventDetails,
} from '../lib/firestoreService';

interface CalendarViewProps {
  uid: string;
  events: CalendarEvent[];
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLOR_KEYS = Object.keys(EVENT_COLORS) as EventColor[];

export function CalendarView({ uid, events }: CalendarViewProps) {
  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Modal / Sheet state for creating or editing an event
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(todayStr);
  const [formTime, setFormTime] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formColor, setFormColor] = useState<EventColor>('cobalt');
  const [saving, setSaving] = useState(false);

  // Quick inline color picker for an event row
  const [colorPickerEventId, setColorPickerEventId] = useState<string | null>(
    null
  );

  // Group events by date for fast lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        if (a.startTime) return -1;
        if (b.startTime) return 1;
        return a.title.localeCompare(b.title);
      });
      map.set(k, list);
    }
    return map;
  }, [events]);

  const selectedDateObj = useMemo(
    () => parseDateStr(selectedDate),
    [selectedDate]
  );

  const monthCells = useMemo(
    () =>
      getMonthGridDays(
        selectedDateObj.getFullYear(),
        selectedDateObj.getMonth()
      ),
    [selectedDateObj]
  );

  const weekDates = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const selectedDayEvents = useMemo(
    () => eventsByDate.get(selectedDate) || [],
    [eventsByDate, selectedDate]
  );

  const handlePrev = () => {
    if (viewMode === 'monthly') {
      setSelectedDate((d) => addMonths(d, -1));
    } else if (viewMode === 'weekly') {
      setSelectedDate((d) => addDays(d, -7));
    } else {
      setSelectedDate((d) => addDays(d, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'monthly') {
      setSelectedDate((d) => addMonths(d, 1));
    } else if (viewMode === 'weekly') {
      setSelectedDate((d) => addDays(d, 7));
    } else {
      setSelectedDate((d) => addDays(d, 1));
    }
  };

  const openCreateSheet = (dateOverride?: string) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDate(dateOverride || selectedDate);
    setFormTime('');
    setFormNotes('');
    setFormColor('cobalt');
    setSheetOpen(true);
  };

  const openEditSheet = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormDate(ev.date);
    setFormTime(ev.startTime || '');
    setFormNotes(ev.notes || '');
    setFormColor(ev.color);
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || saving) return;
    setSaving(true);
    try {
      if (editingEvent) {
        await updateEventDetails(uid, editingEvent.id, {
          title: formTitle,
          notes: formNotes,
          date: formDate,
          startTime: formTime,
          color: formColor,
          completed: editingEvent.completed,
        });
      } else {
        await createEvent(uid, {
          title: formTitle,
          notes: formNotes,
          date: formDate,
          startTime: formTime,
          color: formColor,
        });
      }
      setSelectedDate(formDate);
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    setSaving(true);
    try {
      await deleteEvent(uid, eventId);
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const periodTitle = useMemo(() => {
    if (viewMode === 'monthly') {
      return selectedDateObj.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
    if (viewMode === 'weekly') {
      const first = parseDateStr(weekDates[0]);
      const last = parseDateStr(weekDates[6]);
      const sameMonth = first.getMonth() === last.getMonth();
      if (sameMonth) {
        return `${first.toLocaleDateString('en-US', {
          month: 'short',
        })} ${first.getDate()}–${last.getDate()}, ${last.getFullYear()}`;
      }
      return `${first.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} – ${last.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;
    }
    return formatLongDate(selectedDate);
  }, [viewMode, selectedDateObj, weekDates, selectedDate]);

  // Current time HH:MM for horizontal "now" line in Daily view
  const nowTimeStr = useMemo(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  }, []);

  const renderEventRow = (ev: CalendarEvent, compact = false) => {
    const palette = EVENT_COLORS[ev.color] || EVENT_COLORS.cobalt;
    const isPickerOpen = colorPickerEventId === ev.id;

    return (
      <div
        key={ev.id}
        className={`rounded-xl border transition-colors ${palette.bg} ${palette.border} ${
          ev.completed ? 'opacity-75' : ''
        }`}
      >
        <div className={`flex items-center gap-2 ${compact ? 'p-1.5' : 'p-2.5 sm:p-3'}`}>
          {/* Check button (To-Do toggle) */}
          <button
            type="button"
            onClick={() => toggleEventCompleted(uid, ev.id, !ev.completed)}
            aria-label={
              ev.completed ? `Mark "${ev.title}" incomplete` : `Mark "${ev.title}" finished`
            }
            className="min-h-[44px] min-w-[44px] -m-1.5 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <span
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                ev.completed
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-400 hover:border-slate-700'
              }`}
            >
              {ev.completed && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            </span>
          </button>

          {/* Content with explicit horizontal middle line when completed */}
          <button
            type="button"
            onClick={() => openEditSheet(ev)}
            className="flex-1 min-w-0 text-left py-1 cursor-pointer"
          >
            <div className="relative flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: palette.swatch }}
                aria-hidden="true"
              />
              <span
                className={`relative text-sm font-medium truncate ${palette.text} ${
                  ev.completed ? 'line-through decoration-2 decoration-slate-900/80' : ''
                }`}
              >
                {ev.title}
                {ev.completed && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-slate-900/75"
                  />
                )}
              </span>
            </div>
            {(ev.startTime || ev.notes) && !compact && (
              <div className="mt-0.5 pl-4.5 flex items-center gap-2 text-xs text-slate-600 truncate">
                {ev.startTime && (
                  <span className="font-mono-num inline-flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {ev.startTime}
                  </span>
                )}
                {ev.startTime && ev.notes && <span aria-hidden="true">·</span>}
                {ev.notes && <span className="truncate">{ev.notes}</span>}
              </div>
            )}
          </button>

          {/* Quick Color Change Trigger */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() =>
                setColorPickerEventId(isPickerOpen ? null : ev.id)
              }
              aria-label={`Change color for ${ev.title}`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors cursor-pointer"
            >
              <Palette className="w-4 h-4" />
            </button>
            {!compact && (
              <button
                type="button"
                onClick={() => openEditSheet(ev)}
                aria-label={`Edit ${ev.title}`}
                className="min-h-[44px] min-w-[44px] hidden sm:flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Color Display Picker */}
        {isPickerOpen && (
          <div className="px-3 pb-3 pt-1 border-t border-black/5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 mr-1">Color:</span>
            {COLOR_KEYS.map((ck) => {
              const c = EVENT_COLORS[ck];
              const active = ev.color === ck;
              return (
                <button
                  key={ck}
                  type="button"
                  onClick={async () => {
                    await updateEventColor(uid, ev.id, ck);
                    setColorPickerEventId(null);
                  }}
                  title={c.label}
                  aria-label={c.label}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                    active ? 'ring-2 ring-slate-900 ring-offset-1 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.swatch }}
                >
                  {active && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: Period Navigation + View Switcher + Add Event */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900 ml-2 truncate">
            {periodTitle}
          </h2>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          {/* Segmented Monthly / Weekly / Daily Switcher */}
          <div
            role="tablist"
            aria-label="Calendar view mode"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
          >
            {(['monthly', 'weekly', 'daily'] as CalendarViewMode[]).map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewMode(mode)}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => openCreateSheet()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* MONTHLY VIEW */}
      {viewMode === 'monthly' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Calendar Grid */}
          <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
              {WEEKDAY_NAMES.map((day) => (
                <div
                  key={day}
                  className="py-2.5 text-center text-xs font-semibold text-slate-500"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.dateStr) || [];
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === todayStr;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`min-h-[76px] sm:min-h-[96px] p-1.5 border-b border-r border-slate-100 flex flex-col items-stretch text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-600'
                        : cell.inCurrentMonth
                        ? 'bg-white hover:bg-slate-50/80'
                        : 'bg-slate-50/50 text-slate-400 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-mono-num flex items-center justify-center ${
                          isToday
                            ? 'bg-blue-600 text-white font-semibold'
                            : isSelected
                            ? 'text-blue-700 font-semibold'
                            : cell.inCurrentMonth
                            ? 'text-slate-800 font-medium'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-mono-num text-slate-400 sm:hidden">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Desktop/tablet compact bars with horizontal strikethrough when completed */}
                    <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const c = EVENT_COLORS[ev.color] || EVENT_COLORS.cobalt;
                        return (
                          <div
                            key={ev.id}
                            className={`relative px-1.5 py-0.5 rounded text-[11px] font-medium truncate flex items-center gap-1 ${c.bg} ${c.text}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: c.swatch }}
                            />
                            <span
                              className={`truncate ${
                                ev.completed ? 'line-through opacity-70' : ''
                              }`}
                            >
                              {ev.title}
                            </span>
                            {ev.completed && (
                              <span
                                aria-hidden="true"
                                className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[1.5px] bg-slate-900/70"
                              />
                            )}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-slate-500 pl-1">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Mobile color dot summary */}
                    <div className="flex sm:hidden flex-wrap gap-1 mt-auto pt-1">
                      {dayEvents.slice(0, 4).map((ev) => {
                        const c = EVENT_COLORS[ev.color] || EVENT_COLORS.cobalt;
                        return (
                          <span
                            key={ev.id}
                            className={`w-2 h-2 rounded-full ${
                              ev.completed ? 'opacity-35' : ''
                            }`}
                            style={{ backgroundColor: c.swatch }}
                          />
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day To-Do & Event List */}
          <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  {formatDisplayDate(selectedDate)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedDayEvents.filter((e) => e.completed).length} of{' '}
                  {selectedDayEvents.length} completed
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCreateSheet(selectedDate)}
                className="min-h-[44px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm text-slate-500">
                  No events or tasks on this day.
                </p>
                <button
                  type="button"
                  onClick={() => openCreateSheet(selectedDate)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  Create an event
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedDayEvents.map((ev) => renderEventRow(ev))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WEEKLY VIEW */}
      {viewMode === 'weekly' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekDates.map((dStr) => {
            const dt = parseDateStr(dStr);
            const dayEvents = eventsByDate.get(dStr) || [];
            const isToday = dStr === todayStr;
            const isSelected = dStr === selectedDate;

            return (
              <div
                key={dStr}
                className={`bg-white border rounded-2xl p-3 flex flex-col min-h-[200px] ${
                  isSelected
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(dStr)}
                    className="flex items-center gap-2 text-left cursor-pointer"
                  >
                    <span className="text-xs font-medium text-slate-500">
                      {dt.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full text-xs font-mono-num flex items-center justify-center ${
                        isToday
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-800 font-semibold'
                      }`}
                    >
                      {dt.getDate()}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateSheet(dStr)}
                    aria-label={`Add event on ${dStr}`}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 flex-1">
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      Open day
                    </p>
                  ) : (
                    dayEvents.map((ev) => renderEventRow(ev, true))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DAILY VIEW */}
      {viewMode === 'daily' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                {formatLongDate(selectedDate)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Check items off to strike a horizontal line across completed tasks.
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono-num text-lg font-semibold text-slate-900">
                {selectedDayEvents.filter((e) => e.completed).length}/
                {selectedDayEvents.length}
              </span>
              <span className="block text-xs text-slate-500">Done</span>
            </div>
          </div>

          {/* Horizontal day progress / current-time line */}
          <div className="relative py-1">
            <div className="flex items-center gap-3">
              <span className="font-mono-num text-xs font-medium text-blue-700 shrink-0">
                {selectedDate === todayStr ? `Now · ${nowTimeStr}` : 'Schedule'}
              </span>
              <div className="flex-1 h-[1.5px] bg-blue-500/70 relative">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600"
                />
              </div>
            </div>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-slate-500">
                Nothing scheduled for {formatDisplayDate(selectedDate)} yet.
              </p>
              <button
                type="button"
                onClick={() => openCreateSheet(selectedDate)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Add First Event
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pending items */}
              {selectedDayEvents
                .filter((e) => !e.completed)
                .map((ev) => renderEventRow(ev))}

              {/* Horizontal separator line in the middle between active & completed */}
              {selectedDayEvents.some((e) => !e.completed) &&
                selectedDayEvents.some((e) => e.completed) && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs font-medium text-slate-400">
                      Finished
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}

              {/* Completed items */}
              {selectedDayEvents
                .filter((e) => e.completed)
                .map((ev) => renderEventRow(ev))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT EVENT BOTTOM SHEET / MODAL */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
        >
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden" />

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2
                  id="event-modal-title"
                  className="font-display text-xl font-semibold text-slate-900"
                >
                  {editingEvent ? 'Edit Event' : 'New Event'}
                </h2>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Event or Task Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Morning run, Dentist appointment, Pay bills"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Display Color —{' '}
                  <span className="font-normal text-slate-500">
                    {EVENT_COLORS[formColor].label}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {COLOR_KEYS.map((ck) => {
                    const c = EVENT_COLORS[ck];
                    const active = formColor === ck;
                    return (
                      <button
                        key={ck}
                        type="button"
                        onClick={() => setFormColor(ck)}
                        aria-label={c.label}
                        className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                          active
                            ? 'border-slate-900 bg-slate-100 ring-2 ring-slate-900/15'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: c.swatch }}
                        >
                          {active && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Add location or details..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                {editingEvent && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEvent.id)}
                    disabled={saving}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || !formTitle.trim()}
                  className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving
                    ? 'Saving...'
                    : editingEvent
                    ? 'Save Changes'
                    : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
