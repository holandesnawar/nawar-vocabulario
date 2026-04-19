'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import type { Lesson, CourseModule, VocabularyItem, PhraseItem, ExerciseItem, Dialogue } from '@/lib/types';
import {
  getLessonProgress,
  markLessonStarted,
  markLessonCompleted,
  markPreviousAsCompleted,
} from '@/lib/progress';
import AudioPlayer from './AudioPlayer';
import DarkModeToggle from './DarkModeToggle';

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

/**
 * Mapa global word_nl -> audio_url poblado por LessonViewer cuando carga la
 * lección. speakDutch lo consulta primero antes de caer a TTS del navegador.
 *
 * Esto hace que cualquier ejercicio que diga speakDutch("koffie") use
 * automáticamente el MP3 de ElevenLabs si existe — sin tocar cada componente.
 */
let _wordAudioMap: Record<string, string> = {};
let _currentAudio: HTMLAudioElement | null = null;

export function setWordAudioMap(map: Record<string, string>) {
  _wordAudioMap = map;
}

function _ttsFallback(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'nl-NL';
  u.rate = 0.78;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

function speakDutch(text: string) {
  // Para parar cualquier audio previo (TTS o MP3)
  if (_currentAudio) { try { _currentAudio.pause(); } catch {} _currentAudio = null; }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();

  const key = text.trim().toLowerCase();
  const url = _wordAudioMap[key];
  if (url) {
    try {
      const audio = new Audio(url);
      _currentAudio = audio;
      audio.onerror = () => _ttsFallback(text);
      audio.play().catch(() => _ttsFallback(text));
      return;
    } catch {
      // fallthrough to TTS
    }
  }
  _ttsFallback(text);
}


/* ── Feedback banner (correct / incorrect) ── */

function FeedbackBanner({
  correct,
  correctAnswer,
  explanation,
}: {
  correct: boolean;
  correctAnswer?: string;
  explanation?: string;
  /** @deprecated ya no se usa — se mantiene la firma para no romper llamadas */
  onHear?: () => void;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
        correct
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      {correct ? '✓ ¡Correcto!' : `✗ La respuesta era: "${correctAnswer}"`}
      {explanation && (
        <p className="mt-1 text-[13px] opacity-80">{explanation}</p>
      )}
    </div>
  );
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
          className="h-full rounded-full transition-all duration-500 progress-fill"
          style={{ width: `${pct}%` }}
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

type VPStepType =
  | 'words' | 'phrases' | 'listen' | 'translate' | 'truefalse' | 'test' | 'complete'
  | 'order' | 'classify' | 'write' | 'scramble' | 'pairs'
  | 'emoji' | 'intruder' | 'letterdash' | 'memory';

const VP_META: Record<VPStepType, { label: string; emoji: string }> = {
  words:      { label: 'Diccionario',           emoji: '📖' },
  phrases:    { label: 'Repaso de frases',      emoji: '💬' },
  listen:     { label: 'Escucha y elige',       emoji: '🎧' },
  translate:  { label: 'Escucha y traduce',     emoji: '🎙️' },
  truefalse:  { label: 'Verdadero o falso',     emoji: '✅' },
  test:       { label: 'Selecciona la correcta',emoji: '🧪' },
  complete:   { label: 'Completa la frase',     emoji: '✏️' },
  order:      { label: 'Ordena las palabras',   emoji: '🔤' },
  classify:   { label: 'Clasifica',             emoji: '🗂️' },
  write:      { label: 'Escribe en neerlandés', emoji: '✍️' },
  scramble:   { label: 'Deletrea la palabra',   emoji: '🔡' },
  pairs:      { label: 'Empareja',              emoji: '🔗' },
  emoji:      { label: 'Toca el emoji',         emoji: '🎯' },
  intruder:   { label: 'Elige la intrusa',      emoji: '🔎' },
  letterdash: { label: 'Letras que faltan',     emoji: '🔠' },
  memory:     { label: 'Memory cards',          emoji: '🃏' },
};

interface ClassifyGroup { id: string; label: string }
interface ClassifyItemData { dutch: string; groupId: string }

type VPStep =
  | { type: 'words' }
  | { type: 'phrases';    items: PhraseItem[] }
  | { type: 'listen';     exercises: ExerciseItem[] }
  | { type: 'translate';  exercises: ExerciseItem[] }
  | { type: 'truefalse';  exercises: ExerciseItem[] }
  | { type: 'test';       exercises: ExerciseItem[] }
  | { type: 'complete';   exercises: ExerciseItem[] }
  | { type: 'order';      exercises: ExerciseItem[] }
  | { type: 'classify';   groups: ClassifyGroup[]; items: ClassifyItemData[] }
  | { type: 'write';      exercises: ExerciseItem[] }
  | { type: 'scramble';   exercises: ExerciseItem[] }
  | { type: 'pairs';      exercises: ExerciseItem[] }
  | { type: 'emoji';      exercises: ExerciseItem[] }
  | { type: 'intruder';   exercises: ExerciseItem[] }
  | { type: 'letterdash'; exercises: ExerciseItem[] }
  | { type: 'memory';     exercises: ExerciseItem[] };

function isTrueFalse(e: ExerciseItem): boolean {
  if (e.type === 'true_false') return true;
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
  // Article-based fallback — only de/het nouns (skip verbs and items without article)
  const deHetItems = items.filter(i => i.article === 'de' || i.article === 'het');
  const hasDE  = deHetItems.some(i => i.article === 'de');
  const hasHET = deHetItems.some(i => i.article === 'het');
  const groups: ClassifyGroup[] = [];
  if (hasDE)  groups.push({ id: 'de',  label: 'de ...' });
  if (hasHET) groups.push({ id: 'het', label: 'het ...' });
  if (groups.length >= 2) {
    return {
      groups,
      items: deHetItems.map(i => ({ dutch: i.dutch, groupId: i.article! })),
    };
  }
  return null;
}

function buildVPSteps(
  vocabItems: VocabularyItem[],
  phraseItems: PhraseItem[],
  exercises: ExerciseItem[],
): VPStep[] {
  const steps: VPStep[] = [];

  if (vocabItems.length > 0)
    steps.push({ type: 'words' });

  if (phraseItems.length > 0)
    steps.push({ type: 'phrases', items: phraseItems });

  const listenEx = exercises.filter(e => e.type === 'listen_and_choose');
  if (listenEx.length > 0)
    steps.push({ type: 'listen', exercises: listenEx });

  const translateEx = exercises.filter(e => e.type === 'listen_translate');
  if (translateEx.length > 0)
    steps.push({ type: 'translate', exercises: translateEx });

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

  // Classify desactivado por feedback del usuario (no encajaba en el flujo Duolingo).
  // Se mantienen el tipo y el componente por si se reactiva más adelante.
  // const classifyData = buildClassifyData(vocabItems);
  // if (classifyData) steps.push({ type: 'classify', ...classifyData });

  const writeEx = exercises.filter(e => e.type === 'write_answer');
  if (writeEx.length > 0)
    steps.push({ type: 'write', exercises: writeEx });

  const scrambleEx = exercises.filter(e => e.type === 'word_scramble');
  if (scrambleEx.length > 0)
    steps.push({ type: 'scramble', exercises: scrambleEx });

  const pairsEx = exercises.filter(e => e.type === 'match_pairs');
  if (pairsEx.length > 0)
    steps.push({ type: 'pairs', exercises: pairsEx });

  const emojiEx = exercises.filter(e => e.type === 'emoji_choice');
  if (emojiEx.length > 0)
    steps.push({ type: 'emoji', exercises: emojiEx });

  const intruderEx = exercises.filter(e => e.type === 'odd_one_out');
  if (intruderEx.length > 0)
    steps.push({ type: 'intruder', exercises: intruderEx });

  const letterDashEx = exercises.filter(e => e.type === 'letter_dash');
  if (letterDashEx.length > 0)
    steps.push({ type: 'letterdash', exercises: letterDashEx });

  // Memory cards desactivado por feedback del usuario.
  // const memoryEx = exercises.filter(e => e.type === 'pair_memory');
  // if (memoryEx.length > 0) steps.push({ type: 'memory', exercises: memoryEx });

  return steps;
}

/* ── Step bar ── */

function StepBar({ steps, current }: {
  steps: VPStep[];
  current: number;
}) {
  const meta = VP_META[steps[current].type];
  // Total de "tarjetas" (steps no-content) y posición actual entre ellas
  const cardSteps = steps.filter(s => s.type !== 'words' && s.type !== 'phrases');
  const isContentStep = steps[current].type === 'words' || steps[current].type === 'phrases';
  const cardNum = isContentStep ? null : steps.slice(0, current + 1).filter(s => s.type !== 'words' && s.type !== 'phrases').length;

  return (
    <div className="flex-1 flex items-center gap-3 min-w-0">
      <p className="text-[20px] font-bold text-[#1D0084] leading-tight truncate" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
        {meta.emoji} {meta.label}
      </p>
      {!isContentStep && (
        <span className="text-[11px] text-[#9CA3AF] font-medium tabular-nums shrink-0">
          {cardNum} / {cardSteps.length}
        </span>
      )}
    </div>
  );
}

/* ── Word card (simple play button) ── */

function WordCard({ word }: { word: VocabularyItem }) {
  const [isPlaying, setIsPlaying] = useState(false);

  function handlePlay() {
    if (isPlaying) {
      // speakDutch maneja stop interno
      window.speechSynthesis?.cancel();
      setIsPlaying(false);
      return;
    }
    // Texto con artículo → speakDutch enruta automáticamente al MP3 -art.mp3
    // si está en el mapa global, o cae a TTS.
    const text = (word.article ? `${word.article} ` : '') + word.dutch;
    setIsPlaying(true);
    speakDutch(text);
    // Resetear estado tras una pausa razonable (no tenemos onended del helper)
    setTimeout(() => setIsPlaying(false), 2500);
  }

  return (
    <div className="rounded-2xl border border-[#DDE6F5] bg-white overflow-hidden flex flex-col">
      <div className="h-1.5 w-full brand-accent-line" />
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
  // Persistencia del índice (efecto libro: al volver, aterriza donde estabas / en
  // el último si el step estaba completado).
  const storageKey = typeof window !== 'undefined' ? `vp-phrases-${window.location.pathname}` : null;
  const [index, setIndex] = useState(() => {
    if (!storageKey || typeof window === 'undefined') return 0;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored !== null) {
        const n = parseInt(stored, 10);
        if (Number.isFinite(n) && n >= 0 && n < items.length) return n;
      }
    } catch {}
    return 0;
  });
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
    if (storageKey) try { sessionStorage.setItem(storageKey, String(newIndex)); } catch {}
    onSubProgress?.(newIndex + 1, items.length);
  }

  // Al pasar al siguiente step, guarda el ÚLTIMO índice para que al volver
  // atrás aterrice ahí (como una página atrás en un libro).
  function handleDone() {
    if (storageKey && items.length > 0) {
      try { sessionStorage.setItem(storageKey, String(items.length - 1)); } catch {}
    }
    onDone();
  }

  useEffect(() => {
    onSubProgress?.(1, items.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-2xl border border-[#DDE6F5] p-6 space-y-4">
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
          onClick={() => { stopAudio(); if (isLast) handleDone(); else navigate(index + 1); }}
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

/* ─────────────────────────────────────────────────────────────────────────────
   Exercise runner — navegación libre tipo app moderna
   Sin "finished" modal ni "reviewMode" secreto. Cada ejercicio es un slide.
   El usuario puede moverse siempre (Anterior/Siguiente/dots) y las respuestas
   ya dadas se mantienen. Al terminar TODOS, el boton de "Siguiente paso"
   pasa al step siguiente.
───────────────────────────────────────────────────────────────────────────── */

function ExerciseRunner({ exercises, onDone, onBack, hasBackStep, onSubProgress, cacheKey }: {
  exercises: ExerciseItem[];
  onDone: () => void;
  onBack: () => void;
  hasBackStep?: boolean;
  onSubProgress?: (done: number, total: number) => void;
  cacheKey?: string;
}) {
  const answersKey = cacheKey ? `vp-ex-${cacheKey}-data` : null;
  const indexKey = cacheKey ? `vp-ex-${cacheKey}` : null;

  // Load cached answers once on mount (sessionStorage-safe).
  // Filtra entries con indices fuera del rango actual (cache obsoleto si
  // el seed cambió de tamaño).
  const initialAnswers = useMemo<Record<number, string>>(() => {
    if (!answersKey || typeof window === 'undefined') return {};
    try {
      const raw = sessionStorage.getItem(answersKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      const cleaned: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const n = Number(k);
        if (Number.isFinite(n) && n >= 0 && n < exercises.length && typeof v === 'string') {
          cleaned[n] = v;
        }
      }
      // Re-persist cleaned version to evict stale entries from storage
      sessionStorage.setItem(answersKey, JSON.stringify(cleaned));
      return cleaned;
    } catch { return {}; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<Record<number, string>>(initialAnswers);
  const [index, setIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    // Si hay un index guardado de una sesión en curso, úsalo
    if (indexKey) {
      try {
        const stored = sessionStorage.getItem(indexKey);
        if (stored !== null) {
          const n = parseInt(stored, 10);
          if (Number.isFinite(n) && n >= 0 && n < exercises.length) return n;
        }
      } catch {}
    }
    // Sin index guardado pero con respuestas previas → step ya completado:
    // aterriza en el ÚLTIMO ejercicio (como pasar páginas atrás en un libro).
    if (Object.keys(initialAnswers).length > 0 && exercises.length > 0) {
      return exercises.length - 1;
    }
    return 0;
  });
  const [exKey, setExKey] = useState(0);

  // Computed score from answers map — single source of truth.
  // Filtra índices fuera del rango actual (cache obsoleto de seeds antiguos).
  const score = useMemo(() => {
    return exercises.reduce((acc, ex, i) => {
      const a = answers[i];
      if (!a) return acc;
      const ca = (ex.correctAnswer ?? '').trim().toLowerCase();
      return a.trim().toLowerCase() === ca ? acc + 1 : acc;
    }, 0);
  }, [answers, exercises]);

  // Solo cuenta respuestas dentro del rango actual del step
  const answeredCount = Object.keys(answers).filter(k => {
    const n = Number(k);
    return Number.isFinite(n) && n >= 0 && n < exercises.length;
  }).length;
  const allAnswered = answeredCount >= exercises.length;
  const isLast = index + 1 >= exercises.length;
  const canGoBack = index > 0 || !!hasBackStep;

  // Persist index + report progress on every index change
  useEffect(() => {
    if (indexKey) try { sessionStorage.setItem(indexKey, String(index)); } catch {}
    onSubProgress?.(index, exercises.length);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(correct: boolean, answer: string) {
    setAnswers(prev => {
      const next = { ...prev, [index]: answer };
      if (answersKey) try { sessionStorage.setItem(answersKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function go(target: number) {
    // Atrás: siempre permitido (incluyendo a paso anterior)
    if (target < 0) { if (hasBackStep) onBack(); return; }
    // Adelante libre (skip permitido — se endurecerá más adelante)
    if (target >= exercises.length) {
      // Al pasar al siguiente step, guardamos el ÚLTIMO índice del step que
      // dejamos para que al volver atrás aterrice ahí (no en el primero).
      // Así se comporta como "pasar página atrás en un libro".
      if (indexKey && exercises.length > 0) {
        try { sessionStorage.setItem(indexKey, String(exercises.length - 1)); } catch {}
      }
      onDone();
      return;
    }
    if (target === index) return;
    setIndex(target);
    setExKey(k => k + 1);
  }

  function handleNext() { go(index + 1); }
  function handlePrev() { go(index - 1); }

  const currentAnswered = index in answers;

  return (
    <div className="space-y-4">
      {/* Single progress strip: segmented bar (color por estado) + % + score */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 flex-1">
            {exercises.map((ex, i) => {
              const a = answers[i];
              let segCls = 'bg-[#DDE6F5] hover:bg-[#9CA3AF]/40';
              if (a !== undefined) {
                const correct = a.trim().toLowerCase() === (ex.correctAnswer ?? '').trim().toLowerCase();
                segCls = correct
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-400 hover:bg-red-500';
              }
              if (i === index && a === undefined) {
                segCls = 'hover:opacity-80';
              }
              const isCurrent = i === index;
              return (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Ejercicio ${i + 1}`}
                  className={`h-2.5 flex-1 rounded-full transition-all duration-200 ${segCls} ${isCurrent ? 'ring-2 ring-[#1D0084] ring-offset-1' : ''} ${isCurrent && a === undefined ? 'progress-fill' : ''}`}
                />
              );
            })}
          </div>
          <span className="text-[13px] font-bold text-[#025dc7] bg-[#EEF4FF] px-2.5 py-0.5 rounded-full shrink-0 tabular-nums">
            {Math.min(100, Math.round((answeredCount / Math.max(exercises.length, 1)) * 100))}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#9CA3AF] font-medium tabular-nums">
            {index + 1} / {exercises.length}
          </span>
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#16a34a] bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {score}
          </div>
        </div>
      </div>

      {/* Exercise content */}
      <div className="relative md:px-[84px]">
        <button
          onClick={canGoBack ? handlePrev : undefined}
          aria-label="Anterior"
          className={`hidden md:flex absolute left-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-200 ${
            canGoBack ? 'text-[#9CA3AF] hover:bg-[#F0F5FF] hover:text-[#1D0084] cursor-pointer' : 'text-[#E8ECF4] pointer-events-none'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div key={exKey}>
          <ExerciseStep exercise={exercises[index]} onAnswer={handleAnswer} initialAnswer={answers[index]} />
        </div>

        <button
          onClick={handleNext}
          aria-label={isLast ? 'Siguiente paso' : 'Siguiente ejercicio'}
          className={`hidden md:flex absolute right-0 top-5 w-11 h-11 items-center justify-center rounded-2xl transition-all duration-300 ${
            currentAnswered
              ? 'bg-[#1D0084] text-white cursor-pointer hover:bg-[#025dc7]'
              : 'bg-[#F0F5FF] text-[#1D0084] cursor-pointer hover:bg-[#e0eaff] border border-[#DDE6F5]'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mobile buttons — always visible */}
      <div className="flex items-stretch gap-2 md:hidden">
        <button
          onClick={handlePrev}
          disabled={!canGoBack}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-[#5A6480] text-[13px] font-semibold border border-[#DDE6F5] hover:text-[#1D0084] hover:border-[#1D0084]/30 disabled:opacity-40 transition-colors duration-200 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={handleNext}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-semibold transition-colors duration-200 ${
            currentAnswered
              ? 'bg-[#1D0084] text-white hover:bg-[#025dc7]'
              : 'bg-[#F0F5FF] text-[#1D0084] border border-[#DDE6F5] hover:bg-[#e0eaff]'
          }`}
        >
          {currentAnswered ? (isLast ? 'Siguiente paso' : 'Siguiente') : (isLast ? 'Saltar al siguiente paso' : 'Saltar')}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
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
      {/* Top row: back button (always visible) + score badge */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { if (index > 0) { setIndex(i => i - 1); setResult(null); } else { onBack(); } }}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-[#9CA3AF] hover:text-[#1D0084] transition-colors duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {index > 0 ? 'Anterior' : 'Paso anterior'}
        </button>
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
        <button onClick={handleNext} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
          {index + 1 < queue.length ? 'Siguiente' : 'Siguiente paso'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
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

  function handleReset(confirm = true) {
    if (confirm && typeof window !== 'undefined' && !window.confirm('¿Borrar todas tus respuestas y empezar de cero?')) return;
    // Borra TODO el cache de esta lección — respuestas, índices, step actual
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('vp-ex-') || k.startsWith('vp-step-'))) keys.push(k);
      }
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch {}
    setAllDone(false);
    setStepIndex(0);
    setSubProgress(undefined);
    setRunnerKey(k => k + 1);
  }

  if (allDone) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center rounded-2xl py-12 px-6 gap-3" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-5xl">⭐</span>
          <p className="text-white font-bold text-[22px]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>¡Práctica completada!</p>
          <p className="text-white/60 text-[14px]">Has repasado todo el vocabulario</p>
        </div>
        <button
          onClick={() => handleReset(false)}
          className="w-full py-4 rounded-xl bg-[#1D0084] text-white text-[16px] font-bold hover:bg-[#025dc7] transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Hacer la práctica de nuevo
        </button>
        <button
          onClick={onComplete}
          className="w-full py-3 rounded-xl bg-white text-[#5A6480] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#F0F5FF] hover:text-[#1D0084] transition-colors duration-200"
        >
          Salir al menú de la lección
        </button>
      </div>
    );
  }

  const step = steps[stepIndex];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <StepBar steps={steps} current={stepIndex} />
        <button
          onClick={() => handleReset(true)}
          title="Reiniciar todas las respuestas"
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#9CA3AF] hover:text-[#1D0084] hover:bg-[#F0F5FF] transition-colors duration-200 -mt-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reiniciar
        </button>
      </div>

      {step.type === 'words' && (
        <WordsStep key={runnerKey} items={vocabItems} onDone={handleStepDone}
          onSubProgress={(done, total) => setSubProgress({ done, total })} />
      )}
      {step.type === 'phrases' && (
        <PhrasesStep key={runnerKey} items={step.items} onDone={handleStepDone} onBack={handleStepBack}
          onSubProgress={(done, total) => setSubProgress({ done, total })} />
      )}
      {(step.type === 'listen' || step.type === 'translate' || step.type === 'truefalse' || step.type === 'test' || step.type === 'complete' || step.type === 'order' || step.type === 'write' || step.type === 'scramble' || step.type === 'pairs' || step.type === 'emoji' || step.type === 'intruder' || step.type === 'letterdash' || step.type === 'memory') && (
        <ExerciseRunner
          key={runnerKey}
          exercises={step.exercises}
          onDone={handleStepDone}
          onBack={handleStepBack}
          hasBackStep={stepIndex > 0}
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
  // Prevent showing next card content before flip-back animation completes
  const [isAdvancing, setIsAdvancing] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current); };
  }, []);

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
    if (isAdvancing) return;
    setIsAdvancing(true);
    setFlipped(false);
    // Wait for flip-back animation (0.45s) before moving the card to end of queue
    advanceTimerRef.current = setTimeout(() => {
      setQueue(q => {
        const next = [...q];
        const [current] = next.splice(index, 1);
        next.push(current);
        return next;
      });
      setIsAdvancing(false);
    }, 460);
  }

  function advance() {
    if (isAdvancing) return;
    setIsAdvancing(true);
    setFlipped(false);
    // Wait for flip-back animation (0.45s) before showing the next card
    advanceTimerRef.current = setTimeout(() => {
      setIsAdvancing(false);
      if (index + 1 >= queue.length) {
        setDone(true);
      } else {
        setIndex(i => i + 1);
      }
    }, 460);
  }

  function handleShuffle() {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    setIsAdvancing(false);
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
            className="rounded-2xl border border-[#DDE6F5] bg-white flex flex-col items-center justify-center gap-3 p-8 absolute inset-0"
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
            {mode === 'nl-es' && (
              <button
                onClick={(e) => { e.stopPropagation(); speakDutch(front); }}
                aria-label="Escuchar pronunciación"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#025dc7] text-[12px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
                </svg>
                Escuchar
              </button>
            )}
            <p className="text-[11px] text-[#9CA3AF]">Toca la tarjeta para girarla</p>
          </div>
          {/* Back */}
          <div
            className="rounded-2xl border border-[#025dc7]/30 bg-[#F8FAFF] flex flex-col items-center justify-center gap-3 p-8 absolute inset-0"
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
            {mode === 'es-nl' && (
              <button
                onClick={(e) => { e.stopPropagation(); speakDutch(back); }}
                aria-label="Escuchar pronunciación"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#025dc7] text-[12px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
                </svg>
                Escuchar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {flipped && !isAdvancing ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRepeat}
            disabled={isAdvancing}
            className="py-3.5 rounded-xl bg-[#FFF5F5] border border-red-100 text-red-600 text-[15px] font-semibold hover:bg-red-50 transition-colors duration-200 disabled:opacity-40"
          >
            🔄 Repasar
          </button>
          <button
            onClick={handleKnown}
            disabled={isAdvancing}
            className="py-3.5 rounded-xl bg-[#F0FFF4] border border-green-200 text-green-700 text-[15px] font-semibold hover:bg-green-50 transition-colors duration-200 disabled:opacity-40"
          >
            ✓ Ya la sé
          </button>
        </div>
      ) : !isAdvancing ? (
        <p className="text-center text-[13px] text-[#9CA3AF]">
          Primero mira la tarjeta, luego decide
        </p>
      ) : null}

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
        <FeedbackBanner
          correct={selected === exercise.correctAnswer}
          correctAnswer={exercise.correctAnswer}
          explanation={exercise.explanation}
          onHear={selected !== exercise.correctAnswer ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
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
        <FeedbackBanner
          correct={isCorrect}
          correctAnswer={exercise.correctAnswer}
          onHear={!isCorrect ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
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
  const hasOptions = (exercise.options?.length ?? 0) > 0;
  const parts = exercise.prompt.split('___');

  // ── Text-input mode state ──
  const [value, setValue] = useState(initialAnswer ?? '');
  const [submitted, setSubmitted] = useState(initialAnswer !== undefined && initialAnswer !== '');
  const isCorrect = value.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  // ── Chip mode state ──
  const [chipSelected, setChipSelected] = useState<string | null>(initialAnswer ?? null);
  const [playingChip, setPlayingChip] = useState<string | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isChipAnswered = chipSelected !== null;
  const isChipCorrect = chipSelected?.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  const shuffledOptions = useMemo(() => {
    if (!exercise.options?.length) return [];
    const arr = [...exercise.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function playChipAudio(opt: string) {
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    setPlayingChip(opt);
    speakDutch(opt);
    playTimerRef.current = setTimeout(() => setPlayingChip(null), 2200);
  }

  // Dos fases: tap = escucha + rellena el hueco (no envía). "Comprobar" envía.
  const [chipSubmitted, setChipSubmitted] = useState(initialAnswer !== undefined && initialAnswer !== null);
  function handleChipTap(opt: string) {
    playChipAudio(opt);
    if (chipSubmitted) return; // tras comprobar, re-tap solo reproduce audio
    setChipSelected(opt);
  }
  function handleChipSubmit() {
    if (!chipSelected || chipSubmitted) return;
    setChipSubmitted(true);
    const correct = chipSelected.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();
    onAnswer(correct, chipSelected);
  }

  function handleTextSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect, value.trim());
  }

  // ── Chip variant ──
  if (hasOptions) {
    function chipStyle(opt: string): string {
      const base = 'flex items-center gap-2 px-4 py-3 rounded-xl border text-[15px] font-semibold transition-all duration-200 ';
      if (!chipSubmitted) {
        // Mientras no se ha enviado: chip seleccionado destaca, playing anima
        if (opt === chipSelected) {
          return base + 'bg-[#1D0084] border-[#1D0084] text-white';
        }
        if (opt === playingChip) {
          return base + 'bg-[#1D0084]/10 border-[#1D0084]/40 text-[#1D0084] scale-[0.97]';
        }
        return base + 'bg-[#F0F5FF] border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7]/40 hover:bg-[#e8f0ff] active:scale-[0.97]';
      }
      // Después de comprobar: verde la correcta, rojo la elegida si era incorrecta
      if (opt === exercise.correctAnswer) return base + 'bg-green-50 border-green-400 text-green-800';
      if (opt === chipSelected) return base + 'bg-red-50 border-red-400 text-red-700';
      return base + 'bg-[#F8F9FA] border-[#DDE6F5] text-[#9CA3AF]';
    }

    return (
      <div className="space-y-4">
        {/* Sentence with blank */}
        <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
          <p className="text-[16px] font-semibold text-[#1D0084] leading-snug">
            {parts[0]}
            <span className={`fill-blank-slot ${
              chipSubmitted
                ? isChipCorrect ? 'is-correct' : 'is-wrong'
                : chipSelected ? 'is-filled' : 'is-empty'
            }`}>
              {chipSelected ?? '\u00A0'}
            </span>
            {parts[1] ?? ''}
          </p>
          {exercise.hint && <p className="text-[13px] text-[#9CA3AF] mt-2">💡 {exercise.hint}</p>}
        </div>

        {/* Option chips — tap = escucha audio + rellena el hueco (no envía) */}
        <div className="grid grid-cols-2 gap-2">
          {shuffledOptions.map(opt => (
            <button key={opt} onClick={() => handleChipTap(opt)} className={chipStyle(opt)}>
              <svg className={`w-4 h-4 shrink-0 transition-opacity duration-150 ${opt === playingChip ? 'opacity-100' : 'opacity-50'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="truncate">{opt}</span>
              {chipSubmitted && opt === exercise.correctAnswer && (
                <svg className="w-4 h-4 shrink-0 text-green-600 ml-auto" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Botón Comprobar: aparece cuando hay selección y aún no se ha enviado */}
        {!chipSubmitted && (
          <button
            onClick={handleChipSubmit}
            disabled={!chipSelected}
            className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
          >
            Comprobar
          </button>
        )}

        {chipSubmitted && (
          <FeedbackBanner
            correct={isChipCorrect}
            correctAnswer={exercise.correctAnswer}
            explanation={exercise.explanation}
          />
        )}
      </div>
    );
  }

  // ── Text-input variant (when no options) ──
  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug flex flex-wrap items-center gap-1">
          {parts[0]}
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
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
          onClick={handleTextSubmit}
          disabled={!value.trim()}
          className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          Comprobar
        </button>
      )}
      {submitted && (
        <FeedbackBanner
          correct={isCorrect}
          correctAnswer={exercise.correctAnswer}
          explanation={exercise.explanation}
          onHear={!isCorrect ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
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
  // Extract Dutch word in quotes for TTS, but DON'T show it in the prompt
  const match = exercise.prompt.match(/"([^"]+)"/);
  const dutchText = match ? match[1] : exercise.prompt;
  const visiblePrompt = match
    ? exercise.prompt.replace(/\s*[:：]?\s*"[^"]+"\s*\.?\s*$/, '').trim() || 'Escucha y elige la respuesta correcta'
    : exercise.prompt;

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
          <p className="text-[17px] font-semibold text-[#1D0084] leading-snug">{visiblePrompt}</p>
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
        <FeedbackBanner
          correct={selected === exercise.correctAnswer}
          correctAnswer={exercise.correctAnswer}
          explanation={exercise.explanation}
          onHear={selected !== exercise.correctAnswer ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
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
        <FeedbackBanner
          correct={isCorrect}
          correctAnswer={exercise.correctAnswer}
          onHear={!isCorrect ? () => speakDutch(exercise.correctAnswer) : undefined}
        />
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
        <FeedbackBanner
          correct={isCorrect}
          correctAnswer={word}
          onHear={!isCorrect ? () => speakDutch(word) : undefined}
        />
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

/* ────────────────────────────────────────────────────────────────────────────
   Test Lab formats: true_false, emoji_choice, odd_one_out, letter_dash, pair_memory
──────────────────────────────────────────────────────────────────────────── */

function TrueFalseExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const correct = (exercise.correctAnswer ?? '').toLowerCase().trim();
  const init = (initialAnswer ?? '').toLowerCase().trim();
  const [selected, setSelected] = useState<'verdadero' | 'falso' | null>(
    init === 'verdadero' || init === 'falso' ? (init as 'verdadero' | 'falso') : null
  );
  const isAnswered = selected !== null;

  function pick(ans: 'verdadero' | 'falso') {
    if (isAnswered) return;
    setSelected(ans);
    onAnswer(ans === correct, ans);
  }

  function styleFor(ans: 'verdadero' | 'falso') {
    const base = 'py-8 rounded-2xl text-[18px] font-bold border-2 flex flex-col items-center gap-2 transition-all duration-200';
    const isGreen = ans === 'verdadero';
    if (!isAnswered) {
      return `${base} ${isGreen
        ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 active:scale-[0.98]'
        : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 active:scale-[0.98]'}`;
    }
    if (selected === ans && correct === ans) return `${base} bg-green-500 border-green-600 text-white`;
    if (selected === ans && correct !== ans) return `${base} bg-red-500 border-red-600 text-white`;
    if (correct === ans) return `${base} bg-green-100 border-green-400 text-green-800`;
    return `${base} bg-gray-50 border-gray-200 text-gray-400`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">¿Es verdadero o falso?</p>
        <p className="text-[20px] font-bold text-[#1D0084] leading-snug text-center py-2">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => pick('verdadero')} disabled={isAnswered} className={styleFor('verdadero')}>
          <span className="text-3xl">✓</span>
          Verdadero
        </button>
        <button onClick={() => pick('falso')} disabled={isAnswered} className={styleFor('falso')}>
          <span className="text-3xl">✗</span>
          Falso
        </button>
      </div>
      {isAnswered && (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
          selected === correct
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {selected === correct
            ? '✓ ¡Correcto!'
            : `✗ La respuesta correcta era: ${correct === 'verdadero' ? 'Verdadero' : 'Falso'}`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function EmojiChoiceExercise({
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
  const options = exercise.options ?? [];

  function pick(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function styleFor(opt: string) {
    const base = 'aspect-square rounded-2xl border-2 flex items-center justify-center text-6xl transition-all duration-200';
    if (!isAnswered) return `${base} bg-[#F0F5FF] border-[#DDE6F5] hover:border-[#025dc7]/50 hover:bg-[#e8f0ff] active:scale-[0.95]`;
    if (opt === exercise.correctAnswer) return `${base} bg-green-50 border-green-400`;
    if (opt === selected) return `${base} bg-red-50 border-red-400`;
    return `${base} bg-gray-50 border-gray-200 opacity-50`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Toca el emoji que corresponde a:</p>
        <p className="text-[24px] font-bold text-[#1D0084] leading-snug text-center py-2">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => (
          <button key={opt} onClick={() => pick(opt)} disabled={isAnswered} className={styleFor(opt)}>
            {opt}
          </button>
        ))}
      </div>
      {isAnswered && (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
          selected === exercise.correctAnswer
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {selected === exercise.correctAnswer
            ? '✓ ¡Correcto!'
            : `✗ El correcto era ${exercise.correctAnswer}`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function OddOneOutExercise({
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
  const options = exercise.options ?? [];

  function pick(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer, opt);
  }

  function styleFor(opt: string) {
    const base = 'py-6 rounded-2xl border-2 text-[17px] font-bold transition-all duration-200';
    if (!isAnswered) return `${base} bg-[#F0F5FF] border-[#DDE6F5] text-[#1D0084] hover:border-[#025dc7]/50 hover:bg-[#e8f0ff] active:scale-[0.97]`;
    if (opt === exercise.correctAnswer) return `${base} bg-green-50 border-green-400 text-green-800`;
    if (opt === selected) return `${base} bg-red-50 border-red-400 text-red-700`;
    return `${base} bg-gray-50 border-gray-200 text-gray-400`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Elige la intrusa</p>
        <p className="text-[17px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => (
          <button key={opt} onClick={() => pick(opt)} disabled={isAnswered} className={styleFor(opt)}>
            {opt}
          </button>
        ))}
      </div>
      {isAnswered && (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
          selected === exercise.correctAnswer
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {selected === exercise.correctAnswer
            ? '✓ ¡Correcto!'
            : `✗ La intrusa era: "${exercise.correctAnswer}"`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * LetterDashExercise
 * Muestra la palabra con algunas letras ocultas (k_ff_e). El alumno
 * escribe SOLO la palabra completa en el input. Pista visual + audio TTS.
 */
function LetterDashExercise({
  exercise,
  onAnswer,
  initialAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean, answer: string) => void;
  initialAnswer?: string;
}) {
  const target = (exercise.correctAnswer ?? '').trim();
  const [value, setValue] = useState(initialAnswer ?? '');
  const [submitted, setSubmitted] = useState(initialAnswer !== undefined && initialAnswer !== '');

  // Compute which letter positions to hide (~40% of letters, deterministic per exercise)
  const masked = useMemo(() => {
    if (!target) return '';
    const seed = exercise.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const indices: number[] = [];
    for (let i = 0; i < target.length; i++) {
      // Skip first letter as a hint, then mask every ~2nd letter using seed
      if (i === 0) continue;
      if (((i + seed) % 2) === 0) indices.push(i);
    }
    // Ensure at least 1 masked
    if (indices.length === 0 && target.length > 1) indices.push(target.length - 1);
    return target.split('').map((ch, i) => (indices.includes(i) ? '_' : ch)).join(' ');
  }, [exercise.id, target]);

  const isCorrect = value.trim().toLowerCase() === target.toLowerCase();

  function handleSubmit() {
    if (submitted || !value.trim()) return;
    setSubmitted(true);
    onAnswer(isCorrect, value.trim());
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white space-y-3">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">Letras que faltan</p>
        <p className="text-[15px] text-[#1D0084] font-medium leading-snug">{exercise.prompt}</p>
        <div className="text-center py-3">
          <p className="text-[34px] font-bold text-[#1D0084] tracking-[0.4em] tabular-nums" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            {masked}
          </p>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={() => speakDutch(target)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F0F5FF] text-[#025dc7] text-[12px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff]"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Escuchar pista
          </button>
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={submitted}
        onKeyDown={e => { if (e.key === 'Enter' && !submitted) handleSubmit(); }}
        placeholder="Escribe la palabra completa…"
        className={`w-full px-4 py-3.5 rounded-xl text-[16px] font-medium border outline-none transition-colors duration-200 ${
          submitted
            ? isCorrect
              ? 'bg-green-50 border-green-400 text-green-800'
              : 'bg-red-50 border-red-400 text-red-700'
            : 'bg-white border-[#DDE6F5] text-[#1D0084] focus:border-[#025dc7]'
        }`}
      />
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-full py-3 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] disabled:bg-[#DDE6F5] disabled:text-[#9CA3AF] transition-colors duration-200"
        >
          Comprobar
        </button>
      )}
      {submitted && (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
          isCorrect
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {isCorrect ? '✓ ¡Correcto!' : `✗ La palabra era: "${target}"`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * PairMemoryExercise — clásico juego de memoria.
 * 2N cartas boca abajo; descubre 2 a la vez; si coinciden (NL↔ES) se quedan
 * descubiertas. Cuando todas están emparejadas, el ejercicio se completa.
 * Reutiliza `pairs` (igual que MatchPairs) — left=NL, right=ES.
 */
function PairMemoryExercise({ exercise, onAnswer }: { exercise: ExerciseItem; onAnswer: (correct: boolean, answer: string) => void }) {
  const pairs = exercise.pairs ?? [];

  type Card = { id: string; pairKey: string; text: string; side: 'left' | 'right' };
  const cards = useMemo<Card[]>(() => {
    const arr: Card[] = [];
    pairs.forEach((p, i) => {
      arr.push({ id: `L-${i}`, pairKey: String(i), text: p.left, side: 'left' });
      arr.push({ id: `R-${i}`, pairKey: String(i), text: p.right, side: 'right' });
    });
    // Fisher-Yates shuffle, deterministic per exercise
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [revealed, setRevealed] = useState<string[]>([]); // currently flipped (max 2)
  const [matched, setMatched] = useState<Set<string>>(new Set()); // matched pairKeys
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);

  function tryFlip(card: Card) {
    if (done) return;
    if (matched.has(card.pairKey)) return;
    if (revealed.includes(card.id)) return;
    if (revealed.length >= 2) return;

    const next = [...revealed, card.id];
    setRevealed(next);
    if (next.length === 2) {
      setAttempts(a => a + 1);
      const [aId, bId] = next;
      const a = cards.find(c => c.id === aId)!;
      const b = cards.find(c => c.id === bId)!;
      const isMatch = a.pairKey === b.pairKey && a.side !== b.side;
      setTimeout(() => {
        if (isMatch) {
          const newMatched = new Set(matched);
          newMatched.add(a.pairKey);
          setMatched(newMatched);
          setRevealed([]);
          if (newMatched.size === pairs.length) {
            setDone(true);
            const finalAttempts = attempts + 1;
            const perfect = finalAttempts === pairs.length;
            onAnswer(perfect, String(finalAttempts));
          }
        } else {
          setRevealed([]);
        }
      }, isMatch ? 350 : 700);
    }
  }

  function cardClass(card: Card) {
    const isRevealed = revealed.includes(card.id) || matched.has(card.pairKey);
    const isMatched = matched.has(card.pairKey);
    const base = 'aspect-[3/4] rounded-xl border-2 flex items-center justify-center text-center px-2 text-[13px] font-semibold transition-all duration-300 select-none';
    if (isMatched) return `${base} bg-green-50 border-green-300 text-green-800`;
    if (isRevealed) return `${base} bg-white border-[#1D0084] text-[#1D0084] shadow-sm`;
    return `${base} bg-[#1D0084] border-[#1D0084] text-white hover:bg-[#025dc7] active:scale-[0.97] cursor-pointer`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-1">Memory cards</p>
        <p className="text-[17px] font-semibold text-[#1D0084]">{exercise.prompt}</p>
        <p className="text-[12px] text-[#9CA3AF] mt-1">{matched.size}/{pairs.length} encontradas · {attempts} intentos</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map(card => {
          const isRevealed = revealed.includes(card.id) || matched.has(card.pairKey);
          return (
            <button
              key={card.id}
              onClick={() => tryFlip(card)}
              disabled={matched.has(card.pairKey) || done}
              className={cardClass(card)}
            >
              {isRevealed ? card.text : '?'}
            </button>
          );
        })}
      </div>
      {done && (
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
          attempts === pairs.length
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-[#FFF7ED] text-orange-700 border border-orange-200'
        }`}>
          {attempts === pairs.length
            ? `🎉 ¡Perfecto, sin errores! (${attempts} intentos)`
            : `✓ Completado con ${attempts} intentos (mínimo: ${pairs.length})`}
        </div>
      )}
    </div>
  );
}

/**
 * ListenTranslateExercise — escucha la frase NL y compón la traducción ES
 * con chips. La frase NL se muestra entre comillas en el prompt para que
 * TTS la pueda hablar (mismo patrón que ListenAndChoose).
 *
 *   prompt: "Escucha y traduce: \"Ik drink water in de ochtend\""
 *   correctAnswer: "Bebo agua por la mañana"
 *   options: ["Bebo", "agua", "por", "la", "mañana", "café"] (incluye distractores ES)
 */
function ListenTranslateExercise({ exercise, onAnswer }: { exercise: ExerciseItem; onAnswer: (correct: boolean, answer: string) => void }) {
  const match = exercise.prompt.match(/"([^"]+)"/);
  const dutchPhrase = match ? match[1] : exercise.prompt;
  const visibleHint = match
    ? exercise.prompt.replace(/\s*[:：]?\s*"[^"]+"\s*\.?\s*$/, '').trim() || 'Escucha y traduce al español'
    : 'Escucha y traduce al español';

  const [available, setAvailable] = useState<string[]>(() =>
    [...(exercise.options ?? [])].sort(() => Math.random() - 0.5)
  );
  const [sentence, setSentence] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const composed = sentence.join(' ');
  const isCorrect = composed.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

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
    onAnswer(isCorrect, composed);
  }
  function handleReset() {
    setAvailable([...(exercise.options ?? [])].sort(() => Math.random() - 0.5));
    setSentence([]);
    setSubmitted(false);
  }

  return (
    <div className="space-y-4">
      {/* Frase NL + audio */}
      <div className="rounded-2xl p-5 border border-[#DDE6F5] bg-white space-y-3">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">{visibleHint}</p>
        <p className="text-[20px] font-bold text-[#1D0084] leading-snug text-center" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
          {dutchPhrase}
        </p>
        <div className="flex justify-center">
          <button
            onClick={() => speakDutch(dutchPhrase)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D0084] text-white text-[13px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Escuchar
          </button>
        </div>
      </div>

      {/* Slot de la frase ES en construcción */}
      <div className="min-h-[52px] rounded-xl border-2 border-dashed border-[#DDE6F5] bg-white p-3 flex flex-wrap gap-2 items-center">
        {sentence.length === 0 && (
          <span className="text-[13px] text-[#9CA3AF]">Toca las palabras en español para componer la traducción…</span>
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

      {/* Chips disponibles (ES + distractores) */}
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
        <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${
          isCorrect ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {isCorrect
            ? '✓ ¡Correcto!'
            : `✗ La traducción correcta era: "${exercise.correctAnswer}"`}
          {exercise.explanation && <p className="mt-1 text-[13px] opacity-80">{exercise.explanation}</p>}
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
  if (exercise.type === 'listen_translate') return <ListenTranslateExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'fill_blank') return <FillBlankExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'order_sentence') return <OrderSentenceExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'word_scramble') return <WordScrambleExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'match_pairs') return <MatchPairsExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'true_false') return <TrueFalseExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'emoji_choice') return <EmojiChoiceExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'odd_one_out') return <OddOneOutExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'letter_dash') return <LetterDashExercise exercise={exercise} onAnswer={onAnswer} initialAnswer={initialAnswer} />;
  if (exercise.type === 'pair_memory') return <PairMemoryExercise exercise={exercise} onAnswer={onAnswer} />;
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
      <div className="space-y-5">
        {progressBar}
        {exercises.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl bg-[#FEF3C7] border border-[#FCD34D] px-4 py-3">
            <span className="text-[20px] shrink-0">💡</span>
            <p className="text-[13px] text-[#92400E] leading-snug">
              <strong>Primero intenta entenderlo en neerlandés.</strong> Cuando completes los ejercicios, podrás ver la traducción al español.
            </p>
          </div>
        )}
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">Texto en neerlandés</p>
          <div className="text-[16px] text-[#1D0084] leading-relaxed whitespace-pre-line font-medium text-left">
            {textNl.replace(/^[ \t]+/gm, '').trim()}
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
          <p className="text-[14px] text-[#5A6480] leading-relaxed whitespace-pre-line text-left">{textNl.replace(/^[ \t]+/gm, '').trim()}</p>
        </div>
        <div className="border-t border-[#DDE6F5] pt-4">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Traducción al español</p>
          <p className="text-[15px] text-[#1D0084] font-medium leading-relaxed whitespace-pre-line text-left">{textEs.replace(/^[ \t]+/gm, '').trim()}</p>
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

/**
 * Botón de audio por TTS (text-to-speech del navegador) para diálogos
 * que no tienen un archivo de audio grabado. No hay scrubber ni skip
 * porque TTS no se puede "rebobinar"; hace de fallback honesto.
 */
function DialogueTTSButton({
  lines,
  rate,
  accentColor,
}: {
  lines: { dutch: string }[];
  rate: number;
  accentColor: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  function toggle() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const fullText = lines.map(l => l.dutch).join('. ');
    const u = new SpeechSynthesisUtterance(fullText);
    u.lang = 'nl-NL';
    u.rate = rate;
    u.onend = () => setIsPlaying(false);
    window.speechSynthesis.speak(u);
    setIsPlaying(true);
  }

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-3 rounded-xl bg-[#F0F5FF] border border-[#DDE6F5] px-3 py-2 text-left hover:bg-[#e0eaff] transition-colors"
    >
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm"
        style={{ background: accentColor }}
      >
        {isPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </span>
      <span className="text-[12px] text-[#5A6480] font-medium">
        {isPlaying ? 'Pausar' : 'Escuchar (voz del navegador)'}
      </span>
    </button>
  );
}

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
  // Tres vistas: landing (solo audios + CTAs) → dialogue (transcript) → exercises
  const [view, setView] = useState<'landing' | 'dialogue' | 'exercises'>('landing');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [exKey, setExKey] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [exercisesDone, setExercisesDone] = useState(false);

  const exercise = practiceExercises[exerciseIndex];
  const pct = view !== 'exercises' ? 0
    : Math.round(((exerciseIndex + (answered ? 1 : 0)) / Math.max(practiceExercises.length, 1)) * 100);

  /* ── Vista 1: Landing — solo audios + 2 CTAs, texto oculto ─────────── */
  if (view === 'landing') {
    return (
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <h3 className="text-[22px] font-bold text-[#1D0084] leading-tight" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            {dialogue.title}
          </h3>
          <p className="text-[13px] text-[#5A6480]">Escucha primero el audio antes de leer el texto.</p>
        </div>

        {/* Dos audios: normal y lento */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-full bg-[#1D0084]/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#1D0084]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#1D0084] leading-tight">Velocidad normal</p>
                <p className="text-[11px] text-[#9CA3AF] leading-tight">Ritmo natural</p>
              </div>
            </div>
            {dialogue.audio?.url ? (
              <AudioPlayer src={dialogue.audio.url} />
            ) : (
              <DialogueTTSButton lines={dialogue.lines} rate={0.95} accentColor="#1D0084" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-full bg-[#1D0084]/10 flex items-center justify-center text-base">
                🐢
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#1D0084] leading-tight">Versión lenta</p>
                <p className="text-[11px] text-[#9CA3AF] leading-tight">Para entender cada palabra</p>
              </div>
            </div>
            {dialogue.slowAudio?.url ? (
              <AudioPlayer src={dialogue.slowAudio.url} />
            ) : (
              <DialogueTTSButton lines={dialogue.lines} rate={0.6} accentColor="#025dc7" />
            )}
          </div>
        </div>

        {/* Dos botones: ver el diálogo / ir a los ejercicios — misma altura */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => setView('dialogue')}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            Ver el diálogo
          </button>
          {hasExercises && (
            <button
              onClick={() => setView('exercises')}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-white border border-[#DDE6F5] text-[#1D0084] text-[15px] font-semibold hover:bg-[#F0F5FF] transition-colors duration-200"
            >
              Ir directamente a los ejercicios
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Vista 2: Diálogo — transcript estilo guión con traducción togglable ─ */
  if (view === 'dialogue') {
    return (
      <div className="space-y-4">
        {/* Cabecera: volver + toggle traducción */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setView('landing')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#5A6480] hover:text-[#1D0084] hover:bg-[#F0F5FF] transition-colors duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <button
            onClick={() => setShowTranslation(t => !t)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors duration-200 ${
              showTranslation
                ? 'bg-[#1D0084] text-white hover:bg-[#025dc7]'
                : 'bg-white border border-[#DDE6F5] text-[#1D0084] hover:bg-[#F0F5FF]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {showTranslation ? 'Ocultar traducción' : 'Ver traducción'}
          </button>
        </div>

        {/* Título arriba */}
        <div className="border-b border-[#DDE6F5] pb-3">
          <h3 className="text-[18px] font-bold text-[#1D0084] leading-snug" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            {dialogue.title}
          </h3>
        </div>

        {/* Transcript — estilo limpio tipo guión de libro */}
        <div className="space-y-4">
          {dialogue.lines.map(line => (
            <div key={line.id} className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                {line.speaker}
              </p>
              <p className="text-[16px] text-[#1D0084] leading-relaxed font-medium">
                {line.dutch}
              </p>
              {showTranslation && (
                <p className="text-[14px] text-[#5A6480] italic leading-relaxed">
                  {line.spanish}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* CTA a ejercicios */}
        {hasExercises && (
          <button
            onClick={() => setView('exercises')}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200 mt-6"
          >
            Ir a los ejercicios
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  /* ── Step 2: exercises ─────────────────────────────────── */

  // Results banner shown after last exercise
  if (exercisesDone) {
    return (
      <div className="space-y-4">
        <GradientBar pct={100} />
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-2xl">{score >= practiceExercises.length * 0.8 ? '🎉' : '📝'}</span>
          <div>
            <p className="text-white font-bold text-[15px]">{score} / {practiceExercises.length} correctas</p>
            <p className="text-white/60 text-[13px]">
              {score === practiceExercises.length ? '¡Perfecto!' : score >= practiceExercises.length * 0.8 ? '¡Muy bien!' : 'Sigue practicando'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setView('landing');
            setExerciseIndex(0);
            setScore(0);
            setAnswered(false);
            setExKey(k => k + 1);
            setExercisesDone(false);
          }}
          className="w-full py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
        >
          🔄 Volver al diálogo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <GradientBar pct={pct} />
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setView('landing'); setExerciseIndex(0); setScore(0); setAnswered(false); setExKey(k => k + 1); }}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#9CA3AF] hover:text-[#1D0084] transition-colors duration-200"
        >
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
      {exercise && (
        <div key={exKey}>
          <ExerciseStep
            exercise={exercise}
            onAnswer={(correct) => { setAnswered(true); if (correct) setScore(s => s + 1); }}
          />
        </div>
      )}
      {answered && (
        <button
          onClick={() => {
            if (exerciseIndex + 1 >= practiceExercises.length) {
              setExercisesDone(true);
            } else {
              setExerciseIndex(i => i + 1);
              setAnswered(false);
              setExKey(k => k + 1);
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
        >
          {exerciseIndex + 1 < practiceExercises.length ? 'Siguiente ejercicio' : 'Ver resultado'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
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
  nextLesson,
  moduleId,
}: {
  sections: SectionId[];
  completedSections: Set<SectionId>;
  onEnter: (s: SectionId) => void;
  nextLesson?: Lesson | null;
  moduleId?: string;
}) {
  const allComplete = sections.length > 0 && sections.every(s => completedSections.has(s));
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
      {allComplete && nextLesson && moduleId && (
        <Link
          href={`/modulo/${moduleId}/leccion/${nextLesson.id}`}
          className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-white text-[16px] font-bold transition-all duration-150 mt-2 brand-accent-line hover:brightness-110"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          Siguiente lección
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
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

export default function LessonViewer({ lesson, module, prevLesson: _prev, nextLesson }: LessonViewerProps) {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<SectionId>>(new Set());

  useEffect(() => {
    // Direct URL access (typically from Circle): mark all prior lessons as
    // completed so the in-app module list stays coherent for students who
    // progress via Circle rather than via our internal navigation.
    markPreviousAsCompleted(lesson);
    markLessonStarted(lesson.id, lesson.moduleId);
    const existing = getLessonProgress(lesson.id);
    if (existing?.status === 'completed') {
      // Pre-mark all sections as done for returning students
    }
  }, [lesson.id, lesson.moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Construye el mapa texto->audio_url para que los ejercicios usen MP3
  // de ElevenLabs en vez de TTS cuando hagan speakDutch().
  // Fuentes:
  //   - vocabulary_items.audio_url (con y sin artículo)
  //   - phrases.audio_url
  //   - practice_items con texto entre comillas (URL determinista en Storage)
  useEffect(() => {
    const map: Record<string, string> = {};
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    // slug local para reconstruir URLs deterministas (debe coincidir con generate-audio.mjs)
    const slug = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

    for (const block of lesson.blocks) {
      if (block.type === 'vocabulary') {
        for (const v of block.items) {
          // Palabra SIN artículo → audio_url en DB
          if (v.audio?.url) {
            map[v.dutch.trim().toLowerCase()] = v.audio.url;
          }
          // CON artículo → URL determinista (vocab/{lessonId}-{slug}-art.mp3)
          // El lesson_id no llega al cliente directamente; usamos un selector basado en
          // el patrón de la audio_url existente (extraemos {lessonId}-{slug}).
          if (v.article && supabaseUrl && v.audio?.url) {
            const articleUrl = v.audio.url.replace(/\.mp3$/, '-art.mp3');
            map[`${v.article} ${v.dutch}`.trim().toLowerCase()] = articleUrl;
          }
        }
      }
      if (block.type === 'phrases') {
        for (const p of block.items) {
          if (p.audio?.url) {
            map[p.dutch.trim().toLowerCase()] = p.audio.url;
          }
        }
      }
      if (block.type === 'practice' && supabaseUrl) {
        for (const ex of block.exercises) {
          // Listen_* → practice/{id}.mp3
          if (ex.type === 'listen_and_choose' || ex.type === 'listen_translate') {
            const m = ex.prompt.match(/"([^"]+)"/);
            if (m) {
              map[m[1].trim().toLowerCase()] = `${supabaseUrl}/storage/v1/object/public/nawar-audio/practice/${ex.id}.mp3`;
            }
          }
          // Fill_blank options → options/{slug(text)}.mp3 (compartido global)
          if (ex.type === 'fill_blank' && ex.options) {
            for (const opt of ex.options) {
              const text = opt.trim();
              if (!text) continue;
              const s = slug(text);
              if (!s) continue;
              map[text.toLowerCase()] = `${supabaseUrl}/storage/v1/object/public/nawar-audio/options/${s}.mp3`;
            }
          }
        }
      }
    }
    setWordAudioMap(map);
    return () => setWordAudioMap({});
  }, [lesson]);

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
    setCompletedSections(prev => {
      const next = new Set([...prev, id]);
      if (availableSections.length > 0 && availableSections.every(s => next.has(s))) {
        markLessonCompleted(lesson.id, lesson.moduleId, 0, 0, []);
      }
      return next;
    });
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
      <div className="relative brand-banner overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[700px] h-[500px]"
            style={{ background: 'radial-gradient(ellipse at center, rgba(11,109,240,0.30) 0%, transparent 65%)' }}
          />
        </div>
        <div aria-hidden className="absolute inset-0 dots-dark pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-8">
          <div className="flex items-center justify-between mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://docs.holandesnawar.com/img/Nawar.png"
              alt="Holandés Nawar"
              className="h-7 w-auto opacity-90"
            />
            <DarkModeToggle />
          </div>
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
            <>
              {/* Recordatorio: apunta tus errores (las respuestas no se guardan) */}
              <div className="rounded-2xl bg-[#FFF8E1] border border-[#F5D96A]/50 px-4 py-3 mb-6 flex gap-3">
                <span className="text-xl shrink-0" aria-hidden>📝</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#7A5A0E] leading-tight mb-0.5">
                    Consejo: apunta las palabras que falles
                  </p>
                  <p className="text-[12px] text-[#9C793B] leading-snug">
                    Tus respuestas no se guardan entre sesiones. Llevar un cuaderno con los errores te ayuda a repasarlos después.
                  </p>
                </div>
              </div>

              <SectionLanding
                sections={availableSections}
                completedSections={completedSections}
                onEnter={setActiveSection}
                nextLesson={nextLesson}
                moduleId={module.id}
              />
            </>
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
