'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import type { Lesson, CourseModule, VocabularyItem, PhraseItem, ExerciseItem, Dialogue } from '@/lib/types';
import {
  getLessonProgress,
  markLessonStarted,
} from '@/lib/progress';
import AudioPlayer from './AudioPlayer';

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

function speakDutch(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'nl-NL';
  u.rate = 0.78;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}


function GradientBar({ pct, label, subLabel }: { pct: number; label?: string; subLabel?: string }) {
  return (
    <div className="space-y-2">
      {(label || subLabel) && (
        <div className="flex items-center justify-between gap-3">
          <div>
            {label && <p className="text-[14px] font-bold text-[#1D0084] leading-tight">{label}</p>}
            {subLabel && <p className="text-[11px] text-[#9CA3AF] font-medium leading-tight">{subLabel}</p>}
          </div>
          <span className="text-[12px] font-bold text-[#025dc7] bg-[#EEF4FF] px-2 py-0.5 rounded-full shrink-0">{pct}%</span>
        </div>
      )}
      {!label && !subLabel && (
        <div className="flex justify-end">
          <span className="text-[12px] font-bold text-[#025dc7] bg-[#EEF4FF] px-2 py-0.5 rounded-full">{pct}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #1D0084 0%, #4da3ff 100%)' }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION TYPE
───────────────────────────────────────────────────────────────────────────── */

type SectionId = 'vocabulary' | 'flashcards' | 'lezen' | 'luisteren';

const SECTION_META: Record<SectionId, { label: string; emoji: string; desc: string }> = {
  vocabulary:  { label: 'Vocabulario', emoji: '📖', desc: 'Palabras, frases y ejercicios de práctica' },
  flashcards:  { label: 'Flashcards',  emoji: '🃏', desc: 'Practica con tarjetas' },
  lezen:       { label: 'Lezen',       emoji: '📝', desc: 'Lee un texto y responde preguntas' },
  luisteren:   { label: 'Luisteren',   emoji: '🎧', desc: 'Escucha el diálogo' },
};

/* ─────────────────────────────────────────────────────────────────────────────
   VOCAB PRACTICE — types & helpers
───────────────────────────────────────────────────────────────────────────── */

const VOCAB_PER_PAGE = 8;

type VPStepType = 'words' | 'phrases' | 'listen' | 'truefalse' | 'test' | 'complete' | 'order' | 'classify' | 'write' | 'scramble' | 'pairs';

const VP_META: Record<VPStepType, { label: string; emoji: string }> = {
  words:     { label: 'Diccionario',          emoji: '📖' },
  phrases:   { label: 'Repaso de frases',      emoji: '💬' },
  listen:    { label: 'Escucha y elige',       emoji: '🎧' },
  truefalse: { label: 'Verdadero o falso',     emoji: '✅' },
  test:      { label: 'Selecciona la correcta',emoji: '🧪' },
  complete:  { label: 'Completa la frase',     emoji: '✏️' },
  order:     { label: 'Ordena las palabras',   emoji: '🔤' },
  classify:  { label: 'Clasifica',             emoji: '🗂️' },
  write:     { label: 'Escribe en neerlandés', emoji: '✍️' },
  scramble:  { label: 'Deletrea la palabra',   emoji: '🔡' },
  pairs:     { label: 'Empareja',              emoji: '🔗' },
};

interface ClassifyGroup { id: string; label: string }
interface ClassifyItemData { dutch: string; groupId: string }

type VPStep =
  | { type: 'words' }
  | { type: 'phrases';   items: PhraseItem[] }
  | { type: 'listen';    exercises: ExerciseItem[] }
  | { type: 'truefalse'; exercises: ExerciseItem[] }
  | { type: 'test';      exercises: ExerciseItem[] }
  | { type: 'complete';  exercises: ExerciseItem[] }
  | { type: 'order';     exercises: ExerciseItem[] }
  | { type: 'classify';  groups: ClassifyGroup[]; items: ClassifyItemData[] }
  | { type: 'write';     exercises: ExerciseItem[] }
  | { type: 'scramble';  exercises: ExerciseItem[] }
  | { type: 'pairs';     exercises: ExerciseItem[] };

function isTrueFalse(e: ExerciseItem): boolean {
  if (e.type !== 'multiple_choice') return false;
  const opts = (e.options ?? []).map(o => o.toLowerCase().trim());
  return opts.length === 2 && (opts.includes('verdadero') || opts.includes('true')) && (opts.includes('falso') || opts.includes('false'));
}

function buildClassifyData(items: VocabularyItem[]): { groups: ClassifyGroup[]; items: ClassifyItemData[] } | null {
  // Ignore blank/empty categories (happen when Supabase item has no local match)
  const validCategories = [...new Set(items.map(i => i.category).filter(c => c && c.trim() !== ''))];
  if (validCategories.length >= 2) {
    const eligible = items.filter(i => i.category && i.category.trim() !== '');
    return {
      groups: validCategories.map(c => ({ id: c, label: c })),
      items: eligible.map(i => ({ dutch: i.dutch, groupId: i.category })),
    };
  }
  // Article-based fallback (article comes directly from Supabase, always reliable)
  const hasDE   = items.some(i => i.article === 'de');
  const hasHET  = items.some(i => i.article === 'het');
  const hasNone = items.some(i => i.article === null);
  const groups: ClassifyGroup[] = [];
  if (hasDE)   groups.push({ id: 'de',   label: 'de ...' });
  if (hasHET)  groups.push({ id: 'het',  label: 'het ...' });
  if (hasNone) groups.push({ id: 'geen', label: 'Werkwoord' });
  if (groups.length >= 2) {
    return {
      groups,
      items: items.map(i => ({ dutch: i.dutch, groupId: i.article ?? 'geen' })),
    };
  }
  return null;
}

function buildVPSteps(
  vocabItems: VocabularyItem[],
  phraseItems: PhraseItem[],
  exercises: ExerciseItem[],
): VPStep[] {
  const steps: VPStep[] = [{ type: 'words' }];

  if (phraseItems.length > 0)
    steps.push({ type: 'phrases', items: phraseItems });

  const listenEx = exercises.filter(e => e.type === 'listen_and_choose');
  if (listenEx.length > 0)
    steps.push({ type: 'listen', exercises: listenEx });

  const tfEx = exercises.filter(isTrueFalse);
  if (tfEx.length > 0)
    steps.push({ type: 'truefalse', exercises: tfEx });

  const testEx = exercises.filter(e => e.type === 'multiple_choice' && !isTrueFalse(e));
  if (testEx.length > 0)
    steps.push({ type: 'test', exercises: testEx });

  const fillEx = exercises.filter(e => e.type === 'fill_blank');
  if (fillEx.length > 0)
    steps.push({ type: 'complete', exercises: fillEx });

  const orderEx = exercises.filter(e => e.type === 'order_sentence');
  if (orderEx.length > 0)
    steps.push({ type: 'order', exercises: orderEx });

  const classifyData = buildClassifyData(vocabItems);
  if (classifyData)
    steps.push({ type: 'classify', ...classifyData });

  const writeEx = exercises.filter(e => e.type === 'write_answer');
  if (writeEx.length > 0)
    steps.push({ type: 'write', exercises: writeEx });

  const scrambleEx = exercises.filter(e => e.type === 'word_scramble');
  if (scrambleEx.length > 0)
    steps.push({ type: 'scramble', exercises: scrambleEx });

  const pairsEx = exercises.filter(e => e.type === 'match_pairs');
  if (pairsEx.length > 0)
    steps.push({ type: 'pairs', exercises: pairsEx });

  return steps;
}

/* ── Step bar ── */

function StepBar({ steps, current, subProgress }: {
  steps: VPStep[];
  current: number;
  subProgress?: { done: number; total: number };
}) {
  const meta = VP_META[steps[current].type];
  const pct = steps.length === 0 ? 0 : Math.round(((current + (subProgress ? subProgress.done / subProgress.total : 0)) / steps.length) * 100);
  const isContentStep = steps[current].type === 'words' || steps[current].type === 'phrases';
  const exerciseNum = isContentStep ? null : steps.slice(0, current + 1).filter(s => s.type !== 'words' && s.type !== 'phrases').length;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[18px] font-bold text-[#1D0084] leading-tight">
            {isContentStep ? `${meta.emoji} ${meta.label}` : `Ejercicio ${exerciseNum}`}
          </p>
          {!isContentStep && (
            <p className="text-[12px] text-[#9CA3AF] font-medium leading-tight mt-0.5">
              {meta.emoji} {meta.label}
            </p>
          )}
        </div>
        <span className="text-[14px] font-bold text-[#025dc7] bg-[#EEF4FF] px-3 py-1 rounded-full shrink-0">
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #1D0084 0%, #4da3ff 100%)' }}
        />
      </div>
    </div>
  );
}

/* ── Word card (simple play button) ── */

function WordCard({ word }: { word: VocabularyItem }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function handlePlay() {
    if (isPlaying) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      window.speechSynthesis?.cancel();
      setIsPlaying(false);
      return;
    }
    const text = (word.article ? `${word.article} ` : '') + word.dutch;
    setIsPlaying(true);
    if (word.audio?.url) {
      const audio = new Audio(word.audio.url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => { speakDutch(text); };
      audio.play().catch(() => { speakDutch(text); setIsPlaying(false); });
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'nl-NL'; u.rate = 0.78; u.pitch = 1;
        u.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(u);
      }
    }
  }

  return (
    <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden flex flex-col">
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #1D0084 0%, #025dc7 100%)' }} />
      <div className="flex-1 px-3 py-2.5 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {word.article && (
            <span className="text-[10px] font-bold text-[#025dc7] bg-[#F0F5FF] px-1.5 py-0.5 rounded-md shrink-0">
              {word.article}
            </span>
          )}
          <span className="text-[14px] font-bold text-[#1D0084] leading-tight" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            {word.dutch}
          </span>
        </div>
        <p className="text-[12px] text-[#5A6480] font-medium leading-snug">{word.spanish}</p>
      </div>
      <div className="px-3 pb-2.5">
        <button
          onClick={handlePlay}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-200 border ${
            isPlaying
              ? 'bg-[#1D0084] border-[#1D0084] text-white'
              : 'bg-[#F0F5FF] border-[#DDE6F5] text-[#025dc7] hover:bg-[#e0eaff]'
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              Parar
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Escuchar
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Words step (paginated grid) ── */

function WordsStep({ items, onDone, onSubProgress }: {
  items: VocabularyItem[];
  onDone: () => void;
  onSubProgress?: (done: number, total: number) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / VOCAB_PER_PAGE);
  const pageItems = items.slice(page * VOCAB_PER_PAGE, (page + 1) * VOCAB_PER_PAGE);
  const isLastPage = page + 1 >= totalPages;

  useEffect(() => {
    onSubProgress?.(page + 1, totalPages);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pageItems.map(word => <WordCard key={word.id} word={word} />)}
      </div>
      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          onClick={() => setPage(p => p - 1)}
          disabled={page === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Anterior
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={`rounded-full transition-all duration-200 ${i === page ? 'w-5 h-2 bg-[#1D0084]' : 'w-2 h-2 bg-[#DDE6F5]'}`}
              aria-label={`Página ${i + 1}`}
            />
          ))}
        </div>
        {isLastPage ? (
          <button onClick={onDone} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
            Siguiente paso
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button onClick={() => setPage(p => p + 1)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
            Siguiente
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Phrases step ── */

function PhrasesStep({ items, onDone, onBack, onSubProgress }: {
  items: PhraseItem[];
  onDone: () => void;
  onBack: () => void;
  onSubProgress?: (done: number, total: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const phrase = items[index];
  const isLast = index + 1 >= items.length;

  function stopAudio() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
  }

  function handlePlay() {
    if (isPlaying) { stopAudio(); return; }
    setIsPlaying(true);
    if (phrase.audio?.url) {
      const audio = new Audio(phrase.audio.url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => { speakDutch(phrase.dutch); };
      audio.play().catch(() => { speakDutch(phrase.dutch); setIsPlaying(false); });
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(phrase.dutch);
        u.lang = 'nl-NL'; u.rate = 0.78; u.pitch = 1;
        u.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(u);
      }
    }
  }

  function navigate(newIndex: number) {
    stopAudio();
    setIndex(newIndex);
    onSubProgress?.(newIndex + 1, items.length);
  }

  useEffect(() => {
    onSubProgress?.(1, items.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-2xl border border-[#DDE6F5] p-6 space-y-4">
        {phrase.context && (
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">{phrase.context}</p>
        )}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[22px] font-bold text-[#1D0084] leading-tight flex-1" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            {phrase.dutch}
          </h2>
          <button
            onClick={handlePlay}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 border ${
              isPlaying
                ? 'bg-[#1D0084] border-[#1D0084] text-white'
                : 'bg-[#F0F5FF] border-[#DDE6F5] text-[#025dc7] hover:bg-[#e0eaff]'
            }`}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
        </div>
        <div className="rounded-xl bg-[#F0F5FF] px-4 py-3 border border-[#DDE6F5]">
          <p className="text-[11px] font-semibold text-[#9CA3AF] mb-1 uppercase tracking-widest">Traducción</p>
          <p className="text-[15px] text-[#1D0084] font-medium leading-snug">{phrase.spanish}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => { stopAudio(); if (index === 0) onBack(); else navigate(index - 1); }}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Anterior
        </button>
        <button
          onClick={() => { stopAudio(); if (isLast) onDone(); else navigate(index + 1); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
        >
          {isLast ? 'Siguiente paso' : 'Siguiente'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Exercise runner (listen / complete / write steps) ── */

function ExerciseRunner({ exercises, onDone, onBack: _onBack, onSubProgress, cacheKey }: {
  exercises: ExerciseItem[];
  onDone: () => void;
  onBack: () => void;
  onSubProgress?: (done: number, total: number) => void;
  cacheKey?: string;
}) {
  const storageKey = cacheKey ? `vp-ex-${cacheKey}` : null;

  const [index, setIndex] = useState(() => {
    if (!storageKey) return 0;
    try {
      const n = parseInt(sessionStorage.getItem(storageKey) ?? '0', 10);
      return Number.isFinite(n) && n < exercises.length ? n : 0;
    } catch { return 0; }
  });
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [exKey, setExKey] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (storageKey) try { sessionStorage.setItem(storageKey, String(index)); } catch {}
    onSubProgress?.(index, exercises.length);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(correct: boolean, answer: string) {
    setAnswered(true);
    setAnswers(prev => ({ ...prev, [index]: answer }));
    if (correct) { scoreRef.current += 1; setScore(scoreRef.current); }
    onSubProgress?.(index + 1, exercises.length);
  }

  function handleNext() {
    if (index + 1 >= exercises.length) {
      setFinished(true);
    } else {
      setIndex(i => i + 1);
      setAnswered(false);
      setExKey(k => k + 1);
    }
  }

  function handleFinish() {
    if (storageKey) try { sessionStorage.removeItem(storageKey); } catch {}
    onDone();
  }

  function handlePrev() {
    if (index > 0) {
      const prevIdx = index - 1;
      setIndex(prevIdx);
      setAnswered(prevIdx in answers);
      setExKey(k => k + 1);
    }
    // At question 1: do nothing — don't exit the step
  }

  const isLast = index + 1 >= exercises.length;
  const canGoBack = index > 0;

  if (finished) {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="text-5xl">{score >= exercises.length * 0.8 ? '🎉' : '📝'}</div>
        <div>
          <p className="text-[22px] font-bold text-[#1D0084]">{score} / {exercises.length} correctas</p>
          <p className="text-[14px] text-[#9CA3AF] mt-1">
            {score === exercises.length ? '¡Perfecto!' : score >= exercises.length * 0.8 ? '¡Muy bien!' : 'Sigue practicando'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setFinished(false);
              setIndex(exercises.length - 1);
              setAnswered(true);
              setExKey(k => k + 1);
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-[#1D0084] text-[14px] font-semibold border-2 border-[#1D0084]/20 hover:border-[#1D0084]/50 transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Revisar respuestas
          </button>
          <button
            onClick={handleFinish}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            Continuar
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Counter + score */}
      <div className="flex justify-between items-center">
        <span className="text-[12px] text-[#9CA3AF] font-medium tabular-nums">
          {index + 1} / {exercises.length}
        </span>
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {score}
        </div>
      </div>

      {/* Absolute side-nav on desktop — fixed position, never shifts layout */}
      <div className="relative md:px-[84px]">

        {/* ← Left (desktop) — ghost when disabled */}
        <button
          onClick={canGoBack ? handlePrev : undefined}
          aria-label="Pregunta anterior"
          className={`hidden md:flex absolute left-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-200 ${
            canGoBack
              ? 'text-[#9CA3AF] hover:bg-[#F0F5FF] hover:text-[#1D0084] cursor-pointer'
              : 'text-[#E8ECF4] pointer-events-none'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Exercise content */}
        <div key={exKey}>
          <ExerciseStep exercise={exercises[index]} onAnswer={handleAnswer} initialAnswer={answers[index]} />
        </div>

        {/* → Right (desktop) — invisible until answered, then glows */}
        <button
          onClick={answered ? handleNext : undefined}
          aria-label={isLast ? 'Siguiente paso' : 'Siguiente pregunta'}
          className={`hidden md:flex absolute right-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-300 ${
            answered
              ? 'bg-[#1D0084] text-white cursor-pointer hover:bg-[#025dc7]'
              : 'text-[#E8ECF4] pointer-events-none'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mobile: button at bottom, back only when possible */}
      {answered && (
        <div className="space-y-2 md:hidden">
          {canGoBack && (
            <button
              onClick={handlePrev}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-[#9CA3AF] text-[13px] font-semibold border border-[#DDE6F5] hover:text-[#1D0084] hover:border-[#1D0084]/30 transition-colors duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Pregunta anterior
            </button>
          )}
          <button onClick={handleNext} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
            {isLast ? 'Siguiente paso' : 'Siguiente pregunta'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Classify step ── */

function ClassifyStep({ groups, items, onDone, onBack }: { groups: ClassifyGroup[]; items: ClassifyItemData[]; onDone: () => void; onBack: () => void }) {
  const queue = useMemo(() => [...items].sort(() => Math.random() - 0.5).slice(0, Math.min(10, items.length)), [items]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; correctId: string } | null>(null);
  const [score, setScore] = useState(0);
  const current = queue[index];

  function handleGuess(groupId: string) {
    if (result) return;
    const correct = groupId === current.groupId;
    setResult({ correct, correctId: current.groupId });
    if (correct) setScore(s => s + 1);
  }

  function handleNext() {
    if (index + 1 >= queue.length) { onDone(); return; }
    setIndex(i => i + 1);
    setResult(null);
  }

  return (
    <div className="space-y-5">
      {/* Score badge */}
      <div className="flex justify-end">
        <div className="flex items-center gap-1 text-[13px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {score}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#DDE6F5] bg-white py-10 px-6 gap-3 text-center">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">¿A qué grupo pertenece? · {index + 1}/{queue.length}</p>
        <p className="text-[30px] font-bold text-[#1D0084]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
          {current.dutch}
        </p>
        <button onClick={() => speakDutch(current.dutch)} className="flex items-center gap-1.5 text-[12px] font-medium text-[#025dc7] hover:text-[#1D0084] transition-colors duration-200">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          Escuchar
        </button>
      </div>

      <div className={`grid gap-3 ${groups.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => handleGuess(group.id)}
            disabled={!!result}
            className={`py-5 rounded-xl text-[15px] font-bold border transition-all duration-200 ${
              result
                ? result.correctId === group.id
                  ? 'bg-green-50 border-green-400 text-green-800'
                  : 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]'
                : 'bg-[#F0F5FF] border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7]/40 hover:bg-[#e8f0ff]'
            }`}
          >
            {group.label}
          </button>
        ))}
      </div>

      {result && (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${result.correct ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {result.correct ? '✓ ¡Correcto!' : `✗ Era: "${groups.find(g => g.id === result!.correctId)?.label}"`}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <button
            onClick={() => { if (index > 0) { setIndex(i => i - 1); setResult(null); } else { onBack(); } }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-[#9CA3AF] text-[13px] font-semibold border border-[#DDE6F5] hover:text-[#1D0084] hover:border-[#1D0084]/30 transition-colors duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {index > 0 ? 'Ejercicio anterior' : 'Paso anterior'}
          </button>
          <button onClick={handleNext} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
            {index + 1 < queue.length ? 'Siguiente' : 'Siguiente paso'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main vocab practice section ── */

function VocabPracticeSection({
  vocabItems,
  phraseItems,
  practiceExercises,
  onComplete,
}: {
  vocabItems: VocabularyItem[];
  phraseItems: PhraseItem[];
  practiceExercises: ExerciseItem[];
  onComplete: () => void;
}) {
  const steps = useMemo(
    () => buildVPSteps(vocabItems, phraseItems, practiceExercises),
    [vocabItems, phraseItems, practiceExercises]
  );
  const stepCacheKey = typeof window !== 'undefined' ? `vp-step-${window.location.pathname}` : null;
  const [stepIndex, setStepIndex] = useState(() => {
    if (!stepCacheKey) return 0;
    try {
      const n = parseInt(sessionStorage.getItem(stepCacheKey) ?? '0', 10);
      return Number.isFinite(n) && n < steps.length ? n : 0;
    } catch { return 0; }
  });
  const [allDone, setAllDone] = useState(false);
  const [runnerKey, setRunnerKey] = useState(0);
  const [subProgress, setSubProgress] = useState<{ done: number; total: number } | undefined>();

  function handleStepBack() {
    if (stepIndex > 0) {
      const next = stepIndex - 1;
      setStepIndex(next);
      if (stepCacheKey) try { sessionStorage.setItem(stepCacheKey, String(next)); } catch {}
      setSubProgress(undefined);
      setRunnerKey(k => k + 1);
    }
  }

  function handleStepDone() {
    if (stepIndex + 1 >= steps.length) {
      if (stepCacheKey) try { sessionStorage.removeItem(stepCacheKey); } catch {}
      setAllDone(true);
    } else {
      const next = stepIndex + 1;
      setStepIndex(next);
      if (stepCacheKey) try { sessionStorage.setItem(stepCacheKey, String(next)); } catch {}
      setRunnerKey(k => k + 1);
    }
  }

  if (allDone) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center rounded-2xl py-12 px-6 gap-3" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-5xl">⭐</span>
          <p className="text-white font-bold text-[22px]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>¡Práctica completada!</p>
          <p className="text-white/60 text-[14px]">Has repasado todo el vocabulario</p>
        </div>
        <button
          onClick={() => { setAllDone(false); setStepIndex(0); setSubProgress(undefined); setRunnerKey(k => k + 1); onComplete(); }}
          className="w-full py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
        >
          🔄 Repetir práctica
        </button>
      </div>
    );
  }

  const step = steps[stepIndex];

  return (
    <div>
      <StepBar steps={steps} current={stepIndex} subProgress={subProgress} />

      {step.type === 'words' && (
        <WordsStep key={runnerKey} items={vocabItems} onDone={handleStepDone}
          onSubProgress={(done, total) => setSubProgress({ done, total })} />
      )}
      {step.type === 'phrases' && (
        <PhrasesStep key={runnerKey} items={step.items} onDone={handleStepDone} onBack={handleStepBack}
          onSubProgress={(done, total) => setSubProgress({ done, total })} />
      )}
      {(step.type === 'listen' || step.type === 'truefalse' || step.type === 'test' || step.type === 'complete' || step.type === 'order' || step.type === 'write' || step.type === 'scramble' || step.type === 'pairs') && (
        <ExerciseRunner
          key={runnerKey}
          exercises={step.exercises}
          onDone={handleStepDone}
          onBack={handleStepBack}
          onSubProgress={(done, total) => setSubProgress({ done, total })}
          cacheKey={step.type}
        />
      )}
      {step.type === 'classify' && (
        <ClassifyStep key={runnerKey} groups={step.groups} items={step.items} onDone={handleStepDone} onBack={handleStepBack} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FLASHCARD SECTION
───────────────────────────────────────────────────────────────────────────── */

function FlashcardSection({
  items,
  onComplete,
}: {
  items: VocabularyItem[];
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<'nl-es' | 'es-nl'>('nl-es');
  const [queue, setQueue] = useState<VocabularyItem[]>(() =>
    [...items].sort(() => Math.random() - 0.5)
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [done, setDone] = useState(false);

  const card = queue[index];
  const front = mode === 'nl-es'
    ? (card?.article ? `${card.article} ${card.dutch}` : card?.dutch) ?? ''
    : card?.spanish ?? '';
  const back = mode === 'nl-es' ? card?.spanish ?? '' : (card?.article ? `${card.article} ${card.dutch}` : card?.dutch) ?? '';

  function handleKnown() {
    setKnownCount(k => k + 1);
    advance();
  }

  function handleRepeat() {
    setQueue(q => {
      const next = [...q];
      const [current] = next.splice(index, 1);
      next.push(current);
      return next;
    });
    setFlipped(false);
  }

  function advance() {
    setFlipped(false);
    if (index + 1 >= queue.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }

  function handleShuffle() {
    setQueue(q => [...q].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
    setDone(false);
  }

  function handleRestart() {
    setQueue([...items].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
    setKnownCount(0);
    setDone(false);
  }

  if (done) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-[#1D0084] py-10 px-6 text-center space-y-3">
          <span className="text-5xl">🎉</span>
          <p className="text-white font-bold text-[20px]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            ¡Ronda completada!
          </p>
          <p className="text-white/60 text-[14px]">{knownCount} de {items.length} palabras dominadas</p>
        </div>
        <button onClick={handleRestart} className="w-full py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200">
          Repetir flashcards 🔄
        </button>
        <button onClick={onComplete} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Volver a la lección
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <GradientBar pct={Math.round((index / queue.length) * 100)} />

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-[#DDE6F5] overflow-hidden">
          <button
            onClick={() => { setMode('nl-es'); setFlipped(false); }}
            className={`px-3 py-2 text-[12px] font-semibold transition-colors duration-200 ${mode === 'nl-es' ? 'bg-[#1D0084] text-white' : 'bg-white text-[#9CA3AF] hover:text-[#1D0084]'}`}
          >
            NL → ES
          </button>
          <button
            onClick={() => { setMode('es-nl'); setFlipped(false); }}
            className={`px-3 py-2 text-[12px] font-semibold transition-colors duration-200 ${mode === 'es-nl' ? 'bg-[#1D0084] text-white' : 'bg-white text-[#9CA3AF] hover:text-[#1D0084]'}`}
          >
            ES → NL
          </button>
        </div>
        <button onClick={handleShuffle} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDE6F5] text-[12px] font-semibold text-[#5A6480] hover:text-[#1D0084] hover:bg-[#F0F5FF] transition-colors duration-200">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Barajar
        </button>
        <span className="text-[12px] font-semibold text-white bg-[#1D0084] px-2.5 py-1 rounded-full">{knownCount} ✓</span>
      </div>

      {/* Card */}
      <div
        onClick={() => setFlipped(f => !f)}
        className="w-full h-[220px] cursor-pointer"
        style={{ perspective: '1000px' }}
      >
        <div
          style={{
            transition: 'transform 0.45s cubic-bezier(0.4,0.2,0.2,1)',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            position: 'relative',
            height: '220px',
          }}
        >
          {/* Front */}
          <div
            className="rounded-2xl border border-[#DDE6F5] bg-white flex flex-col items-center justify-center gap-4 p-8 absolute inset-0"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">
              {mode === 'nl-es' ? 'Nederlands' : 'Español'}
            </p>
            <p
              className="text-[26px] font-bold text-[#1D0084] text-center leading-tight"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
            >
              {front}
            </p>
            <p className="text-[12px] text-[#9CA3AF]">Toca para ver la traducción</p>
          </div>
          {/* Back */}
          <div
            className="rounded-2xl border border-[#025dc7]/30 bg-[#F8FAFF] flex flex-col items-center justify-center gap-4 p-8 absolute inset-0"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">
              {mode === 'nl-es' ? 'Español' : 'Nederlands'}
            </p>
            <p
              className="text-[26px] font-bold text-[#1D0084] text-center leading-tight"
              style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
            >
              {back}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {flipped ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRepeat}
            className="py-3.5 rounded-xl bg-[#FFF5F5] border border-red-100 text-red-600 text-[15px] font-semibold hover:bg-red-50 transition-colors duration-200"
          >
            🔄 Repasar
          </button>
          <button
            onClick={handleKnown}
            className="py-3.5 rounded-xl bg-[#F0FFF4] border border-green-200 text-green-700 text-[15px] font-semibold hover:bg-green-50 transition-colors duration-200"
          >
            ✓ Ya la sé
          </button>
        </div>
      ) : (
        <p className="text-center text-[13px] text-[#9CA3AF]">
          Primero mira la tarjeta, luego decide
        </p>
      )}

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXERCISE COMPONENTS (shared between Practice and Lezen)
───────────────────────────────────────────────────────────────────────────── */

function MultipleChoiceExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialAnswer ?? null);
  const isAnswered = selected !== null;

  // Shuffle options once per exercise (stable across re-renders)
  const shuffledOptions = useMemo(() => {
    if (!exercise.options?.length) return exercise.options ?? [];
    const arr = [...exercise.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function optionStyle(opt: string): string {
    const base =
      'w-full text-left px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-200 border ';
    if (!isAnswered)
      return base + 'bg-[#F0F5FF] border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.98]';
    if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400 text-green-800';
    if (opt === selected) return base + 'bg-red-50 border-red-400 text-red-700';
    return base + 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]';
  }

  const letters = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Pregunta</p>
        <p className="text-[17px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {shuffledOptions.map((opt, idx) => (
          <button key={opt} className={optionStyle(opt)} onClick={() => handleSelect(opt)}>
            <span className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 transition-all duration-200 ${
                !isAnswered ? 'bg-white/70 text-[#1D0084]' :
                opt === exercise.correctAnswer ? 'bg-green-500 text-white' :
                opt === selected ? 'bg-red-400 text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
              }`}>
                {letters[idx] ?? idx + 1}
              </span>
              <span className="flex-1 text-left">{opt}</span>
              {isAnswered && opt === exercise.correctAnswer && (
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isAnswered && opt === selected && opt !== exercise.correctAnswer && (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            selected === exercise.correctAnswer
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {selected === exercise.correctAnswer
            ? '✓ ¡Correcto!'
            : `✗ La respuesta era: "${exercise.correctAnswer}"`}
          {exercise.explanation && (
            <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function WriteAnswerExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [value, setValue] = useState(initialAnswer ?? '');
  const [submitted, setSubmitted] = useState(initialAnswer !== undefined);
  const isCorrect = value.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  function handleSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, value.trim());
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
        {exercise.hint && (
          <p className="text-[13px] text-[#9CA3AF] mt-2">💡 {exercise.hint}</p>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        disabled={submitted}
        placeholder="Escribe tu respuesta..."
        className="w-full px-4 py-3.5 rounded-xl border border-[#DDE6F5] text-[15px] text-[#1D0084] bg-white focus:outline-none focus:border-[#025dc7] transition-colors duration-200 disabled:opacity-60"
      />
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          Comprobar
        </button>
      )}
      {submitted && (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            isCorrect
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {isCorrect
            ? '✓ ¡Correcto!'
            : `✗ La respuesta correcta era: "${exercise.correctAnswer}"`}
        </div>
      )}
    </div>
  );
}

function FillBlankExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [value, setValue] = useState(initialAnswer ?? '');
  const [submitted, setSubmitted] = useState(initialAnswer !== undefined);
  const isCorrect = value.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();
  const parts = exercise.prompt.split('___');

  function handleSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, value.trim());
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug flex flex-wrap items-center gap-1">
          {parts[0]}
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            disabled={submitted}
            placeholder="___"
            className={`inline-block w-28 px-2 py-0.5 rounded-lg border text-[15px] font-semibold text-center focus:outline-none transition-colors duration-200 disabled:opacity-70 ${
              submitted
                ? isCorrect
                  ? 'bg-green-50 border-green-400 text-green-800'
                  : 'bg-red-50 border-red-400 text-red-700'
                : 'bg-white border-[#025dc7] text-[#1D0084] focus:border-[#1D0084]'
            }`}
          />
          {parts[1] ?? ''}
        </p>
        {exercise.hint && (
          <p className="text-[13px] text-[#9CA3AF] mt-2">💡 {exercise.hint}</p>
        )}
      </div>
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          Comprobar
        </button>
      )}
      {submitted && (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            isCorrect
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {isCorrect
            ? '✓ ¡Correcto!'
            : `✗ La respuesta era: "${exercise.correctAnswer}"`}
          {exercise.explanation && (
            <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ListenAndChooseExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialAnswer ?? null);
  const isAnswered = selected !== null;
  const match = exercise.prompt.match(/"([^"]+)"/);
  const dutchText = match ? match[1] : exercise.prompt;

  // Shuffle options once per exercise
  const shuffledOptions = useMemo(() => {
    if (!exercise.options?.length) return exercise.options ?? [];
    const arr = [...exercise.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function optionStyle(opt: string): string {
    const base =
      'w-full text-left px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-200 border ';
    if (!isAnswered)
      return base + 'bg-[#F0F5FF] border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.98]';
    if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400 text-green-800';
    if (opt === selected) return base + 'bg-red-50 border-red-400 text-red-700';
    return base + 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]';
  }

  const letters = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white space-y-4">
        <div>
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Escucha y elige</p>
          <p className="text-[17px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
        </div>
        {exercise.audio?.url ? (
          <AudioPlayer src={exercise.audio.url} compact />
        ) : (
          <button
            onClick={() => speakDutch(dutchText)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D0084] text-white text-[13px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Escuchar
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {shuffledOptions.map((opt, idx) => (
          <button key={opt} className={optionStyle(opt)} onClick={() => handleSelect(opt)}>
            <span className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 transition-all duration-200 ${
                !isAnswered ? 'bg-white/70 text-[#1D0084]' :
                opt === exercise.correctAnswer ? 'bg-green-500 text-white' :
                opt === selected ? 'bg-red-400 text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
              }`}>
                {letters[idx] ?? idx + 1}
              </span>
              <span className="flex-1 text-left">{opt}</span>
              {isAnswered && opt === exercise.correctAnswer && (
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isAnswered && opt === selected && opt !== exercise.correctAnswer && (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            selected === exercise.correctAnswer
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {selected === exercise.correctAnswer
            ? '✓ ¡Correcto!'
            : `✗ La respuesta era: "${exercise.correctAnswer}"`}
          {exercise.explanation && (
            <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function OrderSentenceExercise({
  exercise,
  onAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
}) {
  const [available, setAvailable] = useState<string[]>(() =>
    [...(exercise.options ?? [])].sort(() => Math.random() - 0.5)
  );
  const [sentence, setSentence] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = sentence.join(' ') === exercise.correctAnswer;

  function addWord(word: string, idx: number) {
    if (submitted) return;
    setSentence(s => [...s, word]);
    setAvailable(a => a.filter((_, i) => i !== idx));
  }

  function removeWord(word: string, idx: number) {
    if (submitted) return;
    setAvailable(a => [...a, word]);
    setSentence(s => s.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!sentence.length || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, sentence.join(' '));
  }

  function handleReset() {
    setAvailable([...(exercise.options ?? [])].sort(() => Math.random() - 0.5));
    setSentence([]);
    setSubmitted(false);
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
      </div>

      <div className="min-h-[52px] rounded-xl border-2 border-dashed border-[#DDE6F5] bg-white p-3 flex flex-wrap gap-2 items-center">
        {sentence.length === 0 && (
          <span className="text-[14px] text-[#9CA3AF]">Toca las palabras para ordenarlas...</span>
        )}
        {sentence.map((word, i) => (
          <button
            key={`${word}-${i}`}
            onClick={() => removeWord(word, i)}
            disabled={submitted}
            className="px-3 py-1.5 rounded-lg bg-[#1D0084] text-white text-[14px] font-medium hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-70"
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {available.map((word, i) => (
          <button
            key={`${word}-${i}`}
            onClick={() => addWord(word, i)}
            disabled={submitted}
            className="px-3 py-1.5 rounded-lg bg-[#F0F5FF] border border-[#DDE6F5] text-[#1D0084] text-[14px] font-medium hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] transition-colors duration-200 disabled:opacity-50"
          >
            {word}
          </button>
        ))}
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-xl bg-[#F0F5FF] text-[#5A6480] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
          >
            Reiniciar
          </button>
          <button
            onClick={handleSubmit}
            disabled={sentence.length === 0}
            className="flex-1 py-3 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
          >
            Comprobar
          </button>
        </div>
      ) : (
        <div
          className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
            isCorrect
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {isCorrect
            ? '✓ ¡Correcto!'
            : `✗ La frase correcta era: "${exercise.correctAnswer}"`}
        </div>
      )}
    </div>
  );
}

function WordScrambleExercise({ exercise, onAnswer }: { exercise: ExerciseItem; onAnswer: (correct: boolean, answer: string) => void }) {
  const word = exercise.correctAnswer;
  const [letters, setLetters] = useState<string[]>(() =>
    word.split('').map((ch, i) => `${ch}__${i}`).sort(() => Math.random() - 0.5)
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const formed = selected.map(k => k.split('__')[0]).join('');
  const isCorrect = formed.toLowerCase() === word.toLowerCase();

  function pick(key: string) {
    if (submitted) return;
    setLetters(l => l.filter(k => k !== key));
    setSelected(s => [...s, key]);
  }
  function unpick(key: string) {
    if (submitted) return;
    setSelected(s => s.filter(k => k !== key));
    setLetters(l => [...l, key]);
  }
  function handleSubmit() {
    if (!selected.length || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, formed);
  }
  function handleReset() {
    setLetters(word.split('').map((ch, i) => `${ch}__${i}`).sort(() => Math.random() - 0.5));
    setSelected([]);
    setSubmitted(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-1">Deletrear en neerlandés</p>
        <p className="text-[17px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
        {exercise.hint && <p className="text-[14px] text-[#025dc7] font-medium mt-1">💡 {exercise.hint}</p>}
      </div>

      {/* Answer area */}
      <div className={`min-h-[52px] rounded-xl border-2 border-dashed p-3 flex flex-wrap gap-2 items-center transition-colors duration-300 ${
        submitted ? (isCorrect ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50') : 'border-[#DDE6F5] bg-white'
      }`}>
        {selected.length === 0 && !submitted && (
          <span className="text-[14px] text-[#9CA3AF]">Toca las letras para formar la palabra...</span>
        )}
        {selected.map(key => (
          <button
            key={key}
            onClick={() => unpick(key)}
            disabled={submitted}
            className={`w-9 h-9 rounded-lg text-[16px] font-bold border transition-all duration-200 uppercase ${
              submitted ? (isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-red-400 border-red-400 text-white') : 'bg-[#1D0084] border-[#1D0084] text-white hover:bg-[#025dc7]'
            }`}
          >
            {key.split('__')[0]}
          </button>
        ))}
      </div>

      {/* Available letters */}
      <div className="flex flex-wrap gap-2">
        {letters.map(key => (
          <button
            key={key}
            onClick={() => pick(key)}
            disabled={submitted}
            className="w-9 h-9 rounded-lg text-[16px] font-bold bg-[#F0F5FF] border border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7] hover:bg-[#e0eaff] transition-all duration-200 uppercase disabled:opacity-40"
          >
            {key.split('__')[0]}
          </button>
        ))}
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <button onClick={handleReset} className="px-4 py-3 rounded-xl bg-[#F0F5FF] text-[#5A6480] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff]">
            Reiniciar
          </button>
          <button onClick={handleSubmit} disabled={selected.length === 0}
            className="flex-1 py-3 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors disabled:opacity-40 disabled:pointer-events-none">
            Comprobar
          </button>
        </div>
      ) : (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${isCorrect ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {isCorrect ? '✓ ¡Correcto!' : `✗ La respuesta era: "${word}"`}
        </div>
      )}
    </div>
  );
}

function MatchPairsExercise({ exercise, onAnswer }: { exercise: ExerciseItem; onAnswer: (correct: boolean, answer: string) => void }) {
  const pairs = exercise.pairs ?? [];
  const [leftSel, setLeftSel] = useState<string | null>(null);
  const [rightSel, setRightSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState(0);

  const rightItems = useMemo(() => [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rightSel && leftSel) {
      const correct = pairs.find(p => p.left === leftSel)?.right === rightSel;
      if (correct) {
        const next = { ...matched, [leftSel]: rightSel };
        setMatched(next);
        if (Object.keys(next).length === pairs.length) {
          setDone(true);
          onAnswer(errors === 0, '');
        }
      } else {
        setErrors(e => e + 1);
        setWrongPair([leftSel, rightSel]);
        setTimeout(() => { setWrongPair(null); }, 700);
      }
      setLeftSel(null);
      setRightSel(null);
    }
  }, [leftSel, rightSel]); // eslint-disable-line react-hooks/exhaustive-deps

  function leftStyle(left: string) {
    const isMatched = matched[left] !== undefined;
    const isSelected = leftSel === left;
    const isWrong = wrongPair?.[0] === left;
    if (isMatched) return 'bg-green-50 border-green-400 text-green-800 cursor-default';
    if (isWrong) return 'bg-red-50 border-red-300 text-red-600 animate-pulse';
    if (isSelected) return 'bg-[#1D0084] border-[#1D0084] text-white';
    return 'bg-white border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7] hover:bg-[#F8FAFF]';
  }
  function rightStyle(right: string) {
    const isMatched = Object.values(matched).includes(right);
    const isSelected = rightSel === right;
    const isWrong = wrongPair?.[1] === right;
    if (isMatched) return 'bg-green-50 border-green-400 text-green-800 cursor-default';
    if (isWrong) return 'bg-red-50 border-red-300 text-red-600 animate-pulse';
    if (isSelected) return 'bg-[#025dc7] border-[#025dc7] text-white';
    return 'bg-white border-[#DDE6F5] text-[#5A6480] hover:border-[#025dc7] hover:bg-[#F8FAFF]';
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-1">Emparejar</p>
        <p className="text-[17px] font-semibold text-[#1D0084]">{exercise.prompt}</p>
        <p className="text-[12px] text-[#9CA3AF] mt-1">{Object.keys(matched).length}/{pairs.length} emparejadas</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          {pairs.map(p => (
            <button
              key={p.left}
              onClick={() => { if (!matched[p.left]) setLeftSel(p.left === leftSel ? null : p.left); }}
              className={`w-full px-3 py-3 rounded-xl border text-[14px] font-semibold text-left transition-all duration-200 ${leftStyle(p.left)}`}
            >
              {p.left}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map(right => (
            <button
              key={right}
              onClick={() => { if (!Object.values(matched).includes(right)) setRightSel(right === rightSel ? null : right); }}
              className={`w-full px-3 py-3 rounded-xl border text-[14px] font-medium text-left transition-all duration-200 ${rightStyle(right)}`}
            >
              {right}
            </button>
          ))}
        </div>
      </div>
      {done && (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${errors === 0 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-[#FFF7ED] text-orange-700 border border-orange-200'}`}>
          {errors === 0 ? '✓ ¡Perfecto, sin errores!' : `✓ Completado con ${errors} error${errors > 1 ? 'es' : ''}`}
        </div>
      )}
    </div>
  );
}

function ExerciseStep({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  if (exercise.type === 'multiple_choice') return <MultipleChoiceExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'write_answer') return <WriteAnswerExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'listen_and_choose') return <ListenAndChooseExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'fill_blank') return <FillBlankExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'order_sentence') return <OrderSentenceExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'word_scramble') return <WordScrambleExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'match_pairs') return <MatchPairsExercise exercise={exercise} onAnswer={onAnswer} />;
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   LEZEN SECTION
───────────────────────────────────────────────────────────────────────────── */

function LezenSection({
  textNl,
  textEs,
  exercises,
  onComplete: _onComplete,
}: {
  textNl: string;
  textEs: string;
  exercises: ExerciseItem[];
  onComplete: () => void;
}) {
  const totalSteps = exercises.length > 0 ? 3 : 2; // text, [exercises,] translation
  const [step, setStep] = useState<'text' | 'exercises' | 'translation'>('text');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [exKey, setExKey] = useState(0);

  const exercise = exercises[exerciseIndex];

  const stepNum = step === 'text' ? 1 : step === 'exercises' ? 2 : totalSteps;
  const pct = Math.round(((stepNum - 1 + (step === 'exercises' ? exerciseIndex / exercises.length : 0)) / totalSteps) * 100);

  function handleAnswer(correct: boolean) {
    setAnswered(true);
    if (correct) setScore(s => s + 1);
  }

  function handleNext() {
    if (exerciseIndex + 1 >= exercises.length) {
      setStep('translation');
    } else {
      setExerciseIndex(i => i + 1);
      setAnswered(false);
      setExKey(k => k + 1);
    }
  }

  const progressBar = (
    <GradientBar pct={pct} />
  );

  if (step === 'text') {
    return (
      <div className="space-y-6">
        {progressBar}
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">Texto en neerlandés</p>
          <div className="text-[16px] text-[#1D0084] leading-relaxed whitespace-pre-wrap font-medium text-left">
            {textNl}
          </div>
        </div>
        <button
          onClick={() => exercises.length > 0 ? setStep('exercises') : setStep('translation')}
          className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
        >
          {exercises.length > 0 ? 'Ir a los ejercicios →' : 'Ver traducción →'}
        </button>
      </div>
    );
  }

  if (step === 'exercises' && exercise) {
    return (
      <div className="space-y-5">
        {progressBar}
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => setStep('text')} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#9CA3AF] hover:text-[#1D0084] transition-colors duration-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver al texto
          </button>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {score}
          </div>
        </div>
        <div key={exKey}>
          <ExerciseStep exercise={exercise} onAnswer={handleAnswer} />
        </div>
        {answered && (
          <button onClick={handleNext} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
            {exerciseIndex + 1 < exercises.length ? 'Siguiente ejercicio' : 'Ver traducción del texto'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // translation step
  return (
    <div className="space-y-6">
      <GradientBar pct={100} />
      {exercises.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-white font-bold text-[15px]">¡Ejercicios completados!</p>
            <p className="text-white/60 text-[13px]">{score} de {exercises.length} respuestas correctas</p>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6 space-y-4">
        <div>
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Texto original</p>
          <p className="text-[14px] text-[#5A6480] leading-relaxed whitespace-pre-wrap text-left">{textNl}</p>
        </div>
        <div className="border-t border-[#DDE6F5] pt-4">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Traducción al español</p>
          <p className="text-[15px] text-[#1D0084] font-medium leading-relaxed whitespace-pre-wrap text-left">{textEs}</p>
        </div>
      </div>
      <button
        onClick={() => { setStep('exercises'); setExerciseIndex(0); setScore(0); setAnswered(false); setExKey(k => k + 1); }}
        className="w-full py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
      >
        🔄 Repetir ejercicios
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LUISTEREN (DIALOGUE) SECTION
───────────────────────────────────────────────────────────────────────────── */

function LuisterenSection({
  dialogue,
  practiceExercises,
  onComplete: _onComplete,
}: {
  dialogue: Dialogue;
  practiceExercises: ExerciseItem[];
  onComplete: () => void;
}) {
  const hasExercises = practiceExercises.length > 0;
  const totalSteps = hasExercises ? 3 : 2;
  const [step, setStep] = useState<'audio' | 'exercises' | 'translation'>('audio');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [exKey, setExKey] = useState(0);
  const [isPlayingNormal, setIsPlayingNormal] = useState(false);
  const [isPlayingSlow, setIsPlayingSlow] = useState(false);
  const normalAudioRef = useRef<HTMLAudioElement | null>(null);
  const slowAudioRef = useRef<HTMLAudioElement | null>(null);

  const exercise = practiceExercises[exerciseIndex];
  const stepNum = step === 'audio' ? 1 : step === 'exercises' ? 2 : totalSteps;
  const pct = Math.round(((stepNum - 1 + (step === 'exercises' ? exerciseIndex / practiceExercises.length : 0)) / totalSteps) * 100);

  const speakerColors: Record<string, string> = {};
  const colorList = ['#1D0084', '#025dc7', '#0b4db5'];
  dialogue.lines.forEach(line => {
    if (!speakerColors[line.speaker]) {
      speakerColors[line.speaker] = colorList[Object.keys(speakerColors).length % colorList.length];
    }
  });

  function playAudio(type: 'normal' | 'slow') {
    const isNormal = type === 'normal';
    const audioRef = isNormal ? normalAudioRef : slowAudioRef;
    const src = isNormal ? dialogue.audio?.url : dialogue.slowAudio?.url;
    const setPlaying = isNormal ? setIsPlayingNormal : setIsPlayingSlow;
    const otherRef = isNormal ? slowAudioRef : normalAudioRef;
    const setOtherPlaying = isNormal ? setIsPlayingSlow : setIsPlayingNormal;
    const isCurrentlyPlaying = isNormal ? isPlayingNormal : isPlayingSlow;

    if (isCurrentlyPlaying) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }
    // Stop other
    otherRef.current?.pause();
    if (otherRef.current) otherRef.current.currentTime = 0;
    setOtherPlaying(false);

    if (src) {
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play().catch(() => setPlaying(false));
      setPlaying(true);
    } else {
      // TTS: read all lines
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const fullText = dialogue.lines.map(l => l.dutch).join(' ');
        const u = new SpeechSynthesisUtterance(fullText);
        u.lang = 'nl-NL';
        u.rate = isNormal ? 0.85 : 0.6;
        u.onend = () => setPlaying(false);
        window.speechSynthesis.speak(u);
        setPlaying(true);
      }
    }
  }

  const progressBar = <GradientBar pct={pct} />;

  if (step === 'audio') {
    return (
      <div className="space-y-6">
        {progressBar}

        {/* Title + context */}
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-1">{dialogue.context}</p>
          <h3 className="text-[17px] font-bold text-[#1D0084]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            {dialogue.title}
          </h3>
        </div>

        {/* Audio buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => playAudio('normal')}
            className={`flex flex-col items-center gap-2 py-5 rounded-2xl border text-[14px] font-semibold transition-all duration-200 ${
              isPlayingNormal ? 'bg-[#1D0084] border-[#1D0084] text-white' : 'bg-white border-[#DDE6F5] text-[#1D0084] hover:bg-[#F0F5FF] hover:border-[#025dc7]/40'
            }`}
          >
            {isPlayingNormal ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
            {isPlayingNormal ? 'Parar' : 'Velocidad normal'}
          </button>
          <button
            onClick={() => playAudio('slow')}
            className={`flex flex-col items-center gap-2 py-5 rounded-2xl border text-[14px] font-semibold transition-all duration-200 ${
              isPlayingSlow ? 'bg-[#025dc7] border-[#025dc7] text-white' : 'bg-white border-[#DDE6F5] text-[#1D0084] hover:bg-[#F0F5FF] hover:border-[#025dc7]/40'
            }`}
          >
            {isPlayingSlow ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
            {isPlayingSlow ? 'Parar' : 'Versión lenta'}
          </button>
        </div>

        {/* Dialogue text — 2 columns on desktop to avoid scroll */}
        <div className="rounded-2xl border border-[#DDE6F5] bg-[#F8FAFF] p-5">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">Diálogo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {dialogue.lines.map(line => (
              <div key={line.id} className="flex items-start gap-2.5">
                <span
                  className="text-[10px] font-bold px-2 py-1 rounded-full text-white shrink-0 mt-0.5"
                  style={{ background: speakerColors[line.speaker] ?? '#1D0084' }}
                >
                  {line.speaker}
                </span>
                <p className="text-[14px] text-[#1D0084] font-medium leading-snug">{line.dutch}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => hasExercises ? setStep('exercises') : setStep('translation')}
          className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
        >
          {hasExercises ? 'Ir a los ejercicios →' : 'Ver traducción →'}
        </button>
      </div>
    );
  }

  if (step === 'exercises' && exercise) {
    return (
      <div className="space-y-5">
        {progressBar}
        <div className="flex items-center justify-between">
          <button onClick={() => setStep('audio')} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#9CA3AF] hover:text-[#1D0084] transition-colors duration-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver al diálogo
          </button>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {score}
          </div>
        </div>
        <div key={exKey}>
          <ExerciseStep exercise={exercise} onAnswer={(correct) => { setAnswered(true); if (correct) setScore(s => s + 1); }} />
        </div>
        {answered && (
          <button onClick={() => {
            if (exerciseIndex + 1 >= practiceExercises.length) { setStep('translation'); }
            else { setExerciseIndex(i => i + 1); setAnswered(false); setExKey(k => k + 1); }
          }} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
            {exerciseIndex + 1 < practiceExercises.length ? 'Siguiente ejercicio' : 'Ver traducción del diálogo'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // translation step
  return (
    <div className="space-y-6">
      <GradientBar pct={100} />
      {hasExercises && (
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-white font-bold text-[15px]">¡Diálogo completado!</p>
            <p className="text-white/60 text-[13px]">{score} de {practiceExercises.length} respuestas correctas</p>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">Traducción completa</p>
        <div className="space-y-3">
          {dialogue.lines.map(line => (
            <div key={line.id} className="grid grid-cols-2 gap-4 pb-3 border-b border-[#F0F5FF] last:border-0 last:pb-0">
              <div>
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">{line.speaker} (NL)</span>
                <p className="text-[14px] font-medium text-[#1D0084] leading-snug mt-0.5">{line.dutch}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">{line.speaker} (ES)</span>
                <p className="text-[14px] text-[#5A6480] leading-snug mt-0.5">{line.spanish}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={() => { setStep('audio'); setExerciseIndex(0); setScore(0); setAnswered(false); setExKey(k => k + 1); }}
        className="w-full py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
      >
        🔄 Escuchar de nuevo
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION LANDING — list of sections
───────────────────────────────────────────────────────────────────────────── */

function SectionLanding({
  sections,
  completedSections,
  onEnter,
}: {
  sections: SectionId[];
  completedSections: Set<SectionId>;
  onEnter: (s: SectionId) => void;
}) {
  return (
    <div className="space-y-3">
      {sections.map((id, idx) => {
        const meta = SECTION_META[id];
        const done = completedSections.has(id);
        return (
          <button
            key={id}
            onClick={() => onEnter(id)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border border-[#DDE6F5] hover:border-[#025dc7]/40 hover:bg-[#F8FAFF] transition-all duration-200 text-left group"
          >
            {/* Number / Done badge */}
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[18px] transition-colors duration-200 ${
                done ? 'bg-[#1D0084]' : 'bg-[#F0F5FF]'
              }`}
            >
              {done ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                meta.emoji
              )}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest">
                  {idx + 1}
                </span>
                <p
                  className="text-[16px] font-bold text-[#1D0084] leading-tight"
                  style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
                >
                  {meta.label}
                </p>
              </div>
              <p className="text-[13px] text-[#5A6480] mt-0.5">{meta.desc}</p>
            </div>

            {/* Arrow */}
            <svg
              className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#1D0084] transition-colors duration-200 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LESSON VIEWER
───────────────────────────────────────────────────────────────────────────── */

interface LessonViewerProps {
  lesson: Lesson;
  module: CourseModule;
  prevLesson?: Lesson | null;
  nextLesson?: Lesson | null;
}

export default function LessonViewer({ lesson, module, prevLesson: _prev, nextLesson: _next }: LessonViewerProps) {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<SectionId>>(new Set());

  useEffect(() => {
    markLessonStarted(lesson.id, lesson.moduleId);
    const existing = getLessonProgress(lesson.id);
    if (existing?.status === 'completed') {
      // Pre-mark all sections as done for returning students
    }
  }, [lesson.id, lesson.moduleId]);

  // Build available sections from blocks
  const availableSections: SectionId[] = (() => {
    const result: SectionId[] = [];
    for (const block of lesson.blocks) {
      if (block.type === 'vocabulary') {
        result.push('vocabulary');
        result.push('flashcards');
      } else if (block.type === 'lezen') {
        result.push('lezen');
      } else if (block.type === 'dialogue') {
        result.push('luisteren');
      }
    }
    return result;
  })();

  function completeSection(id: SectionId) {
    setCompletedSections(prev => new Set([...prev, id]));
    setActiveSection(null);
  }

  const vocabBlock    = lesson.blocks.find(b => b.type === 'vocabulary');
  const phraseBlock   = lesson.blocks.find(b => b.type === 'phrases');
  const practiceBlock = lesson.blocks.find(b => b.type === 'practice');
  const lezenBlock    = lesson.blocks.find(b => b.type === 'lezen');
  const dialogueBlock = lesson.blocks.find(b => b.type === 'dialogue');

  const phraseItems    = phraseBlock   && phraseBlock.type   === 'phrases'  ? phraseBlock.items        : [];
  const practiceItems  = practiceBlock && practiceBlock.type === 'practice' ? practiceBlock.exercises  : [];

  const activeMeta = activeSection ? SECTION_META[activeSection] : null;

  return (
    <>
      {/* ── Header ── */}
      <div className="relative bg-[#1D0084] overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[700px] h-[500px]"
            style={{ background: 'radial-gradient(ellipse at center, rgba(11,109,240,0.30) 0%, transparent 65%)' }}
          />
        </div>
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-8">
          {/* Back link: to module if on landing, to lesson landing if inside section */}
          {activeSection === null ? (
            <Link
              href={`/modulo/${module.id}`}
              className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white/80 transition-colors duration-200 mb-5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              {module.title}
            </Link>
          ) : (
            <button
              onClick={() => setActiveSection(null)}
              className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white/80 transition-colors duration-200 mb-5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              {lesson.title}
            </button>
          )}

          <div className="flex items-start gap-3">
            <span className="text-4xl">{module.emoji}</span>
            <div>
              <h1
                className="text-[24px] font-bold text-white leading-tight"
                style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
              >
                {activeSection ? activeMeta!.label : lesson.title}
              </h1>
              <p className="text-[13px] text-white/50 mt-0.5">
                {activeSection ? activeMeta!.desc : `${lesson.subtitle} · ${lesson.estimatedMinutes} min`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="bg-white min-h-[70vh] py-8 pb-20">
        <div className={`mx-auto px-6 ${activeSection === 'vocabulary' || activeSection === 'luisteren' ? 'max-w-5xl' : 'max-w-2xl'}`}>

          {/* LANDING */}
          {activeSection === null && (
            <SectionLanding
              sections={availableSections}
              completedSections={completedSections}
              onEnter={setActiveSection}
            />
          )}

          {/* VOCABULARY — full practice centre */}
          {activeSection === 'vocabulary' && vocabBlock && vocabBlock.type === 'vocabulary' && (
            <VocabPracticeSection
              vocabItems={vocabBlock.items}
              phraseItems={phraseItems}
              practiceExercises={practiceItems}
              onComplete={() => completeSection('vocabulary')}
            />
          )}

          {/* FLASHCARDS */}
          {activeSection === 'flashcards' && vocabBlock && vocabBlock.type === 'vocabulary' && (
            <FlashcardSection
              items={vocabBlock.items}
              onComplete={() => completeSection('flashcards')}
            />
          )}

          {/* LEZEN */}
          {activeSection === 'lezen' && lezenBlock && lezenBlock.type === 'lezen' && (
            <LezenSection
              textNl={lezenBlock.textNl}
              textEs={lezenBlock.textEs}
              exercises={lezenBlock.exercises}
              onComplete={() => completeSection('lezen')}
            />
          )}

          {/* LUISTEREN */}
          {activeSection === 'luisteren' && dialogueBlock && dialogueBlock.type === 'dialogue' && (
            <LuisterenSection
              dialogue={dialogueBlock.dialogue}
              practiceExercises={practiceItems}
              onComplete={() => completeSection('luisteren')}
            />
          )}

        </div>
      </div>
    </>
  );
}
