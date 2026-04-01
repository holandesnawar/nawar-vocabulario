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


function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-[12px] font-medium text-[#9CA3AF]">
        <span>{label}</span>
        <span>{current} / {total}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#4da3ff] transition-all duration-500"
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

type VPStepType = 'words' | 'phrases' | 'listen' | 'truefalse' | 'test' | 'complete' | 'order' | 'classify' | 'write';

const VP_META: Record<VPStepType, { label: string; emoji: string }> = {
  words:     { label: 'Diccionario',     emoji: '📖' },
  phrases:   { label: 'Frases',          emoji: '💬' },
  listen:    { label: 'Escuchar',        emoji: '🎧' },
  truefalse: { label: 'Verdadero/Falso', emoji: '✅' },
  test:      { label: 'Test',            emoji: '🧪' },
  complete:  { label: 'Completar',       emoji: '✏️' },
  order:     { label: 'Ordenar',         emoji: '🔤' },
  classify:  { label: 'Clasificar',      emoji: '🗂️' },
  write:     { label: 'Escribir',        emoji: '✍️' },
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
  | { type: 'write';     exercises: ExerciseItem[] };

function isTrueFalse(e: ExerciseItem): boolean {
  if (e.type !== 'multiple_choice') return false;
  const opts = (e.options ?? []).map(o => o.toLowerCase().trim());
  return opts.length === 2 && (opts.includes('verdadero') || opts.includes('true')) && (opts.includes('falso') || opts.includes('false'));
}

function buildClassifyData(items: VocabularyItem[]): { groups: ClassifyGroup[]; items: ClassifyItemData[] } | null {
  const categories = [...new Set(items.map(i => i.category))];
  if (categories.length >= 2) {
    return {
      groups: categories.map(c => ({ id: c, label: c })),
      items: items.map(i => ({ dutch: i.dutch, groupId: i.category })),
    };
  }
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

  return steps;
}

/* ── Step bar ── */

function StepBar({ steps, current }: { steps: VPStep[]; current: number }) {
  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#1D0084]">
          {VP_META[steps[current].type].emoji} {VP_META[steps[current].type].label}
        </span>
        <span className="text-[12px] font-semibold text-[#9CA3AF]">
          Paso {current + 1} de {steps.length}
        </span>
      </div>
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
              i < current ? 'bg-[#4da3ff]' : i === current ? 'bg-[#1D0084]' : 'bg-[#DDE6F5]'
            }`}
          />
        ))}
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
      <div className="w-full flex items-center justify-center py-3" style={{ background: word.color }}>
        <span className="text-[28px] leading-none">{word.emoji}</span>
      </div>
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

function WordsStep({ items, onDone }: { items: VocabularyItem[]; onDone: () => void }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / VOCAB_PER_PAGE);
  const pageItems = items.slice(page * VOCAB_PER_PAGE, (page + 1) * VOCAB_PER_PAGE);
  const isLastPage = page + 1 >= totalPages;

  return (
    <div className="flex flex-col">
      <p className="text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">
        {items.length} palabras · página {page + 1} de {totalPages}
      </p>
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

function PhrasesStep({ items, onDone, onBack }: { items: PhraseItem[]; onDone: () => void; onBack: () => void }) {
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
  }

  return (
    <div className="space-y-6">
      <ProgressBar current={index + 1} total={items.length} label="Frases" />

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

      <div className="flex items-center justify-between gap-4">
        {index === 0 ? (
          <button onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
        ) : (
          <button onClick={() => navigate(index - 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>
        )}
        <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[120px]">
          {items.map((_, i) => (
            <button key={i} onClick={() => navigate(i)}
              className={`rounded-full transition-all duration-200 ${i === index ? 'w-5 h-2 bg-[#1D0084]' : i < index ? 'w-2 h-2 bg-[#4da3ff]' : 'w-2 h-2 bg-[#DDE6F5]'}`}
              aria-label={`Frase ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={() => { stopAudio(); if (isLast) onDone(); else navigate(index + 1); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D0084] text-white text-[14px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
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

function ExerciseRunner({ exercises, onDone, onBack }: { exercises: ExerciseItem[]; onDone: () => void; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [exKey, setExKey] = useState(0);
  const scoreRef = useRef(0);

  function handleAnswer(correct: boolean) {
    setAnswered(true);
    if (correct) { scoreRef.current += 1; setScore(scoreRef.current); }
  }

  function handleNext() {
    if (index + 1 >= exercises.length) {
      onDone();
    } else {
      setIndex(i => i + 1);
      setAnswered(false);
      setExKey(k => k + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <ProgressBar current={index + 1} total={exercises.length} label="Ejercicios" />
        <span className="shrink-0 text-[13px] font-semibold text-[#025dc7] bg-[#F0F5FF] px-3 py-1 rounded-full">{score} ✓</span>
      </div>
      <div key={exKey} className="w-full max-w-sm mx-auto">
        <ExerciseStep exercise={exercises[index]} onAnswer={handleAnswer} />
      </div>
      {answered && (
        <div className="flex items-center gap-3 max-w-sm mx-auto">
          <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <button onClick={handleNext} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
            {index + 1 < exercises.length ? 'Siguiente' : 'Siguiente paso'}
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
    <div className="space-y-6">
      <ProgressBar current={index + 1} total={queue.length} label="Clasificar" />

      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#DDE6F5] bg-white py-10 px-6 gap-3 text-center">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest">¿A qué grupo pertenece?</p>
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
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[14px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <button onClick={handleNext} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200">
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
  const [stepIndex, setStepIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [runnerKey, setRunnerKey] = useState(0);

  function handleStepBack() {
    if (stepIndex > 0) {
      setStepIndex(i => i - 1);
      setRunnerKey(k => k + 1);
    }
  }

  function handleStepDone() {
    if (stepIndex + 1 >= steps.length) {
      setAllDone(true);
    } else {
      setStepIndex(i => i + 1);
      setRunnerKey(k => k + 1);
    }
  }

  if (allDone) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center rounded-2xl bg-[#1D0084] py-10 px-6 gap-3" style={{ background: 'linear-gradient(135deg, #1D0084 0%, #025dc7 100%)' }}>
          <span className="text-5xl">⭐</span>
          <p className="text-white font-bold text-[20px]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>¡Práctica completada!</p>
          <p className="text-white/60 text-[14px]">Has repasado todas las secciones</p>
        </div>
        <button onClick={onComplete} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Volver a la lección
        </button>
      </div>
    );
  }

  const step = steps[stepIndex];

  return (
    <div>
      <StepBar steps={steps} current={stepIndex} />

      {step.type === 'words' && (
        <WordsStep key={runnerKey} items={vocabItems} onDone={handleStepDone} />
      )}
      {step.type === 'phrases' && (
        <PhrasesStep key={runnerKey} items={step.items} onDone={handleStepDone} onBack={handleStepBack} />
      )}
      {(step.type === 'listen' || step.type === 'truefalse' || step.type === 'test' || step.type === 'complete' || step.type === 'order' || step.type === 'write') && (
        <ExerciseRunner key={runnerKey} exercises={step.exercises} onDone={handleStepDone} onBack={handleStepBack} />
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
        <span className="text-[12px] font-semibold text-[#9CA3AF]">{index + 1} / {queue.length}</span>
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

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-[#DDE6F5] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#4da3ff] transition-all duration-300"
          style={{ width: `${((index) / queue.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXERCISE COMPONENTS (shared between Practice and Lezen)
───────────────────────────────────────────────────────────────────────────── */

function MultipleChoiceExercise({
  exercise,
  onAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const isAnswered = selected !== null;

  function handleSelect(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer);
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

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug">{exercise.prompt}</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        {exercise.options?.map(opt => (
          <button key={opt} className={optionStyle(opt)} onClick={() => handleSelect(opt)}>
            <span className="flex items-center justify-between gap-2">
              {opt}
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
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = value.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();

  function handleSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect);
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
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = value.trim().toLowerCase() === exercise.correctAnswer.trim().toLowerCase();
  const parts = exercise.prompt.split('___');

  function handleSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    onAnswer(isCorrect);
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
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const isAnswered = selected !== null;
  const match = exercise.prompt.match(/"([^"]+)"/);
  const dutchText = match ? match[1] : exercise.prompt;

  function handleSelect(opt: string) {
    if (isAnswered) return;
    setSelected(opt);
    onAnswer(opt === exercise.correctAnswer);
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

  return (
    <div className="space-y-4">
      <div className="bg-[#F0F5FF] rounded-2xl p-5 border border-[#DDE6F5]">
        <p className="text-[16px] font-semibold text-[#1D0084] leading-snug mb-3">{exercise.prompt}</p>
        {exercise.audio?.url ? (
          <AudioPlayer src={exercise.audio.url} compact />
        ) : (
          <button
            onClick={() => speakDutch(dutchText)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D0084] text-white text-[13px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728" />
            </svg>
            Escuchar
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        {exercise.options?.map(opt => (
          <button key={opt} className={optionStyle(opt)} onClick={() => handleSelect(opt)}>
            <span className="flex items-center justify-between gap-2">
              {opt}
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
  onAnswer: (correct: boolean) => void;
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
    onAnswer(isCorrect);
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

function ExerciseStep({
  exercise,
  onAnswer,
}: {
  exercise: ExerciseItem;
  onAnswer: (correct: boolean) => void;
}) {
  if (exercise.type === 'multiple_choice') return <MultipleChoiceExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'write_answer') return <WriteAnswerExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'listen_and_choose') return <ListenAndChooseExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'order_sentence') return <OrderSentenceExercise exercise={exercise} onAnswer={onAnswer} />;
  if (exercise.type === 'fill_blank') return <FillBlankExercise exercise={exercise} onAnswer={onAnswer} />;
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   LEZEN SECTION
───────────────────────────────────────────────────────────────────────────── */

function LezenSection({
  textNl,
  textEs,
  exercises,
  onComplete,
}: {
  textNl: string;
  textEs: string;
  exercises: ExerciseItem[];
  onComplete: () => void;
}) {
  const [step, setStep] = useState<'text' | 'exercises' | 'translation'>('text');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [exKey, setExKey] = useState(0);

  const exercise = exercises[exerciseIndex];

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

  if (step === 'text') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">Texto en neerlandés</p>
          <div
            className="text-[16px] text-[#1D0084] leading-relaxed whitespace-pre-wrap font-medium"
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
          >
            {textNl}
          </div>
        </div>

        {exercises.length > 0 && (
          <button
            onClick={() => setStep('exercises')}
            className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            Ir a los ejercicios →
          </button>
        )}
        {exercises.length === 0 && (
          <button
            onClick={() => setStep('translation')}
            className="w-full py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            Ver traducción →
          </button>
        )}
      </div>
    );
  }

  if (step === 'exercises' && exercise) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <ProgressBar current={exerciseIndex + 1} total={exercises.length} label="Ejercicios" />
          <span className="shrink-0 text-[13px] font-semibold text-[#025dc7] bg-[#F0F5FF] px-3 py-1 rounded-full">
            {score} ✓
          </span>
        </div>

        <div key={exKey} className="w-full max-w-sm mx-auto">
          <ExerciseStep exercise={exercise} onAnswer={handleAnswer} />
        </div>

        {answered && (
          <button
            onClick={handleNext}
            className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1D0084] text-white text-[15px] font-semibold hover:bg-[#025dc7] transition-colors duration-200"
          >
            {exerciseIndex + 1 < exercises.length ? (
              <>
                Siguiente
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            ) : (
              <>
                Ver traducción del texto
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // translation step
  return (
    <div className="space-y-6">
      {exercises.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#1D0084] px-5 py-4">
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
          <p className="text-[14px] text-[#5A6480] leading-relaxed whitespace-pre-wrap">{textNl}</p>
        </div>
        <div className="border-t border-[#DDE6F5] pt-4">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Traducción al español</p>
          <p className="text-[15px] text-[#1D0084] font-medium leading-relaxed whitespace-pre-wrap">{textEs}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => { setStep('exercises'); setExerciseIndex(0); setScore(0); setAnswered(false); setExKey(k => k + 1); }}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
        >
          🔄 Repetir ejercicios
        </button>
        <button
          onClick={onComplete}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Volver a la lección
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LUISTEREN (DIALOGUE) SECTION
───────────────────────────────────────────────────────────────────────────── */

function LuisterenSection({
  dialogue,
  onComplete,
}: {
  dialogue: Dialogue;
  onComplete: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [shownLines, setShownLines] = useState<Set<string>>(new Set());
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  function toggleLine(id: string) {
    if (showAll) {
      setHiddenLines(s => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setShownLines(s => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
  }

  function handleGlobalToggle() {
    setShowAll(v => !v);
    setShownLines(new Set());
    setHiddenLines(new Set());
  }

  function lineVisible(id: string): boolean {
    return showAll ? !hiddenLines.has(id) : shownLines.has(id);
  }

  const speakerColors: Record<string, string> = {};
  const colorList = ['#1D0084', '#025dc7', '#0b4db5', '#0a3d9e', '#1440a0'];
  dialogue.lines.forEach(line => {
    if (!speakerColors[line.speaker]) {
      const idx = Object.keys(speakerColors).length % colorList.length;
      speakerColors[line.speaker] = colorList[idx];
    }
  });

  return (
    <div className="space-y-6">
      {dialogue.audio?.url && (
        <AudioPlayer src={dialogue.audio.url} title={`Audio: ${dialogue.title}`} />
      )}
      {dialogue.slowAudio?.url && (
        <AudioPlayer src={dialogue.slowAudio.url} title="Audio lento" />
      )}

      <div className="bg-[#F0F5FF] rounded-2xl p-4 border border-[#DDE6F5]">
        <h3
          className="text-[16px] font-bold text-[#1D0084] mb-1"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
        >
          {dialogue.title}
        </h3>
        <p className="text-[13px] text-[#5A6480]">{dialogue.context}</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleGlobalToggle}
          className="text-[13px] font-semibold text-[#025dc7] hover:text-[#1D0084] transition-colors duration-200"
        >
          {showAll ? 'Ocultar todas las traducciones' : 'Mostrar todas las traducciones'}
        </button>
      </div>

      <div className="space-y-3">
        {dialogue.lines.map(line => {
          const color = speakerColors[line.speaker] ?? '#1D0084';
          const show = lineVisible(line.id);
          return (
            <div key={line.id} className="bg-white rounded-2xl border border-[#DDE6F5] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white shrink-0"
                  style={{ background: color }}
                >
                  {line.speaker}
                </span>
              </div>
              <p className="text-[15px] font-medium text-[#1D0084] leading-snug">{line.dutch}</p>
              {line.audio?.url ? (
                <AudioPlayer src={line.audio.url} compact />
              ) : (
                <button
                  onClick={() => speakDutch(line.dutch)}
                  className="self-start inline-flex items-center gap-1.5 text-[12px] font-medium text-[#025dc7] hover:text-[#1D0084]"
                  aria-label="Escuchar"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728" />
                  </svg>
                  Escuchar
                </button>
              )}
              <button
                onClick={() => toggleLine(line.id)}
                className="self-start text-[11px] font-semibold text-[#9CA3AF] hover:text-[#025dc7] transition-colors duration-200 px-2 py-0.5 rounded-md hover:bg-[#F0F5FF]"
              >
                {show ? 'Ocultar traducción' : 'Ver traducción'}
              </button>
              {show && (
                <p className="text-[13px] text-[#5A6480] leading-snug border-t border-[#DDE6F5] pt-2 mt-1">{line.spanish}</p>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onComplete}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#F0F5FF] text-[#1D0084] text-[15px] font-semibold border border-[#DDE6F5] hover:bg-[#e0eaff] transition-colors duration-200"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        </svg>
        Volver a la lección
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
        <div className={`mx-auto px-6 ${activeSection === 'vocabulary' ? 'max-w-4xl' : 'max-w-2xl'}`}>

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
              onComplete={() => completeSection('luisteren')}
            />
          )}

        </div>
      </div>
    </>
  );
}
