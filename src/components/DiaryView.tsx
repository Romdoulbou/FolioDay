import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  DIARY_CLOTH_COLORS,
  DIARY_COVER_PRESETS,
  type DiaryBook,
  type DiaryNote,
} from '../types';
import { formatDisplayDate, toDateStr } from '../lib/dateUtils';
import {
  createBook,
  createNote,
  deleteBook,
  deleteNote,
  saveNoteContent,
  subscribeNotes,
  updateBook,
} from '../lib/firestoreService';

interface DiaryViewProps {
  uid: string;
  books: DiaryBook[];
}

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxWidth = 540;
        const maxHeight = 720;
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 220000 && quality > 0.35) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function BookCoverArt({
  book,
  showTitleOverlay = true,
}: {
  book: Pick<DiaryBook, 'name' | 'coverType' | 'coverValue'>;
  showTitleOverlay?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const preset =
    book.coverType === 'preset'
      ? DIARY_COVER_PRESETS.find(
          (p) =>
            p.src === book.coverValue ||
            p.legacySrc === book.coverValue ||
            p.id === book.coverValue
        ) || DIARY_COVER_PRESETS[0]
      : null;

  const cloth =
    book.coverType === 'color'
      ? DIARY_CLOTH_COLORS.find((c) => c.id === book.coverValue) ||
        DIARY_CLOTH_COLORS[0]
      : null;

  const resolvedImageSrc =
    book.coverType === 'preset'
      ? preset?.src || book.coverValue
      : book.coverValue;

  const showImage =
    (book.coverType === 'preset' || book.coverType === 'custom') && !imgFailed;

  return (
    <div
      className="relative w-full aspect-[3/4] rounded-r-xl rounded-l-sm overflow-hidden shadow-sm border border-black/10 select-none"
      style={
        cloth
          ? { backgroundColor: cloth.bg }
          : undefined
      }
    >
      {showImage ? (
        <img
          src={resolvedImageSrc}
          alt={`${book.name} book cover`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : !cloth ? (
        <div
          className={`w-full h-full bg-gradient-to-br ${
            preset?.fallbackGradient || 'from-slate-200 via-stone-100 to-slate-300'
          } flex items-center justify-center`}
        >
          <BookOpen className="w-10 h-10 text-slate-500/60" />
        </div>
      ) : null}

      {/* Tactile Spine Crease */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/30 via-black/10 to-transparent pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-3 w-px bg-white/25 pointer-events-none"
      />

      {/* Title Overlay with high-contrast scrim */}
      {showTitleOverlay && (
        <div
          className={`absolute inset-x-0 bottom-0 p-3.5 ${
            cloth
              ? ''
              : 'bg-gradient-to-t from-black/80 via-black/45 to-transparent'
          }`}
        >
          <h3
            className={`font-display text-base sm:text-lg font-semibold leading-snug line-clamp-2 ${
              cloth ? '' : 'text-white'
            }`}
            style={cloth ? { color: cloth.text } : undefined}
          >
            {book.name}
          </h3>
        </div>
      )}
    </div>
  );
}

export function DiaryView({ uid, books }: DiaryViewProps) {
  const todayStr = useMemo(() => toDateStr(new Date()), []);

  // Selected book & live notes subscription
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const activeBook = useMemo(
    () => books.find((b) => b.id === activeBookId) || null,
    [books, activeBookId]
  );
  const [notes, setNotes] = useState<DiaryNote[]>([]);

  // Book creator/editor modal state
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<DiaryBook | null>(null);
  const [bookName, setBookName] = useState('');
  const [coverType, setCoverType] = useState<'preset' | 'color' | 'custom'>(
    'preset'
  );
  const [coverValue, setCoverValue] = useState(DIARY_COVER_PRESETS[0].src);
  const [bookSaving, setBookSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Note editor & auto-save state
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState(todayStr);
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');

  // Refs to ensure auto-save never duplicates or drops edits
  const activeNoteIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const inFlightCreateRef = useRef<Promise<string> | null>(null);
  const dirtyRef = useRef(false);
  const latestDraftRef = useRef({
    title: '',
    content: '',
    entryDate: todayStr,
    bookId: '',
  });

  useEffect(() => {
    if (!activeBookId) {
      setNotes([]);
      return;
    }
    const unsub = subscribeNotes(uid, activeBookId, (items) => {
      setNotes(items);
    });
    return () => unsub();
  }, [uid, activeBookId]);

  // Keep latestDraftRef synced
  useEffect(() => {
    latestDraftRef.current = {
      title: noteTitle,
      content: noteContent,
      entryDate: noteDate,
      bookId: activeBookId || '',
    };
  }, [noteTitle, noteContent, noteDate, activeBookId]);

  const flushAutoSave = async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const draft = latestDraftRef.current;
    if (!draft.bookId) return;
    if (!activeNoteIdRef.current && !draft.title.trim() && !draft.content.trim()) {
      dirtyRef.current = false;
      setSaveState('idle');
      return;
    }

    setSaveState('saving');
    setSaveError(null);
    const snapshotTitle = draft.title;
    const snapshotContent = draft.content;
    const snapshotDate = draft.entryDate;

    try {
      if (!activeNoteIdRef.current) {
        if (!inFlightCreateRef.current) {
          inFlightCreateRef.current = createNote(uid, draft.bookId, {
            title: snapshotTitle.trim() || 'Untitled Note',
            content: snapshotContent,
            entryDate: snapshotDate,
          });
        }
        const createdId = await inFlightCreateRef.current;
        inFlightCreateRef.current = null;
        activeNoteIdRef.current = createdId;
        setSelectedNoteId(createdId);
      } else {
        await saveNoteContent(uid, draft.bookId, activeNoteIdRef.current, {
          title: snapshotTitle,
          content: snapshotContent,
          entryDate: snapshotDate,
        });
      }

      // If user typed more while the request was in flight, save the newer draft
      const current = latestDraftRef.current;
      if (
        current.bookId === draft.bookId &&
        (current.title !== snapshotTitle ||
          current.content !== snapshotContent ||
          current.entryDate !== snapshotDate)
      ) {
        dirtyRef.current = true;
        void flushAutoSave();
        return;
      }

      dirtyRef.current = false;
      setSaveState('saved');
      setLastSavedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err) {
      inFlightCreateRef.current = null;
      setSaveState('error');
      setSaveError(
        err instanceof Error ? err.message : 'Unable to save note.'
      );
    }
  };

  const scheduleAutoSave = () => {
    dirtyRef.current = true;
    setSaveState('saving');
    setSaveError(null);
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void flushAutoSave();
    }, 450);
  };

  // Flush pending auto-save when switching away or hiding tab, and on unmount
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        void flushAutoSave();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (dirtyRef.current) {
        void flushAutoSave();
      }
    };
  }, []);

  const openCreateBookModal = () => {
    setEditingBook(null);
    setBookName('');
    setCoverType('preset');
    setCoverValue(DIARY_COVER_PRESETS[0].src);
    setUploadError(null);
    setBookError(null);
    setBookModalOpen(true);
  };

  const openEditBookModal = (book: DiaryBook) => {
    setEditingBook(book);
    setBookName(book.name);
    setCoverType(book.coverType);
    setCoverValue(book.coverValue);
    setUploadError(null);
    setBookError(null);
    setBookModalOpen(true);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setCoverType('custom');
      setCoverValue(dataUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to process image.'
      );
    }
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim() || bookSaving) return;
    setBookSaving(true);
    setBookError(null);
    try {
      if (editingBook) {
        await updateBook(uid, editingBook.id, {
          name: bookName,
          coverType,
          coverValue,
        });
      } else {
        const newBookId = await createBook(uid, {
          name: bookName,
          coverType,
          coverValue,
        });
        setActiveBookId(newBookId);
      }
      setBookModalOpen(false);
    } catch (err) {
      setBookError(
        err instanceof Error ? err.message : 'Unable to save diary book.'
      );
    } finally {
      setBookSaving(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    setBookSaving(true);
    setBookError(null);
    try {
      await deleteBook(uid, bookId);
      setBookModalOpen(false);
      if (activeBookId === bookId) {
        setActiveBookId(null);
        setEditorOpen(false);
      }
    } catch (err) {
      setBookError(
        err instanceof Error ? err.message : 'Unable to delete diary book.'
      );
    } finally {
      setBookSaving(false);
    }
  };

  const startNewNote = async () => {
    if (saveTimerRef.current !== null) {
      await flushAutoSave();
    }
    activeNoteIdRef.current = null;
    inFlightCreateRef.current = null;
    setSelectedNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteDate(todayStr);
    setSaveState('idle');
    setLastSavedAt('');
    setEditorOpen(true);
  };

  const openExistingNote = async (note: DiaryNote) => {
    if (saveTimerRef.current !== null) {
      await flushAutoSave();
    }
    activeNoteIdRef.current = note.id;
    inFlightCreateRef.current = null;
    setSelectedNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteDate(note.entryDate);
    setSaveState('saved');
    setLastSavedAt('');
    setEditorOpen(true);
  };

  const handleBackFromBook = async () => {
    if (saveTimerRef.current !== null) {
      await flushAutoSave();
    }
    setEditorOpen(false);
    setActiveBookId(null);
  };

  const handleBackFromEditor = async () => {
    if (saveTimerRef.current !== null) {
      await flushAutoSave();
    }
    setEditorOpen(false);
  };

  const handleDeleteCurrentNote = async () => {
    if (!activeBookId || !activeNoteIdRef.current) {
      setEditorOpen(false);
      return;
    }
    const targetId = activeNoteIdRef.current;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    activeNoteIdRef.current = null;
    await deleteNote(uid, activeBookId, targetId);
    setSelectedNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setEditorOpen(false);
  };

  // ---------------- BOOK INTERIOR VIEW ----------------
  if (activeBook) {
    return (
      <div className="space-y-4">
        {/* Book Header */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={editorOpen ? handleBackFromEditor : handleBackFromBook}
              aria-label="Back"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900 truncate">
                {activeBook.name}
              </h2>
              <p className="text-xs text-slate-500">
                {notes.length} note{notes.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openEditBookModal(activeBook)}
              aria-label="Edit book details"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={startNewNote}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Note</span>
            </button>
          </div>
        </div>

        {/* Two-Pane on Desktop, Stack/Switch on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Notes List */}
          <div
            className={`lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 ${
              editorOpen ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-600">
                Pages in this book
              </span>
              <button
                type="button"
                onClick={handleBackFromBook}
                className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
              >
                All Books
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm text-slate-500">
                  This book has no notes yet.
                </p>
                <button
                  type="button"
                  onClick={startNewNote}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Write First Note
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notes.map((n) => {
                  const active = selectedNoteId === n.id && editorOpen;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openExistingNote(n)}
                      className={`w-full py-3 px-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-50/80'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {n.title || 'Untitled Note'}
                        </h4>
                        <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                          {n.entryDate}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {n.content || 'Empty page...'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Auto-Saving Editor */}
          <div
            className={`lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 min-h-[420px] flex flex-col ${
              editorOpen ? 'block' : 'hidden lg:flex'
            }`}
          >
            {!editorOpen ? (
              <div className="my-auto text-center py-14 space-y-3">
                <BookOpen className="w-9 h-9 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-500">
                  Select a note on the left or create a new note to start writing.
                </p>
                <button
                  type="button"
                  onClick={startNewNote}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Create New Note
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={noteDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setNoteDate(e.target.value);
                          scheduleAutoSave();
                        }
                      }}
                      aria-label="Entry date"
                      className="text-xs font-mono-num text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg focus:outline-none"
                    />
                    <span
                      className={`text-xs ${
                        saveState === 'error' ? 'text-rose-600 font-semibold' : 'text-slate-500'
                      }`}
                      aria-live="polite"
                    >
                      {saveState === 'saving'
                        ? 'Saving...'
                        : saveState === 'error'
                        ? saveError || 'Save failed'
                        : saveState === 'saved'
                        ? lastSavedAt
                          ? `Auto-saved at ${lastSavedAt}`
                          : 'Saved'
                        : 'Auto-saves as you type'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleDeleteCurrentNote}
                    aria-label="Delete note"
                    className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>

                <input
                  type="text"
                  maxLength={140}
                  value={noteTitle}
                  onChange={(e) => {
                    setNoteTitle(e.target.value);
                    scheduleAutoSave();
                  }}
                  placeholder="Note title..."
                  className="mt-4 font-display text-2xl font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none w-full"
                />

                <textarea
                  value={noteContent}
                  maxLength={50000}
                  onChange={(e) => {
                    setNoteContent(e.target.value);
                    scheduleAutoSave();
                  }}
                  placeholder="Start writing your thoughts — every word auto-saves automatically..."
                  className="mt-4 flex-1 min-h-[280px] w-full text-base leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none"
                />
              </>
            )}
          </div>
        </div>

        {/* EDIT BOOK MODAL (also accessible inside book) */}
        {bookModalOpen && (
          <BookCreatorModal
            editingBook={editingBook}
            bookName={bookName}
            setBookName={setBookName}
            coverType={coverType}
            setCoverType={setCoverType}
            coverValue={coverValue}
            setCoverValue={setCoverValue}
            bookSaving={bookSaving}
            bookError={bookError}
            uploadError={uploadError}
            onCoverUpload={handleCoverUpload}
            onSubmit={handleSaveBook}
            onDelete={handleDeleteBook}
            onClose={() => setBookModalOpen(false)}
          />
        )}
      </div>
    );
  }

  // ---------------- BOOKSHELF VIEW ----------------
  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Diary Bookshelf
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {books.length} book{books.length === 1 ? '' : 's'} · Tap any book
            to write auto-saving notes
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateBookModal}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Book</span>
        </button>
      </div>

      {books.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-10 sm:p-14 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="max-w-sm mx-auto space-y-1.5">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              Create your first diary book
            </h3>
            <p className="text-sm text-slate-500">
              Give your notebook a name and pick a book cover. Every note you
              write inside saves automatically as you type.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateBookModal}
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Create New Book
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {books.map((book) => (
            <div key={book.id} className="group flex flex-col">
              <button
                type="button"
                onClick={() => {
                  setActiveBookId(book.id);
                  setEditorOpen(false);
                }}
                className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xl transition-transform group-hover:-translate-y-1 cursor-pointer"
              >
                <BookCoverArt book={book} />
                <div className="mt-2.5 px-0.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {book.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
                      {book.noteCount} note{book.noteCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {bookModalOpen && (
        <BookCreatorModal
          editingBook={editingBook}
          bookName={bookName}
          setBookName={setBookName}
          coverType={coverType}
          setCoverType={setCoverType}
          coverValue={coverValue}
          setCoverValue={setCoverValue}
          bookSaving={bookSaving}
          bookError={bookError}
          uploadError={uploadError}
          onCoverUpload={handleCoverUpload}
          onSubmit={handleSaveBook}
          onDelete={handleDeleteBook}
          onClose={() => setBookModalOpen(false)}
        />
      )}
    </div>
  );
}

interface BookCreatorModalProps {
  editingBook: DiaryBook | null;
  bookName: string;
  setBookName: (val: string) => void;
  coverType: 'preset' | 'color' | 'custom';
  setCoverType: (t: 'preset' | 'color' | 'custom') => void;
  coverValue: string;
  setCoverValue: (val: string) => void;
  bookSaving: boolean;
  bookError: string | null;
  uploadError: string | null;
  onCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: (bookId: string) => void;
  onClose: () => void;
}

function BookCreatorModal({
  editingBook,
  bookName,
  setBookName,
  coverType,
  setCoverType,
  coverValue,
  setCoverValue,
  bookSaving,
  bookError,
  uploadError,
  onCoverUpload,
  onSubmit,
  onDelete,
  onClose,
}: BookCreatorModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-modal-title"
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden" />

        <form onSubmit={onSubmit} className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2
              id="book-modal-title"
              className="font-display text-xl font-semibold text-slate-900"
            >
              {editingBook ? 'Edit Diary Book' : 'Create New Book'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-5 sm:col-span-4">
              <BookCoverArt
                book={{
                  name: bookName || 'My Diary',
                  coverType,
                  coverValue,
                }}
              />
            </div>
            <div className="col-span-7 sm:col-span-8 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Book Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  placeholder="e.g., Daily Reflections, Travel Journal"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <label className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-2 cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                <span>Upload Custom Cover</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onCoverUpload}
                  className="hidden"
                />
              </label>
              {uploadError && (
                <p className="text-xs text-rose-600">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Preset Artwork Covers */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              Illustrated Covers
            </span>
            <div className="grid grid-cols-4 gap-2.5">
              {DIARY_COVER_PRESETS.map((preset) => {
                const active =
                  coverType === 'preset' &&
                  (coverValue === preset.src ||
                    coverValue === preset.legacySrc ||
                    coverValue === preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCoverType('preset');
                      setCoverValue(preset.src);
                    }}
                    className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      active
                        ? 'border-blue-600 ring-2 ring-blue-600/20'
                        : 'border-transparent hover:border-slate-300'
                    }`}
                    title={preset.label}
                  >
                    <img
                      src={preset.src}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {active && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cloth Color Covers */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              Hardcover Cloth Colors
            </span>
            <div className="flex flex-wrap gap-2.5">
              {DIARY_CLOTH_COLORS.map((cloth) => {
                const active =
                  coverType === 'color' && coverValue === cloth.id;
                return (
                  <button
                    key={cloth.id}
                    type="button"
                    onClick={() => {
                      setCoverType('color');
                      setCoverValue(cloth.id);
                    }}
                    aria-label={cloth.label}
                    title={cloth.label}
                    className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      active
                        ? 'border-slate-900 ring-2 ring-slate-900/20 scale-105'
                        : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: cloth.bg }}
                  >
                    {active && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {bookError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 break-words"
            >
              {bookError}
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            {editingBook && (
              <button
                type="button"
                onClick={() => onDelete(editingBook.id)}
                disabled={bookSaving}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
            <button
              type="submit"
              disabled={bookSaving || !bookName.trim()}
              className="flex-1 min-h-[48px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {bookSaving
                ? 'Saving...'
                : editingBook
                ? 'Save Book'
                : 'Create Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
